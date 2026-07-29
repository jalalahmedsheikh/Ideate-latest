import axios from "axios";
import React, { useEffect, useState } from "react";
import { FaUserCircle, FaShare, FaEllipsisV } from "react-icons/fa";
import { FaRegHeart, FaHeart } from "react-icons/fa";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import { Link, Navigate } from "react-router-dom";
import Cookies from 'js-cookie';
import { formatDistanceToNow, parseISO } from 'date-fns';
import verifiedBadge from '../assets/images/verified.png';
import { animate } from "framer-motion";

const theme = {
  primary: "rgb(40, 0, 65)",
  secondary: "#fd1d1d",
  lightGray: "dark",
};

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});
  const [activeTab, setActiveTab] = useState("explore"); // "explore" or "followings"
  const [showMenu, setShowMenu] = useState(null); // State to track the open menu

  // Fetch Posts from API
  const fetchPosts = (tab) => {
    setLoading(true); // Show loading

    if (tab === "explore") {
      const url = "http://localhost:8000/post/followings";
      axios
        .get(url)
        .then((response) => {
          setPosts(response.data.posts);
          setLoading(false); // Hide loading
        })
        .catch((error) => {
          setError("No posts to show. Follow some users to see their posts.");
          setLoading(false); // Hide loading
        });
    } else {
      // For "followings" tab, we clear the posts or show an empty state.
      setPosts([]);
      setLoading(false); // Hide loading immediately for empty followings state
    }
  };

  useEffect(() => {
    fetchPosts(activeTab); // Fetch posts for the active tab
  }, [activeTab]); // When tab changes, fetch posts

  // Toggle like functionality
  const toggleLike = async (postId) => {
    try {
      if (likedPosts[postId]) {
        const token = Cookies.get('token');
        // If no token is found, redirect to Auth page
        return !token ? <Navigate to="/auth" /> : await axios.post(`http://localhost:8000/post/${postId}/dislike`);
        setLikedPosts((prevState) => ({
          ...prevState,
          [postId]: false,
        }));
      } else {
        const token = Cookies.get('token');
        // If no token is found, redirect to Auth page
        return !token ? <Navigate to="/auth" /> : await axios.post(`http://localhost:8000/post/${postId}/like`);
        setLikedPosts((prevState) => ({
          ...prevState,
          [postId]: true,
        }));
      }
    } catch (error) {
      console.error("Error toggling like", error);
    }
  };

  // Toggle save functionality
  const toggleSave = async (postId) => {
    try {
      if (savedPosts[postId]) {
        await axios.post(`http://localhost:8000/post/${postId}/unsavepost`);
        setSavedPosts((prevState) => ({
          ...prevState,
          [postId]: false,
        }));
      } else {
        await axios.post(`http://localhost:8000/post/${postId}/savepost`);
        setSavedPosts((prevState) => ({
          ...prevState,
          [postId]: true,
        }));
      }
    } catch (error) {
      console.error("Error toggling save", error);
    }
  };

  // Handle delete post
  const deletePost = async (postId) => {
    try {
      await axios.delete(`http://localhost:8000/post/${postId}`);
      setPosts(posts.filter((post) => post.id !== postId)); // Remove the post from the state
      setShowMenu(null); // Close the menu
    } catch (error) {
      console.error("Error deleting post", error);
    }
  };

  // Handle report post
  const reportPost = async (postId) => {
    try {
      await axios.post(`http://localhost:8000/post/${postId}/report`);
      setShowMenu(null); // Close the menu
    } catch (error) {
      console.error("Error reporting post", error);
    }
  };

  // Function to format time to "time ago" format
  const formatTimeAgo = (createdAt) => {
    const parsedDate = parseISO(createdAt); // Parse the ISO date
    return formatDistanceToNow(parsedDate) + ' ago'; // Format the date to "time ago"
  };

  if (loading) {
    return <div className="text-center">Loading posts...</div>;
  }

  if (error) {
    return <div className="text-center">{error}</div>;
  }

  return (
    <div className="app">
      <div className="head sticky-top user-select-none">
        {/* <h1 className="text-white text-center">Home</h1> */}
        {/* Tab Navigation */}
        <div className="tabs-container">
          {/* <div
            className={`tab ${activeTab === "explore" ? "text-white border-bottom border-3 rounded-0" : "text-secondary"}`}
            onClick={() => setActiveTab("explore")}
          >
            Explore
          </div> */}
          <div
            className={`tab text-white border-bottom border-3 rounded-0`}
            // onClick={() => setActiveTab("followings")}
          >
            Followings
          </div>
        </div>
      </div>

      {/* Adding the shake animation style directly here */}
      <style>
        {`
          @keyframes shake {
            0% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            50% { transform: translateX(5px); }
            75% { transform: translateX(-5px); }
            100% { transform: translateX(0); }
          }
          .tabs-container {
            display: flex;
            justify-content: center;
            margin-top: 20px;
          }
          .tab {
            margin: 0 20px;
            padding: 10px 20px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            color: #fff;
            border-radius: 8px;
          }
          .tab.active {
            background-color: ${theme.primary};
          }
        `}
      </style>

      {/* Conditional Rendering for Followings Tab */}
      {activeTab === "followings" && posts.length === 0 ? (
        <div className="text-center mt-5">
          <h5>No posts to show. Follow some users to see their posts.</h5>
        </div>
      ) : (
        // Display Posts
        posts.map((post) => (
          <div key={post.id} style={styles.cardContainer} className="border">
            <div style={styles.cardHeader}>
              <div>
                {
                  post.author.profileImage ? <img src={post.author.profileImage} alt={post.author.username} /> : <FaUserCircle className="fs-1 me-2" />
                }
              </div>
              <div className="w-100">
                <Link className=" user-select-none text-decoration-none text-white" to={`/user/${post.author._id}`} style={styles.username}>
                  {post.author.username || "User"}{post.author.isverified ? <img
                    src={verifiedBadge}
                    alt="Verified"
                    style={{ width: '20px', height: '15px', marginLeft: '3px', verticalAlign: 'middle' }}
                    className=""
                  /> : ""}
                </Link>
                <div style={styles.footer}>
                  <span>{formatTimeAgo(post.createdAt)}</span> {/* Display the formatted time */}
                </div>
              </div>
            </div>
            <div style={styles.cardImage}>
              <h5>{post.caption}</h5>
            </div>
            <div style={styles.cardActions} className="user-select-none">
              <div
                onClick={() => toggleLike(post.id)}
                style={{
                  ...styles.actionButton,
                  animation: likedPosts[post.id] ? "shake 0.5s ease-in-out" : "none",
                }}
              >
                <span
                  style={{
                    ...styles.icon,
                    color: likedPosts[post.id] ? theme.primary : theme.secondary,
                  }}
                >
                  {likedPosts[post.id] ? <FaHeart /> : <FaRegHeart />}
                </span>
                <span>{likedPosts[post.id] ? "Liked" : "Like"}</span>
              </div>
              <div style={styles.actionButton}>
                <span style={styles.icon}><i className="fa-regular fa-comment"></i></span>
                <span>Comment</span>
              </div>
              <div style={styles.actionButton}>
                <span style={styles.icon}><FaShare /></span>
                <span>Share</span>
              </div>
              <div onClick={() => toggleSave(post.id)} style={styles.actionButton}>
                <span style={styles.icon}>
                  {savedPosts[post.id] ? <FaBookmark /> : <FaRegBookmark />}
                </span>
                <span>{savedPosts[post.id] ? "Saved" : "Save"}</span>
              </div>
            </div>
            <div style={styles.cardContent}>
              <span style={styles.likesCount}>
                {likedPosts[post.id] ? "1 Like" : "0 Likes"}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const styles = {
  cardContainer: {
    width: "100%",
    maxWidth: "500px",
    margin: "20px auto",
    backgroundColor: theme.lightGray,
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.3s ease",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    padding: "10px",
  },
  username: {
    fontSize: "16px",
    fontWeight: "bold",
  },
  cardImage: {
    width: "100%",
    overflow: "hidden",
    padding: "25px",
  },
  cardActions: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 15px",
  },
  actionButton: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    transition: "color 0.3s ease",
  },
  icon: {
    fontSize: "20px",
    marginRight: "5px",
  },
  cardContent: {
    padding: "10px 15px",
  },
  likesCount: {
    fontWeight: "bold",
  },
  footer: {
    fontSize: "12px",
    color: "#888",
  },
};

export default Home;

