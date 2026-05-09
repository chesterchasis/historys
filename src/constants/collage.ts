import { LayoutType, BorderMode, SlotSpec } from '../types/collage';

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  'three-horizontal': '3 slots horizontales',
  'two-vertical-one-horizontal': '2 verticales + 1 horizontal',
  'one-horizontal-two-vertical': '1 horizontal + 2 verticales',
};

export const BORDER_LABELS: Record<BorderMode, string> = {
  black: 'Con bordes',
  none: 'Sin bordes',
};

export const DURATION_OPTIONS = [5, 10, 15, 30];

export const MIN_PHOTO_SCALE = 1;
export const MAX_PHOTO_SCALE = 4;
export const MAX_TRANSLATE = 220;

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

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
