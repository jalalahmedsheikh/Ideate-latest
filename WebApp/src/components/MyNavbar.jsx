import React, { useState, useEffect, useContext } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import axios from "axios";
import { FaUserCircle } from "react-icons/fa";
import verifiedBadge from '../assets/images/verified.png';
import { UserContext } from "../contexts/UserContext";
import { useSocket } from "../contexts/SocketContext";

export default function MyNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const { user } = useContext(UserContext);
  const { unreadCount } = useSocket();

  useEffect(() => {
    // Check if JWT exists in cookies to determine if the user is logged in
    const jwtToken = Cookies.get("token");
    if (jwtToken) {
      setIsLoggedIn(true); // User is logged in
    } else {
      setIsLoggedIn(false); // User is not logged in
    }

    // Fetch suggested users
    axios
      .get("http://localhost:8000/user/suggestions")
      .then((response) => {
        console.log("Result => ", response);
        setSuggestedUsers(response.data.suggestedUsers); // Update state with fetched users
      })
      .catch((error) => {
        console.error("Error fetching suggested users:", error);
      });
  }, []); // Run once on mount

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { path: "/", label: "Home", icon: "fa-home" },
    { path: "/followings", label: "Followings", icon: "fa-users" },
    { path: "/create", label: "Create", icon: "fa-solid fa-file-pen" },
    { path: "/updates", label: "Updates", icon: "fa-comments" },
    { path: "/myprofile", label: "Profile", icon: "fa-user" },
  ];

  if (user?.user?.role === "admin") {
    menuItems.push({ path: "/admin", label: "Admin", icon: "fa-lock" });
  }

  const handleLogout = () => {
    Cookies.remove("token"); // Ensure the token cookie name is correct
    setIsLoggedIn(false);
    navigate("/"); // Redirect to home page after logout
  };

  return (
    <>
      {/* Navbar for desktop and tablets (left-side navbar) */}
      <nav
        className="navbar navbar-dark bg-dark d-none d-md-flex flex-column position-fixed vh-100 shadow"
        style={{ width: "300px" }}
      >
        <div className="container-fluid d-flex flex-column align-items-center py-4">
          <a className="navbar-brand mb-4" href="/">
            <h2 className="text-white fs-1 user-select-none">Ideate</h2>
          </a>

          {/* Search Bar */}
          <div className="w-100 mb-4 p-3">
            <div className="bg-dark rounded shadow bg-white d-flex align-items-center" style={{ width: "100%", padding: "5px" }}>
              <input
                type="text"
                className="form-control border-0"
                placeholder="Search any user or post..."
                autoFocus
                style={{ borderRadius: "0", boxShadow: "none" }}
              />
              <i
                className="fa fa-search text-dark hover-icon ms-2"
                style={{ fontSize: "1.5rem", cursor: "pointer" }}
                title="Search"
              ></i>
            </div>
          </div>

          {/* Menu Items */}
          <ul className="navbar-nav flex-column w-100 user-select-none">
            {menuItems.map(({ path, label, icon }) => (
              <li key={path} className={`nav-item ${isActive(path) ? "active-item" : ""}`}>
                <a className="nav-link d-flex align-items-center ps-3 text-center hover-effect" href={path}>
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    <i className={`fa ${icon}`} style={{ fontSize: "1.5rem" }}></i>
                    {label === 'Updates' && unreadCount > 0 && (
                      <span style={{
                        position: 'absolute', top: '-6px', right: '-8px',
                        background: '#e74c3c', color: '#fff', borderRadius: '50%',
                        fontSize: '10px', fontWeight: 'bold',
                        minWidth: '18px', height: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px'
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                  <small className="d-block fs-4 ms-5 mt-1">{label}</small>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <div className="d-md-flex bg-dark">
        <div
          className="flex-grow-1 p-3 d-none d-lg-block"
          style={{
            marginLeft: "300px", // Offset for sidebar
            marginTop: "70px", // Offset for top bar
          }}
        >
          <Outlet />
        </div>
        <div
          className="flex-grow-1 p-3 d-block d-lg-none"
          style={{
          }}
        >
          <Outlet />
        </div>

        {/* Right sidebar */}
        <div className="bg-dark vh-100 shadow d-none d-md-block sticky-top" style={{ width: "300px", minHeight: "100%" }}>
          {/* Top-right corner (Login/SignUp or Logout) */}
          <div className="m-3">
            {isLoggedIn ? (
              <button
                className="btn btn-outline-light float-end"
                onClick={handleLogout}
                style={{ fontSize: "1rem" }}
                title="Logout"
              >
                Logout
              </button>
            ) : (
              <a
                className="btn btn-outline-light float-end"
                href="/auth"
                style={{ fontSize: "1rem" }}
                title="Login/SignUp"
              >
                Login
              </a>
            )}
          </div>

          <div className="suggested-users mt-5 pt-4 container-fluid overflow-y-scroll"><hr />
            <div className="d-flex justify-content-center user-select-none">
              <h4 className="text-center text-white">Suggested Users</h4>
            </div>
            {suggestedUsers.length > 0 ? (
              suggestedUsers.map((user) => (
                <div key={user._id} className="user border rounded p-3 bg-dark shadow-lg">
                  <div className="d-flex justify-content-center mb-3">
                    {user.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt="ProfileImage"
                        className="rounded-circle border border-3 border-light"
                        style={{ width: "60px", height: "60px", objectFit: "cover" }}
                      />
                    ) : (
                      <FaUserCircle className="fs-1 text-secondary" style={{ width: "60px", height: "60px" }} />
                    )}
                  </div>
                  <div className="info text-center text-white">
                    <a
                      className="username fs-6 fw-bold text-decoration-none text-white"
                      style={{ transition: "color 0.3s ease" }}
                      href={`/user/${user._id}`} // dynamic profile URL with user _id
                    >
                      <span>@{user.username}</span>
                      {user.isverified && (
                        <img
                          src={verifiedBadge}
                          alt="Verified"
                          style={{ width: '20px', height: '15px', marginLeft: '5px', verticalAlign: 'middle' }}
                        />
                      )}
                    </a>
                    <small className="category d-block text-secondary mb-2">{user.category || "User"}</small>
                    <div className="d-flex justify-content-center mb-2">
                      <div className="followers me-4 d-flex align-items-center">
                        <i className="fa fa-users me-1 text-light" style={{ fontSize: "1.1rem" }}></i>
                        <small>{user.followers.length} Followers</small>
                      </div>
                      <div className="following d-flex align-items-center">
                        <i className="fa fa-user-check me-1 text-light" style={{ fontSize: "1.1rem" }}></i>
                        <small>{user.followings.length} Following</small>
                      </div>
                    </div>
                    <button className="follow btn btn-light w-100 py-2 fw-bold" style={{ transition: "background-color 0.3s ease" }}>
                      Follow
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-white text-center user-select-none">No suggested users available.</p>
            )}
          </div>

        </div>
      </div>

      {/* Navbar for mobile devices */}
      <nav className="navbar navbar-dark bg-dark fixed-bottom d-flex d-md-none justify-content-around py-2 shadow-lg">
        {menuItems.map(({ path, label, icon }) => (
          <a
            key={path}
            className={`nav-link text-white text-center hover-effect  ${isActive(path) ? "active-item  border-bottom fs-5" : "fs-6"}`}
            href={path}
          >
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <i className={`fa ${icon}`} style={{ fontSize: "1.5rem" }}></i>
              {label === 'Updates' && unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-8px',
                  background: '#e74c3c', color: '#fff', borderRadius: '50%',
                  fontSize: '9px', fontWeight: 'bold',
                  minWidth: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 2px'
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <small className="d-block">{label}</small>
          </a>
        ))}
      </nav>
    </>
  );
}
