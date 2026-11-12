import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { STORY_HEIGHT, STORY_WIDTH } from '../constants/collage';
import { LayoutType, SlotSpec } from '../types/collage';
import { getSlotBoundsMap } from '../utils/collageMath';

type Props = {
  layout: LayoutType;
  hasBlackBorders: boolean;
  slots: SlotSpec[];
  width: number;
  height: number;
  disabled?: boolean;
  canDrag: (slotId: string) => boolean;
  canAdjust: (slotId: string) => boolean;
  renderGhost: (slotId: string) => ReactNode;
  onTapSlot: (slotId: string) => void;
  onDoubleTapSlot: (slotId: string) => void;
  onTapOutside: () => void;
  onSwap: (fromId: string, toId: string) => void;
  onDragChange?: (active: boolean) => void;
};

type DragState = { fromId: string; hoverId: string | null };
type Rect = { id: string; x: number; y: number; width: number; height: number };

const LONG_PRESS_MS = 380;
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 320;
const GHOST_SCALE = 0.7;

export function SlotGestureLayer(props: Props) {
  const propsRef = useRef(props);
  propsRef.current = props;

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const ghostPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ghostSize = useRef({ width: 0, height: 0 });
  const touchRef = useRef({ x: 0, y: 0, slotId: null as string | null, moved: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ slotId: string; time: number } | null>(null);

  const getRects = (): Rect[] => {
    const { layout, hasBlackBorders, slots, width, height } = propsRef.current;
    const bounds = getSlotBoundsMap(layout, hasBlackBorders);
    const scaleX = width / STORY_WIDTH;
    const scaleY = height / STORY_HEIGHT;
    return slots.flatMap((slot) => {
      const bound = bounds[slot.id];
      if (!bound) return [];
      return [
        {
          id: slot.id,
          x: bound.x * scaleX,
          y: bound.y * scaleY,
          width: bound.width * scaleX,
          height: bound.height * scaleY,
        },
      ];
    });
  };

  const hitTest = (x: number, y: number) =>
    getRects().find(
      (rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
    ) ?? null;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const endDrag = () => {
    dragRef.current = null;
    setDrag(null);
    propsRef.current.onDragChange?.(false);
  };

  const beginDrag = () => {
    const { slotId, x, y } = touchRef.current;
    if (!slotId || !propsRef.current.canDrag(slotId)) return;
    const source = getRects().find((rect) => rect.id === slotId);
    if (!source) return;

    ghostSize.current = { width: source.width * GHOST_SCALE, height: source.height * GHOST_SCALE };
    ghostPosition.setValue({ x: x - ghostSize.current.width / 2, y: y - ghostSize.current.height / 2 });
    dragRef.current = { fromId: slotId, hoverId: null };
    setDrag({ fromId: slotId, hoverId: null });
    propsRef.current.onDragChange?.(true);
  };

  const handleTap = () => {
    const { slotId } = touchRef.current;
    const handlers = propsRef.current;
    if (!slotId) {
      lastTapRef.current = null;
      handlers.onTapOutside();
      return;
    }

    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.slotId === slotId && now - last.time < DOUBLE_TAP_MS && handlers.canAdjust(slotId)) {
      lastTapRef.current = null;
      handlers.onDoubleTapSlot(slotId);
      return;
    }

    lastTapRef.current = { slotId, time: now };
    handlers.onTapSlot(slotId);
  };

  useEffect(() => clearTimer, []);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !propsRef.current.disabled,
      onMoveShouldSetPanResponder: () => !propsRef.current.disabled,
      onPanResponderTerminationRequest: () => !dragRef.current,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        touchRef.current = {
          x: locationX,
          y: locationY,
          slotId: hitTest(locationX, locationY)?.id ?? null,
          moved: false,
        };
        clearTimer();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (!touchRef.current.moved) beginDrag();
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_event, gesture) => {
        const start = touchRef.current;
        const pointX = start.x + gesture.dx;
        const pointY = start.y + gesture.dy;

        if (!dragRef.current) {
          if (Math.hypot(gesture.dx, gesture.dy) > TAP_SLOP) {
            touchRef.current.moved = true;
            clearTimer();
          }
          return;
        }

        ghostPosition.setValue({
          x: pointX - ghostSize.current.width / 2,
          y: pointY - ghostSize.current.height / 2,
        });
        const over = hitTest(pointX, pointY);
        const hoverId = over && over.id !== dragRef.current.fromId ? over.id : null;
        if (hoverId !== dragRef.current.hoverId) {
          dragRef.current = { ...dragRef.current, hoverId };
          setDrag(dragRef.current);
        }
      },
      onPanResponderRelease: () => {
        clearTimer();
        const current = dragRef.current;
        if (current) {
          endDrag();
          if (current.hoverId) propsRef.current.onSwap(current.fromId, current.hoverId);
          return;
        }
        if (!touchRef.current.moved) handleTap();
      },
      onPanResponderTerminate: () => {
        clearTimer();
        if (dragRef.current) endDrag();
      },
    })
  ).current;

  const rects = drag ? getRects() : [];
  const source = rects.find((rect) => rect.id === drag?.fromId);
  const hover = rects.find((rect) => rect.id === drag?.hoverId);

  return (
    <View style={StyleSheet.absoluteFill} collapsable={false} {...responder.panHandlers}>
      {drag && source && (
        <View
          pointerEvents="none"
          style={[styles.sourceDim, { left: source.x, top: source.y, width: source.width, height: source.height }]}
        />
      )}
      {drag && hover && (
        <View
          pointerEvents="none"
          style={[styles.hoverRing, { left: hover.x, top: hover.y, width: hover.width, height: hover.height }]}
        />
      )}
      {drag && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              width: ghostSize.current.width,
              height: ghostSize.current.height,
              transform: ghostPosition.getTranslateTransform(),
            },
          ]}
        >
          {props.renderGhost(drag.fromId)}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sourceDim: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  hoverRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#7a9ccc',
    backgroundColor: 'rgba(122, 156, 204, 0.28)',
  },
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#f9f8f6',
    opacity: 0.92,
    elevation: 10,
  },
});
