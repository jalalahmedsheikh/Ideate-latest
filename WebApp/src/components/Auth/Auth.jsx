import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

const Auth = ({ setLoginUser }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login and Signup
  const [loading, setLoading] = useState(false);
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

    console.log("User Input: ", user); // Debugging input values

    try {
      setLoading(true);
      const endpoint = isLogin
        ? 'http://localhost:8000/user/login'
        : 'http://localhost:8000/user/register';

      // Send the request with credentials (cookies)
      const response = await axios.post(endpoint, user, {
        withCredentials: true, // This ensures the cookie is sent
      });
      console.log("API Response: ", response.data); // Debugging API response

      if (isLogin) {
        // After successful login, the token will be stored in cookies and localStorage
        const token = response.data.token;
        if (token) {
          Cookies.set('token', token, { expires: 10 });
          localStorage.setItem('token', token);
        }
        setLoginUser(response.data.user); // Set logged-in user from the response
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

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="card shadow-lg" style={{ width: '28rem' }}>
        <div className="card-body">
          <h2 className="card-title text-center mb-4 text-dark">
            {isLogin ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p className="text-center text-muted mb-4">
            {isLogin ? 'Login to your account' : 'Sign up for a new account'}
          </p>

          {error && (
            <div className="alert alert-danger text-center" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="mb-3">
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="username"
                  name="username"
                  value={user.username}
                  onChange={handleChange}
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                id="email"
                name="email"
                value={user.email}
                onChange={handleChange}
                placeholder="Enter your email"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                className="form-control"
                id="password"
                name="password"
                value={user.password}
                onChange={handleChange}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className={`btn btn-dark w-100 ${loading ? 'disabled' : ''}`}
            >
              {loading
                ? isLogin
                  ? 'Logging in...'
                  : 'Signing up...'
                : isLogin
                  ? 'Login'
                  : 'Sign Up'}
            </button>
          </form>

          <div className="text-center mt-3">
            <p className="text-muted">
              {isLogin
                ? "Don't have an account? "
                : 'Already have an account? '}
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
