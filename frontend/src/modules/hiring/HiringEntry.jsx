import React from 'react';
import RecruiterDashboard from './dashboards/RecruiterDashboard';
import HiringTeamLeaderDashboard from './dashboards/HiringTeamLeaderDashboard';

// Top-level entry for the Hiring workspace's own two native roles — mounted from
// frontend/src/App.jsx's two new switch cases ('recruiter', 'hiring_team_leader').
// Super Admin's Hiring workspace view is a separate entry point (HiringAdminDashboard),
// reached via SuperAdminDashboard.jsx's own "Switch to Hiring View" button, not this file.
export default function HiringEntry({ token, user, onLogout }) {
  if (user.role === 'hiring_team_leader') {
    return <HiringTeamLeaderDashboard token={token} user={user} onLogout={onLogout} />;
  }
  return <RecruiterDashboard token={token} user={user} onLogout={onLogout} />;
}
