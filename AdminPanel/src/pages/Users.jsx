import React, { useEffect, useState } from 'react';
import api from '../api';
import {
  FiSearch, FiShield, FiUserX, FiUserCheck, FiTrash2,
  FiRefreshCw, FiUser, FiFilter
} from 'react-icons/fi';
import './TablePage.css';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | banned | verified | admin
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      if (res.data.success) setUsers(res.data.users);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setAction = (id, val) => setActionLoading(p => ({ ...p, [id]: val }));

  const toggleBan = async (userId, isBanned) => {
    setAction(userId, 'ban');
    try {
      const res = await api.post('/admin/users/ban', { targetUserId: userId });
      if (res.data.success) {
        setUsers(u => u.map(x => x._id === userId ? { ...x, isBanned: !x.isBanned } : x));
        showToast(isBanned ? 'User unbanned.' : 'User banned.');
      }
    } catch (e) { showToast('Action failed.', 'error'); }
    finally { setAction(userId, null); }
  };

  const toggleVerify = async (userId, isVerified) => {
    setAction(userId, 'verify');
    try {
      const res = await api.post('/admin/users/verify', { targetUserId: userId });
      if (res.data.success) {
        setUsers(u => u.map(x => x._id === userId ? { ...x, isverified: !x.isverified } : x));
        showToast(isVerified ? 'Verification removed.' : 'User verified!');
      }
    } catch (e) { showToast('Action failed.', 'error'); }
    finally { setAction(userId, null); }
  };

  const filtered = users.filter(u => {
    const matchSearch =
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'banned') return u.isBanned;
    if (filter === 'verified') return u.isverified;
    if (filter === 'admin') return u.role === 'admin';
    return true;
  });

  return (
    <div className="table-page fade-in">
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}

      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>{users.length} total users in database</p>
        </div>
        <button className="refresh-btn" onClick={load}>
          <FiRefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="table-controls">
        <div className="search-bar">
          <FiSearch color="#5c5c70" />
          <input
            type="text"
            placeholder="Search by username or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-pills">
          <FiFilter size={14} color="#5c5c70" />
          {['all', 'admin', 'verified', 'banned'].map(f => (
            <button
              key={f}
              className={`pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No users found</td></tr>
              ) : filtered.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {u.profileImage
                          ? <img src={u.profileImage} alt="" />
                          : <FiUser size={16} />}
                      </div>
                      <div>
                        <span className="user-name">@{u.username}</span>
                        {u.role === 'admin' && <span className="badge badge-purple" style={{ marginLeft: 6, fontSize: '0.65rem' }}>Admin</span>}
                      </div>
                    </div>
                  </td>
                  <td className="cell-muted">{u.email || '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-blue'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.isBanned
                      ? <span className="badge badge-red">Banned</span>
                      : <span className="badge badge-green">Active</span>}
                  </td>
                  <td>
                    {u.isverified
                      ? <span className="badge badge-purple">Verified ✓</span>
                      : <span className="badge" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>—</span>}
                  </td>
                  <td className="cell-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className={`action-btn ${u.isBanned ? 'btn-success' : 'btn-danger'}`}
                        onClick={() => toggleBan(u._id, u.isBanned)}
                        disabled={actionLoading[u._id] === 'ban'}
                        title={u.isBanned ? 'Unban User' : 'Ban User'}
                      >
                        {u.isBanned ? <FiUserCheck size={15} /> : <FiUserX size={15} />}
                        {u.isBanned ? 'Unban' : 'Ban'}
                      </button>
                      <button
                        className={`action-btn ${u.isverified ? 'btn-neutral' : 'btn-purple'}`}
                        onClick={() => toggleVerify(u._id, u.isverified)}
                        disabled={actionLoading[u._id] === 'verify'}
                        title={u.isverified ? 'Remove verification' : 'Verify user'}
                      >
                        <FiShield size={15} />
                        {u.isverified ? 'Unverify' : 'Verify'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
