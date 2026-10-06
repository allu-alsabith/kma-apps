import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type AppTheme = 'light' | 'dark';

export interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const getStoredTheme = (): AppTheme => {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('attendo_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage errors in sandboxed iframes
  }
  return 'light';
};

export const applyThemeToDom = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  if (theme === 'dark') {
    root.classList.add('dark');
    body.classList.add('dark');
  } else {
    root.classList.remove('dark');
    body.classList.remove('dark');
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const initial = getStoredTheme();
    applyThemeToDom(initial);
    return initial;
  });

  useEffect(() => {
    applyThemeToDom(theme);
    try {
      localStorage.setItem('attendo_theme', theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  const isDark = theme === 'dark';

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme, setTheme }),
    [theme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
