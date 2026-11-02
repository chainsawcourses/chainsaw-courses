// Creates unsigned standalone Xcode handoffs. Never signs or uploads to Apple.
import { cp, mkdir, readFile, writeFile, rm, realpath } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const localPurchases = process.argv.includes("--local-storekit");
const testFlight = process.argv.includes("--testflight");
if (testFlight && localPurchases) throw new Error("TestFlight cannot use local simulated purchases.");
const url = new URL(process.argv[2] || "");
const validHost = testFlight ? url.hostname === "app.chainsawcourses.com" : url.hostname.endsWith(".replit.dev");
if (url.protocol !== "https:" || !validHost || url.port || url.pathname !== "/" || url.username || url.password || url.search || url.hash) {
  throw new Error(testFlight ? "Provide the verified HTTPS production app origin for TestFlight." : "Provide the HTTPS development preview origin for this sandbox-only handoff.");
}
const out = path.join(root, "generated-artifacts/apple-storekit");
const packageName = testFlight ? "Chainsaw-Courses-TestFlight-1.0.7-Build9" : localPurchases ? "Chainsaw-Courses-Local-Purchases" : "Chainsaw-Courses-StoreKit-Sandbox";
const project = path.join(out, packageName);
await mkdir(out, { recursive: true });
await rm(project, { recursive: true, force: true });
await cp(path.join(root, "artifacts/chainsaw-training/ios/App"), project, {
  recursive: true,
  filter(source) {
    return !/(^|\/)(public|xcuserdata|DerivedData|build|\.DS_Store)(\/|$)/.test(source)
      && !(testFlight && (source.endsWith(".storekit") || source.endsWith(".xcscheme")));
  },
});
// The hosted sandbox UI is served by the development workflow. Keep only the
// native offline/error shell, not stale protected assets or release packages.
const publicDir = path.join(project, "App/public");
await mkdir(publicDir, { recursive: true });
await cp(path.join(root, "artifacts/chainsaw-training/ios/App/App/public/native-error.html"), path.join(publicDir, "native-error.html"));
const configPath = path.join(project, "App/capacitor.config.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
config.appId = "com.overleafpublishers.chainsawcourses";
config.server = { ...config.server, url: url.origin, cleartext: false, allowNavigation: [url.hostname] };
await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
const spm = path.join(project, "CapApp-SPM/Package.swift");
let manifest = await readFile(spm, "utf8");
for (const [name, pkg] of [["CapacitorFilesystem", "filesystem"], ["CapacitorShare", "share"]]) {
  const source = await realpath(path.join(root, `artifacts/chainsaw-training/node_modules/@capacitor/${pkg}`));
  await cp(source, path.join(project, "Vendor", name), {
    recursive: true, filter: sourcePath => !path.relative(source, sourcePath).split(path.sep).includes("node_modules"),
  });
  await readFile(path.join(project, "Vendor", name, "Package.swift"));
  manifest = manifest.replace(new RegExp(`(\\.package\\(name: "${name}", path: ")[^"]+(")`, "g"), `$1../Vendor/${name}$2`);
}
if (manifest.includes("node_modules") || manifest.includes("/home/runner")) throw new Error("Non-portable Swift package path");
await writeFile(spm, manifest);
const pbx = path.join(project, "App.xcodeproj/project.pbxproj");
let source = await readFile(pbx, "utf8");
if (!source.includes("AppleStorePlugin.swift in Sources")) throw new Error("StoreKit source missing from target");
// A candidate build number only: check App Store Connect before any upload.
source = source.replaceAll("CURRENT_PROJECT_VERSION = 7;", "CURRENT_PROJECT_VERSION = 8;");
if (testFlight) {
  source = source.replace(/CURRENT_PROJECT_VERSION = \d+;/g, "CURRENT_PROJECT_VERSION = 9;");
  source = source.replace(/MARKETING_VERSION = [^;]+;/g, "MARKETING_VERSION = 1.0.7;");
  const schemes = path.join(project, "App.xcodeproj/xcshareddata/xcschemes");
  await mkdir(schemes, { recursive: true });
  await cp(path.join(root, "docs/apple-testflight/App.xcscheme"), path.join(schemes, "App.xcscheme"));
}
// The standalone handoff moves App out of ios; keep SOURCE_ROOT references portable.
await cp(path.join(root, "artifacts/chainsaw-training/ios/debug.xcconfig"), path.join(project, "debug.xcconfig"));
source = source.replaceAll("path = ../debug.xcconfig;", "path = debug.xcconfig;");
if (localPurchases) {
  const templates = path.join(root, "docs/apple-local-storekit");
  await cp(path.join(templates, "ChainsawCourses-Local.storekit"), path.join(project, "ChainsawCourses-Local.storekit"));
  const schemes = path.join(project, "App.xcodeproj/xcshareddata/xcschemes");
  await mkdir(schemes, { recursive: true });
  await cp(path.join(templates, "Local-Purchases.xcscheme"), path.join(schemes, "Local-Purchases.xcscheme"));
  source = source.replace("/* Begin PBXFileReference section */", `/* Begin PBXFileReference section */
ACAA00000000000000000020 /* ChainsawCourses-Local.storekit */ = {isa = PBXFileReference; lastKnownFileType = text; path = "ChainsawCourses-Local.storekit"; sourceTree = "<group>"; };`);
  source = source.replace("children = (\n958DCC722DB07C7200EA8C5F", "children = (\nACAA00000000000000000020 /* ChainsawCourses-Local.storekit */,\n958DCC722DB07C7200EA8C5F");
}
await writeFile(pbx, source);
await cp(path.join(root, testFlight ? "docs/apple-testflight/READ-ME-FIRST.md" : localPurchases ? "docs/apple-local-storekit/READ-ME-FIRST.md" : "docs/apple-storekit-setup.md"), path.join(project, "READ-ME-FIRST.md"));
const archive = path.join(out, `${packageName}.zip`);
await rm(archive, { force: true });
execFileSync("zip", ["-qr", archive, path.basename(project)], { cwd: out });
const bytes = await readFile(archive);
const checksum = createHash("sha256").update(bytes).digest("hex");
await writeFile(archive + ".sha256", `${checksum}  ${path.basename(archive)}\n`);
console.log(`Created unsigned ${testFlight ? "TestFlight" : "sandbox"} Xcode handoff (${Math.round(bytes.length / 1024)} KiB), SHA-256 ${checksum}`);
