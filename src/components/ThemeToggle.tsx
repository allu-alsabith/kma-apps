import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false, compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Read stored preference or system preference
    const saved = localStorage.getItem('attendo_theme_mode');
    const isDark = saved === 'dark';
    setTheme(isDark ? 'dark' : 'light');
    applyTheme(isDark ? 'dark' : 'light');

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'attendo_theme_mode' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
        applyTheme(e.newValue);
      }
    };

    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<'light' | 'dark'>;
      if (customEvent.detail) {
        setTheme(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('attendo-theme-change', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('attendo-theme-change', handleCustom);
    };
  }, []);

  const applyTheme = (t: 'light' | 'dark') => {
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  };

  const toggleTheme = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem('attendo_theme_mode', next);
      window.dispatchEvent(new CustomEvent('attendo-theme-change', { detail: next }));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      id="theme-mode-toggle"
      className={`relative inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs rounded-lg select-none ${
        compact ? 'p-1.5' : 'px-2.5 py-1'
      } ${
        theme === 'dark'
          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
          : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#CBD5E1]'
      } ${className}`}
      title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-scale-in" />
          {showLabel && (
            <span className="text-[11px] font-semibold text-slate-200">Light</span>
          )}
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-slate-600 shrink-0 animate-scale-in" />
          {showLabel && (
            <span className="text-[11px] font-semibold text-slate-700">Dark</span>
          )}
        </>
      )}
    </button>
  );
}
