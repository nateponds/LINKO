# Frontend Guide

## Archive Note

This guide has been archived in favor of [PROPOSED_LAYOUT.md](../PROPOSED_LAYOUT.md), which represents the more current and comprehensive layout strategy developed by the frontend team.

## Purpose

This document explains the current React file structure and what each page/component is intended to become.

## Development Stage

LINKO is currently in the design and early frontend scaffolding phase. The goal is to define page layouts, reusable UI components, and user flows before backend integration.

## Folder Overview

src/layouts
Main layout wrappers used across pages.

src/components/navigation
Navigation components such as sidebar, topbar, and mobile menu.

src/components/ui
Reusable UI primitives such as buttons, cards, badges, inputs, tables, and empty states.

src/pages
Top-level route pages.

src/features
Domain-specific components for inventory, supplier discovery, matching, orders, and logistics coordination.

## Page Responsibilities

### Dashboard.jsx

Overview of inventory status, wholesaler activity, pending orders, and logistics alerts.

### Inventory.jsx

Main inventory tracking page with stock table, filters, item cards, and low-stock indicators.

### Suppliers.jsx

Supplier discovery page with search, filters, wholesaler cards, and comparison-friendly information.

### SupplierDetails.jsx

Detailed wholesaler profile with product categories, service areas, terms, trust indicators, and contact actions.

### Matching.jsx

Supplier-matching workflow where users provide their location and view wholesalers recommended by proximity. Merchandise type and category filters are not part of the MVP matching workflow.

### Orders.jsx

Quote requests, order tracking, and buyer/wholesaler transaction states.

### Logistics.jsx

Shipment, dispatch, and delivery coordination view.

## Component Responsibilities

### AppLayout.jsx

Main app shell. Should include sidebar, topbar, mobile navigation, and page content area.

### Sidebar.jsx

Desktop navigation.

### Topbar.jsx

Header area for page title, search, user account, or quick actions.

### MobileNav.jsx

Mobile navigation pattern.

### Button.jsx

Reusable button component.

### Card.jsx

Reusable content container.

### Badge.jsx

Generic status/category badge.

### Input.jsx

Reusable form input.

### DataTable.jsx

Reusable table for inventory, orders, supplier-domain records, and logistics records.

### EmptyState.jsx

Reusable placeholder for pages or sections with no data.

## Design Priorities

- Mobile-friendly layouts.
- Clear dashboard structure.
- Practical business interface, not a marketing page.
- Easy scanning of inventory, wholesaler, and order data.
- Reusable components before detailed styling.
- Keep mock data simple and realistic.

## Initial Mock Data Needed

- Inventory items.
- Wholesaler profiles.
- Orders or quote requests.
- Shipment records.
- Match results.

## Notes for Frontend Developers

- Focus first on layout, responsiveness, and user flow.
- Backend integration is not required yet.
- Use mock data while building UI.
- Keep components reusable but avoid overengineering.
- Match the roadmap in `ROADMAP.md`.
