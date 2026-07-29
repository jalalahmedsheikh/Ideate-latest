import React, { useEffect } from 'react';
import {
  FaHeart, FaComment, FaUserPlus, FaUserCircle,
  FaBell, FaPoll, FaUserCheck, FaTrash, FaCheckDouble
} from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '../contexts/SocketContext';

// ── Icon & colour map for all notification types ──────────────────────────────
const getNotifStyle = (type) => {
  switch (type) {
    case 'like':           return { icon: <FaHeart />,      color: '#e74c3c', label: 'Liked'         };
    case 'dislike':        return { icon: <FaHeart />,      color: '#888',    label: 'Unliked'       };
    case 'comment':        return { icon: <FaComment />,    color: '#3498db', label: 'Comment'       };
    case 'follow':         return { icon: <FaUserPlus />,   color: '#2ecc71', label: 'Followed'      };
    case 'follow_request': return { icon: <FaUserPlus />,   color: '#f39c12', label: 'Follow Req.'   };
    case 'follow_accept':  return { icon: <FaUserCheck />,  color: '#1abc9c', label: 'Accepted'      };
    case 'vote':           return { icon: <FaPoll />,       color: '#9b59b6', label: 'Voted'         };
    case 'mention':        return { icon: <FaBell />,       color: '#e67e22', label: 'Mention'       };
    default:               return { icon: <FaBell />,       color: '#f1c40f', label: 'Notification'  };
  }
};

const timeAgo = (timestamp) => {
  try {
    if (!timestamp) return 'Just now';
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch { return 'Just now'; }
};

export default function Updates() {
  const { notifications, unreadCount, loading, markAllRead, clearAll } = useSocket();

  // Mark all as read when user opens this page
  useEffect(() => {
    markAllRead();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #111127 100%)',
      padding: '24px 16px',
      color: '#fff',
    }}>
      {/* ── Header ── */}
      <div style={{
        maxWidth: 640, margin: '0 auto 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.6rem', letterSpacing: '-0.5px' }}>
            🔔 Updates
          </h2>
          {unreadCount > 0 && (
            <small style={{ color: '#e74c3c', fontWeight: 600 }}>
              {unreadCount} unread
            </small>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={markAllRead}
            title="Mark all as read"
            style={{
              background: 'rgba(52,152,219,0.15)', border: '1px solid #3498db',
              color: '#3498db', borderRadius: 8, padding: '6px 12px',
              cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <FaCheckDouble /> Mark read
          </button>
          <button
            onClick={clearAll}
            title="Clear all"
            style={{
              background: 'rgba(231,76,60,0.12)', border: '1px solid #e74c3c',
              color: '#e74c3c', borderRadius: 8, padding: '6px 12px',
              cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <FaTrash /> Clear all
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
            Loading notifications…
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            background: 'rgba(255,255,255,0.03)', borderRadius: 16,
            border: '1px dashed rgba(255,255,255,0.08)',
          }}>
            <FaBell style={{ fontSize: 48, opacity: 0.25, marginBottom: 16 }} />
            <p style={{ color: '#666', margin: 0 }}>
              No notifications yet — they'll appear here in real-time!
            </p>
          </div>
        )}

        {notifications.map((notif, idx) => {
          const { icon, color, label } = getNotifStyle(notif.type);
          const sender = notif.senderDetails || notif.userDetails || {};
          const isUnread = !notif.isRead;

          return (
            <div
              key={notif._id || idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', marginBottom: 10,
                background: isUnread
                  ? 'linear-gradient(135deg, rgba(52,152,219,0.07), rgba(26,26,36,0.9))'
                  : 'rgba(26,26,36,0.85)',
                borderRadius: 14,
                border: isUnread
                  ? '1px solid rgba(52,152,219,0.25)'
                  : '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                transition: 'transform 0.15s ease',
                cursor: 'default',
                position: 'relative',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
            >
              {/* Unread indicator dot */}
              {isUnread && (
                <span style={{
                  position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
                  width: 6, height: 6, borderRadius: '50%', background: '#3498db',
                }} />
              )}

              {/* Avatar */}
              <div style={{ flexShrink: 0, position: 'relative' }}>
                {sender.profileImage ? (
                  <img
                    src={sender.profileImage}
                    alt={sender.username}
                    style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover',
                             border: `2px solid ${color}` }}
                  />
                ) : (
                  <FaUserCircle style={{ fontSize: 46, color: '#555' }} />
                )}
                {/* Type badge */}
                <span style={{
                  position: 'absolute', bottom: -3, right: -3,
                  background: color, borderRadius: '50%',
                  width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: '#fff', border: '2px solid #111',
                }}>
                  {icon}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#e0e0e0', lineHeight: 1.5 }}>
                  <strong style={{ color: '#fff' }}>@{sender.username || 'Someone'}</strong>{' '}
                  {notif.message || label.toLowerCase() + ' your post'}
                </p>
                <small style={{ color: '#666', fontSize: 11 }}>
                  {timeAgo(notif.createdAt)}
                </small>
              </div>

              {/* Type label chip */}
              <span style={{
                flexShrink: 0,
                background: `${color}22`, border: `1px solid ${color}44`,
                color, borderRadius: 20, padding: '3px 9px',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
