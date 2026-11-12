import { BackgroundMode, BorderMode, CollageFormat, LayoutType, SlotSpec } from '../types/collage';

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  'three-horizontal': '3 slots horizontales',
  'two-vertical-one-horizontal': '2 verticales + 1 horizontal',
  'one-horizontal-two-vertical': '1 horizontal + 2 verticales',
};

export const LAYOUT_CHOICES: { id: LayoutType; label: string }[] = [
  { id: 'three-horizontal', label: '3 bandas' },
  { id: 'two-vertical-one-horizontal', label: '2+1' },
  { id: 'one-horizontal-two-vertical', label: '1+2' },
];

export const BORDER_LABELS: Record<BorderMode, string> = {
  black: 'Con bordes',
  none: 'Sin bordes',
};

export const DURATION_OPTIONS = [5, 10, 15, 30];

export const QUALITY_OPTIONS = [
  { id: 'low', label: 'Ligera', mbps: 6 },
  { id: 'medium', label: 'Normal', mbps: 15 },
  { id: 'high', label: 'Máxima', mbps: 28 },
] as const;

export type ExportQuality = (typeof QUALITY_OPTIONS)[number]['id'];

export const MIN_PHOTO_SCALE = 1;
export const MAX_PHOTO_SCALE = 4;

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export const FORMAT_CHOICES: { id: CollageFormat; label: string }[] = [
  { id: 'story', label: '9:16' },
  { id: 'feed', label: '4:5' },
  { id: 'square', label: '1:1' },
];

export const FORMAT_SIZES: Record<CollageFormat, { width: number; height: number }> = {
  story: { width: STORY_WIDTH, height: STORY_HEIGHT },
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
};

export const getFormatRatio = (format: CollageFormat) => {
  const size = FORMAT_SIZES[format];
  return size.width / size.height;
};

export const BACKGROUND_CHOICES: { id: BackgroundMode; label: string }[] = [
  { id: 'black', label: 'Negro' },
  { id: 'white', label: 'Blanco' },
];

export const BACKGROUND_COLORS: Record<BackgroundMode, string> = {
  black: '#000000',
  white: '#ffffff',
};

/** Las fotos solas se guardan al doble del tamaño del vídeo: 2160 × 3840 en historias. */
export const PHOTO_EXPORT_SCALE = 2;

export const LAYOUT_SPECS: Record<LayoutType, SlotSpec[]> = {
  'three-horizontal': [
    { id: 'slot-1', style: 'horizontal' },
    { id: 'slot-2', style: 'horizontal' },
    { id: 'slot-3', style: 'horizontal' },
  ],
  'two-vertical-one-horizontal': [
    { id: 'slot-1', style: 'vertical' },
    { id: 'slot-2', style: 'vertical' },
    { id: 'slot-3', style: 'horizontal' },
  ],
  'one-horizontal-two-vertical': [
    { id: 'slot-1', style: 'horizontal' },
    { id: 'slot-2', style: 'vertical' },
    { id: 'slot-3', style: 'vertical' },
  ],
};
