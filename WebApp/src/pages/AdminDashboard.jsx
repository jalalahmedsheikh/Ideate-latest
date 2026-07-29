import React, { useState, useEffect } from "react";
import axiosInstance from "./axiosInstance";
import styled from "styled-components";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaUsers, FaChartBar, FaExclamationTriangle, FaCheck, FaTrash,
  FaUserSlash, FaCertificate, FaSearch, FaBullhorn, FaPaperPlane,
  FaFolderOpen, FaCrown, FaBan
} from "react-icons/fa";

// ── Styling Design Tokens ────────────────────────────────────────────────────
const DashboardContainer = styled.div`
  max-width: 1250px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  color: #fff;
  font-family: 'Outfit', sans-serif;
  background-color: #0b0b0f;
  min-height: 100vh;
`;

const Header = styled.div`
  margin-bottom: 2.5rem;
  background: linear-gradient(135deg, #161622 0%, #0d0d14 100%);
  padding: 2.5rem;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
  text-align: left;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(131, 58, 180, 0.15) 0%, transparent 70%);
    pointer-events: none;
  }

  h1 {
    font-size: 2.6rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    background: linear-gradient(90deg, #fd1d1d, #833ab4, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -1px;
  }

  p {
    color: #9494a3;
    font-size: 1.05rem;
    margin: 0;
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 0.8rem;
  margin-bottom: 2.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 1.2rem;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const TabButton = styled.button`
  background: ${props => props.active ? "linear-gradient(135deg, #7828b4 0%, #4a1570 100%)" : "rgba(255, 255, 255, 0.02)"};
  color: ${props => props.active ? "#fff" : "#9494a3"};
  border: 1px solid ${props => props.active ? "rgba(120, 40, 180, 0.4)" : "rgba(255, 255, 255, 0.05)"};
  padding: 0.8rem 1.6rem;
  border-radius: 30px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.95rem;

  &:hover {
    color: #fff;
    background: ${props => props.active ? "linear-gradient(135deg, #7828b4 0%, #4a1570 100%)" : "rgba(255, 255, 255, 0.06)"};
    border-color: ${props => props.active ? "rgba(120, 40, 180, 0.6)" : "rgba(255, 255, 255, 0.15)"};
    transform: translateY(-2px);
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
`;

const StatCard = styled(motion.div)`
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 20px;
  padding: 1.8rem;
  text-align: center;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: ${props => props.color || "linear-gradient(90deg, #fd1d1d, #833ab4)"};
  }

  .icon {
    font-size: 2.2rem;
    margin-bottom: 0.8rem;
  }

  h3 {
    font-size: 2.4rem;
    font-weight: 800;
    margin: 0 0 0.25rem;
    letter-spacing: -1px;
  }

  p {
    color: #9494a3;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin: 0;
    font-weight: 600;
  }
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  
  @media (min-width: 992px) {
    grid-template-columns: 2fr 1fr;
  }
