import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FiGrid, FiUsers, FiFolder, FiAlertTriangle,
  FiBell, FiLogOut, FiShield, FiMenu, FiX, FiActivity
} from 'react-icons/fi';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/', icon: FiGrid, label: 'Dashboard' },
  { path: '/users', icon: FiUsers, label: 'Users' },
  { path: '/content', icon: FiFolder, label: 'Content Registry' },
  { path: '/reports', icon: FiAlertTriangle, label: 'Moderation' },
  { path: '/broadcast', icon: FiBell, label: 'Broadcaster' },
  { path: '/activity', icon: FiActivity, label: 'Live Activity' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <FiShield size={22} color="#8b5cf6" />
          <span>Ideate <strong>Admin</strong></span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-chip">
            <div className="admin-avatar">{admin?.username?.[0]?.toUpperCase() || 'A'}</div>
            <div className="admin-info">
              <span className="admin-name">@{admin?.username}</span>
              <span className="admin-role">Administrator</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <FiLogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-wrapper">
        <header className="topbar">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
          <div className="topbar-right">
            <div className="status-dot" />
            <span className="status-text">Live — Backend Connected</span>
          </div>
        </header>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
