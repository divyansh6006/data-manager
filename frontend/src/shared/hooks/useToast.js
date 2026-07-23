import { useState, useCallback } from 'react';

// Mirrors the toast pattern duplicated across CounselorDashboard/ManagerDashboard/
// TeamLeaderDashboard/SuperAdminDashboard (see CounselorDashboard.jsx ~219-225) —
// extracted once here for the Hiring module instead of re-duplicating a 5th time.
export default function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, closing: false }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, closing: true } : t)));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250);
    }, 3200);
  }, []);

  return { toasts, showToast };
}
