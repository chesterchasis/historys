import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import {
  MAX_PHOTO_SCALE,
  MAX_TRANSLATE,
  STORY_HEIGHT,
  STORY_WIDTH,
} from '../constants/collage';
import { LayoutType, SlotMedia, SlotSpec } from '../types/collage';
import { clamp, getSlotBoundsMap } from './collageMath';

type ExportVideoOptions = {
  activeSlots: SlotSpec[];
  slots: Record<string, SlotMedia>;
  layout: LayoutType;
  hasBlackBorders: boolean;
  duration: number;
  onProgress?: (value: number) => void;
};

type ExportImageOptions = {
  exportCanvasRef: { current: any };
};

const quoteForFfmpeg = (uri: string) => `"${uri.replace(/"/g, '\\"')}"`;
const toFfmpegPath = (uri: string) => (uri.startsWith('file://') ? uri.replace('file://', '') : uri);
const VIDEO_CODEC = 'mpeg4';

export const saveToGallery = async (assetUri: string) => {
  const asset = await MediaLibrary.createAssetAsync(assetUri);
  const albumName = 'Historys';
  const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);

  if (existingAlbum) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
  } else {
    await MediaLibrary.createAlbumAsync(albumName, asset, false);
  }
};

export const exportAsImageFallback = async ({ exportCanvasRef }: ExportImageOptions) => {
  if (!exportCanvasRef.current) throw new Error('No export canvas');

  await new Promise((resolve) => setTimeout(resolve, 120));

  const exportedImageUri = await captureRef(exportCanvasRef.current, {
    format: 'jpg',
    quality: 1,
    result: 'tmpfile',
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
  });

  await saveToGallery(exportedImageUri);
};

export const exportVideoWithFfmpeg = async ({
  activeSlots,
  slots,
  layout,
  hasBlackBorders,
  duration,
  onProgress,
}: ExportVideoOptions) => {
  const ffmpegModule = await import('@wokcito/ffmpeg-kit-react-native');
  const { FFmpegKit, ReturnCode } = ffmpegModule;

  const slotBoundsMap = getSlotBoundsMap(layout, hasBlackBorders);
  const inputArgs: string[] = [];
  const filterChains: string[] = [];
  const overlays: string[] = ['[0:v]setpts=PTS-STARTPTS[base0]'];
  const audioMappings: string[] = [];

  let inputIndex = 1;
  let overlayIndex = 0;

  for (const slot of activeSlots) {
    const media = slots[slot.id] ?? { kind: 'empty' as const };
    if (media.kind === 'empty' || !media.uri) continue;

    const bounds = slotBoundsMap[slot.id];
    const inputPath = quoteForFfmpeg(toFfmpegPath(media.uri));

    if (media.kind === 'photo') {
      inputArgs.push(`-loop 1 -t ${duration} -i ${inputPath}`);
    } else {
      inputArgs.push(`-stream_loop -1 -i ${inputPath}`);
    }

    const slotLabel = `slot${inputIndex}`;
    const transform = media.transform ?? { scale: 1, translateX: 0, translateY: 0 };
    const zoom = clamp(transform.scale, 1, MAX_PHOTO_SCALE);

    let translateExpressionX = '';
    let translateExpressionY = '';

    if (media.kind === 'photo') {
      const maxOffsetX = Math.round(bounds.width * 0.32);
      const maxOffsetY = Math.round(bounds.height * 0.32);
      const offsetX = Math.round((transform.translateX / MAX_TRANSLATE) * maxOffsetX);
      const offsetY = Math.round((transform.translateY / MAX_TRANSLATE) * maxOffsetY);

      translateExpressionX = offsetX === 0 ? '' : offsetX > 0 ? `-${offsetX}` : `+${Math.abs(offsetX)}`;
      translateExpressionY = offsetY === 0 ? '' : offsetY > 0 ? `-${offsetY}` : `+${Math.abs(offsetY)}`;
    }

    const scaledWidth = Math.max(Math.round(bounds.width * zoom), bounds.width);
    const scaledHeight = Math.max(Math.round(bounds.height * zoom), bounds.height);

    filterChains.push(
      `[${inputIndex}:v]` +
        `scale=${scaledWidth}:${scaledHeight}:force_original_aspect_ratio=increase,` +
        `crop=${bounds.width}:${bounds.height}:` +
        `x='max(min((iw-${bounds.width})/2${translateExpressionX},iw-${bounds.width}),0)':` +
        `y='max(min((ih-${bounds.height})/2${translateExpressionY},ih-${bounds.height}),0)',` +
        `trim=duration=${duration},setpts=PTS-STARTPTS,format=yuv420p[${slotLabel}]`
    );

    overlays.push(
      `[base${overlayIndex}][${slotLabel}]` +
        `overlay=${bounds.x}:${bounds.y}:shortest=1[base${overlayIndex + 1}]`
    );

    // Agregar audio si el video no está muteado
    if (media.kind === 'video' && !media.muted) {
      audioMappings.push(`-map ${inputIndex}:a:0?`);
    }

    inputIndex += 1;
    overlayIndex += 1;
  }

  const outputUri = new FileSystem.File(FileSystem.Paths.cache, `collage_${Date.now()}.mp4`).uri;
  const outputPath = quoteForFfmpeg(toFfmpegPath(outputUri));

  const filterComplex = [...filterChains, ...overlays].join(';');
  const command = [
    '-y',
    '-f lavfi',
    `-i color=c=black:s=${STORY_WIDTH}x${STORY_HEIGHT}:r=30:d=${duration}`,
    ...inputArgs,
    `-filter_complex "${filterComplex}"`,
    `-map "[base${overlayIndex}]"`,
    ...audioMappings,
    '-r 30',
    '-t',
    `${duration}`,
    '-c:v',
    VIDEO_CODEC,
    '-c:a aac',
    '-pix_fmt yuv420p',
    outputPath,
  ].join(' ');

  const session = await new Promise<any>((resolve, reject) => {
    FFmpegKit.executeAsync(
      command,
      (completedSession: any) => resolve(completedSession),
      undefined,
      (statistics: any) => {
        const renderedMs = typeof statistics?.getTime === 'function' ? Number(statistics.getTime()) : 0;
        const ratio = clamp(renderedMs / (duration * 1000), 0, 0.98);
        onProgress?.(ratio);
      }
    ).catch(reject);
  });

  const returnCode = await session.getReturnCode();

  if (!ReturnCode.isSuccess(returnCode)) {
    const output = typeof session?.getOutput === 'function' ? await session.getOutput() : '';
    const failStack =
      typeof session?.getFailStackTrace === 'function' ? await session.getFailStackTrace() : '';
    throw new Error(output || failStack || 'FFmpeg export failed');
  }

  onProgress?.(1);
  await saveToGallery(outputUri);
};
