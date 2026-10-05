import React, { createContext, useContext, useMemo, useState } from 'react';
import { themes, type ColorTokens, type ThemeName } from '../tokens';

interface ThemeContextValue {
  name: ThemeName;
  colors: ColorTokens;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children, initial = 'brand' }: { children: React.ReactNode; initial?: ThemeName }) {
  const [name, setTheme] = useState<ThemeName>(initial);
  const value = useMemo(
    () => ({ name, colors: themes[name], setTheme }),
    [name],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
