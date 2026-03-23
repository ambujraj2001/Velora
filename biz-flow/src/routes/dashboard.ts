import { Router } from "express";
import { saveDashboard, getDashboards, getDashboardById, refreshDashboard } from "../controllers/dashboardController";

const router = Router();

router.post("/save", saveDashboard);
router.get("/", getDashboards);
router.get("/:id", getDashboardById);
router.post("/:id/refresh", refreshDashboard);

export default router;
