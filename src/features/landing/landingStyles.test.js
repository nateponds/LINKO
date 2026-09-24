import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("landing header includes the LINKO logo image", async () => {
  const page = await readFile(
    new URL("../../pages/LandingPage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /<img[\s\S]*?src="\/images\/linko\.png"/);
});

test("landing page references product banner artwork", async () => {
  const page = await readFile(
    new URL("../../pages/LandingPage.jsx", import.meta.url),
    "utf8",
  );

  assert.ok(
    page.includes("/images/productbanners/") || page.includes("productBanners"),
    "landing page should use product banner artwork",
  );
});

test("landing workflow explains supplier search, listed prices, and shipment updates", async () => {
  const page = await readFile(
    new URL("../../pages/LandingPage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /id="workflow"/);
  assert.match(page, /From search to delivery/);
  assert.match(page, /Search by business name or location/);
  assert.match(page, /unit prices/);
  assert.match(page, /parcel updates after shipment/);
  assert.doesNotMatch(page, /SavingsCalculator|Claim your savings|bulk discount|matched to your location/i);
});

test("signed-in landing actions use the role-aware destination helper", async () => {
  const page = await readFile(
    new URL("../../pages/LandingPage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /redirectPathForRoles\(activeRoles, user\.global_role === "platform_admin"\)/);
  assert.match(page, /"\/": "Enter marketplace"/);
  assert.match(page, /"\/logistics": "Open logistics"/);
  assert.match(page, /"\/courier": "Courier dashboard"/);
  assert.match(page, /"\/admin": "Admin dashboard"/);
});

test("mobile landing navigation has expanded state and keyboard close behavior", async () => {
  const page = await readFile(
    new URL("../../pages/LandingPage.jsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /aria-expanded=\{menuOpen\}/);
  assert.match(page, /aria-controls="landing-nav-links"/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /menuToggleRef\.current\?\.focus\(\)/);
  assert.match(page, /id="tour" tabIndex=\{-1\}/);
  assert.match(page, /href="#workflow" onClick=\{closeMenu\}/);
});

test("landing styles use LINKO brand tokens", async () => {
  const css = await readFile(
    new URL("../../assets/css/landing.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /var\(--color-primary\)/);
  assert.match(css, /var\(--color-accent\)/);
  assert.doesNotMatch(css, /Barlow|Source Sans|#16343a|#e4b33a/i);
});
