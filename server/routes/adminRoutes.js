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
    adjustUserCredits,
    updateUserPlan,
    getProjectsList,
    getSystemHealth,
} from "../controllers/adminController.js";

const adminRouter = Router();

// All admin routes require admin authentication
adminRouter.use(adminMiddleware);

adminRouter.get("/overview", getOverview);
adminRouter.get("/users/growth", getUsersGrowth);
adminRouter.get("/users/list", getUsersList);
adminRouter.post("/users/:id/credits", adjustUserCredits);
adminRouter.patch("/users/:id/plan", updateUserPlan);
adminRouter.get("/projects/list", getProjectsList);
adminRouter.get("/projects/activity", getProjectsActivity);
adminRouter.get("/projects/status", getProjectStatusBreakdown);
adminRouter.get("/compute/daily", getComputeDaily);
adminRouter.get("/revenue/daily", getRevenueDaily);
adminRouter.get("/models/breakdown", getModelBreakdown);
adminRouter.get("/recent", getRecentActivity);
adminRouter.get("/plans/breakdown", getPlanBreakdown);
adminRouter.get("/system/health", getSystemHealth);

export default adminRouter;
