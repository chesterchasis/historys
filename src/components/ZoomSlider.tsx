import { useRef, useState } from 'react';
import { type AccessibilityActionEvent, PanResponder, StyleSheet, View } from 'react-native';
import { clamp } from '../utils/collageMath';

type Props = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

const THUMB = 26;

export function ZoomSlider({ value, min, max, step = 0.25, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const propsRef = useRef({ min, max, onChange });
  propsRef.current = { min, max, onChange };
  const widthRef = useRef(0);
  const startXRef = useRef(0);

  const valueFromX = (x: number) => {
    const usable = Math.max(1, widthRef.current - THUMB);
    const ratio = clamp((x - THUMB / 2) / usable, 0, 1);
    return propsRef.current.min + ratio * (propsRef.current.max - propsRef.current.min);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        startXRef.current = event.nativeEvent.locationX;
        propsRef.current.onChange(valueFromX(startXRef.current));
      },
      onPanResponderMove: (_event, gesture) => {
        propsRef.current.onChange(valueFromX(startXRef.current + gesture.dx));
      },
    })
  ).current;

  const ratio = clamp((value - min) / (max - min), 0, 1);
  const usable = Math.max(0, width - THUMB);
  const thumbLeft = ratio * usable;

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
    onChange(clamp(value + direction * step, min, max));
  };

  return (
    <View
      style={styles.hit}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Zoom"
      accessibilityValue={{ min, max, now: Number(value.toFixed(2)) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
        setWidth(event.nativeEvent.layout.width);
      }}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={styles.visual}>
        <View style={[styles.track, { left: THUMB / 2, right: THUMB / 2 }]} />
        <View style={[styles.fill, { left: THUMB / 2, width: thumbLeft }]} />
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 44,
    justifyContent: 'center',
  },
  visual: {
    height: THUMB,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a4446',
  },
  fill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f0ebe3',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#f0ebe3',
    elevation: 3,
  },
});
