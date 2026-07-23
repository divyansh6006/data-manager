import { useEffect } from 'react';

// Binds a single key combo (e.g. 'k' with ctrlOrCmd:true) to a handler for the lifetime of
// the calling component. Ctrl on Windows/Linux, Cmd on Mac — checks both metaKey/ctrlKey so
// the same shortcut works cross-platform without detecting the OS.
export default function useKeyboardShortcut(key, handler, { ctrlOrCmd = false } = {}) {
  useEffect(() => {
    const listener = (e) => {
      const keyMatches = e.key.toLowerCase() === key.toLowerCase();
      const modifierMatches = ctrlOrCmd ? (e.ctrlKey || e.metaKey) : true;
      if (keyMatches && modifierMatches) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [key, handler, ctrlOrCmd]);
}