`;

const ContentPanel = styled.div`
  background: rgba(25, 25, 35, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 30px;
  padding: 0.6rem 1.6rem;
  margin-bottom: 1.8rem;
  max-width: 480px;

  input {
    background: transparent;
    border: none;
    color: #fff;
    margin-left: 0.75rem;
    outline: none;
    width: 100%;
    font-size: 0.95rem;

    &::placeholder {
      color: #666;
    }
  }
`;

const TableContainer = styled.div`
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
`;

const CustomTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;

  th, td {
    padding: 1.1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  th {
    background: rgba(255, 255, 255, 0.03);
    color: #9494a3;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.8rem;
    letter-spacing: 1px;
  }

  tr:hover {
    background: rgba(255, 255, 255, 0.015);
  }
`;

const Badge = styled.span`
  background: ${props => props.type === "admin" ? "rgba(131, 58, 180, 0.15)" : "rgba(253, 29, 29, 0.12)"};
  color: ${props => props.type === "admin" ? "#c19bf5" : "#ff7676"};
  border: 1px solid ${props => props.type === "admin" ? "rgba(131, 58, 180, 0.35)" : "rgba(253, 29, 29, 0.3)"};
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
`;

const ActionButton = styled.button`
  background: ${props =>
    props.variant === "danger"
      ? "rgba(253, 29, 29, 0.12)"
      : props.variant === "success"
      ? "rgba(56, 239, 125, 0.12)"
      : "rgba(255, 255, 255, 0.03)"};
  color: ${props =>
    props.variant === "danger"
      ? "#ff7676"
      : props.variant === "success"
      ? "#38ef7d"
      : "#e1e1e6"};
  border: 1px solid ${props =>
    props.variant === "danger"
      ? "rgba(253, 29, 29, 0.3)"
      : props.variant === "success"
      ? "rgba(56, 239, 125, 0.3)"
      : "rgba(255, 255, 255, 0.08)"};
  padding: 0.5rem 1.1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 0.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  &:hover {
    background: ${props =>
      props.variant === "danger"
        ? "rgba(253, 29, 29, 0.22)"
        : props.variant === "success"
        ? "rgba(56, 239, 125, 0.22)"
        : "rgba(255, 255, 255, 0.08)"};
    transform: translateY(-1px);
  }
`;

const NotificationForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: rgba(25, 25, 35, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 24px;
  padding: 2.2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  h3 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #ff9f43;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
    
    label {
      font-size: 0.85rem;
      color: #9494a3;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
  }

  textarea {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem;
    color: #fff;
    font-size: 0.95rem;
    resize: none;
    height: 110px;
    outline: none;
    transition: border-color 0.2s ease;

    &:focus {
      border-color: #ff9f43;
    }
  }

  select {
    background: #181824;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.8rem 1rem;
    color: #fff;
    font-size: 0.95rem;
    outline: none;
    cursor: pointer;
  }

  input[type="text"] {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 0.8rem 1rem;
    color: #fff;
    font-size: 0.95rem;
    outline: none;
  }
`;

const ContentCard = styled.div`
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 16px;
  padding: 1.4rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;

  .main-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
    
    .type-badge {
      align-self: flex-start;
      font-size: 0.7rem;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-weight: 700;
      text-transform: uppercase;
      background: ${props => props.contentType === "Post" ? "rgba(59, 130, 246, 0.15)" : "rgba(139, 92, 246, 0.15)"};
      color: ${props => props.contentType === "Post" ? "#3b82f6" : "#8b5cf6"};
      border: 1px solid ${props => props.contentType === "Post" ? "rgba(59, 130, 246, 0.3)" : "rgba(139, 92, 246, 0.3)"};
    }

    .body-text {
      font-size: 0.95rem;
      color: #e1e1e6;
      margin: 0;
      line-height: 1.4;
    }

    .author-info {
      font-size: 0.8rem;
      color: #666;
    }
  }
`;

const SearchDropdown = styled.div`
  background: #181824;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  max-height: 160px;
  overflow-y: auto;
  margin-top: 0.5rem;
  
  .dropdown-item {
    padding: 0.6rem 1rem;
    cursor: pointer;
    text-align: left;
    font-size: 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    
    &:hover {
      background: rgba(255, 255, 255, 0.05);
    }
  }
`;

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [content, setContent] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Broadcast Notification form state
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyTarget, setNotifyTarget] = useState("all");
  const [notifyUserId, setNotifyUserId] = useState("");
  const [notifyUserSearch, setNotifyUserSearch] = useState("");
  const [dropdownUsers, setDropdownUsers] = useState([]);

  useEffect(() => {
    fetchAnalytics();
    fetchUsers();
    fetchReports();
    fetchContent();
  }, []);

  useEffect(() => {
    if (activeTab === "content") {
      fetchContent();
    }
  }, [searchQuery, activeTab]);

  const fetchAnalytics = async () => {
    try {
      const res = await axiosInstance.get("/admin/analytics");
      if (res.data.success) {
        setAnalytics(res.data.analytics);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get("/admin/users");
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await axiosInstance.get("/admin/reports");
      if (res.data.success) {
        setReports(res.data.reports);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContent = async () => {
    try {
      const res = await axiosInstance.get(`/admin/content?search=${searchQuery}`);
      if (res.data.success) {
        setContent(res.data.content);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBanToggle = async (userId) => {
    try {
      const res = await axiosInstance.post("/admin/users/ban", { targetUserId: userId });
      if (res.data.success) {
        fetchUsers();
        fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyToggle = async (userId) => {
    try {
      const res = await axiosInstance.post("/admin/users/verify", { targetUserId: userId });
      if (res.data.success) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveReport = async (reportId, action) => {
    try {
      const res = await axiosInstance.post("/admin/reports/resolve", { reportId, action });
      if (res.data.success) {
        fetchReports();
        fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteContent = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      const res = await axiosInstance.post("/admin/content/delete", { id, type });
      if (res.data.success) {
        fetchContent();
        fetchAnalytics();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notifyMsg.trim()) return alert("Please type a notification message.");
    if (notifyTarget === "single" && !notifyUserId) return alert("Please select a target user.");

    try {
      const res = await axiosInstance.post("/admin/notify", {
        message: notifyMsg,
        targetType: notifyTarget,
        targetUserId: notifyUserId
      });
      if (res.data.success) {
        alert("Broadcast notification sent successfully!");
        setNotifyMsg("");
        setNotifyUserSearch("");
        setNotifyUserId("");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to send notification.");
    }
  };

  const handleUserSearchChange = (val) => {
    setNotifyUserSearch(val);
    if (!val.trim()) {
      setDropdownUsers([]);
      return;
    }
    const filtered = users.filter(u =>
      u.username.toLowerCase().includes(val.toLowerCase())
    );
    setDropdownUsers(filtered.slice(0, 5));
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardContainer>
      <Header>
        <h1>Admin Control Room</h1>
        <p>100% full database configuration, content controls, and instant system notifications</p>
      </Header>

      <TabContainer>
        <TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
          <FaChartBar /> Analytics
        </TabButton>
        <TabButton active={activeTab === "users"} onClick={() => setActiveTab("users")}>
          <FaUsers /> Users
        </TabButton>
        <TabButton active={activeTab === "content"} onClick={() => setActiveTab("content")}>
          <FaFolderOpen /> Registry
        </TabButton>
        <TabButton active={activeTab === "reports"} onClick={() => { setActiveTab("reports"); fetchReports(); }}>
          <FaExclamationTriangle /> Moderation Queue
        </TabButton>
        <TabButton active={activeTab === "broadcast"} onClick={() => setActiveTab("broadcast")}>
          <FaBullhorn /> Broadcaster
        </TabButton>
      </TabContainer>

      <AnimatePresence mode="wait">
        {/* ── Analytics Tab ── */}
        {activeTab === "analytics" && analytics && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            key="analytics"
          >
            <StatsGrid>
              <StatCard color="linear-gradient(90deg, #3b82f6, #00f2fe)" whileHover={{ scale: 1.02 }}>
                <FaUsers className="icon" style={{ color: "#3b82f6" }} />
                <h3>{analytics.totalUsers}</h3>
                <p>Total Registered Users</p>
              </StatCard>
              <StatCard color="linear-gradient(90deg, #fd1d1d, #ff7676)" whileHover={{ scale: 1.02 }}>
                <FaChartBar className="icon" style={{ color: "#fd1d1d" }} />
                <h3>{analytics.activeUsersCount}</h3>
                <p>Estimated Active Users</p>
              </StatCard>
              <StatCard color="linear-gradient(90deg, #38ef7d, #11998e)" whileHover={{ scale: 1.02 }}>
                <FaFolderOpen className="icon" style={{ color: "#38ef7d" }} />
                <h3>{analytics.totalPosts + analytics.totalPolls}</h3>
                <p>Active Posts & Polls</p>
              </StatCard>
              <StatCard color="linear-gradient(90deg, #f9d423, #ff4e50)" whileHover={{ scale: 1.02 }}>
                <FaExclamationTriangle className="icon" style={{ color: "#f9d423" }} />
                <h3>{analytics.pendingReportsCount}</h3>
                <p>Pending Reports</p>
              </StatCard>
              <StatCard color="linear-gradient(90deg, #833ab4, #fd1d1d)" whileHover={{ scale: 1.02 }}>
                <div className="icon">⚡</div>
                <h3>{analytics.engagementRate}%</h3>
                <p>Avg Engagement Rate</p>
              </StatCard>
            </StatsGrid>
          </motion.div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            key="users"
          >
            <SearchBar>
              <FaSearch color="#aaa" />
              <input
                type="text"
                placeholder="Search database users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchBar>

            <TableContainer>
              <CustomTable>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user._id}>
                      <td style={{ fontWeight: "600" }}>@{user.username}</td>
                      <td>{user.email || "N/A"}</td>
                      <td>
                        <Badge type={user.role}>{user.role}</Badge>
                      </td>
                      <td>
                        {user.isBanned ? (
                          <span style={{ color: "#ff7676", fontWeight: "700" }}>Banned</span>
                        ) : (
                          <span style={{ color: "#38ef7d", fontWeight: "700" }}>Active</span>
                        )}
                      </td>
                      <td>
                        <ActionButton
                          variant="danger"
                          onClick={() => handleBanToggle(user._id)}
                        >
                          <FaBan />
                          {user.isBanned ? "Unban" : "Ban"}
                        </ActionButton>
                        <ActionButton
                          onClick={() => handleVerifyToggle(user._id)}
                          style={{ borderColor: user.isverified ? "#38ef7d" : "rgba(255,255,255,0.08)" }}
                        >
                          <FaCertificate style={{ color: user.isverified ? "#38ef7d" : "#aaa" }} />
                          {user.isverified ? "Unverify" : "Verify"}
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </CustomTable>
            </TableContainer>
          </motion.div>
        )}

        {/* ── Content Tab (Registry) ── */}
        {activeTab === "content" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            key="content"
          >
            <SearchBar>
              <FaSearch color="#aaa" />
              <input
                type="text"
                placeholder="Search all posts and polls by text/caption..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </SearchBar>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {content.length === 0 ? (
                <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>No matching posts or polls found in registry.</p>
              ) : (
                content.map(item => (
                  <ContentCard key={item._id} contentType={item.type}>
                    <div className="main-info">
                      <span className="type-badge">{item.type}</span>
                      <p className="body-text">
                        {item.type === "Post" ? item.caption : item.question}
                      </p>
                      <span className="author-info">
                        By @{item.author?.username || "unknown"} • {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <ActionButton variant="danger" onClick={() => handleDeleteContent(item._id, item.type)}>
                      <FaTrash /> Delete
                    </ActionButton>
                  </ContentCard>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* ── Moderation Queue Tab ── */}
        {activeTab === "reports" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            key="reports"
          >
            {reports.length === 0 ? (
              <p style={{ color: "#aaa", textAlign: "center", marginTop: "3rem" }}>No pending reports. Community is clean!</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {reports.map(report => (
                  <div key={report._id} style={{ background: 'rgba(25,25,35,0.4)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9b59b6', textTransform: 'uppercase' }}>{report.targetType} Report</span>
                        <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: 4, background: 'rgba(249, 212, 35, 0.15)', color: '#f9d423' }}>{report.status}</span>
                      </div>
                      <div style={{ color: '#ff7676', fontSize: '0.9rem', marginBottom: '1rem', fontStyle: 'italic' }}>Reason: {report.reason}</div>
                      {report.targetContent && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 8, fontSize: '0.85rem', color: '#ccc', textAlign: 'left', marginBottom: '1rem' }}>
                          {report.targetType === "Post" && (
                            <>
                              <strong>Post Author:</strong> @{report.targetContent.author?.username}<br/>
                              <strong>Content:</strong> {report.targetContent.caption}
                            </>
                          )}
                          {report.targetType === "Poll" && (
                            <>
                              <strong>Poll Author:</strong> @{report.targetContent.author?.username}<br/>
                              <strong>Question:</strong> {report.targetContent.question}
                            </>
                          )}
                          {report.targetType === "User" && (
                            <>
                              <strong>User Profile:</strong> @{report.targetContent.username}
                            </>
                          )}
                        </div>
                      )}
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.5rem', textAlign: 'left' }}>Reported by: @{report.reportedBy?.username || "unknown"}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <ActionButton variant="success" onClick={() => handleResolveReport(report._id, "dismiss")}>
                        <FaCheck /> Dismiss
                      </ActionButton>
                      <ActionButton variant="danger" onClick={() => handleResolveReport(report._id, "delete_content")}>
                        <FaTrash /> Action
                      </ActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── System Broadcaster Tab ── */}
        {activeTab === "broadcast" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            key="broadcast"
            style={{ maxWidth: 600, margin: '0 auto' }}
          >
            <NotificationForm onSubmit={handleSendNotification}>
              <h3><FaBullhorn /> Push System Notification</h3>
              
              <div className="form-group">
                <label>Recipients</label>
                <select value={notifyTarget} onChange={(e) => setNotifyTarget(e.target.value)}>
                  <option value="all">Broadcast to All Users</option>
                  <option value="single">Single Selected User</option>
                </select>
              </div>

              {notifyTarget === "single" && (
                <div className="form-group">
                  <label>Search User</label>
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={notifyUserSearch}
                    onChange={(e) => handleUserSearchChange(e.target.value)}
                  />
                  {dropdownUsers.length > 0 && (
                    <SearchDropdown>
                      {dropdownUsers.map(u => (
                        <div
                          key={u._id}
                          className="dropdown-item"
                          onClick={() => {
                            setNotifyUserId(u._id);
                            setNotifyUserSearch(`@${u.username}`);
                            setDropdownUsers([]);
                          }}
                        >
                          @{u.username} ({u.email || "No Email"})
                        </div>
                      ))}
                    </SearchDropdown>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Notification Message</label>
                <textarea
                  placeholder="Enter important app announcements or alert messages to users..."
                  value={notifyMsg}
                  onChange={(e) => setNotifyMsg(e.target.value)}
                />
              </div>

              <ActionButton variant="success" type="submit" style={{ padding: '0.8rem', justifyContent: 'center' }}>
                <FaPaperPlane /> Send Broadcast
              </ActionButton>
            </NotificationForm>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardContainer>
  );
}
