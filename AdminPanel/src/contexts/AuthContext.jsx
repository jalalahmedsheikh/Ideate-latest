import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('adminToken') || localStorage.getItem('adminToken');
    const stored = localStorage.getItem('adminUser');
    if (token && stored) {
      try {
        setAdmin(JSON.parse(stored));
      } catch {
        setAdmin(null);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/user/login', { email, password });
    if (!res.data.success) throw new Error(res.data.message || 'Login failed');
    const user = res.data.user;
    if (user.role !== 'admin') throw new Error('Access denied. Admin account required.');
    const token = res.data.token || Cookies.get('token');
    Cookies.set('adminToken', token, { expires: 7 });
    localStorage.setItem('adminToken', token);
    localStorage.setItem('adminUser', JSON.stringify(user));
    setAdmin(user);
    return user;
  };

  const logout = () => {
    Cookies.remove('adminToken');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
