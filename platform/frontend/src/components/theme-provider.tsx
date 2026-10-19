'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import {
  DEFAULT_PALETTE,
  MODE_STORAGE_KEY,
  PALETTE_STORAGE_KEY,
  isPaletteId,
  isUnthemedPath,
  type PaletteId,
} from '@/lib/appearance';

interface PaletteContextValue {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
}

const PaletteContext = React.createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
});

/** The user's colour theme. Light/dark mode is `useTheme()` from next-themes. */
export function usePalette() {
  return React.useContext(PaletteContext);
}

/**
 * Light/dark mode (next-themes, `.dark` on <html>) plus the colour theme
 * (`data-theme` on <html>). Public pages are pinned to the default look.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const unthemed = isUnthemedPath(usePathname());
  const [palette, setPaletteState] = React.useState<PaletteId>(DEFAULT_PALETTE);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
      if (isPaletteId(saved)) setPaletteState(saved);
    } catch {
      // storage blocked — stay on the default
    }
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (unthemed) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', palette);
  }, [palette, unthemed]);

  const setPalette = React.useCallback((id: PaletteId) => {
    setPaletteState(id);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      // storage blocked — applies for this page view only
    }
  }, []);

  const value = React.useMemo(() => ({ palette, setPalette }), [palette, setPalette]);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={MODE_STORAGE_KEY}
      forcedTheme={unthemed ? 'light' : undefined}
      disableTransitionOnChange
    >
      <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>
    </NextThemesProvider>
  );
}
