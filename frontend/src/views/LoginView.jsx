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
 *   Secure Single Sign-On (SSO) login container. Supports device detection,
 *   force-override conflict resolvers, and domain validation.
 *
 * Copyright (c) 2026. All rights reserved.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';

const SkillLabsLogo = ({ className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className={className}>
    <text x="0" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="800" fontSize="38" fill="#1BACE4" letterSpacing="-1.5">Skill</text>
    <text x="92" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="300" fontSize="38" fill="#F7941D" letterSpacing="-1.5">Labs</text>
  </svg>
);

export default function LoginView({ onLoginSuccess }) {
  useEffect(() => {
    const handleCutPaste = (e) => { e.preventDefault(); };
    document.addEventListener('cut', handleCutPaste);
    document.addEventListener('paste', handleCutPaste);
    return () => {
      document.removeEventListener('cut', handleCutPaste);
      document.removeEventListener('paste', handleCutPaste);
    };
  }, []);

  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState(null);

  const generateDeviceId = () => {
    let devId = localStorage.getItem('device_id');
    if (!devId) { devId = 'dev_' + Math.random().toString(36).substring(2, 11); localStorage.setItem('device_id', devId); }
    return devId;
  };

  const handleLogin = async (e, force = false) => {
    if (e) e.preventDefault();
    setError(null); setLoading(true);
    if (!email) { setError('Please enter your email.'); setLoading(false); return; }
    if (!email.toLowerCase().endsWith('@company.com')) {
      setError('Access restricted: Only @company.com accounts are permitted.');
      setLoading(false); return;
    }
    const deviceId = generateDeviceId();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), deviceId, force })
      });
      const data = await response.json();
      if (response.status === 409) { setConflict({ email, deviceId }); setLoading(false); return; }
      if (!response.ok) { setError(data.error || 'Login failed'); setLoading(false); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.token, data.user);
    } catch (err) { setError('Server connection failed. Make sure the backend is running.'); setLoading(false); }
  };

  const handleConfirmConflict = () => { setConflict(null); handleLogin(null, true); };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0C2340 0%, #0E3A5C 50%, #0C2340 100%)' }}
    >
      {/* Glow orbs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(27,172,228,0.15), transparent 70%)' }} />
      <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(247,148,29,0.12), transparent 70%)' }} />
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '3rem 3rem' }} />

      <div className="relative w-full max-w-[440px]">

        {/* Logo area */}
        <div className="text-center mb-8">
          <SkillLabsLogo className="h-14 w-auto mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-body-sm tracking-wide">CRM Admin Portal</p>
          <div className="mt-3 mx-auto w-20 h-0.5 rounded-full"
            style={{ background: 'linear-gradient(to right, #1BACE4, #F7941D)' }} />
        </div>

        {/* Glassmorphism card */}
        <div className="border p-8 rounded-2xl shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', borderColor: 'rgba(255,255,255,0.1)' }}>

          <h2 className="text-white text-lg font-bold mb-1 font-headline-md">Welcome back</h2>
          <p className="text-slate-400 text-xs font-body-sm mb-6">Sign in with your company account to continue</p>

          {error && (
            <div className="mb-5 p-3 rounded-lg text-xs flex items-start gap-2"
              style={{ background: 'rgba(186,26,26,0.12)', border: '1px solid rgba(186,26,26,0.35)', color: '#fca5a5' }}>
              <span className="material-symbols-outlined text-sm mt-0.5">error</span>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e, false)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 font-label-caps">
                Company Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <span className="material-symbols-outlined text-lg">mail</span>
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="username@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-500"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#1BACE4'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 font-body-sm">
                * Restricted to <strong className="text-slate-400">@company.com</strong> accounts only
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-white text-sm font-bold rounded-lg transition duration-200 disabled:opacity-50 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1BACE4 0%, #1082B0 100%)' }}
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">login</span>
                  <span>Sign in with Google Workspace</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}></div>
            <span className="flex-shrink mx-4 text-[11px] text-slate-500 font-label-caps uppercase">or</span>
            <div className="flex-grow border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}></div>
          </div>

          <button
            onClick={(e) => handleLogin(e, false)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-slate-300 text-xs font-medium rounded-lg transition duration-200"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="material-symbols-outlined text-lg" style={{ color: '#1BACE4' }}>cloud</span>
            <span>Sign in with Microsoft 365</span>
          </button>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-5 font-body-sm">
          &copy; {new Date().getFullYear()} SkillLabs &mdash; All sessions are monitored &amp; logged
        </p>
      </div>

      {/* Session Conflict Modal */}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
          <div className="w-full max-w-md p-6 rounded-2xl shadow-2xl"
            style={{ background: '#0E1C2E', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                <span className="material-symbols-outlined">warning</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-headline-md">Active Session Conflict</h3>
                <p className="text-xs text-slate-400 mt-2 font-body-sm">
                  You are already logged in from another device. Logging in here will terminate your other active session.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setConflict(null)}
                className="py-1.5 px-3 text-xs font-semibold rounded-lg text-slate-300"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
                Cancel
              </button>
              <button onClick={handleConfirmConflict}
                className="py-1.5 px-3 bg-[#BA1A1A] hover:bg-[#93000A] text-white text-xs font-semibold rounded-lg">
                Terminate &amp; Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
