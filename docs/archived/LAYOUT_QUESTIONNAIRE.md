# LINKO UI Layout — Open Questions Questionnaire

> **Context:** This questionnaire covers unresolved design decisions from the [LINKO UI Layout Proposal](./PROPOSED_LAYOUT.md). Please read through each question, pick the option that makes the most sense (or write in your own answer), and note your name beside your choice so we can discuss any disagreements.
>
> **Navigation labels have been finalized as:** `Dashboard / Inventory / Suppliers / Logistics / Reports`

---

## Question 1 — Inventory: What should the "Product Statistic" header do?

The Inventory page has a `Product Statistic` section header with a collapse/expand chevron on the right side. The question is: **when the user expands it, what do they see?**

For reference, the Dashboard page already shows analytics via a donut chart and summary cards. This question is about whether Inventory should have its own inline analytics too, or if the header is just a visual separator.

**Options:**

- [ ] **A.** Show an analytics summary when expanded — e.g. stat tiles for total products, low stock alerts, category breakdown chart. Collapsing it hides these stats and leaves just the table.
- [ ] **B.** It's just a collapsible title bar that hides/shows the product table below it. No extra analytics.
- [ ] **C.** Keep the header static (always visible, never collapses) — it's purely a section label with no interactive behavior.

**Your pick:** ******\_\_\_******  
**Your name:** ******\_\_\_******  
**Notes (optional):** ******\_\_\_******

---

## Question 2 — Suppliers: Should we add a left sidebar for filtering?

Right now, the Suppliers page uses an `AvatarScroller` strip (horizontal row of circular category/location icons) as the only way to filter wholesalers. The Alibaba reference in the mood board shows a **left sidebar** with nested category filters alongside a product grid.

**As the wholesaler list grows, which filtering approach should the Suppliers page use?**

**Options:**

- [ ] **A.** Build a left sidebar from the start — even if it starts minimal, it sets us up for deeper filtering later (region, product type, rating, minimum order quantity, etc.).
- [ ] **B.** No sidebar for now — the AvatarScroller strip is enough. We'll revisit when we actually have enough suppliers to need it.
- [ ] **C.** Use a slide-out filter drawer instead — triggered by a hamburger or filter icon. Keeps the page clean but still allows deep filtering when needed.

**Your pick:** ******\_\_\_******  
**Your name:** ******\_\_\_******  
**Notes (optional):** ******\_\_\_******

---

## Question 3 — Supplier Details: What are the category band pills?

On the Supplier Details page, there's a `categories` label in the center, flanked by two pill-shaped elements on the left and right. This band sits **between** the profile/actions row (top) and the product grid (bottom).

**What should these pill elements do?**

**Options:**

- [ ] **A.** Tag chips — clickable category tags that filter the product grid below them (e.g. "Electronics", "Textiles", "Food"). Clicking one shows only that supplier's products in that category.
- [ ] **B.** Previous / Next navigation — arrow buttons to page through the supplier's product categories one at a time, updating the grid below.
- [ ] **C.** Both — show scrollable tag chips for categories, with left/right arrow buttons on the edges to scroll through overflow when there are too many to fit.

**Your pick:** ******\_\_\_******  
**Your name:** ******\_\_\_******  
**Notes (optional):** ******\_\_\_******

---

## Question 4 — DataTable: What columns should each row have?

The `DataTable` component is reused on both the Dashboard and Inventory pages. The current proposal lists these columns:

| Checkbox | Thumbnail | ID/SKU | Name | Price | Stock | Status |
| -------- | --------- | ------ | ---- | ----- | ----- | ------ |

**Should we add any extra columns?**

**Options:**

- [ ] **A.** Those columns are correct as-is. No changes.
- [ ] **B.** Add a **Category** column (e.g. "Electronics", "Raw Materials").
- [ ] **C.** Add a **Supplier** column to show which wholesaler provides the product.
- [ ] **D.** Add both Category and Supplier columns.
- [ ] **E.** Other (write in below).

**Your pick:** ******\_\_\_******  
**Your name:** ******\_\_\_******  
**If you picked E, what columns?** ******\_\_\_******

---

## Question 5 — DataTable: What status values should products have?

The Status column renders as colored badges. **How many states do we need, and what should they be called?**

**Options:**

- [ ] **A.** 3 states — `In Stock` / `Low Stock` / `Out of Stock`
- [ ] **B.** 4 states — `In Stock` / `Low Stock` / `Out of Stock` / `Discontinued`
- [ ] **C.** 4 states, different naming — `Available` / `Limited` / `Unavailable` / `Backordered`
- [ ] **D.** 5 states — `In Stock` / `Low Stock` / `Out of Stock` / `On Order` / `Discontinued`
- [ ] **E.** Other (write in below).

**Your pick:** ******\_\_\_******  
**Your name:** ******\_\_\_******  
**If you picked E, what statuses?** ******\_\_\_******

---

## Question 6 — Logistics Page: What's the plan?

The Logistics page was left out of the proposal because it's still under deliberation. Since we've now confirmed it gets a nav slot (`Dashboard / Inventory / Suppliers / Logistics / Reports`), we need to decide what to do with it **right now**.

**Options:**

- [ ] **A.** Skip it entirely for now — don't even build a placeholder. The nav link can be disabled/grayed out.
- [ ] **B.** Reserve the nav slot and show a "Coming Soon" placeholder page so users know it exists.
- [ ] **C.** I have ideas for what the Logistics page should contain (describe below).

**Your pick:** ******\_\_\_******  
**Your name:** ******\_\_\_******  
**If you picked C, describe your vision:** ******\_\_\_******

---

## Summary Table

Fill this in once everyone has answered, to record the group's final decisions.

| #   | Question                                      | Final Decision | Decided By |
| --- | --------------------------------------------- | -------------- | ---------- |
| 1   | Inventory — Product Statistic header behavior |                |            |
| 2   | Suppliers — Left sidebar filtering            |                |            |
| 3   | Supplier Details — Category band pills        |                |            |
| 4   | DataTable — Column set                        |                |            |
| 5   | DataTable — Status values                     |                |            |
| 6   | Logistics page — Scope                        |                |            |

---

_Generated from the open questions in [PROPOSED_LAYOUT.md](./PROPOSED_LAYOUT.md)._
