import express from "express";
import authRouter from "./routes/auth.js";
import inventoryRouter from "./routes/inventory.js";
import logisticsRouter from "./routes/logistics.js";
import ordersRouter from "./routes/orders.js";
import productsRouter from "./routes/products.js";
import suppliersRouter from "./routes/suppliers.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAnyRole, requireAuth } from "./middleware/auth.js";

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
