import { Router } from "express";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
import {
    getOverview,
    getUsersGrowth,
    getProjectsActivity,
    getComputeDaily,
    getUsersList,
    getRevenueDaily,
    getModelBreakdown,
    getProjectStatusBreakdown,
    getRecentActivity,
    getPlanBreakdown,
} from "../controllers/adminController.js";

const adminRouter = Router();

// All admin routes require admin authentication
adminRouter.use(adminMiddleware);

adminRouter.get("/overview", getOverview);
adminRouter.get("/users/growth", getUsersGrowth);
adminRouter.get("/users/list", getUsersList);
adminRouter.get("/projects/activity", getProjectsActivity);
adminRouter.get("/projects/status", getProjectStatusBreakdown);
adminRouter.get("/compute/daily", getComputeDaily);
adminRouter.get("/revenue/daily", getRevenueDaily);
adminRouter.get("/models/breakdown", getModelBreakdown);
adminRouter.get("/recent", getRecentActivity);
adminRouter.get("/plans/breakdown", getPlanBreakdown);

export default adminRouter;
