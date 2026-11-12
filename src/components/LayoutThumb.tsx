import { StyleSheet, View } from 'react-native';
import { BACKGROUND_COLORS, FORMAT_SIZES } from '../constants/collage';
import { BackgroundMode, CollageFormat, LayoutType } from '../types/collage';
import { getSlotBoundsMap } from '../utils/collageMath';

type Props = {
  layout: LayoutType;
  hasBlackBorders: boolean;
  selected: boolean;
  format?: CollageFormat;
  background?: BackgroundMode;
};

const THUMB_WIDTH = 64;
const THUMB_BOX_HEIGHT = 114;

export function LayoutThumb({ layout, hasBlackBorders, selected, format = 'story', background = 'black' }: Props) {
  const bounds = getSlotBoundsMap(layout, hasBlackBorders, format);
  const size = FORMAT_SIZES[format];
  const thumbHeight = Math.round((THUMB_WIDTH * size.height) / size.width);
  const scaleX = THUMB_WIDTH / size.width;
  const scaleY = thumbHeight / size.height;

  return (
    <View style={styles.box}>
      <View style={{ width: THUMB_WIDTH, height: thumbHeight, backgroundColor: BACKGROUND_COLORS[background], overflow: 'hidden' }}>
        {Object.entries(bounds).map(([id, bound]) => (
          <View
            key={id}
            style={{
              position: 'absolute',
              left: bound.x * scaleX,
              top: bound.y * scaleY,
              width: bound.width * scaleX,
              height: bound.height * scaleY,
              backgroundColor: selected ? '#f4f1eb' : '#e7e2da',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: '#1c1c1c',
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: THUMB_WIDTH,
    height: THUMB_BOX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
