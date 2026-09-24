import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("skeleton shimmer is disabled when reduced motion is requested", () => {
  const css = readFileSync(new URL("./Skeleton.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  assert.match(css, /\.skeleton::after\s*\{[^}]*animation:\s*none/s);
});
