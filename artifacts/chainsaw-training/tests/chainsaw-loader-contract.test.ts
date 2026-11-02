import { test } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

test("ChainsawLoader contract", async (t) => {
  await t.test("provides accessible defaults and accepts custom labels", () => {
    const compPath = path.resolve(process.cwd(), "src/components/ui/chainsaw-loader.tsx");
    const compContent = fs.readFileSync(compPath, "utf-8");
    assert.ok(compContent.includes('role="status"'), "must have role=status");
    assert.ok(compContent.includes('"aria-label": ariaLabel = "Loading"'), "must have default aria-label property");
    assert.ok(compContent.includes("chainsaw-loader-root"), "must expose a stable loader marker");
    assert.ok(compContent.includes('className="chainsaw-chain-path"'), "must include the chain path class");
    assert.ok(compContent.includes('<circle cx="12" cy="12"'), "must use a circular guide bar");
    assert.ok(!compContent.includes("<line "), "must not render a centre line");
    assert.ok(
      compContent.includes("Array.from({ length: 11 })") && compContent.includes("/ 14)"),
      "must leave a three-link spinner gap while retaining fourteen path positions"
    );
  });

  await t.test("index.css includes reduced-motion media query for animation", () => {
    const cssPath = path.resolve(process.cwd(), "src/index.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    assert.ok(cssContent.includes("@media (prefers-reduced-motion: reduce)"), "must include reduced-motion query");
    assert.ok(
      cssContent.includes(".chainsaw-chain-path") && cssContent.includes("animation: none"),
      "must disable animation for chainsaw-chain-path under reduced motion"
    );
  });
});
