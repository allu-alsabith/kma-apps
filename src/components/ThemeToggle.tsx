import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme, AppTheme } from '../context/ThemeContext';

export type { AppTheme };

interface ThemeToggleProps {
  className?: string;
}

/**
 * Clean, minimal, compact icon button featuring only a sun or moon icon.
 * Seamlessly toggles global theme between light mode (#F8FAFC) and dark mode (#0F172A).
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      id="btn-global-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all duration-200 select-none shadow-xs active:scale-90 shrink-0 ${
        isDark
          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400 hover:text-sky-300'
          : 'bg-white hover:bg-slate-50 border-[#CBD5E1] text-amber-500 hover:text-amber-600'
      } ${className}`}
    >
      {isDark ? (
        <Moon className="w-4 h-4 transition-transform duration-200 hover:rotate-12" />
      ) : (
        <Sun className="w-4 h-4 transition-transform duration-200 hover:rotate-45" />
      )}
    </button>
  );
};

export default ThemeToggle;

