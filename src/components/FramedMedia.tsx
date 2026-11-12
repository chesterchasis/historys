import { type AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useCallback, useRef, useState } from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';
import { PhotoTransform } from '../types/collage';
import { placedMediaRect, stillImageTurn } from '../utils/frameTransform';

type Props = {
  uri: string;
  kind: 'photo' | 'video';
  displayWidth?: number;
  displayHeight?: number;
  stillWidth?: number;
  stillHeight?: number;
  rotation?: number;
  transform?: PhotoTransform;
  playVideo?: boolean;
  muted?: boolean;
  sessionKey?: number;
  slotWidth?: number;
  slotHeight?: number;
  opacity?: number;
  /** Desde dónde se reproduce el vídeo, en ms. Con `trimLengthMs` el tramo se repite en bucle. */
  trimStartMs?: number;
  trimLengthMs?: number;
};

const frameStyle = (rect: { left: number; top: number; width: number; height: number }, turn: number): ImageStyle => {
  if (turn === 90 || turn === 270) {
    return {
      position: 'absolute',
      width: rect.height,
      height: rect.width,
      left: rect.left + (rect.width - rect.height) / 2,
      top: rect.top + (rect.height - rect.width) / 2,
      transform: [{ rotate: `${turn}deg` }],
    };
  }

  return {
    position: 'absolute',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    transform: turn === 180 ? [{ rotate: '180deg' }] : undefined,
  };
};

export function FramedMedia({
  uri,
  kind,
  displayWidth,
  displayHeight,
  stillWidth,
  stillHeight,
  rotation,
  transform,
  playVideo = false,
  muted = false,
  sessionKey = 0,
  slotWidth,
  slotHeight,
  opacity,
  trimStartMs,
  trimLengthMs,
}: Props) {
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const videoRef = useRef<Video>(null);
  const boxWidth = slotWidth && slotWidth > 0 ? slotWidth : measured.width;
  const boxHeight = slotHeight && slotHeight > 0 ? slotHeight : measured.height;
  const rect = placedMediaRect(boxWidth, boxHeight, displayWidth ?? 0, displayHeight ?? 0, transform);
  const turn =
    kind === 'video' && !playVideo
      ? stillImageTurn(stillWidth ?? 0, stillHeight ?? 0, displayWidth ?? 0, displayHeight ?? 0, rotation)
      : 0;

  const startMs = trimStartMs ?? 0;
  const endMs = trimLengthMs ? startMs + trimLengthMs : null;
  const loopWithinTrim = useCallback(
    (status: AVPlaybackStatus) => {
      if (endMs == null || !status.isLoaded) return;
      if (status.positionMillis >= endMs) videoRef.current?.setPositionAsync(startMs);
    },
    [endMs, startMs]
  );
  const videoTrimProps =
    endMs == null
      ? {}
      : { positionMillis: startMs, progressUpdateIntervalMillis: 100, onPlaybackStatusUpdate: loopWithinTrim };

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        if (slotWidth && slotHeight) return;
        const { width, height } = event.nativeEvent.layout;
        setMeasured((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }}
    >
      {rect && kind === 'photo' && <Image source={{ uri }} style={[frameStyle(rect, 0), { opacity }]} />}
      {rect && kind === 'video' && playVideo && (
        <Video
          ref={videoRef}
          key={sessionKey}
          source={{ uri }}
          style={frameStyle(rect, 0)}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted={muted}
          {...videoTrimProps}
        />
      )}
      {rect && kind === 'video' && !playVideo && (
        <Image source={{ uri }} style={[frameStyle(rect, turn), { opacity }]} />
      )}
      {!rect && playVideo && (
        <Video
          key={sessionKey}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          isMuted={muted}
        />
      )}
      {!rect && !playVideo && <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />}
    </View>
  );
}
