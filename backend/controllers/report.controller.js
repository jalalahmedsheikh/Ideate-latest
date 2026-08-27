import { Report } from "../models/report.model.js";

export const createReport = async (req, res) => {
    try {
        const userId = req.id;
        const { targetId, targetType, reason, description } = req.body;

        if (!targetId || !targetType || !reason) {
            return res.status(400).json({ success: false, message: "Target ID, Target Type, and Reason are required." });
        }

        const report = await Report.create({
            reportedBy: userId,
            targetId,
            targetType,
            reason,
            description: description ? description.trim() : ""
        });

        return res.status(201).json({
            success: true,
            message: "Report submitted successfully. Administrators will review it shortly.",
            report
        });
    } catch (error) {
        console.error("Create Report Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};
