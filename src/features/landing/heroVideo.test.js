import test from "node:test";
import assert from "node:assert/strict";
import { HERO_VIDEO } from "./heroVideo.js";

test("hero recording uses the documented public video handoff path", () => {
  assert.equal(HERO_VIDEO.src, "/videos/linko-product-tour.mp4");
  assert.deepEqual(HERO_VIDEO.chapters, [
    "Discover suppliers",
    "Compare bulk pricing",
    "Manage orders",
    "Track deliveries",
  ]);
});
