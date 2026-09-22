import assert from "node:assert/strict";
import test from "node:test";
import {
  RECENT_SEARCH_KEY,
  clearRecentSearches,
  loadRecentSearches,
  marketplaceSearchPath,
  parseRecentSearches,
  rankSuggestions,
  rememberSearch,
  saveRecentSearches,
  searchParamsWithoutQuery,
  suggestionRank,
} from "./marketplaceSearch.js";

const rice = { product_id: 1, product_name: "Rice", sku: "RCE-1", category_name: "Grains" };
const brownRice = { product_id: 2, product_name: "Brown Rice", sku: "BRN-2", category_name: "Grains" };
const sauce = { product_id: 3, product_name: "Soy Sauce", sku: "RICE-OIL", category_name: "Condiments" };
const fields = ["product_name", "sku", "category_name"];

test("suggestionRank prefers exact, then prefix, then word, then substring", () => {
  assert.equal(suggestionRank(rice, "rice", fields), 0);
  assert.equal(suggestionRank(brownRice, "brown", fields), 1);
  assert.equal(suggestionRank(brownRice, "rice", fields), 2);
  assert.equal(suggestionRank(sauce, "rice", fields), 1);
  assert.equal(suggestionRank(sauce, "cond", fields), 1);
  assert.equal(suggestionRank({ product_name: "Noodles" }, "rice", ["product_name"]), 4);
});

test("rankSuggestions returns a few closest matches in rank order", () => {
  const ranked = rankSuggestions([sauce, brownRice, rice], "rice", { fields, limit: 2 });
  assert.deepEqual(ranked.map((item) => item.product_id), [1, 3]);
});

test("rankSuggestions keeps the original order when matches are equally close", () => {
  const ranked = rankSuggestions(
    [
      { business_id: 4, business_name: "Riceland Trading" },
      { business_id: 9, business_name: "Rice Bowl Supply" },
    ],
    "rice",
    { fields: ["business_name"], limit: 4 },
  );
  assert.deepEqual(ranked.map((item) => item.business_id), [4, 9]);
});

test("rankSuggestions ignores a blank query and bad input", () => {
  assert.deepEqual(rankSuggestions([rice], "   ", { fields }), []);
  assert.deepEqual(rankSuggestions(null, "rice", { fields }), []);
  assert.deepEqual(rankSuggestions([rice], "rice", {}), []);
});

test("rememberSearch caps the list and moves a repeat to the front", () => {
  const first = rememberSearch([], "  Rice  ", 3);
  const second = rememberSearch(first, "Soy", 3);
  const third = rememberSearch(second, "Noodles", 3);
  const fourth = rememberSearch(third, "Oil", 3);
  assert.deepEqual(fourth, ["Oil", "Noodles", "Soy"]);
  assert.deepEqual(rememberSearch(fourth, "soy sauce", 3), ["soy sauce", "Oil", "Noodles"]);
  assert.deepEqual(rememberSearch(["Rice", "Soy"], "rice", 8), ["rice", "Soy"]);
});

test("rememberSearch drops blanks and ignores a blank query", () => {
  assert.deepEqual(rememberSearch(["  ", "Rice", 4, "rice"], ""), ["Rice"]);
  assert.deepEqual(parseRecentSearches("{"), []);
  assert.deepEqual(parseRecentSearches(["Rice", "Rice", " Soy "], 8), ["Rice", "Soy"]);
});

test("recent searches persist, reload, and clear through storage", () => {
  const saved = new Map();
  const storage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };

  saveRecentSearches(rememberSearch([], "Rice"), storage);
  assert.equal(saved.has(RECENT_SEARCH_KEY), true);
  assert.deepEqual(loadRecentSearches(storage), ["Rice"]);
  clearRecentSearches(storage);
  assert.deepEqual(loadRecentSearches(storage), []);
  assert.deepEqual(loadRecentSearches(null), []);
});

test("marketplace search paths keep the category and drop paging", () => {
  assert.equal(marketplaceSearchPath({ q: " brown rice ", category: "Grains" }), "/?q=brown+rice&category=Grains");
  assert.equal(marketplaceSearchPath({ q: "   " }), "/");
  const cleared = searchParamsWithoutQuery("?q=rice&category=Grains&page=2&product_page=3&supplier_limit=25");
  assert.equal(cleared.get("q"), null);
  assert.equal(cleared.get("page"), null);
  assert.equal(cleared.get("product_page"), null);
  assert.equal(cleared.get("supplier_limit"), null);
  assert.equal(cleared.get("category"), "Grains");
});
