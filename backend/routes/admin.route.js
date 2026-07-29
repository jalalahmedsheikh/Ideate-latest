import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { User } from "../models/user.model.js";
import {
    getDashboardAnalytics,
    listAllUsers,
    toggleBanUser,
    toggleVerifyUser,
    listAllReports,
    resolveReport,
    sendAdminNotification,
    listAllContent,
    deleteContent
} from "../controllers/admin.controller.js";

const router = express.Router();

// Middleware to verify admin privileges
const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.id);
        if (!user || user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Forbidden. Admin access required." });
        }
        next();
    } catch (error) {
        console.error("Admin verification error:", error);
        return res.status(500).json({ success: false, message: "Server error verifying admin rights." });
    }
};

router.route("/analytics").get(isAuthenticated, isAdmin, getDashboardAnalytics);
router.route("/users").get(isAuthenticated, isAdmin, listAllUsers);
router.route("/users/ban").post(isAuthenticated, isAdmin, toggleBanUser);
router.route("/users/verify").post(isAuthenticated, isAdmin, toggleVerifyUser);
router.route("/reports").get(isAuthenticated, isAdmin, listAllReports);
router.route("/reports/resolve").post(isAuthenticated, isAdmin, resolveReport);
router.route("/content").get(isAuthenticated, isAdmin, listAllContent);
router.route("/content/delete").post(isAuthenticated, isAdmin, deleteContent);
router.route("/notify").post(isAuthenticated, isAdmin, sendAdminNotification);

export default router;
