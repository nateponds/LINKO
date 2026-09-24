import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HERO_VIDEO } from "./heroVideo.js";

test("hero recording uses the documented public video handoff path", () => {
  assert.equal(HERO_VIDEO.src, "/videos/linko-product-tour.mp4");
  assert.deepEqual(HERO_VIDEO.chapters, [
    "Discover suppliers",
    "Review listed product prices",
    "Manage orders",
    "Track deliveries",
  ]);
});

test("product tour supports native playback controls and reduced motion", async () => {
  const component = await readFile(
    new URL("./HeroVideoPreview.jsx", import.meta.url),
    "utf8",
  );

  assert.match(component, /controls/);
  assert.match(component, /autoPlay=\{!prefersReducedMotion\}/);
  assert.match(component, /loop=\{!prefersReducedMotion\}/);
  assert.match(component, /videoRef\.current\?\.pause\(\)/);
  assert.match(component, /The product tour could not be loaded/);
  assert.doesNotMatch(component, /recording is ready|bulk pricing/i);
});
