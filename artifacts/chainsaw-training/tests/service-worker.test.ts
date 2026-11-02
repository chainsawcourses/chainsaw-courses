import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import vm from "node:vm";
import { isAdminRoute, registerProductionServiceWorker } from "../src/lib/pwaServiceWorker.ts";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const pushSource = await readFile(new URL("../src/hooks/usePushNotifications.ts", import.meta.url), "utf8");
const execFileAsync = promisify(execFile);

async function assertMissing(path: string) {
  await assert.rejects(access(new URL(path, import.meta.url)));
}

function createWorker(now = 1_000_000, scope = "https://course.test/") {
  const handlers = new Map<string, (event: any) => void>();
  const entries = new Map<string, Response>();
  const clients = new Map<string, { url: string; postMessage: (message: any) => void }>();
  let fetchImpl: (request: Request) => Promise<Response> = async () => { throw new Error("offline"); };
  const caches = {
    open: async () => ({
      put: async (request: Request | string, response: Response) => { entries.set(typeof request === "string" ? request : request.url, response); },
      delete: async (request: Request | string) => entries.delete(typeof request === "string" ? request : request.url),
      addAll: async () => {},
    }),
    match: async (request: Request | string) => entries.get(typeof request === "string" ? request : request.url),
    keys: async () => [],
    delete: async () => true,
  };
  const self = {
    location: { origin: "https://course.test" },
    addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [...clients.values()], get: async (id: string) => clients.get(id) },
    registration: { scope },
  };
  vm.runInNewContext(source, {
    self, caches, fetch: (request: Request) => fetchImpl(request), URL, Request, Response, Headers,
    Date: { now: () => now }, indexedDB: {},
  });
  return {
    entries,
    clients,
    setFetch(fn: typeof fetchImpl) { fetchImpl = fn; },
    async dispatch(request: Request, clientId?: string) {
      let responsePromise: Promise<Response | undefined> | undefined;
      handlers.get("fetch")!({ request, clientId, respondWith: (value: Promise<Response | undefined>) => { responsePromise = value; } });
      return responsePromise;
    },
    async activate() {
      let done: Promise<unknown> | undefined;
      handlers.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { done = promise; } });
      await done;
    },
    setNow(value: number) { now = value; },
  };
}

test("admin route boundary matches only admin paths beneath the active base", () => {
  for (const base of ["/", "/chainsaw-training/", "/courses/app/"]) {
    const prefix = base === "/" ? "" : base.replace(/\/$/, "");
    for (const path of ["/admin", "/admin/dashboard", "/admin/students/1", "/admin-preview"]) {
      assert.equal(isAdminRoute(`${prefix}${path}`, base), true, `${base}${path}`);
    }
    for (const path of ["/", "/training", "/training/1", "/administrator", "/administer"]) {
      assert.equal(isAdminRoute(`${prefix}${path}`, base), false, `${base}${path}`);
    }
  }
  assert.equal(isAdminRoute("/admin/dashboard", "/courses/app/"), false);
});

test("signed-in admin navigation is not registered or reloaded by learner update events", async () => {
  const swEvents = new Map<string, (event: any) => void>();
  const windowEvents = new Map<string, (event: any) => void>();
  let reloads = 0;
  let registrations = 0;
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const location = { pathname: "/courses/app/admin" };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { ...location, reload: () => { reloads++; } },
      addEventListener: (name: string, fn: (event: any) => void) => windowEvents.set(name, fn) },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: {
      addEventListener: (name: string, fn: (event: any) => void) => swEvents.set(name, fn),
      register: async () => { registrations++; return { update: async () => {} }; },
    } },
  });
  try {
    registerProductionServiceWorker("/courses/app/", "/courses/app");
    assert.equal(swEvents.size, 0);
    assert.equal(windowEvents.size, 0);

    // A learner tab may already have listeners when it navigates to admin.
    window.location.pathname = "/courses/app/training";
    registerProductionServiceWorker("/courses/app/", "/courses/app");
    windowEvents.get("load")!({});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(registrations, 1);
    window.location.pathname = "/courses/app/admin/dashboard"; // after sign-in
    swEvents.get("controllerchange")!({});
    swEvents.get("message")!({ data: { type: "SW_UPDATED" } });
    windowEvents.get("pageshow")!({ persisted: true });
    assert.equal(reloads, 0);
    window.location.pathname = "/courses/app/training";
    swEvents.get("controllerchange")!({});
    swEvents.get("message")!({ data: { type: "SW_UPDATED" } });
    assert.equal(reloads, 1);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
  }
});

test("admin navigation and assets never receive offline shell or cached responses", async () => {
  for (const scope of ["https://course.test/", "https://course.test/courses/app/"]) {
    const worker = createWorker(1_000_000, scope);
    const prefix = scope.endsWith("/courses/app/") ? "/courses/app" : "";
    worker.entries.set("/offline.html", new Response("offline shell"));
    assert.equal(await worker.dispatch({ method: "GET", url: `https://course.test${prefix}/admin/dashboard`, mode: "navigate" } as Request), undefined);
    assert.equal(await worker.dispatch(new Request(`https://course.test${prefix}/admin/students/1`)), undefined);
    worker.clients.set("admin", { url: `https://course.test${prefix}/admin/dashboard`, postMessage: () => {} });
    worker.entries.set("https://course.test/assets/app.js", new Response("stale bundle"));
    assert.rejects(worker.dispatch(new Request("https://course.test/assets/app.js"), "admin"));
  }
});

