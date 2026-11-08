import { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { STORY_HEIGHT, STORY_WIDTH } from '../constants/collage';
import { LayoutType, SlotSpec } from '../types/collage';
import { getSlotBoundsMap } from '../utils/collageMath';

type Props = {
  layout: LayoutType;
  hasBlackBorders: boolean;
  slots: SlotSpec[];
  renderSlot: (slot: SlotSpec) => ReactNode;
};

export function CollageLayout({ layout, hasBlackBorders, slots, renderSlot }: Props) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const bounds = getSlotBoundsMap(layout, hasBlackBorders);
  const scaleX = box.width > 0 ? box.width / STORY_WIDTH : 0;
  const scaleY = box.height > 0 ? box.height / STORY_HEIGHT : 0;

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {scaleX > 0 &&
        slots.map((slot) => {
          const bound = bounds[slot.id];
          if (!bound) return null;
          return (
            <View
              key={slot.id}
              style={{
                position: 'absolute',
                left: bound.x * scaleX,
                top: bound.y * scaleY,
                width: bound.width * scaleX,
                height: bound.height * scaleY,
                overflow: 'hidden',
              }}
            >
              {renderSlot(slot)}
            </View>
          );
        })}
    </View>
  );
}
