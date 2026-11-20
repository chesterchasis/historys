import * as FileSystem from 'expo-file-system';
import {
  BACKGROUND_CHOICES,
  DURATION_OPTIONS,
  FORMAT_CHOICES,
  LAYOUT_CHOICES,
  QUALITY_OPTIONS,
  type ExportQuality,
} from '../constants/collage';
import type { ThemePreference } from '../theme/theme';
import type { BackgroundMode, BorderMode, CollageFormat, LayoutType } from '../types/collage';

/** El último diseño que se usó, para volver a abrirlo igual. */
export type DesignPrefs = {
  layout: LayoutType;
  format: CollageFormat;
  background: BackgroundMode;
  borderMode: BorderMode;
  duration: number;
  quality: ExportQuality;
};

export type AppSettings = {
  theme: ThemePreference;
  /** Abrir la app con el último formato, fondo, forma, bordes, duración y calidad. */
  rememberDesign: boolean;
  /** Los vídeos nuevos empiezan silenciados. */
  muteOnLoad: boolean;
  design: DesignPrefs | null;
};

const FILE_NAME = 'historys-settings.json';

const fileHandle = () => new FileSystem.File(FileSystem.Paths.document, FILE_NAME);

/** Sube cuando cambia un valor por defecto, para que también se aplique a quien ya tenía ajustes guardados. */
const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  rememberDesign: true,
  muteOnLoad: true,
  design: null,
};

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'auto' || value === 'light' || value === 'dark';

const oneOf = <T extends string>(options: { id: T }[], value: unknown): value is T =>
  options.some((option) => option.id === value);

const readDesign = (value: any): DesignPrefs | null => {
  if (!value || typeof value !== 'object') return null;
  const { layout, format, background, borderMode, duration, quality } = value;
  if (
    !oneOf(LAYOUT_CHOICES, layout) ||
    !oneOf(FORMAT_CHOICES, format) ||
    !oneOf(BACKGROUND_CHOICES, background) ||
    !(borderMode === 'black' || borderMode === 'none') ||
    !DURATION_OPTIONS.includes(duration) ||
    !oneOf([...QUALITY_OPTIONS], quality)
  ) {
    return null;
  }
  return { layout, format, background, borderMode, duration, quality };
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const file = fileHandle();
    if (!file.exists) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(await file.text());
    return {
      theme: isPreference(parsed?.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
      rememberDesign:
        typeof parsed?.rememberDesign === 'boolean' ? parsed.rememberDesign : DEFAULT_SETTINGS.rememberDesign,
      muteOnLoad:
        parsed?.version === SETTINGS_VERSION && typeof parsed?.muteOnLoad === 'boolean'
          ? parsed.muteOnLoad
          : DEFAULT_SETTINGS.muteOnLoad,
      design: readDesign(parsed?.design),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    const file = fileHandle();
    if (!file.exists) file.create({ overwrite: true });
    file.write(JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
  } catch {
    // Si no se puede guardar, se vuelve a los valores de siempre la próxima vez. No es grave.
  }
}
