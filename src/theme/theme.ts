import { type AppStyles, lightStyles } from '../styles/appStyles';

export type Scheme = 'light' | 'dark';
export type ThemePreference = 'auto' | Scheme;

export type ThemeColors = {
  bg: string;
  ink: string;
  onInk: string;
  switchOn: string;
  switchOff: string;
  switchThumb: string;
};

export const COLORS: Record<Scheme, ThemeColors> = {
  light: {
    bg: '#f1efeb',
    ink: '#2f3638',
    onInk: '#f4f2ee',
    switchOn: '#2f3638',
    switchOff: '#cbc6be',
    switchThumb: '#f9f8f6',
  },
  dark: {
    bg: '#111517',
    ink: '#ece8e1',
    onInk: '#1b2124',
    switchOn: '#5f86b8',
    switchOff: '#3a4346',
    switchThumb: '#f2efea',
  },
};

/**
 * El tema claro es la fuente de verdad. El oscuro sustituye cada color por su equivalente
 * según la propiedad en la que aparece: el mismo gris es texto en un sitio y fondo en otro.
 */
const DARK_BACKGROUND: Record<string, string> = {
  '#f1efeb': '#111517',
  '#f9f8f6': '#1b2124',
  '#f2efea': '#232a2d',
  '#f1eeea': '#232a2d',
  '#e9e5df': '#2a3235',
  '#e7e2da': '#2a3235',
  '#eae6de': '#2a3235',
  '#eae7e1': '#1f2629',
  '#ece8e1': '#222a2d',
  '#e5e1da': '#222a2d',
  '#d7d2cb': '#343c3f',
  '#cbc6be': '#3a4346',
  '#dbd7d1': '#343c3f',
  '#dde7f2': '#2b3f55',
  '#d4e4f7': '#2b3f55',
  '#2f3638': '#ece8e1',
  '#40494c': '#cfcac2',
};

const DARK_BORDER: Record<string, string> = {
  '#dbd7d1': '#343c3f',
  '#d4cfc6': '#343c3f',
  '#ded9d0': '#343c3f',
  '#dad4ca': '#343c3f',
  '#cac4bb': '#343c3f',
  '#d4d1cc': '#343c3f',
  '#c7c2bc': '#434c4f',
  '#b5ada3': '#4a5457',
  '#b9b2a8': '#4a5457',
  '#7a9ccc': '#5f86b8',
  '#2f3638': '#ece8e1',
  '#6b7477': '#cfcac2',
  '#1a1a1a': '#0e1112',
};

const DARK_TEXT: Record<string, string> = {
  '#2f3638': '#ece8e1',
  '#1f2527': '#f2efea',
  '#31393d': '#e6e2db',
  '#3c4447': '#d9d5ce',
  '#41484b': '#d9d5ce',
  '#4f575b': '#c6c2bb',
  '#525a5e': '#b9b5ae',
  '#5e666a': '#a9b0b3',
  '#626a6e': '#a2a9ac',
  '#6f7a7e': '#8d979a',
  '#2d3437': '#e6e2db',
  '#30383b': '#d9d5ce',
  '#2a3133': '#d9d5ce',
  '#b85c4b': '#e0836f',
  '#f4f2ee': '#1b2124',
  '#f0ede8': '#1b2124',
  '#f3f2ef': '#1b2124',
  '#d9d4cc': '#3a4346',
  '#a8b0b3': '#5f696d',
};

/** Pantallas y elementos que ya son oscuros en ambos temas, o que representan el archivo exportado. */
const KEEP_AS_IS =
  /^(preview|editor|slot(?!Button)|videoBadge|export(Canvas|Slot|Media|EmptyFill|Hidden)|successThumb|sheetThumb|canvasFrame|libraryModalDim)/;

const mapFor = (property: string): Record<string, string> | null => {
  if (property === 'backgroundColor') return DARK_BACKGROUND;
  if (property === 'color') return DARK_TEXT;
  if (property.startsWith('border') && property.endsWith('Color')) return DARK_BORDER;
  return null;
};

const buildDarkStyles = (): AppStyles => {
  const result: Record<string, unknown> = {};
  for (const [name, style] of Object.entries(lightStyles)) {
    if (KEEP_AS_IS.test(name)) {
      result[name] = style;
      continue;
    }
    const next: Record<string, unknown> = {};
    for (const [property, value] of Object.entries(style as Record<string, unknown>)) {
      const map = mapFor(property);
      next[property] = map && typeof value === 'string' ? map[value.toLowerCase()] ?? value : value;
    }
    result[name] = next;
  }
  return result as AppStyles;
};

let darkStylesCache: AppStyles | null = null;

export const createStyles = (scheme: Scheme): AppStyles => {
  if (scheme === 'light') return lightStyles;
  if (!darkStylesCache) darkStylesCache = buildDarkStyles();
  return darkStylesCache;
};
