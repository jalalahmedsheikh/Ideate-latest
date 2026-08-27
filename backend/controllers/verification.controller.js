import { VerificationRequest } from "../models/verificationRequest.model.js";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import { Notification } from "../models/notification.model.js";

/**
 * POST /verification/apply
 */
export const applyVerification = async (req, res) => {
  try {
    const userId = req.id;
    const { category, fullName, officialLinks, evidenceText } = req.body;

    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Please provide your full legal or brand name." });
    }

    if (!evidenceText || evidenceText.trim().length < 10) {
      return res.status(400).json({ success: false, message: "Please explain your verification background (at least 10 characters)." });
    }

    const existing = await VerificationRequest.findOne({
      user: userId,
      status: { $in: ["pending", "under_review"] },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You already have an active verification application under review.",
      });
    }

    const request = await VerificationRequest.create({
      user: userId,
      category: category || "creator",
      fullName: fullName.trim(),
      officialLinks: Array.isArray(officialLinks) ? officialLinks : [],
      evidenceText: evidenceText.trim(),
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Verification application submitted successfully!",
      request,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error submitting verification request." });
  }
};

/**
 * GET /verification/status
 */
export const getMyVerificationStatus = async (req, res) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId).select("isverified verificationCategory").lean();
    const latestRequest = await VerificationRequest.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      isVerified: user?.isverified || false,
      category: user?.verificationCategory || null,
      request: latestRequest || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error checking verification status." });
  }
};

/**
 * POST /verification/admin/review
 */
export const reviewVerification = async (req, res) => {
  try {
    const reviewerId = req.id;
    const { requestId, action, reviewNotes } = req.body; // 'approve', 'reject', 'revoke'

    const reviewer = await User.findById(reviewerId);
    if (!reviewer || reviewer.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin privileges required." });
    }

    const request = await VerificationRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Verification request not found." });
    }

    if (action === "approve") {
      request.status = "approved";
      request.reviewedBy = reviewerId;
      request.reviewNotes = reviewNotes || "Approved based on identity and contribution standards.";
      request.reviewedAt = new Date();
      await request.save();

      await User.findByIdAndUpdate(request.user, {
        isverified: true,
        verificationCategory: request.category,
      });

      await AuditLog.create({
        actor: reviewerId,
        action: "verification_approved",
        targetType: "user",
        targetId: request.user,
        details: { category: request.category },
        reason: request.reviewNotes,
      });

      await Notification.create({
        recipient: request.user,
        sender: reviewerId,
        type: "verification_approved",
        message: "🎉 Your Ideate profile has been verified!",
      });

      return res.status(200).json({ success: true, message: "Verification approved!" });
    } else if (action === "reject") {
      request.status = "rejected";
      request.reviewedBy = reviewerId;
      request.reviewNotes = reviewNotes || "Application did not meet verification criteria.";
      request.reviewedAt = new Date();
      await request.save();

      await Notification.create({
        recipient: request.user,
        sender: reviewerId,
        type: "verification_rejected",
        message: "Your verification application was reviewed and could not be approved at this time.",
      });

      return res.status(200).json({ success: true, message: "Verification rejected." });
    } else if (action === "revoke") {
      request.status = "revoked";
      request.reviewedBy = reviewerId;
      request.reviewNotes = reviewNotes || "Verification revoked.";
      await request.save();

      await User.findByIdAndUpdate(request.user, {
        isverified: false,
        verificationCategory: null,
      });

      await AuditLog.create({
        actor: reviewerId,
        action: "verification_revoked",
        targetType: "user",
        targetId: request.user,
        reason: reviewNotes || "Policy violation or fraud",
      });

      return res.status(200).json({ success: true, message: "Verification revoked." });
    }

    return res.status(400).json({ success: false, message: "Invalid action." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error reviewing verification." });
  }
};
