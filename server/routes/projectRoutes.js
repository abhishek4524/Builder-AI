import { Router } from "express";
import {
    createProject,
    deleteProject,
    getProject,
    getPublicProject,
    listProjects,
    publishProject,
    updateProjectFiles,
    cancelProject,
    streamProjectEvents,
} from "../controllers/projectController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { chat } from "../controllers/chatController.js";
import { generateLimiter, reviseLimiter } from "../middleware/rateLimiters.js";

const projectRouter = Router();

// Public Route (no auth needed)
projectRouter.get("/public/:id", getPublicProject);

// Protect all following routes
projectRouter.use(authMiddleware);

// Per-user rate limiters run AFTER authMiddleware so req.user is available
projectRouter.post("/", generateLimiter, createProject);
projectRouter.get("/", listProjects);
projectRouter.get("/:id", getProject);
projectRouter.delete("/:id", deleteProject);
projectRouter.put("/:id/files", updateProjectFiles);
projectRouter.post("/:id/publish", publishProject);

// Cancel ongoing generation/revision
projectRouter.post("/:id/cancel", cancelProject);

// SSE Stream for live generation events
projectRouter.get("/:id/events", streamProjectEvents);

// Chat / Revision
projectRouter.post("/:id/chat", reviseLimiter, chat);

export default projectRouter;
