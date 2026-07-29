import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FiLock, FiMail, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-glow" />
      <div className="login-card fade-in">
        <div className="login-logo">
          <FiShield size={36} color="#8b5cf6" />
          <h1>Ideate <span>Admin</span></h1>
        </div>
        <p className="login-subtitle">Secure control panel access only</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <FiMail className="input-icon" />
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <FiLock className="input-icon" />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="toggle-pass"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : 'Sign In to Admin Panel'}
          </button>
        </form>

        <p className="login-note">Only accounts with admin role can access this panel.</p>
      </div>
    </div>
  );
}
