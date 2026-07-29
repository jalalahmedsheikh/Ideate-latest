import React, { useEffect, useState, useRef, useContext } from "react";
import { FaUserCircle, FaEllipsisV, FaRegHeart, FaHeart, FaFlag, FaTrash } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';
import { formatDistanceToNow, parseISO } from 'date-fns';
import verifiedBadge from '../assets/images/verified.png';
import Loading from '../components/Loading';
import { UserContext } from "../contexts/UserContext";
import axiosInstance from "./axiosInstance";
import PollCard from "../components/PollCard";

const theme = {
  primary: "rgb(40, 0, 65)",
  secondary: "#fd1d1d",
  lightGray: "#1e1e2d",
};

const Home = () => {
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});
  const [activeTab, setActiveTab] = useState("explore");
  const [showMenu, setShowMenu] = useState(null);
  const menuRef = useRef();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPosts = async (tab) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "explore") {
        const [postsRes, pollsRes] = await Promise.all([
          axiosInstance.get("/post/allposts"),
          axiosInstance.get("/poll/allpolls")
        ]);

        const postsData = (postsRes.data.posts || []).map(p => ({ ...p, feedType: 'post' }));
        const pollsData = (pollsRes.data.polls || []).map(p => ({ ...p, feedType: 'poll' }));

        const combined = [...postsData, ...pollsData].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        const currentUserId = user?.user?._id;
        const likedMap = {};
        const savedMap = {};

        postsData.forEach(post => {
          if (currentUserId && post.likes && post.likes.includes(currentUserId)) {
            likedMap[post._id] = true;
          }
        });

        if (user?.user?.bookmarks) {
          user.user.bookmarks.forEach(bookmarkId => {
            const id = bookmarkId?._id || bookmarkId;
            savedMap[id] = true;
          });
        }

        setLikedPosts(likedMap);
        setSavedPosts(savedMap);
        setFeedItems(combined);
      } else {
        // followings tab
        const res = await axiosInstance.get("/post/followings");
        const postsData = (res.data.posts || []).map(p => ({ ...p, feedType: 'post' }));

        const currentUserId = user?.user?._id;
        const likedMap = {};
        const savedMap = {};

        postsData.forEach(post => {
          if (currentUserId && post.likes && post.likes.includes(currentUserId)) {
            likedMap[post._id] = true;
          }
        });

        if (user?.user?.bookmarks) {
          user.user.bookmarks.forEach(bookmarkId => {
            const id = bookmarkId?._id || bookmarkId;
            savedMap[id] = true;
          });
        }

        setLikedPosts(likedMap);
        setSavedPosts(savedMap);
        setFeedItems(postsData);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load feed items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(activeTab);
  }, [activeTab, user]);

  const toggleLike = async (postId) => {
    try {
      const token = Cookies.get('token');
      if (!token) {
        navigate('/auth');
        return;
      }

      const isLiked = likedPosts[postId];
      const action = isLiked ? 'dislike' : 'like';

      await axiosInstance.post(`/post/${postId}/${action}`);

      setLikedPosts((prev) => ({
        ...prev,
        [postId]: !isLiked,
      }));

      // Update like count visually
      setFeedItems((prevItems) =>
        prevItems.map((item) =>
          item._id === postId && item.feedType === 'post'
            ? {
                ...item,
                likes: isLiked
                  ? item.likes.filter((id) => id !== user?.user?._id)
                  : [...item.likes, user?.user?._id],
              }
            : item
        )
      );
    } catch (err) {
      console.error("Error toggling like", err);
    }
  };

  const toggleSave = async (postId) => {
    try {
      const token = Cookies.get('token');
      if (!token) {
        navigate('/auth');
        return;
      }

      const isSaved = savedPosts[postId];
      const action = isSaved ? 'unsavepost' : 'savepost';

      await axiosInstance.post(`/post/${postId}/${action}`);

      setSavedPosts((prev) => ({
        ...prev,
        [postId]: !isSaved,
      }));
    } catch (err) {
      console.error("Error toggling save", err);
    }
  };

  const deletePost = async (postId) => {
    try {
      await axiosInstance.delete(`/post/delete/${postId}`);
      setFeedItems(feedItems.filter((item) => item._id !== postId));
      setShowMenu(null);
    } catch (err) {
      console.error("Error deleting post", err);
    }
  };

  const reportPost = async (postId) => {
    try {
      await axiosInstance.post(`/post/${postId}/report`);
      setShowMenu(null);
    } catch (err) {
      console.error("Error reporting post", err);
    }
  };

  const formatTimeAgo = (createdAt) => {
    try {
      const parsedDate = parseISO(createdAt);
      return formatDistanceToNow(parsedDate) + " ago";
    } catch (e) {
      return "some time ago";
    }
  };

  if (loading) return <div className="text-center mt-5"><Loading /></div>;
  if (error) return <div className="text-center text-danger mt-5">{error}</div>;

  return (
    <div className="app bg-black text-white min-vh-100 pb-5">
      <div className="head sticky-top user-select-none bg-black border-bottom border-secondary">
        <h1 className="text-white text-center d-none d-lg-block py-3 m-0">Home</h1>
        <div className="tabs-container pb-2">
          <div
            className={`tab ${activeTab === "explore" ? "text-white border-bottom border-3 border-light rounded-0" : "text-secondary"}`}
            onClick={() => setActiveTab("explore")}
          >
            Explore
          </div>
          <div
            className={`tab ${activeTab === "followings" ? "text-white border-bottom border-3 border-light rounded-0" : "text-secondary"}`}
            onClick={() => setActiveTab("followings")}
          >
            Followings
          </div>
        </div>
      </div>

      <style>
        {`
          .tabs-container {
            display: flex;
            justify-content: center;
            margin-top: 10px;
          }
          .tab {
            margin: 0 20px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 700;
            transition: color 0.2s;
          }
        `}
      </style>

      <div className="feed-container px-3">
        {activeTab === "followings" && feedItems.length === 0 ? (
          <div className="text-center mt-5 text-secondary">
            <h5>No posts to show. Follow some users to see their posts.</h5>
          </div>
        ) : (
          feedItems.map((item) => {
            if (item.feedType === 'poll') {
              return <PollCard key={item._id} poll={item} />;
            }

            const post = item;
            const author = post.author || {};
            const isOwnPost = author.username === user?.user?.username;

            return (
              <div key={post._id} style={styles.cardContainer} className="border border-secondary position-relative text-white bg-dark">
                <div style={styles.cardHeader}>
                  <Link to={`/user/${author._id}`} className="text-decoration-none text-white me-2">
                    {author.profileImage ? (
                      <img src={author.profileImage} alt={author.username} className="rounded-circle" style={{ width: "40px", height: "40px", objectFit: "cover" }} />
                    ) : (
                      <FaUserCircle className="fs-1 text-secondary" />
                    )}
                  </Link>
                  <div className="w-100 text-start">
                    <Link to={`/user/${author._id}`} className="text-white text-decoration-none fw-bold">
                      {author.username || "User"}
                      {author.isverified && (
                        <img src={verifiedBadge} alt="Verified" style={{ width: '18px', height: '18px', marginLeft: '5px' }} />
                      )}
                    </Link>
                    <div style={styles.footer}>
                      <span>{formatTimeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                  <div style={{ position: "relative" }}>
                    <FaEllipsisV
                      style={{ cursor: "pointer" }}
                      onClick={() => setShowMenu(showMenu === post._id ? null : post._id)}
                    />
                    {showMenu === post._id && (
                      <div
                        ref={menuRef}
                        className="bg-dark border border-secondary shadow rounded position-absolute"
                        style={{ top: "30px", right: "0px", zIndex: 1000, width: "120px" }}
                      >
                        <ul className="list-unstyled m-0 py-1 text-start">
                          {isOwnPost && (
                            <li className="dropdown-item px-3 py-2 border-bottom border-secondary text-danger fw-semibold" onClick={() => deletePost(post._id)} style={{ cursor: 'pointer' }}>
                              <FaTrash className="me-2" /> Delete
                            </li>
                          )}
                          <li className="dropdown-item px-3 py-2 text-white" onClick={() => reportPost(post._id)} style={{ cursor: 'pointer' }}>
                            <FaFlag className="me-2 text-warning" /> Report
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.cardImage} className="text-start">
                  <h5>
                    {post.caption.length > 150 ? `${post.caption.slice(0, 150)}...` : post.caption}
                    {post.caption.length > 150 && (
                      <Link to={`/post/${post._id}`} className="text-decoration-none">
                        <small className="text-info ms-2">More</small>
                      </Link>
                    )}
                  </h5>
                </div>

                <div style={styles.cardActions} className="user-select-none border-top border-secondary">
                  <div
                    onClick={() => toggleLike(post._id)}
                    style={{
                      ...styles.actionButton,
                      animation: likedPosts[post._id] ? "shake 0.5s ease-in-out" : "none",
                    }}
                  >
                    <span style={{ ...styles.icon, color: likedPosts[post._id] ? theme.secondary : "#aaa" }}>
                      {likedPosts[post._id] ? <FaHeart /> : <FaRegHeart />}
                    </span>
                    <span>{likedPosts[post._id] ? "Liked" : "Like"}</span>
                  </div>

                  <Link to={`/post/${post._id}`} className="text-decoration-none" style={styles.actionButton}>
                    <span style={styles.icon} className="text-secondary"><i className="fa-regular fa-comment"></i></span>
                    <span>Comment <small className="text-secondary">({post.comments ? post.comments.length : 0})</small></span>
                  </Link>

                  <div onClick={() => toggleSave(post._id)} style={styles.actionButton}>
                    <span style={{ ...styles.icon, color: savedPosts[post._id] ? "rgb(150, 100, 200)" : "#aaa" }}>
                      {savedPosts[post._id] ? <FaHeart /> : <FaRegHeart />}
                    </span>
                    <span>{savedPosts[post._id] ? "Saved" : "Save"}</span>
                  </div>
                </div>

                <div style={styles.cardContent} className="text-start border-top border-secondary small text-secondary">
                  <span style={styles.likesCount}>
                    {`${post.likes ? post.likes.length : 0} Likes`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles = {
  cardContainer: {
    width: "100%",
    maxWidth: "600px",
    margin: "20px auto",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 6px 12px rgba(0, 0, 0, 0.3)",
    transition: "transform 0.3s ease",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    position: "relative",
  },
  cardImage: {
    padding: "20px 24px",
  },
  cardActions: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 24px",
  },
  actionButton: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    transition: "color 0.3s ease",
    color: "#aaa",
    fontSize: "14px",
  },
  icon: {
    fontSize: "18px",
    marginRight: "6px",
  },
  cardContent: {
    padding: "8px 24px",
  },
  likesCount: {
    fontWeight: "600",
  },
  footer: {
    fontSize: "11px",
    color: "#888",
  },
};

export default Home;
