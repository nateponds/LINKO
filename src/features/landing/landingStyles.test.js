import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("hero arc stays below the trust row", async () => {
  const css = await readFile(
    new URL("../../assets/css/landing.css", import.meta.url),
    "utf8",
  );
  const arcBlock = css.match(/\.landing-hero::after\s*\{([^}]*)\}/)?.[1];

  assert.ok(arcBlock, "hero arc styles must exist");

  const bottomOffset = Number(arcBlock.match(/bottom:\s*(-?\d+)px/)?.[1]);
  assert.ok(
    bottomOffset <= -235,
    `hero arc bottom offset must be -235px or lower; received ${bottomOffset}px`,
  );
});

test("landing navigation uses a white text LINKO wordmark instead of an image", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../../pages/LandingPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../assets/css/landing.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    page,
    /className="auth-brand-mark landing-brand-mark"[^>]*>[\s\S]*?LINK<span>O<\/span>/,
  );
  assert.doesNotMatch(page, /<img\s+src="\/images\/linko\.png"/);
  assert.match(
    css,
    /\.landing-brand-mark\s*\{[^}]*color:\s*#fff;/,
  );
});

test("landing page does not render or link to a marketplace preview section", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../../pages/LandingPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../assets/css/landing.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /<section[^>]+marketplace-section/);
  assert.doesNotMatch(page, /href="#marketplace"/);
  assert.doesNotMatch(css, /\.marketplace-section\b/);
});
