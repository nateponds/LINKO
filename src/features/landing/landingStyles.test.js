import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("landing hero is a flat catalog surface without a decorative arc", async () => {
  const css = await readFile(
    new URL("../../assets/css/landing.css", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(css, /\.landing-hero::after/);
  assert.match(css, /\.landing-page\s*\{[^}]*background:\s*var\(--paper\)/);
  assert.doesNotMatch(css, /background-clip:\s*text/);
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
