import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';

const Auth = ({ setLoginUser }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState({
    username: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
    setError(''); // Clear error on input change
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      const endpoint = isLogin
        ? 'http://localhost:8000/user/login'
        : 'http://localhost:8000/user/register';

      // Send the request with credentials (cookies)
      const response = await axios.post(endpoint, user, {
        withCredentials: true, // This ensures the cookie is sent
      });

      if (isLogin) {
        // After successful login, the token will be stored in cookies and localStorage
        const token = response.data.token;
        if (token) {
          Cookies.set('token', token, { expires: 10 });
          localStorage.setItem('token', token);
        }
        if (setLoginUser) {
          setLoginUser(response.data.user);
        }
        navigate('/'); // Redirect to home
      } else {
        alert('Signup successful! You can now log in.');
        setIsLogin(true); // Switch to login view
      }
    } catch (err) {
      console.error("Error Response: ", err.response?.data || err.message);
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      setSocialLoading(provider);
      setError('');

      // For standard browser flow, prompt or authenticate
      let socialPayload = null;
      if (provider === 'google') {
        const email = prompt('Enter your Google Account email to continue with Google Login:');
        if (!email) {
          setSocialLoading('');
          return;
        }
        const name = email.split('@')[0];
        socialPayload = {
          email,
          name,
          firebaseUid: `google_web_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          authProvider: 'google',
        };
      } else if (provider === 'facebook') {
        const email = prompt('Enter your Facebook Account email to continue with Facebook Login:');
        if (!email) {
          setSocialLoading('');
          return;
        }
        const name = email.split('@')[0];
        socialPayload = {
          email,
          name,
          firebaseUid: `facebook_web_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          authProvider: 'facebook',
        };
      }

      if (!socialPayload) {
        setSocialLoading('');
        return;
      }

      const response = await axios.post('http://localhost:8000/user/social-auth', socialPayload, {
        withCredentials: true,
      });

      if (response.data.success) {
        const token = response.data.token;
        if (token) {
          Cookies.set('token', token, { expires: 10 });
          localStorage.setItem('token', token);
        }
        if (setLoginUser) {
          setLoginUser(response.data.user);
        }
        navigate('/');
      } else {
        setError(response.data.message || 'Social login failed.');
      }
    } catch (err) {
      console.error("Social Auth Error: ", err.response?.data || err.message);
      setError(err.response?.data?.message || 'Failed to authenticate with social provider.');
    } finally {
      setSocialLoading('');
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100 py-4">
      <div className="card shadow-lg border-0 rounded-4" style={{ width: '30rem', backgroundColor: '#ffffff' }}>
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <h2 className="card-title fw-bold text-dark mb-1">
              {isLogin ? 'Welcome Back' : 'Create an Account'}
            </h2>
            <p className="text-muted small">
              {isLogin ? 'Sign in to access your Ideate dashboard' : 'Join Ideate to share and explore discussions'}
            </p>
          </div>

          {error && (
            <div className="alert alert-danger text-center py-2 mb-3" role="alert">
              <small>{error}</small>
            </div>
          )}

          {/* Social Auth Buttons */}
          <div className="d-flex flex-column gap-2 mb-3">
            <button
              type="button"
              className="btn btn-outline-secondary d-flex align-items-center justify-content-center gap-2 py-2 rounded-3"
              style={{ borderColor: '#e2e8f0', fontWeight: 500 }}
              onClick={() => handleSocialLogin('google')}
              disabled={loading || !!socialLoading}
            >
              <FcGoogle size={20} />
              <span>{socialLoading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <button
              type="button"
              className="btn d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 text-white"
              style={{ backgroundColor: '#1877F2', borderColor: '#1877F2', fontWeight: 500 }}
              onClick={() => handleSocialLogin('facebook')}
              disabled={loading || !!socialLoading}
            >
              <FaFacebook size={20} />
              <span>{socialLoading === 'facebook' ? 'Connecting to Facebook...' : 'Continue with Facebook'}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1 my-0 text-muted" />
            <span className="px-3 text-muted small fw-semibold" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
              OR WITH EMAIL
            </span>
            <hr className="flex-grow-1 my-0 text-muted" />
          </div>

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="mb-3">
                <label htmlFor="username" className="form-label small fw-semibold text-secondary">
                  Username
                </label>
                <input
                  type="text"
                  className="form-control rounded-3 py-2"
                  id="username"
                  name="username"
                  value={user.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  required
                />
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="email" className="form-label small fw-semibold text-secondary">
                Email Address
              </label>
              <input
                type="email"
                className="form-control rounded-3 py-2"
                id="email"
                name="email"
                value={user.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label small fw-semibold text-secondary">
                Password
              </label>
              <input
                type="password"
                className="form-control rounded-3 py-2"
                id="password"
                name="password"
                value={user.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-dark w-100 py-2 rounded-3 fw-semibold mt-2"
              disabled={loading || !!socialLoading}
            >
              {loading
                ? isLogin
                  ? 'Logging in...'
                  : 'Signing up...'
                : isLogin
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          <div className="text-center mt-4">
            <p className="text-muted small mb-0">
              {isLogin
                ? "Don't have an account? "
                : 'Already have an account? '}
              <button
                type="button"
                className="btn btn-link p-0 fw-semibold text-decoration-none"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
              >
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

