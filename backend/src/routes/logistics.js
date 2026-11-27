import { Router } from "express";
import parcelsRouter from "./logistics/parcels.js";
import branchesRouter from "./logistics/branches.js";
import couriersRouter from "./logistics/couriers.js";
import serviceTiersRouter from "./logistics/serviceTiers.js";

export {
  canCourierSubmitTrackingStatus,
  canSubmitTrackingStatus,
  courierAllowedNextStatuses,
  parseParcelListQuery,
} from "./logistics/shared.js";

const router = Router();

router.use(parcelsRouter);
router.use(branchesRouter);
router.use(couriersRouter);
router.use(serviceTiersRouter);

export default router;
