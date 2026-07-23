/**
 * ============================================================================
 * Skill Labs Data Manager - Core Application Service
 *
 * Designed and Developed by:
 *   DIVYANSH KUMAR SHARMA
 *   Associate Product Manager - AI Product and Platforms
 *   Skill Labs Resource Service Private Limited
 *   Phone: +91 6006291486
 *   Email: divyansh6005@gmail.com
 *
 * Description:
 *   Main React routing and session router container. Maps authenticated users
 *   to their respective dashboard panels depending on security tokens.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import LoginView from './views/LoginView';
import SuperAdminDashboard from './views/SuperAdminDashboard';
import ManagerDashboard from './views/ManagerDashboard';
import CounselorDashboard from './views/CounselorDashboard';
import TeamLeaderDashboard from './views/TeamLeaderDashboard';
import HiringEntry from './modules/hiring/HiringEntry';

// Optional absolute backend base URL for cross-origin setups; defaults to a relative
// path so requests stay same-origin, matching every other fetch in this app - this
// works both in dev (via the Vite proxy) and in prod (via the nginx reverse proxy).
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      verifySession();
    } else {
      setLoading(false);
    }

    // Idle Session Timeout Check (15 minutes of inactivity)
    let idleTimer;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      if (token) {
        idleTimer = setTimeout(() => {
          alert('Session expired due to inactivity.');
          handleLogout();
        }, 15 * 60 * 1000); // 15 minutes
      }
    };

    // User activity listeners
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, resetIdleTimer);
    });

    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, resetIdleTimer);
      });
    };
  }, [token]);

  const verifySession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        // Session invalid (conflict or expired)
        handleLogout();
      }
    } catch (err) {
      console.error('Session verification failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#0F4C5C] mb-2">sync</span>
          <p className="text-xs text-[#70787C] font-semibold">Authorizing domain session...</p>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Route to the dashboard based on backend role enforcement
  switch (user.role) {
    case 'super_admin':
      return <SuperAdminDashboard token={token} user={user} onLogout={handleLogout} />;
    case 'manager':
      return <ManagerDashboard token={token} user={user} onLogout={handleLogout} />;
    case 'team_leader':
      return <TeamLeaderDashboard token={token} user={user} onLogout={handleLogout} />;
    case 'counselor':
      return <CounselorDashboard token={token} user={user} onLogout={handleLogout} />;
    case 'recruiter':
    case 'hiring_team_leader':
      return <HiringEntry token={token} user={user} onLogout={handleLogout} />;
    default:
      return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }
}