test("worker update notifications exclude admin windows but reach learner windows", async () => {
  const worker = createWorker();
  const messages: string[] = [];
  for (const path of ["/admin/dashboard", "/chainsaw-training/admin/dashboard", "/training"]) {
    worker.clients.set(path, { url: `https://course.test${path}`, postMessage: () => messages.push(path) });
  }
  await worker.activate();
  assert.deepEqual(messages, ["/training"]);
});

test("/api course and auth responses are never cache-served", async () => {
  const worker = createWorker();
  worker.setFetch(async () => new Response("network"));
  assert.equal(await worker.dispatch(new Request("https://course.test/api/course/1")), undefined);
  assert.equal(await worker.dispatch(new Request("https://course.test/api/auth/me")), undefined);
  assert.equal(worker.entries.size, 0);
});

test("native app containers cannot register the browser PWA worker", () => {
  assert.match(mainSource, /if \(Capacitor\.isNativePlatform\(\)\)/);
  assert.match(mainSource, /\.getRegistrations\(\)/);
  assert.match(mainSource, /else if \("serviceWorker" in navigator\)/);
  assert.match(
    pushSource,
    /Capacitor\.isNativePlatform\(\) \|\| !\("serviceWorker" in navigator\)/,
  );
});

test("manual and course-content assets are never cached or served offline", async () => {
  const worker = createWorker();
  worker.setFetch(async () => new Response("manual page"));
  assert.equal(await worker.dispatch(new Request("https://course.test/manual-pages/page-1.pdf")), undefined);
  assert.equal(await worker.dispatch(new Request("https://course.test/course-content/module-1.json")), undefined);
  assert.equal(worker.entries.size, 0);
});

test("authenticated manual API responses remain network-only", async () => {
  const worker = createWorker();
  worker.setFetch(async () => new Response("protected manual page"));
  assert.equal(
    await worker.dispatch(new Request("https://course.test/api/documents/manual/pages/page-000.jpg")),
    undefined,
  );
  assert.equal(worker.entries.size, 0);
});

test("assessment images are never cached or served offline", async () => {
  const worker = createWorker();
  worker.setFetch(async () => new Response("protected assessment image"));
  assert.equal(
    await worker.dispatch(new Request("https://course.test/api/assessment-images/bundled/air-filter.jpg")),
    undefined,
  );
  assert.equal(await worker.dispatch(new Request("https://course.test/question-images/air-filter.jpg")), undefined);
  assert.equal(worker.entries.size, 0);
});

test("manual source files cannot return to web or native public bundles", async () => {
  await Promise.all([
    assertMissing("../public/manual-pages"),
    assertMissing("../public/pdfs/manual.pdf"),
    assertMissing("../dist/public/manual-pages"),
    assertMissing("../dist/public/pdfs/manual.pdf"),
    assertMissing("../android/app/src/main/assets/public/manual-pages"),
    assertMissing("../android/app/src/main/assets/public/pdfs/manual.pdf"),
    assertMissing("../ios/App/App/public/manual-pages"),
    assertMissing("../ios/App/App/public/pdfs/manual.pdf"),
  ]);
});

test("assessment images cannot return to web or native public bundles", async () => {
  await Promise.all([
    assertMissing("../public/question-images"),
    assertMissing("../dist/public/question-images"),
    assertMissing("../android/app/src/main/assets/public/question-images"),
    assertMissing("../ios/App/App/public/question-images"),
  ]);
});

test("built Android release archives do not contain assessment images", async () => {
  for (const archive of [
    "../android/app/build/outputs/apk/release/app-release.apk",
    "../android/app/build/outputs/bundle/release/app-release.aab",
  ]) {
    try {
      await access(new URL(archive, import.meta.url));
    } catch {
      continue;
    }
    const { stdout } = await execFileAsync("unzip", ["-l", new URL(archive, import.meta.url).pathname]);
    assert.doesNotMatch(stdout, /assets\/public\/question-images\//);
  }
});

test("navigation only falls back to the offline shell", async () => {
  const worker = createWorker();
  worker.entries.set("/offline.html", new Response("offline shell"));
  const response = await worker.dispatch({ method: "GET", url: "https://course.test/training/1", mode: "navigate" } as Request);
  assert.equal(await response?.text(), "offline shell");
});

test("cached static assets expire instead of being usable indefinitely", async () => {
  const worker = createWorker();
  worker.setFetch(async () => new Response("bundle"));
  const request = new Request("https://course.test/assets/course.js");
  assert.equal(await (await worker.dispatch(request))?.text(), "bundle");
  worker.setFetch(async () => { throw new Error("offline"); });
  worker.setNow(1_000_000 + 7 * 24 * 60 * 60 * 1000 - 1);
  assert.equal(await (await worker.dispatch(request))?.text(), "bundle");
  worker.setNow(1_000_000 + 7 * 24 * 60 * 60 * 1000);
  assert.equal(await worker.dispatch(request), undefined);
  assert.equal(worker.entries.has(request.url), false);
});