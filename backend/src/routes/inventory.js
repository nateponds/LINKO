import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  // Placeholder for Sprint 1. Later this should query inventory_items joined
  // with products, categories, and warehouses to match docs/API_CONTRACTS.md.
  res.json([]);
});

router.post("/", (_req, res) => {
  res.status(501).json({
    error: { message: "Inventory creation is not implemented yet" },
  });
});

router.patch("/:id", (req, res) => {
  res.status(501).json({
    error: {
      message: `Inventory item ${req.params.id} updates are not implemented yet`,
    },
  });
});

export default router;
