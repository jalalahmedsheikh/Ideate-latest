import express from 'express'
import { 
  getUserProfile, 
  login, 
  socialAuth,
  logout, 
  register, 
  checkUsername,
  checkEmail,
  sendOTP,
  suggestedUsers, 
  toggleFollow, 
  updateProfile, 
  getSingleUser,
  getFollowRequests,
  respondToFollowRequest,
  toggleAccountPrivacy,
  toggleBlockUser,
  toggleMuteUser,
  deleteAccount,
  changePassword,
  getFollowers,
  getFollowing,
  getBlockedUsers,
  getMutedUsers,
  updatePrivacySettings
} from '../controllers/user.controller.js'
import isAuthenticated from '../middlewares/isAuthenticated.js'
import upload from "../utills/multer.js";
import rateLimiter from "../middlewares/rateLimiter.js";

const router = express.Router()

const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  if (token) {
    return isAuthenticated(req, res, next);
  }
  next();
};

// Strict rate limits for registration and authentication to prevent abuse
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per 15 mins
  message: "Too many attempts from this IP, please try again after 15 minutes."
});

router.route("/check-username").post(checkUsername)
router.route("/check-email").post(checkEmail)
router.route("/send-otp").post(authLimiter, sendOTP)
router.route("/register").post(authLimiter, register)
router.route("/login").post(authLimiter, login)
router.route("/social-auth").post(authLimiter, socialAuth)
router.route("/logout").get(logout)
router.route("/delete-account").delete(isAuthenticated, deleteAccount)
router.route("/change-password").post(isAuthenticated, changePassword)
router.route("/profile").get(isAuthenticated, getUserProfile)
router.route("/profile/:id").get(optionalAuth, getSingleUser)
router.route("/profile/update").put(isAuthenticated, upload.single("profilePhoto"), updateProfile)
router.route("/toggleFollow").post(isAuthenticated, toggleFollow)
router.route("/suggestions").get(optionalAuth, suggestedUsers)
router.route("/followers/:id").get(optionalAuth, getFollowers)
router.route("/following/:id").get(optionalAuth, getFollowing)
router.route("/follow-requests").get(isAuthenticated, getFollowRequests)
router.route("/follow-requests/respond").post(isAuthenticated, respondToFollowRequest)
router.route("/privacy").post(isAuthenticated, toggleAccountPrivacy)
router.route("/privacy-settings").put(isAuthenticated, updatePrivacySettings)
router.route("/block").post(isAuthenticated, toggleBlockUser)
router.route("/blocked").get(isAuthenticated, getBlockedUsers)
router.route("/mute").post(isAuthenticated, toggleMuteUser)
router.route("/muted").get(isAuthenticated, getMutedUsers)

export default router;