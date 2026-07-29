import axios from "axios";
import React, { useEffect, useState } from "react";
import { FaUserCircle, FaShare } from "react-icons/fa";  
import { FaRegHeart, FaHeart } from "react-icons/fa"; 
import { FaBookmark, FaRegBookmark } from "react-icons/fa"; 

const theme = {
  primary: "rgb(40, 0, 65)",
  secondary: "#fd1d1d",
  lightGray: "dark",
};

const PostCard = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); 
  const [likedPosts, setLikedPosts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});

  // Fetch Poll Data from API
  useEffect(() => {
    axios
      .get("http://localhost:8000/post/allposts")
      .then((response) => {
        setPosts(response.data.posts); 
        setLoading(false); 
      })
      .catch((error) => {
        setError("Error fetching posts");
        setLoading(false);
      });
  }, []);

  const toggleLike = (postId) => {
    setLikedPosts(prevState => ({
      ...prevState,
      [postId]: !prevState[postId],
    }));
  };

  const toggleSave = (postId) => {
    setSavedPosts(prevState => ({
      ...prevState,
      [postId]: !prevState[postId],
    }));
  };

  if (loading) {
    return <div className='text-center'>Loading posts...</div>;
  }

  if (error) {
    return <div className='text-center'>{error}</div>;
  }

  return (
    <div className="app">
      <h1 className="text-white text-center">Home</h1>
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
        `}
      </style>
      {posts.map((post) => (
        <div key={post.id} style={styles.cardContainer} className="border">
          <div style={styles.cardHeader}>
            <div>
              <FaUserCircle className="fs-1 me-2" />
            </div>
            <div>
              <div style={styles.username}>{post.username || "john_doe"}</div>
              <div style={styles.footer}>
                <span>{post.timestamp || "2 hours ago"}</span>
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
      ))}
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
    height: "300px",
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

export default PostCard;
