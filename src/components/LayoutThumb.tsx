import { StyleSheet, View } from 'react-native';
import { STORY_HEIGHT, STORY_WIDTH } from '../constants/collage';
import { LayoutType } from '../types/collage';
import { getSlotBoundsMap } from '../utils/collageMath';

type Props = {
  layout: LayoutType;
  hasBlackBorders: boolean;
  selected: boolean;
};

const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 114;

export function LayoutThumb({ layout, hasBlackBorders, selected }: Props) {
  const bounds = getSlotBoundsMap(layout, hasBlackBorders);
  const scaleX = THUMB_WIDTH / STORY_WIDTH;
  const scaleY = THUMB_HEIGHT / STORY_HEIGHT;

  return (
    <View style={styles.frame}>
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
  );
}

const styles = StyleSheet.create({
  frame: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
});
