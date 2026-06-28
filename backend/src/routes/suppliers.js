import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  // Placeholder for Sprint 1. Later this should query businesses joined with
  // supplier_profiles and return the supplier contract shape.
  res.json([]);
});

router.post("/", (_req, res) => {
  res.status(501).json({
    error: { message: "Supplier creation is not implemented yet" },
  });
});

router.patch("/:id", (req, res) => {
  res.status(501).json({
    error: {
      message: `Supplier ${req.params.id} updates are not implemented yet`,
    },
  });
});

export default router;
