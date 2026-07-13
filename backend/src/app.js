import express from "express";
import authRouter from "./routes/auth.js";
import inventoryRouter from "./routes/inventory.js";
import logisticsRouter from "./routes/logistics.js";
import ordersRouter from "./routes/orders.js";
import productsRouter from "./routes/products.js";
import suppliersRouter from "./routes/suppliers.js";
import warehousesRouter from "./routes/warehouses.js";
import dashboardRouter from "./routes/dashboard.js";
import adminRouter from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAnyRole, requireAuth, requireGlobalRole } from "./middleware/auth.js";

export function createApp() {
  const app = express();

  // This lets Express read JSON request bodies, like the POST examples in
  // docs/API_CONTRACTS.md. Without it, req.body would be undefined.
  app.use(express.json());

  // A tiny route for checking that the server is alive before testing real APIs.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // These routers own their domain paths. Code inside inventory.js can stay
  // focused on "/" because app.js attaches it under "/api/inventory".
  app.use("/api/auth", authRouter);
  app.use(
    "/api/inventory",
    requireAuth,
    requireAnyRole(["buyer", "wholesaler", "platform_admin"]),
    inventoryRouter,
  );
  // Read-only warehouse lookup feeding the inventory add-stock picker
  // (Sprint 10). Same audience as the inventory writes it supports.
  app.use(
    "/api/warehouses",
    requireAuth,
    requireAnyRole(["wholesaler", "platform_admin"]),
    warehousesRouter,
  );
  // Suppliers is a read-only marketplace listing for any authenticated user
  // (buyers browse wholesalers), so it only needs requireAuth -- no role gate.
  app.use("/api/suppliers", requireAuth, suppliersRouter);

  // Marketplace products + category taxonomy (Milestone 2). Owns /api/products
  // and /api/categories, so it mounts at /api and declares full paths and its
  // own per-route auth internally (reads are any-authenticated, writes are
  // wholesaler/platform_admin).
  app.use("/api", productsRouter);

  // Marketplace orders and invoices (Milestone 3). Owns /api/orders and
  // /api/invoices; per-route auth keeps buyer/wholesaler/admin rules local.
  app.use("/api", ordersRouter);

  // Dashboard and notifications
  app.use("/api", dashboardRouter);

  // Platform-admin management console (Milestone 6). Owns /api/admin/* and is
  // gated globally here so the router itself can assume an authenticated admin.
  app.use(
    "/api/admin",
    requireAuth,
    requireGlobalRole("platform_admin"),
    adminRouter,
  );

  // Course-deliverable logistics subsystem (Sprint 2-CD). Owns several
  // top-level paths (/api/parcels, /api/service-tiers, /api/customers), so
  // it mounts at /api and declares full paths internally.
  app.use("/api", logisticsRouter);

  // If no route above matched, return a JSON 404 instead of Express' HTML page.
  app.use((req, res) => {
    res.status(404).json({
      error: {
        message: "Route not found",
        path: req.originalUrl,
      },
    });
  });

  // Error middleware goes last. Express calls it when a route passes or throws
  // an error, so every API error can share one JSON response shape.
  app.use(errorHandler);

  return app;
}

export default createApp;
