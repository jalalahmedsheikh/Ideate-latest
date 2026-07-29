import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { UserContext } from './UserContext';
import axiosInstance from '../pages/axiosInstance';

const SocketContext = createContext();
export const useSocket = () => useContext(SocketContext);

const SERVER_URL = 'http://localhost:8000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket]             = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]   = useState(0);
  const [loading, setLoading]           = useState(false);
  const { user } = useContext(UserContext);

  // ── Fetch persisted notification history from DB ─────────
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/notifications?limit=50');
      if (res.data.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Mark all as read (called when user opens Updates page) ──
  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      await axiosInstance.put('/notifications/mark-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications read:', err.message);
    }
  }, [unreadCount]);

  // ── Clear all notifications ───────────────────────────────
  const clearAll = useCallback(async () => {
    try {
      await axiosInstance.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to clear notifications:', err.message);
    }
  }, []);

  // ── Socket connection + real-time listener ────────────────
  useEffect(() => {
    if (!user?.user?._id) {
      if (socket) { socket.close(); setSocket(null); }
      return;
    }

    // Load history first
    fetchNotifications();

    // Open WebSocket
    const newSocket = io(SERVER_URL, {
      query: { userId: user.user._id },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    setSocket(newSocket);

    // Real-time: prepend incoming notification and bump unread count
    newSocket.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    return () => { newSocket.close(); };
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAllRead,
        clearAll,
        setNotifications,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
