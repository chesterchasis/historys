import { MAX_PHOTO_SCALE, MIN_PHOTO_SCALE } from '../constants/collage';
import { PhotoTransform } from '../types/collage';
import { clamp } from './collageMath';

export type MediaRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const normalizeQuarterTurn = (rotation?: number): 0 | 90 | 180 | 270 => {
  if (rotation == null || !Number.isFinite(rotation)) return 0;
  const turns = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  if (turns === 90 || turns === 180 || turns === 270) return turns;
  return 0;
};

export const normalizeTransform = (transform?: Partial<PhotoTransform> | null): PhotoTransform => ({
  scale: clamp(transform?.scale ?? 1, MIN_PHOTO_SCALE, MAX_PHOTO_SCALE),
  translateX: clamp(transform?.translateX ?? 0, -1, 1),
  translateY: clamp(transform?.translateY ?? 0, -1, 1),
});

/**
 * Contain the media in the slot, then zoom. Pan is a fraction of whatever
 * sticks out of the slot, so the same numbers crop the editor, the thumbnail
 * and the FFmpeg frame.
 */
export const placedMediaRect = (
  slotWidth: number,
  slotHeight: number,
  mediaWidth: number,
  mediaHeight: number,
  transform?: Partial<PhotoTransform> | null
): MediaRect | null => {
  if (slotWidth <= 0 || slotHeight <= 0 || mediaWidth <= 0 || mediaHeight <= 0) return null;

  const framed = normalizeTransform(transform);
  const fit = Math.min(slotWidth / mediaWidth, slotHeight / mediaHeight);
  const width = mediaWidth * fit * framed.scale;
  const height = mediaHeight * fit * framed.scale;
  const overflowX = Math.max(0, width - slotWidth);
  const overflowY = Math.max(0, height - slotHeight);

  return {
    width,
    height,
    left: (slotWidth - width) / 2 + framed.translateX * (overflowX / 2),
    top: (slotHeight - height) / 2 + framed.translateY * (overflowY / 2),
  };
};

/** Clockwise degrees to turn an unrotated still so it matches the display. */
export const stillImageTurn = (
  stillWidth: number,
  stillHeight: number,
  displayWidth: number,
  displayHeight: number,
  rotationCcw?: number
): 0 | 90 | 180 | 270 => {
  const rotation = normalizeQuarterTurn(rotationCcw);
  if (rotation === 0 || stillWidth <= 0 || stillHeight <= 0 || displayWidth <= 0 || displayHeight <= 0) {
    return 0;
  }
  if (rotation === 180) return 180;

  const stillAspect = stillWidth / stillHeight;
  const displayAspect = displayWidth / displayHeight;
  if (displayAspect <= 0 || stillAspect <= 0) return 0;
  if (Math.abs(Math.log(stillAspect / displayAspect)) < 0.08) return 0;

  return rotation === 90 ? 270 : 90;
};
