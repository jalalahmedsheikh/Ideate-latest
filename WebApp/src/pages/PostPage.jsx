import React, { useEffect, useState, useRef, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FaUserCircle,
  FaRegHeart,
  FaHeart,
  FaEllipsisV
} from 'react-icons/fa';
import verifiedBadge from '../assets/images/verified.png';
import LoadingSpinner from '../components/Loading';
import { UserContext } from '../contexts/UserContext';

const theme = {
  primary: 'rgb(0, 0, 0)',
  secondary: '#fd1d1d',
  lightGray: 'dark',
};

const PostPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const {user} = useContext(UserContext);
  const [activeDropdown, setActiveDropdown] = useState(null); // State to track which dropdown is open
  console.log(user);
  

  // Handle outside click to close the dropdown
  const menuRef = useRef();
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveDropdown(null); // Close the dropdown when clicking outside
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const response = await fetch(`http://localhost:8000/post/${id}`);
        const data = await response.json();
        setPost(data.post);
      } catch (error) {
        console.error('Error fetching post:', error);
      }
    };

    const fetchComments = async () => {
      try {
        const response = await fetch(`http://localhost:8000/post/${id}/comment/all`);
        const data = await response.json();
        setComments(data.comments || []);
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    };

    fetchPost();
    fetchComments();
  }, [id]);

  const toggleLike = (postId) => {
    setLikedPosts((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const formatTimeAgo = (date) => {
    const time = new Date(date);
    const now = new Date();
    const diff = now - time;
    const minutes = Math.floor(diff / 1000 / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(diff / 1000 / 60 / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(diff / 1000 / 60 / 60 / 24);
    return `${days} days ago`;
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const newComment = { content: commentText };

    try {
      const response = await fetch(`http://localhost:8000/post/${id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComment),
      });

      const data = await response.json();
      if (data.success) {
        setComments((prev) => [...prev, data.comment]);
        setCommentText('');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const deletePost = async () => {
    try {
      await fetch(`http://localhost:8000/post/delete/${id}`, { method: 'DELETE' });
      navigate('/'); // Redirect to home after deleting
    } catch (err) {
      console.error('Error deleting post', err);
    }
  };

  const reportPost = async () => {
    try {
      await fetch(`http://localhost:8000/post/${id}/report`, { method: 'POST' });
      setActiveDropdown(null); // Close dropdown after reporting
      alert('Reported successfully.');
    } catch (err) {
      console.error('Error reporting post', err);
    }
  };

  const toggleDropdown = (dropdownId) => {
    setActiveDropdown((prev) => (prev === dropdownId ? null : dropdownId)); // Toggle dropdown open/close
  };

  if (!post) return <div><LoadingSpinner /></div>;

  return (
    <div key={post._id} style={styles.cardContainer} className="border">
      <div style={styles.cardHeader}>
        <Link className="text-decoration-none text-white" to={`/user/${post.author._id}`}>
          {post.author.profileImage ? (
            <img src={post.author.profileImage} alt={post.author.username} style={styles.profileIcon} />
          ) : (
            <FaUserCircle className="fs-1 me-2" />
          )}
        </Link>
        <div className="w-100">
          <Link className="text-decoration-none text-white fw-bold" to={`/user/${post.author._id}`}>
            {post.author.username || 'User'}
            {post.author.isverified && (
              <img
                src={verifiedBadge}
                alt="Verified"
                style={styles.verifiedBadge}
              />
            )}
          </Link>
          <div style={styles.footer}>
            <span>{formatTimeAgo(post.createdAt)}</span>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <FaEllipsisV
            style={styles.menuIcon}
            onClick={() => toggleDropdown('post')}
          />
          {activeDropdown === 'post' && (
            <div ref={menuRef} style={styles.menu}>
              <ul className="list-unstyled m-0 p-2">
                {post.author.username == user.user.username ? <li className="dropdown-item text-dark" onClick={deletePost} style={styles.menuItem}>Delete</li> : ""}
                <li className="dropdown-item text-dark" onClick={reportPost} style={styles.menuItem}>Report</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div style={styles.cardImage}>
        <h5>{post.caption}</h5>
      </div>

      <div style={styles.cardActions} className="user-select-none">
        <div onClick={() => toggleLike(post._id)} style={styles.actionButton}>
          <span style={{ ...styles.icon, color: likedPosts[post._id] ? theme.primary : theme.secondary }}>
            {likedPosts[post._id] ? <FaHeart /> : <FaRegHeart className="text-white" />}
          </span>
          <span>{likedPosts[post._id] ? 'Liked' : 'Like'}</span>
        </div>
      </div>

      <div style={styles.cardContent}>
        <span style={styles.likesCount}>{`${post.likes.length} Likes`}</span>
      </div>
      <hr />

      <div style={styles.commentsList}>
        {comments.map((comment, index) => (
          <div key={index} style={styles.commentItem}>
            <div style={styles.commentBubble}>
              <div className="d-flex align-items-start">
                <Link className="text-decoration-none text-white" to={`/user/${comment.author._id}`}>
                  {comment.author.profileImage ? (
                    <img src={comment.author.profileImage} alt={comment.author.username} style={styles.profileIcon} />
                  ) : (
                    <FaUserCircle className="fs-1 me-2" />
                  )}
                </Link>
                <div className="w-100">
                  <Link className="text-decoration-none text-white fw-bold" to={`/user/${comment.author._id}`}>
                    {comment.author.username || "User"}
                    {comment.author.isverified && (
                      <img
                        src={verifiedBadge}
                        alt="Verified"
                        style={styles.verifiedBadge}
                      />
                    )}
                  </Link>
                  <small style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</small>
                </div>
                <div style={{ position: 'relative' }}>
                  <FaEllipsisV
                    style={styles.menuIcon}
                    onClick={() => toggleDropdown(`comment-${comment._id}`)} // Use unique id for each comment dropdown
                  />
                  {activeDropdown === `comment-${comment._id}` && (
                    <div ref={menuRef} style={styles.menu}>
                      <ul className="list-unstyled m-0 p-2">
                        <li className="dropdown-item text-dark" style={styles.menuItem}>Edit</li>
                        <li className="dropdown-item text-dark" style={styles.menuItem}>Delete</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div>{comment.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Comment Section */}
      <div style={styles.commentSection} className="mb-5 pb-4 pb-lg-0 mb-lg-0 fixed-bottom d-flex align-items-center justify-content-between px-3">
        <form onSubmit={handleCommentSubmit} style={styles.commentForm} className="w-100 d-flex">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            style={styles.commentInput}
          />
          <button type="submit" style={styles.commentButton}>
            Post
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  cardContainer: {
    width: '100%',
    maxWidth: '500px',
    margin: '20px auto',
    backgroundColor: theme.lightGray,
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    position: 'relative',
  },
  profileIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    marginRight: '10px',
  },
  verifiedBadge: {
    width: '14px',
    height: '14px',
    marginLeft: '5px',
    verticalAlign: 'middle',
  },
  menuIcon: {
    cursor: 'pointer',
    color: '#ccc',
  },
  menu: {
    position: 'absolute',
    top: '30px',
    right: '0',
    zIndex: 1000,
    backgroundColor: '#fff',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: '5px',
    padding: '5px 10px',
  },
  menuItem: {
    cursor: 'pointer',
    padding: '5px',
    fontSize: '14px',
  },
  cardImage: {
    width: '100%',
    overflow: 'hidden',
    padding: '20px',
  },
  cardActions: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 15px',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  icon: {
    fontSize: '20px',
    marginRight: '5px',
  },
  cardContent: {
    padding: '0px 15px',
  },
  likesCount: {
    fontWeight: 'bold',
  },
  footer: {
    fontSize: '12px',
    color: '#888',
  },
  commentSection: {
    padding: '10px 15px',
    borderTop: '1px solid gray',
    backgroundColor: 'white',
    boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
  },
  commentForm: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
  },
  commentInput: {
    padding: '10px',
    marginRight: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    width: '80%',
    fontSize: '14px',
    resize: 'none',
  },
  commentButton: {
    padding: '10px 15px',
    backgroundColor: theme.primary,
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  commentsList: {
    padding: '0 15px',
  },
  commentItem: {
    marginBottom: '10px',
    fontSize: '14px',
  },
  commentBubble: {
    borderBottom: '1px solid gray',
    borderRadius: '0 0 20px 0',
    padding: '10px',
    margin: '5px 0',
    maxWidth: '80%',
    wordWrap: 'break-word',
  },
  commentTime: {
    fontSize: '12px',
    color: '#888',
  },
};

export default PostPage;
