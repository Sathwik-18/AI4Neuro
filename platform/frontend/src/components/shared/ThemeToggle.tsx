'use client';

import * as React from 'react';
import { Moon, Sun } from '@/components/icons';
import { useTheme } from 'next-themes';

/** One-click light/dark switch for the dashboard top bar. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="flex items-center justify-center h-8 w-8 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}
