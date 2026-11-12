import type { SlotMedia } from '../types/collage';
import { clamp } from './collageMath';

/** Un clip solo se recorta si sobra tiempo por encima de la historia. */
export const TRIM_MIN_EXTRA_MS = 500;

export const canTrimClip = (media: Pick<SlotMedia, 'kind' | 'durationMs'>, storySeconds: number): boolean =>
  media.kind === 'video' && (media.durationMs ?? 0) > storySeconds * 1000 + TRIM_MIN_EXTRA_MS;

export const maxTrimStartMs = (media: Pick<SlotMedia, 'durationMs'>, storySeconds: number): number =>
  Math.max(0, (media.durationMs ?? 0) - storySeconds * 1000);

/**
 * Desde dónde se usa el clip. Si luego se alarga la historia, el inicio se corre hacia atrás
 * para que la ventana siga cabiendo dentro del clip.
 */
export const effectiveTrimStartMs = (
  media: Pick<SlotMedia, 'kind' | 'durationMs' | 'trimStartMs'>,
  storySeconds: number
): number => {
  if (media.kind !== 'video' || !media.durationMs) return 0;
  return Math.round(clamp(media.trimStartMs ?? 0, 0, maxTrimStartMs(media, storySeconds)));
};
