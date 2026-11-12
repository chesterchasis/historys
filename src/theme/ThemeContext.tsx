import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Appearance, useColorScheme, View } from 'react-native';
import type { AppStyles } from '../styles/appStyles';
import { type AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from '../utils/settings';
import { COLORS, createStyles, type Scheme, type ThemeColors, type ThemePreference } from './theme';

type ThemeValue = {
  scheme: Scheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  styles: AppStyles;
  colors: ThemeColors;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadSettings().then((stored) => {
      if (!active) return;
      settingsRef.current = stored;
      setSettings(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const preference = settings.theme;
  const scheme: Scheme = preference === 'auto' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  useEffect(() => {
    Appearance.setColorScheme(preference === 'auto' ? null : preference);
  }, [preference]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(COLORS[scheme].bg).catch(() => {});
  }, [scheme]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => updateSettings({ theme: next }),
    [updateSettings]
  );

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      settings,
      updateSettings,
      styles: createStyles(scheme),
      colors: COLORS[scheme],
    }),
    [scheme, preference, setPreference, settings, updateSettings]
  );

  if (!loaded) return <View style={{ flex: 1, backgroundColor: COLORS[scheme].bg }} />;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return value;
}
