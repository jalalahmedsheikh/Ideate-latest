import React, { useState, useContext, useEffect } from "react";
import { FaUserCircle, FaShare, FaBookmark, FaRegBookmark } from "react-icons/fa";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import axiosInstance from "../pages/axiosInstance";

const theme = {
  primary: "rgb(40, 0, 65)",
  secondary: "#fd1d1d",
  lightGray: "#1e1e2d",
  green: "#2ecc71",
  red: "#e74c3c",
  blue: "#3498db",
  yellow: "#f1c40f",
};

const PollCard = ({ poll: initialPoll }) => {
  const { user } = useContext(UserContext);
  const currentUserId = user?.user?._id;

  const [poll, setPoll] = useState(initialPoll);
  const [votedOption, setVotedOption] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (poll && currentUserId) {
      // Find if current user has already voted in votesHistory
      const userVote = poll.votesHistory?.find(
        (v) => (v.user === currentUserId || v.user?._id === currentUserId)
      );
      if (userVote !== undefined) {
        setVotedOption(userVote.optionIndex);
      } else {
        setVotedOption(null);
      }

      // Check if poll is in user's bookmarks
      const bookmarked = user?.user?.bookmarks?.some(
        (bookmarkId) => (bookmarkId === poll._id || bookmarkId?._id === poll._id)
      );
      setIsSaved(!!bookmarked);
    }
  }, [poll, currentUserId, user]);

  if (!poll) return null;

  const totalVotes = poll.votes ? poll.votes.reduce((acc, curr) => acc + curr, 0) : 0;

  const handleVote = async (index) => {
    if (votedOption !== null) return; // Prevent multiple votes

    try {
      const response = await axiosInstance.post(`/poll/${poll._id}/vote`, {
        optionIndex: index,
      });
      if (response.data.success) {
        setPoll(response.data.poll);
        setVotedOption(index);
      }
    } catch (err) {
      console.error("Error casting vote:", err);
      alert(err.response?.data?.message || "Failed to vote. Please try again.");
    }
  };

  const handleSave = async () => {
    try {
      const response = await axiosInstance.post(`/poll/${poll._id}/savepoll`);
      if (response.data.success) {
        setIsSaved(!isSaved);
      }
    } catch (err) {
      console.error("Error saving poll:", err);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/poll/${poll._id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const calculatePercentage = (optionIndex) => {
    if (totalVotes === 0) return 0;
    const voteCount = poll.votes[optionIndex] || 0;
    return ((voteCount / totalVotes) * 100).toFixed(1);
  };

  const getOptionColor = (index) => {
    const colors = [theme.red, theme.green, theme.blue, theme.yellow, "#9b59b6"];
    return colors[index % colors.length];
  };

  // Get author details
  const authorName = poll.author?.username || "User";
  const authorAvatar = poll.author?.profileImage;

  // Format creation time
  let timeAgo = "some time ago";
  try {
    if (poll.createdAt) {
      timeAgo = formatDistanceToNow(new Date(poll.createdAt)) + " ago";
    }
  } catch (e) {
    console.error(e);
  }

  return (
    <div style={styles.cardContainer} className="border w-100 mb-4 bg-dark text-white">
      <div style={styles.cardHeader} className="border-bottom border-secondary text-start">
        <Link to={`/user/${poll.author?._id}`} className="text-decoration-none text-white d-flex align-items-center">
          {authorAvatar ? (
            <img src={authorAvatar} alt={authorName} style={styles.avatar} />
          ) : (
            <FaUserCircle className="fs-1 me-2 text-secondary" style={{ width: '40px', height: '40px' }} />
          )}
        </Link>
        <div>
          <Link to={`/user/${poll.author?._id}`} className="text-decoration-none text-white">
            <div style={styles.username}>{authorName}</div>
          </Link>
          <div style={styles.footer}>
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>

      <div style={styles.cardContent} className="user-select-none">
        <h3 style={styles.pollTitle}>{poll.question}</h3>
        {poll.options.map((option, index) => {
          const hasVoted = votedOption !== null;
          const isUserSelection = votedOption === index;
          const percentage = calculatePercentage(index);

          return (
            <div key={index} style={styles.optionContainer}>
              <div
                onClick={() => handleVote(index)}
                style={{
                  ...styles.optionButton,
                  backgroundColor: isUserSelection 
                    ? theme.primary 
                    : hasVoted 
                    ? "rgba(255, 255, 255, 0.05)" 
                    : "rgba(255, 255, 255, 0.1)",
                  cursor: hasVoted ? "default" : "pointer",
                  border: isUserSelection ? `1px solid ${getOptionColor(index)}` : "1px solid transparent",
                }}
              >
                <span className="fw-semibold">{option}</span>
                {hasVoted && <span className="ms-auto font-monospace">{percentage}%</span>}
              </div>

              {hasVoted && (
                <div style={styles.progressContainer}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{
                      ...styles.progressBar,
                      backgroundColor: getOptionColor(index),
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {totalVotes > 0 && (
          <div className="text-secondary small mt-3 text-start">
            Total Votes: {totalVotes}
          </div>
        )}
      </div>

      <div style={styles.cardActions} className="user-select-none border-top border-secondary">
        <div style={styles.actionButton} onClick={handleShare}>
          <FaShare style={styles.icon} />
          <span>{copySuccess ? "Link Copied!" : "Share"}</span>
        </div>
        <div style={styles.actionButton} onClick={handleSave}>
          {isSaved ? (
            <FaBookmark style={{ ...styles.icon, color: theme.secondary }} />
          ) : (
            <FaRegBookmark style={styles.icon} />
          )}
          <span>{isSaved ? "Saved" : "Save"}</span>
        </div>
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
    boxShadow: "0 6px 12px rgba(0, 0, 0, 0.25)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    marginRight: "10px",
    objectFit: "cover",
  },
  username: {
    fontSize: "15px",
    fontWeight: "bold",
    textAlign: "left",
  },
  cardContent: {
    padding: "16px",
  },
  pollTitle: {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "20px",
    textAlign: "left",
    lineHeight: "1.4",
  },
  optionContainer: {
    marginBottom: "15px",
  },
  optionButton: {
    padding: "12px 16px",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "all 0.2s ease-in-out",
  },
  progressContainer: {
    width: "100%",
    height: "6px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "3px",
    marginTop: "6px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: "3px",
  },
  cardActions: {
    display: "flex",
    justifyContent: "space-around",
    padding: "12px 16px",
  },
  actionButton: {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    transition: "color 0.2s ease",
    fontSize: "14px",
    color: "#a0a0b0",
  },
  icon: {
    fontSize: "18px",
    marginRight: "6px",
  },
  footer: {
    fontSize: "11px",
    color: "#888",
    textAlign: "left",
  },
};

export default PollCard;
