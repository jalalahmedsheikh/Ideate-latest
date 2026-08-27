import express from 'express'
import isAuthenticated from '../middlewares/isAuthenticated.js'
import upload from '../utills/multer.js'
import { 
  addComment, 
  addNewPost, 
  deletePost, 
  getAllPosts, 
  getAllPostsOfFollowing, 
  getCommentsOfPost, 
  getSinglePost, 
  getUserPosts, 
  handlePostReaction, 
  SavePost, 
  sharePost,
  getSavedPostsAndPolls,
  getLikedPosts
} from '../controllers/post.controller.js'

const router = express.Router()

// Named/specific endpoints MUST come before parameterized /:id routes
router.route("/addNewPost").post(isAuthenticated, addNewPost)
router.route("/allposts").get(getAllPosts)
router.route("/followings").get(isAuthenticated, getAllPostsOfFollowing)
router.route("/saved/all").get(isAuthenticated, getSavedPostsAndPolls)
router.route("/liked/all").get(isAuthenticated, getLikedPosts)
router.route("/userpost/all").get(isAuthenticated, getUserPosts)
router.route("/userpost/all/:id").get(isAuthenticated, getUserPosts)

// Action endpoints on specific posts
router.route("/:id/like").post(isAuthenticated, (req, res) => handlePostReaction(req, res, 'like'));
router.route("/:id/dislike").post(isAuthenticated, (req, res) => handlePostReaction(req, res, 'dislike'));
router.route("/share/:id").post(isAuthenticated, sharePost);
router.route("/:id/comment").post(isAuthenticated, addComment); 
router.route("/:id/comment/all").get(getCommentsOfPost);
router.route("/delete/:id").delete(isAuthenticated, deletePost);
router.route("/:id/savepost").post(isAuthenticated, SavePost);
router.route("/:id/unsavepost").post(isAuthenticated, SavePost);

// Single post detail route (parameterized)
router.route("/:id").get(getSinglePost)

export default router;