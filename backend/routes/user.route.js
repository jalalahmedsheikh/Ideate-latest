import express from 'express'
import { 
  getUserProfile, 
  login, 
  logout, 
  register, 
  suggestedUsers, 
  toggleFollow, 
  updateProfile, 
  getSingleUser,
  getFollowRequests,
  respondToFollowRequest,
  toggleAccountPrivacy,
  toggleBlockUser,
  toggleMuteUser
} from '../controllers/user.controller.js'
import isAuthenticated from '../middlewares/isAuthenticated.js'
import upload from "../utills/multer.js";
import rateLimiter from "../middlewares/rateLimiter.js";

const router = express.Router()

// Strict rate limits for registration and authentication to prevent abuse
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 requests per 15 mins
  message: "Too many attempts from this IP, please try again after 15 minutes."
});

router.route("/register").post(authLimiter, register)
router.route("/login").post(authLimiter, login)
router.route("/logout").get(logout)
router.route("/profile").get(isAuthenticated,getUserProfile)
router.route("/profile/:id").get(getSingleUser)
router.route("/profile/update").put(isAuthenticated, upload.single("profilePhoto"),updateProfile)
router.route("/toggleFollow").post(isAuthenticated,toggleFollow)
router.route("/suggestions").get(isAuthenticated,suggestedUsers)
router.route("/follow-requests").get(isAuthenticated, getFollowRequests)
router.route("/follow-requests/respond").post(isAuthenticated, respondToFollowRequest)
router.route("/privacy").post(isAuthenticated, toggleAccountPrivacy)
router.route("/block").post(isAuthenticated, toggleBlockUser)
router.route("/mute").post(isAuthenticated, toggleMuteUser)

export default router;