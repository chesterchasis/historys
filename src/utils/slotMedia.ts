import type { ImagePickerAsset } from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Image } from 'react-native';
import type { MediaType, SlotMedia } from '../types/collage';
import { probeVideoOrientation } from './collageExport';

const readImageSize = (imageUri: string) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    Image.getSize(
      imageUri,
      (width, height) => resolve(width > 0 && height > 0 ? { width, height } : null),
      () => resolve(null)
    );
  });

export const formatClipDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export async function buildSlotMedia(asset: ImagePickerAsset): Promise<SlotMedia> {
  const kind: MediaType = asset.type === 'video' ? 'video' : 'photo';

  let previewUri: string | undefined = asset.uri;
  if (kind === 'video') {
    try {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 700 });
      previewUri = thumbnail.uri;
    } catch {
      previewUri = undefined;
    }
  }

  let width: number | undefined;
  let height: number | undefined;
  let stillWidth: number | undefined;
  let stillHeight: number | undefined;
  let rotation: number | undefined;
  let hasAudio: boolean | undefined;

  if (kind === 'photo') {
    const size = await readImageSize(asset.uri);
    width = size?.width;
    height = size?.height;
    stillWidth = width;
    stillHeight = height;
  } else {
    const probed = await probeVideoOrientation(asset.uri);
    const still = previewUri ? await readImageSize(previewUri) : null;
    stillWidth = still?.width;
    stillHeight = still?.height;
    if (probed) {
      width = probed.width;
      height = probed.height;
      rotation = probed.rotation;
      hasAudio = probed.hasAudio;
    } else if (still) {
      width = still.width;
      height = still.height;
      rotation = 0;
    }
  }

  return {
    kind,
    uri: asset.uri,
    previewUri,
    width,
    height,
    stillWidth,
    stillHeight,
    rotation: kind === 'video' ? rotation : undefined,
    hasAudio: kind === 'video' ? hasAudio : undefined,
    durationMs: kind === 'video' && asset.duration ? asset.duration : undefined,
    transform: { scale: 1, translateX: 0, translateY: 0 },
    muted: kind === 'video' ? false : undefined,
  };
}
