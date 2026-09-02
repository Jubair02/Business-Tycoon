'use client';

import { useEffect } from 'react';

interface AutoTickSyncProps {
  speed: string;
  onSpeedChange: (speed: string) => void;
}

// Invisible component that syncs auto-tick speed via localStorage
// between SettingsView and the page-level auto-tick timer
export function AutoTickSync({ speed, onSpeedChange }: AutoTickSyncProps) {
  useEffect(() => {
    // Read initial value from localStorage
    const saved = localStorage.getItem('bd-tycoon-auto-tick');
    if (saved && saved !== speed) {
      onSpeedChange(saved);
    }
  }, []);

  useEffect(() => {
    // Persist speed changes to localStorage
    localStorage.setItem('bd-tycoon-auto-tick', speed);

    // Listen for changes from SettingsView
    const handler = (e: StorageEvent) => {
      if (e.key === 'bd-tycoon-auto-tick' && e.newValue && e.newValue !== speed) {
        onSpeedChange(e.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [speed, onSpeedChange]);

  return null;
}
