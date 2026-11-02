import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { configureNixWebKitRuntime } from "./nix-webkit-runtime.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "webkit-runtime-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const lib = path.join(root, "lib");
  const vendors = path.join(root, "share/glvnd/egl_vendor.d");
  const plugins = path.join(lib, "gstreamer-1.0");
  const scanner = path.join(root, "libexec/gstreamer-1.0/gst-plugin-scanner");
  for (const dir of [vendors, plugins, path.dirname(scanner)]) {
    mkdirSync(dir, { recursive: true });
  }
  const manifest = path.join(vendors, "50_mesa.json");
  writeFileSync(manifest, "{}");
  writeFileSync(path.join(vendors, "README"), "not a vendor");
  writeFileSync(scanner, "");
  return { lib, manifest, plugins, scanner };
}

test("discovers explicit EGL manifests and GStreamer split outputs without store paths", (t) => {
  const { lib, manifest, plugins, scanner } = fixture(t);
  const env = { NIX_LDFLAGS: `-rpath ignored -L${lib} -L${lib} -L/missing-output/lib` };
  configureNixWebKitRuntime(env);
  assert.equal(env.__EGL_VENDOR_LIBRARY_FILENAMES, manifest);
  assert.equal(env.GST_PLUGIN_SYSTEM_PATH_1_0, plugins);
  assert.equal(env.GST_PLUGIN_SCANNER, scanner);
  assert.equal(env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS, "1");
  assert.equal(env.LIBGL_ALWAYS_SOFTWARE, undefined);
});

test("uses active Nix vendors instead of inherited image vendors, preserving media overrides", (t) => {
  const { lib, manifest } = fixture(t);
  for (const vendorKey of ["__EGL_VENDOR_LIBRARY_FILENAMES", "__EGL_VENDOR_LIBRARY_DIRS"]) {
    const env = {
      NIX_LDFLAGS: `-L${lib}`,
      [vendorKey]: "/custom/vendor",
      GST_PLUGIN_SYSTEM_PATH_1_0: "/custom/plugins",
      GST_PLUGIN_SCANNER: "/custom/scanner",
      PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: "0",
    };
    configureNixWebKitRuntime(env);
    assert.equal(env.__EGL_VENDOR_LIBRARY_FILENAMES, manifest);
    if (vendorKey.endsWith("DIRS")) assert.equal(env.__EGL_VENDOR_LIBRARY_DIRS, "/custom/vendor");
    assert.equal(env.GST_PLUGIN_SYSTEM_PATH_1_0, "/custom/plugins");
    assert.equal(env.GST_PLUGIN_SCANNER, "/custom/scanner");
    assert.equal(env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS, "0");
  }
});

test("leaves non-Nix hosts untouched and handles absent split outputs", () => {
  const plain = { OTHER: "unchanged" };
  configureNixWebKitRuntime(plain);
  assert.deepEqual(plain, { OTHER: "unchanged" });
  const missing = { NIX_LDFLAGS: "-L/missing-output/lib", __EGL_VENDOR_LIBRARY_FILENAMES: "/external/vendor.json" };
  configureNixWebKitRuntime(missing);
  assert.equal(missing.__EGL_VENDOR_LIBRARY_FILENAMES, "/external/vendor.json");
  assert.equal(missing.GST_PLUGIN_SCANNER, undefined);
  assert.equal(missing.GST_PLUGIN_SYSTEM_PATH_1_0, undefined);
});