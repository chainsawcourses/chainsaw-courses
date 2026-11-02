import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = path.resolve(
  process.env.MOBILE_PACKAGE_CHECK_ROOT ?? import.meta.dirname,
  process.env.MOBILE_PACKAGE_CHECK_ROOT ? "." : "..",
);

const protectedAssetRoots = [
  "artifacts/chainsaw-training/public",
  "artifacts/chainsaw-training/dist/public",
  "artifacts/chainsaw-training/android/app/src/main/assets",
  "artifacts/chainsaw-training/ios/App/App/public",
];

const forbiddenExtensions = new Set([".aab", ".apk", ".apks", ".ipa", ".xapk", ".zip"]);

async function findForbiddenPackages(relativeDirectory) {
  const absoluteDirectory = path.join(workspaceRoot, relativeDirectory);
  let entries;

  try {
    entries = await readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const matches = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findForbiddenPackages(relativePath)));
      continue;
    }

    if (entry.isFile() && forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) {
      matches.push(relativePath);
    }
  }

  return matches;
}

const matches = (
  await Promise.all(protectedAssetRoots.map(findForbiddenPackages))
).flat();

if (matches.length > 0) {
  console.error(
    [
      "Mobile install or release packages must not be stored in public web or native asset directories.",
      "Move release deliverables to exports/ instead:",
      ...matches.sort().map((file) => `  - ${file}`),
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log("Mobile package boundary check passed.");
}