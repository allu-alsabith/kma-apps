import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

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
    const saved = localStorage.getItem('attendo_theme') || localStorage.getItem('theme');
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

  if (root) {
    if (theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.backgroundColor = '#0F172A';
      root.style.color = '#F8FAFC';
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.backgroundColor = '#F8FAFC';
      root.style.color = '#1E293B';
      root.style.colorScheme = 'light';
    }
  }

  if (body) {
    if (theme === 'dark') {
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
      body.style.backgroundColor = '#0F172A';
      body.style.color = '#F8FAFC';
    } else {
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
      body.style.backgroundColor = '#F8FAFC';
      body.style.color = '#1E293B';
    }
  }

  // Sync browser theme-color meta tag
  try {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F8FAFC');
    }
  } catch {
    // Ignore
  }
};

// Immediate application upon bundle evaluation
if (typeof window !== 'undefined') {
  applyThemeToDom(getStoredTheme());
}

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
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  // Synchronize across browser tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'attendo_theme' || e.key === 'theme') {
        const val = e.newValue;
        if (val === 'dark' || val === 'light') {
          setThemeState(val);
          applyThemeToDom(val);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: AppTheme = prev === 'light' ? 'dark' : 'light';
      applyThemeToDom(next);
      try {
        localStorage.setItem('attendo_theme', next);
        localStorage.setItem('theme', next);
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    applyThemeToDom(newTheme);
    try {
      localStorage.setItem('attendo_theme', newTheme);
      localStorage.setItem('theme', newTheme);
    } catch {
      // Ignore
    }
  }, []);

  const isDark = theme === 'dark';

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme, setTheme }),
    [theme, isDark, toggleTheme, setTheme]
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

