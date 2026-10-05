import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { textSizes, type TextSizePreference } from '@bhojan/shared';

const STORAGE_KEY = 'bhojan.accessibility.v1';

interface StoredPreferences {
  textSize: TextSizePreference;
  reduceMotion: boolean;
}

interface ThemeContextValue {
  textSize: TextSizePreference;
  /** Multiplier applied to every type style, on top of the phone's own font scaling. */
  textScale: number;
  /** True when either the phone or the in-app setting asks for less motion. */
  reduceMotion: boolean;
  appReduceMotion: boolean;
  systemReduceMotion: boolean;
  setTextSize: (size: TextSizePreference) => void;
  setAppReduceMotion: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StoredPreferences>({ textSize: 'standard', reduceMotion: false });
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
        setPrefs((current) => ({
          textSize: parsed.textSize && parsed.textSize in textSizes ? parsed.textSize : current.textSize,
          reduceMotion: parsed.reduceMotion ?? current.reduceMotion,
        }));
      })
      .catch(() => {
        // Preferences are a convenience; defaults are fine if storage is unavailable.
      });

    AccessibilityInfo.isReduceMotionEnabled()
      .then(setSystemReduceMotion)
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => subscription.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const persist = (next: StoredPreferences) => {
      setPrefs(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    };
    return {
      textSize: prefs.textSize,
      textScale: textSizes[prefs.textSize],
      reduceMotion: prefs.reduceMotion || systemReduceMotion,
      appReduceMotion: prefs.reduceMotion,
      systemReduceMotion,
      setTextSize: (textSize) => persist({ ...prefs, textSize }),
      setAppReduceMotion: (reduceMotion) => persist({ ...prefs, reduceMotion }),
    };
  }, [prefs, systemReduceMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
