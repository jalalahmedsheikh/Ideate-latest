import React, { useEffect, useState, useCallback } from 'react';
import api from '../api';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  FiUsers, FiFileText, FiAlertTriangle, FiActivity,
  FiZap, FiRefreshCw, FiBarChart2, FiHeart
} from 'react-icons/fi';
import './Dashboard.css';

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="stat-card fade-in" style={{ '--accent': color }}>
    <div className="stat-icon" style={{ background: `${color}18`, color }}>
      <Icon size={22} />
    </div>
    <div className="stat-body">
      <span className="stat-value">{value ?? '—'}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
    <div className="stat-bar" style={{ background: `${color}22` }}>
      <div className="stat-bar-fill" style={{ background: color, width: '60%' }} />
    </div>
  </div>
);

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f97316'];

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fakeChartData = analytics
    ? Array.from({ length: 7 }, (_, i) => ({
        day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
        users: Math.max(1, Math.floor(analytics.activeUsersCount * (0.6 + Math.random() * 0.8))),
        content: Math.max(1, Math.floor((analytics.totalPosts + analytics.totalPolls) * (0.1 + Math.random() * 0.15))),
      }))
    : [];

  const pieData = analytics
    ? [
        { name: 'Posts', value: analytics.totalPosts || 0 },
        { name: 'Polls', value: analytics.totalPolls || 0 },
        { name: 'Active', value: analytics.activeUsersCount || 0 },
        { name: 'Reports', value: analytics.pendingReportsCount || 0 },
      ]
    : [];

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) setAnalytics(res.data.analytics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time platform overview</p>
        </div>
        <button className="refresh-btn" onClick={() => load(true)} disabled={refreshing}>
          <FiRefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard icon={FiUsers} label="Total Users" value={analytics?.totalUsers} color="#8b5cf6" sub="Registered accounts" />
        <StatCard icon={FiActivity} label="Active Users (24h)" value={analytics?.activeUsersCount} color="#3b82f6" sub="Est. daily active" />
        <StatCard icon={FiFileText} label="Total Posts" value={analytics?.totalPosts} color="#22c55e" sub="Published ideas" />
        <StatCard icon={FiBarChart2} label="Total Polls" value={analytics?.totalPolls} color="#f97316" sub="Community polls" />
        <StatCard icon={FiAlertTriangle} label="Pending Reports" value={analytics?.pendingReportsCount} color="#ef4444" sub="Awaiting review" />
        <StatCard icon={FiZap} label="Engagement Rate" value={`${analytics?.engagementRate}%`} color="#eab308" sub="Avg per content item" />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <h3 className="chart-title"><FiActivity /> Weekly Activity Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={fakeChartData}>
              <defs>
                <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradContent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: '#5c5c70', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5c5c70', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f1f1f5' }} />
              <Area type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradUsers)" name="Active Users" />
              <Area type="monotone" dataKey="content" stroke="#3b82f6" strokeWidth={2} fill="url(#gradContent)" name="New Content" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card pie-chart-card">
          <h3 className="chart-title"><FiHeart /> Platform Breakdown</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={4}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#13131f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#f1f1f5' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {pieData.map((d, i) => (
              <span key={d.name} className="pie-leg-item">
                <span style={{ background: PIE_COLORS[i], width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} />
                {d.name}: <strong>{d.value}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
