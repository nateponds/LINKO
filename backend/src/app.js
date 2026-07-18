import express from "express";
import authRouter from "./routes/auth.js";
import logisticsRouter from "./routes/logistics.js";
import ordersRouter from "./routes/orders.js";
import productsRouter from "./routes/products.js";
import suppliersRouter from "./routes/suppliers.js";
import dashboardRouter from "./routes/dashboard.js";
import adminRouter from "./routes/admin.js";
import settingsRouter from "./routes/settings.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth, requireGlobalRole } from "./middleware/auth.js";

export function createApp() {
  const app = express();

  // This lets Express read JSON request bodies, like the POST examples in
  // docs/API_CONTRACTS.md. Without it, req.body would be undefined.
  app.use(express.json());

  // A tiny route for checking that the server is alive before testing real APIs.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // These routers own their domain paths.
  app.use("/api/auth", authRouter);
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

  // Business location settings (Sprint 13). Active-business-scoped; per-route
  // auth lives inside the router.
  app.use("/api/settings", settingsRouter);

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
