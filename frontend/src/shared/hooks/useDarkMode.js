import { useState, useEffect } from 'react';

// Wires up the darkMode:"class" Tailwind strategy already declared (but unused) in
// index.html's inline config. Deliberately scoped to a wrapper <div> around the Hiring
// module's own root, NOT <html> — Tailwind's class strategy only requires a `.dark`
// ancestor, so this gives full isolation from Admissions with zero edit to index.html.
export default function useDarkMode(storageKey = 'hiring_dark_mode') {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) return saved === 'true';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isDark));
  }, [isDark, storageKey]);

  return [isDark, () => setIsDark(d => !d)];
}
