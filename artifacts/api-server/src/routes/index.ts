import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import alertsRouter from "./alerts";
import casesRouter from "./cases";
import monitoringRouter from "./monitoring";
import overviewRouter from "./overview";
import { requireAuth } from "../middlewares/requireAuth";
import { workspaceRateLimit } from "../middlewares/rateLimits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(workspaceRateLimit);
router.use(overviewRouter);
router.use(brandsRouter);
router.use(alertsRouter);
router.use(casesRouter);
router.use(monitoringRouter);

export default router;
