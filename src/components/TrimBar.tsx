import { useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { clamp } from '../utils/collageMath';
import { formatClipDuration } from '../utils/slotMedia';

type Props = {
  clipMs: number;
  /** Duración de la historia: el tramo que se usa del clip. */
  windowMs: number;
  startMs: number;
  stripUris: string[];
  onChange: (startMs: number) => void;
  onRelease: (startMs: number) => void;
};

const TRACK_HEIGHT = 52;

/** Una ventana del largo de la historia que se desliza sobre el clip. Sin asas ni cuentas. */
export function TrimBar({ clipMs, windowMs, startMs, stripUris, onChange, onRelease }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const latest = useRef({ clipMs, windowMs, startMs, trackWidth, onChange, onRelease });
  latest.current = { clipMs, windowMs, startMs, trackWidth, onChange, onRelease };
  const dragStart = useRef(0);
  const current = useRef(startMs);

  const windowLeft = clipMs > 0 ? (startMs / clipMs) * trackWidth : 0;
  const windowWidth = clipMs > 0 ? (windowMs / clipMs) * trackWidth : trackWidth;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { clipMs: clip, windowMs: window, startMs: start, trackWidth: width, onChange: change } = latest.current;
        if (width <= 0 || clip <= 0) return;
        const max = Math.max(0, clip - window);
        const left = (start / clip) * width;
        const right = left + (window / clip) * width;
        const touchX = event.nativeEvent.locationX;
        let next = start;
        if (touchX < left || touchX > right) {
          next = clamp((touchX / width) * clip - window / 2, 0, max);
          change(next);
        }
        dragStart.current = next;
        current.current = next;
      },
      onPanResponderMove: (_event, gesture) => {
        const { clipMs: clip, windowMs: window, trackWidth: width, onChange: change } = latest.current;
        if (width <= 0 || clip <= 0) return;
        const max = Math.max(0, clip - window);
        const next = clamp(dragStart.current + (gesture.dx / width) * clip, 0, max);
        current.current = next;
        change(next);
      },
      onPanResponderRelease: () => latest.current.onRelease(current.current),
      onPanResponderTerminate: () => latest.current.onRelease(current.current),
    })
  ).current;

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Tramo del vídeo</Text>
        <Text style={styles.range}>
          {formatClipDuration(startMs)} – {formatClipDuration(Math.min(clipMs, startMs + windowMs))}
        </Text>
      </View>
      <View
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Tramo del vídeo, empieza en ${formatClipDuration(startMs)}`}
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={styles.strip}>
          {stripUris.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.frame} />
          ))}
        </View>
        <View pointerEvents="none" style={[styles.dim, { left: 0, width: windowLeft }]} />
        <View pointerEvents="none" style={[styles.dim, { left: windowLeft + windowWidth, right: 0 }]} />
        <View pointerEvents="none" style={[styles.window, { left: windowLeft, width: windowWidth }]} />
      </View>
      <View style={styles.labelRow}>
        <Text style={styles.end}>0:00</Text>
        <Text style={styles.end}>{formatClipDuration(clipMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#d9d4cc',
    fontSize: 12,
    fontWeight: '700',
  },
  range: {
    color: '#f0ebe3',
    fontSize: 12,
    fontWeight: '700',
  },
  end: {
    color: '#7f898c',
    fontSize: 10,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#2a3335',
  },
  strip: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  frame: {
    flex: 1,
    height: '100%',
  },
  dim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 14, 15, 0.66)',
  },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2.5,
    borderColor: '#f0ebe3',
    borderRadius: 10,
  },
});
