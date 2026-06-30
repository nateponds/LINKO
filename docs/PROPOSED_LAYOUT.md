---
title: LINKO UI Layout Proposal
---

# LINKO UI Layout Proposal

## Overview

LINKO is a supply chain management web app for MSMEs, with an early UI focused on inventory workflows, wholesaler discovery, and related operational views. All four pages share a common shell, or top navbar, and differ mainly in the content panel below it. This document breaks each page into regions and suggests a React component structure so engineering can start scaffolding directly from it.

## Shared Visual Language

- App name/logo `LINKO` in the top-left on a dark gray header bar.
- A horizontal nav group with placeholder labels to be replaced with real labels, for example `Dashboard / Inventory / Suppliers`.
- A row of circular avatar or icon buttons on the right for profile, notifications, and similar actions.
- Light gray panels for cards and placeholders, plus mid-gray blocks for image placeholders that should map to actual product or wholesaler imagery later.

## Shared Components

Build these first.

| Component                    | Description                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<AppHeader />`              | Top bar with logo, nav links, search where applicable, action buttons, avatar group, and notification bell. Persists across all pages.                                                                            |
| `<IconButton />`             | Circular gray button used for avatars, bell, hamburger, and message or comment icons.                                                                                                                             |
| `<SearchBar />`              | Rounded input with search icon, used in the header and table toolbars.                                                                                                                                            |
| `<FilterDropdown />`         | Pill-shaped `select`-style control with chevron icon for category, status, and similar filters.                                                                                                                   |
| `<PrimaryButton icon="+" />` | Square or rounded add action button for adding products or wholesalers.                                                                                                                                           |
| `<Card />`                   | Generic light-gray rounded container used for stat tiles, Recent Orders, and analytics panels.                                                                                                                    |
| `<DataTable />`              | Table with checkbox column, image thumbnail column, sortable header row, and a status badge column. Used identically on Dashboard and Inventory pages.                                                            |
| `<ImagePlaceholderCard />`   | Tall gray rectangle for product or wholesaler imagery, used in grid layouts on Suppliers and Supplier Details.                                                                                                    |
| `<AvatarScroller />`         | Horizontal row of circular avatars representing categories or locations, with a leading or trailing chevron for scroll or expand behavior. Used on the Suppliers page and inspired by the Alibaba category strip. |

## Page Layouts

### Dashboard

Purpose: At-a-glance summary plus quick access to recent product and order data.

**Regions, top to bottom:**

1. `<AppHeader />`
2. **Welcome row** - 3-column grid:
   - `WelcomeCard` (`Welcome back, {profile name}`)
   - `AnalyticsSummaryCard` (`Something analytics` headline KPI placeholder)
   - Third slot reserved for an additional KPI or promo card
3. **Insights row** - 2-column layout:
   - Left: `DonutChartCard` for category or status breakdown above `RecentOrdersCard` for a list with a `See all` link, where each row includes thumbnail, item name, and price.
   - Right: `<DataTable />` for the main product table with toolbar:
     - Search input
     - Up to 3 filter dropdowns, for example category, stock status, and date
     - Add (`+`) button
     - Columns: `checkbox | thumbnail | ID/SKU | Name | Price | Stock | Status (sortable)`

**React sketch**

```jsx
<DashboardPage>
  <AppHeader />
  <section className="welcome-row">
    <WelcomeCard /> <AnalyticsSummaryCard /> <PromoCard />
  </section>
  <section className="insights-row">
    <aside>
      <DonutChartCard />
      <RecentOrdersCard />
    </aside>
    <DataTable toolbar={<TableToolbar withAdd />} />
  </section>
</DashboardPage>
```

### Inventory

Purpose: Full product list and management view, using the same table as Dashboard but promoted to the primary content with its own collapsible section header.

**Regions:**

1. `<AppHeader />` with toolbar variant: search, filter, add button, hamburger menu icon, and single avatar.
2. **Section header band** - `Product Statistic` title plus `Something analytics` subtitle, with a collapse or expand chevron on the right. This band visually separates the table from the header and can toggle to show or hide an analytics summary above the table.
3. `<DataTable />` with identical structure to Dashboard's table:
   - `checkbox | thumbnail | ID/SKU | Name | Price | Stock | Status (sortable)`
4. Empty or footer state placeholder for additional rows or pagination.

**React sketch**

```jsx
<InventoryPage>
  <AppHeader variant="toolbar" />
  <CollapsibleSectionHeader
    title="Product Statistic"
    subtitle="Something analytics"
    collapsible
  />
  <DataTable />
