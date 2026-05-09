import { LayoutType, SlotBounds } from '../types/collage';
import { STORY_HEIGHT, STORY_WIDTH } from '../constants/collage';

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const getSlotBoundsMap = (
  layout: LayoutType,
  hasBlackBorders: boolean
): Record<string, SlotBounds> => {
  const padding = hasBlackBorders ? 24 : 0;
  const gap = hasBlackBorders ? 24 : 0;
  const innerWidth = STORY_WIDTH - padding * 2;
  const innerHeight = STORY_HEIGHT - padding * 2;

  if (layout === 'three-horizontal') {
    const h1 = Math.floor((innerHeight - gap * 2) / 3);
    const h2 = h1;
    const h3 = innerHeight - h1 - h2 - gap * 2;
    return {
      'slot-1': { x: padding, y: padding, width: innerWidth, height: h1 },
      'slot-2': { x: padding, y: padding + h1 + gap, width: innerWidth, height: h2 },
      'slot-3': {
        x: padding,
        y: padding + h1 + gap + h2 + gap,
        width: innerWidth,
        height: h3,
      },
    };
  }

  if (layout === 'two-vertical-one-horizontal') {
    const topHeight = Math.floor((innerHeight - gap) * (2 / 3));
    const bottomHeight = innerHeight - topHeight - gap;
    const leftWidth = Math.floor((innerWidth - gap) / 2);
    const rightWidth = innerWidth - leftWidth - gap;
    return {
      'slot-1': { x: padding, y: padding, width: leftWidth, height: topHeight },
      'slot-2': {
        x: padding + leftWidth + gap,
        y: padding,
        width: rightWidth,
        height: topHeight,
      },
      'slot-3': {
        x: padding,
        y: padding + topHeight + gap,
        width: innerWidth,
        height: bottomHeight,
      },
    };
  }

  const topHeight = Math.floor((innerHeight - gap) / 3);
  const bottomHeight = innerHeight - topHeight - gap;
  const leftWidth = Math.floor((innerWidth - gap) / 2);
  const rightWidth = innerWidth - leftWidth - gap;
  return {
    'slot-1': { x: padding, y: padding, width: innerWidth, height: topHeight },
    'slot-2': {
      x: padding,
      y: padding + topHeight + gap,
      width: leftWidth,
      height: bottomHeight,
    },
    'slot-3': {
      x: padding + leftWidth + gap,
      y: padding + topHeight + gap,
      width: rightWidth,
      height: bottomHeight,
    },
  };
};
