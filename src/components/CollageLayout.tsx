import { ReactNode } from 'react';
import { View } from 'react-native';
import { LayoutType, SlotSpec } from '../types/collage';

type Props = {
  layout: LayoutType;
  hasBlackBorders: boolean;
  slots: SlotSpec[];
  renderSlot: (slot: SlotSpec) => ReactNode;
};

export function CollageLayout({ layout, hasBlackBorders, slots, renderSlot }: Props) {
  if (layout === 'three-horizontal') {
    return <View style={{ flex: 1, gap: hasBlackBorders ? 6 : 0 }}>{slots.map(renderSlot)}</View>;
  }

  if (layout === 'two-vertical-one-horizontal') {
    return (
      <>
        <View
          style={{
            flexDirection: 'row',
            flex: 2,
            gap: hasBlackBorders ? 6 : 0,
            marginBottom: hasBlackBorders ? 6 : 0,
          }}
        >
          {slots.slice(0, 2).map(renderSlot)}
        </View>
        <View style={{ flex: 1 }}>{renderSlot(slots[2])}</View>
      </>
    );
  }

  return (
    <>
      <View style={{ flex: 1 }}>{renderSlot(slots[0])}</View>
      <View
        style={{
          flexDirection: 'row',
          flex: 2,
          gap: hasBlackBorders ? 6 : 0,
          marginTop: hasBlackBorders ? 6 : 0,
        }}
      >
        {slots.slice(1, 3).map(renderSlot)}
      </View>
    </>
  );
}