</InventoryPage>
```

**Note:** Because the table component is identical to Dashboard's, build `<DataTable />` once and reuse it with different props, for example `compact` versus `withSidebarChart`.

### Suppliers

Purpose: Browse and discover wholesalers, filterable by category or location, modeled loosely on the Alibaba seller-search layout.

**Regions:**

1. `<AppHeader />` with toolbar variant: search, single filter icon, hamburger, and avatar. No add button on this page.
2. `<AvatarScroller />` band - a horizontally scrollable row of circular icons labeled categories or locations, with a trailing chevron-down for the expand or filter menu. This is the wholesaler-category quick filter, inspired by the Alibaba category strip in the reference mood board.
3. **Supplier grid** - responsive 3-column grid of `<ImagePlaceholderCard />`, each representing a wholesaler. Image, logo, name, and rating can be added once data is available.

**React sketch**

```jsx
<SuppliersPage>
  <AppHeader variant="toolbar" showAdd={false} />
  <AvatarScroller label="categories/location" />
  <SupplierGrid>
    <SupplierCard /> <SupplierCard /> <SupplierCard /> ...
  </SupplierGrid>
</SuppliersPage>
```

**Inspiration notes:** The Alibaba Seller Central screenshot shows a left category sidebar plus a grid of product cards with sort and view-toggle controls, plus a result count such as `13,546 results for ...`. Consider whether Suppliers should adopt a similar sidebar-plus-grid pattern as the page matures past wireframe stage.

### Supplier Details

Purpose: Drill-down view for a single wholesaler, with profile info, categories or products they offer, and contact or communication actions.

**Regions:**

1. `<AppHeader />` with toolbar variant: search, hamburger, and avatar.
2. **Profile + actions row:**
   - `profile` pill button on the left, acting as the wholesaler name or avatar entry point and likely expanding to full profile info.
   - Right-aligned stacked action buttons: Add (`+`) and Message or Comment (speech bubble icon).
3. **Categories band** - centered `categories` label, flanked by two pill placeholders on the left and right. These likely represent previous and next category navigation or tag chips.
4. **Product/offering grid** - responsive 3-column grid of `<ImagePlaceholderCard />` showing the products or items associated with this wholesaler, reusing the same card component as the Suppliers grid.

**React sketch**

```jsx
<SupplierDetailsPage>
  <AppHeader variant="toolbar" />
  <ProfileActionsRow>
    <ProfilePillButton />
    <ActionStack>
      <PrimaryButton icon="+" />
      <IconButton icon="message" />
    </ActionStack>
  </ProfileActionsRow>
  <CategoriesBand label="categories" />
  <ProductGrid>
    <ImagePlaceholderCard /> <ImagePlaceholderCard /> <ImagePlaceholderCard />{" "}
    ...
  </ProductGrid>
</SupplierDetailsPage>
```

## Suggested File and Folder Structure

```text
src/
  components/
    layout/
      AppHeader.jsx
      AvatarScroller.jsx
    common/
      IconButton.jsx
      SearchBar.jsx
      FilterDropdown.jsx
      PrimaryButton.jsx
      Card.jsx
      ImagePlaceholderCard.jsx
    table/
      DataTable.jsx
      TableToolbar.jsx
  pages/
    Dashboard/
      DashboardPage.jsx
      WelcomeCard.jsx
      DonutChartCard.jsx
      RecentOrdersCard.jsx
    Inventory/
      InventoryPage.jsx
      CollapsibleSectionHeader.jsx
    Suppliers/
      SuppliersPage.jsx
      SupplierCard.jsx
    SupplierDetails/
      SupplierDetailsPage.jsx
      ProfileActionsRow.jsx
      CategoriesBand.jsx
```

## Open Questions and Follow-ups

- Replace placeholder nav labels (`something / menu / stuff`) with final IA, for example `Dashboard / Inventory / Suppliers / Reports`.
- Confirm whether Inventory's `Product Statistic` header should always show an analytics chart when expanded, or just act as a collapsible title bar.
- Decide whether the Suppliers page needs a left sidebar, per the Alibaba reference, once the wholesaler list grows large enough to need filtering by more than category or location.
- Clarify what the two pill placeholders in the Supplier Details `categories` band represent, such as tag chips versus previous and next navigation.
- Define the real data shape for `DataTable` rows, including SKU, name, price, stock, and status enum, so the same component can serve both Dashboard and Inventory.

---

P.S. The logistics page is still under deliberation, so it is not included in this proposal.
