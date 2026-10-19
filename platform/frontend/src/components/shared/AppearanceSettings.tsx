'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Check, Moon, Sun } from '@/components/icons';
import { usePalette } from '@/components/theme-provider';
import { PALETTES } from '@/lib/appearance';

/** Settings section: light/dark mode + colour theme. Applies instantly. */
export function AppearanceSettings() {
  const { resolvedTheme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const mode = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';
  const modes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
  ] as const;

  return (
    <div className="py-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Appearance</h2>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Mode</p>
            <p className="text-xs text-slate-500">Light or dark across every dashboard.</p>
          </div>
          <div role="radiogroup" aria-label="Mode" className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            {modes.map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-900">Colour theme</p>
          <p className="text-xs text-slate-500 mb-3">Saved on this device.</p>
          <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PALETTES.map((p) => {
              const active = palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPalette(p.id)}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: p.swatch }}
                  >
                    {active && <Check className="h-3 w-3 text-white" aria-hidden />}
                  </span>
                  <span className="font-medium">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
