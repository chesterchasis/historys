import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Linking, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ExportQuality, STORY_HEIGHT, STORY_WIDTH } from '../constants/collage';
import { LayoutType, SlotMedia, SlotSpec } from '../types/collage';
import { clamp, getSlotBoundsMap } from './collageMath';
import { normalizeQuarterTurn, normalizeTransform } from './frameTransform';

export const isRunningInExpoGo = (): boolean => {
  try {
    return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  } catch {
    // @ts-ignore - fallback por si la API cambia
    return Constants?.appOwnership === 'expo';
  }
};

export const hasVideoSlots = (
  activeSlots: SlotSpec[],
  slots: Record<string, SlotMedia>
): boolean => activeSlots.some((s) => slots[s.id]?.kind === 'video');

type ExportVideoOptions = {
  activeSlots: SlotSpec[];
  slots: Record<string, SlotMedia>;
  layout: LayoutType;
  hasBlackBorders: boolean;
  duration: number;
  quality?: ExportQuality;
  onProgress?: (value: number) => void;
};

export type ExportVideoResult = {
  codec: string;
  h264: boolean;
};

type ExportImageOptions = {
  exportCanvasRef: { current: any };
};

export class ExportCancelledError extends Error {
  constructor() {
    super('EXPORT_CANCELLED');
    this.name = 'ExportCancelledError';
  }
}

let cancelRequested = false;

/** Pide parar el render en curso. El temporal se borra en el `finally` de la exportación. */
export const requestCancelExport = async () => {
  cancelRequested = true;
  try {
    const ffmpeg = await import('@wokcito/ffmpeg-kit-react-native');
    await ffmpeg.FFmpegKit.cancel();
  } catch {
    // Sin módulo nativo no hay render que parar.
  }
};

const deleteCacheFile = async (uri: string) => {
  try {
    const file = new FileSystem.File(uri);
    if (file.exists) file.delete();
  } catch {
    // La copia en galería ya está hecha, o el temporal no llegó a crearse.
  }
};

const quoteForFfmpeg = (uri: string) => `"${uri.replace(/"/g, '\\"')}"`;
const toFfmpegPath = (uri: string) => (uri.startsWith('file://') ? uri.replace('file://', '') : uri);

const audioPad = (inputIndex: number, duration: number, label: string) =>
  `[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[${label}]`;

const videoRotationFilters = (rotation?: number): string[] => {
  const turns = normalizeQuarterTurn(rotation);
  if (turns === 90) return ['transpose=2'];
  if (turns === 270) return ['transpose=1'];
  if (turns === 180) return ['hflip', 'vflip'];
  return [];
};

const readCounterClockwiseRotation = (properties: Record<string, any> | undefined): number => {
  const sideData = properties?.side_data_list;
  if (Array.isArray(sideData)) {
    for (const item of sideData) {
      const value = Number(item?.rotation);
      if (Number.isFinite(value)) return value;
    }
  }

  const tag = Number(properties?.tags?.rotate);
  if (!Number.isFinite(tag)) return 0;
  const clockwise = ((Math.round(tag) % 360) + 360) % 360;
  return (360 - clockwise) % 360;
};

export const probeVideoOrientation = async (
  uri: string
): Promise<{ width: number; height: number; rotation: number; hasAudio: boolean } | null> => {
  if (isRunningInExpoGo()) return null;

  try {
    const ffmpeg = await import('@wokcito/ffmpeg-kit-react-native');
    const session = await ffmpeg.FFprobeKit.getMediaInformation(toFfmpegPath(uri));
    const info = session.getMediaInformation();
    const streams = info?.getStreams?.() ?? [];
    const stream = streams.find((item: { getType?: () => string }) => item.getType?.() === 'video');
    if (!stream) return null;

    const codedWidth = Number(stream.getWidth?.());
    const codedHeight = Number(stream.getHeight?.());
    if (!codedWidth || !codedHeight) return null;

    const rotation = normalizeQuarterTurn(readCounterClockwiseRotation(stream.getAllProperties?.()));
    const swap = rotation === 90 || rotation === 270;
    const hasAudio = streams.some((item: { getType?: () => string }) => item.getType?.() === 'audio');
    return {
      width: swap ? codedHeight : codedWidth,
      height: swap ? codedWidth : codedHeight,
      rotation,
      hasAudio,
    };
  } catch {
    return null;
  }
};

/** Más tolerante con MP4/MOV raros (cámara, HDR metadata, contenedores largos). */
const EXPORT_PROBE_ARGS = ['-analyzeduration', '100M', '-probesize', '100M'];

/**
 * Media no cambia el comando de hoy: 15M / 18M / 36M en h264_mediacodec.
 * Si ese encoder falla, entra libx264 cuando el binario lo tiene, y mpeg4 solo al final.
 */
const QUALITY_RATE: Record<ExportQuality, { bitrate: string; maxrate: string; bufsize: string; mpeg4: string }> = {
  low: { bitrate: '6M', maxrate: '8M', bufsize: '16M', mpeg4: '5M' },
  medium: { bitrate: '15M', maxrate: '18M', bufsize: '36M', mpeg4: '14M' },
  high: { bitrate: '28M', maxrate: '35M', bufsize: '56M', mpeg4: '20M' },
};

let libx264Known: boolean | null = null;

const binaryHasLibx264 = async (FFmpegKit: {
  executeAsync: (command: string, onComplete: (session: any) => void) => Promise<unknown>;
}): Promise<boolean> => {
  if (libx264Known != null) return libx264Known;
  try {
    const session = await new Promise<any>((resolve, reject) => {
      FFmpegKit.executeAsync('-hide_banner -encoders', (completed: any) => resolve(completed)).catch(reject);
    });
    const output = typeof session?.getOutput === 'function' ? await session.getOutput() : '';
    const logs = typeof session?.getAllLogsAsString === 'function' ? await session.getAllLogsAsString() : '';
    libx264Known = /\blibx264\b/.test(`${output}\n${logs}`);
  } catch {
    libx264Known = false;
  }
  return libx264Known;
};

const encoderAttempts = (quality: ExportQuality, hasLibx264: boolean): string[][] => {
  const rate = QUALITY_RATE[quality];
  const h264Rate = ['-b:v', rate.bitrate, '-maxrate', rate.maxrate, '-bufsize', rate.bufsize];
  const attempts: string[][] = [];
  if (Platform.OS === 'android') {
    attempts.push(['-c:v', 'h264_mediacodec', ...h264Rate]);
  } else if (Platform.OS === 'ios') {
    attempts.push(['-c:v', 'h264_videotoolbox', '-b:v', rate.bitrate, '-allow_sw', '1']);
  }
  if (hasLibx264) {
    attempts.push(['-c:v', 'libx264', ...h264Rate, '-preset', 'veryfast']);
  }
  attempts.push(['-c:v', 'mpeg4', '-b:v', rate.mpeg4]);
  return attempts;
};

const isH264Codec = (codec: string) => {
  const name = codec.toLowerCase();
  return name === 'h264' || name === 'avc' || name === 'avc1';
};

const probeOutputVideoCodec = async (uri: string): Promise<string> => {
  try {
    const ffmpeg = await import('@wokcito/ffmpeg-kit-react-native');
    const session = await ffmpeg.FFprobeKit.getMediaInformation(toFfmpegPath(uri));
    const stream = session
      .getMediaInformation()
      ?.getStreams?.()
      ?.find((item: { getType?: () => string }) => item.getType?.() === 'video');
    return String(stream?.getCodec?.() ?? '').toLowerCase();
  } catch {
    return '';
  }
};

export const openDeviceGallery = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('photos-redirect://');
      return true;
    }
    if (Platform.OS === 'android') {
      await Linking.openURL('content://media/external/images/media');
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

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

  try {
    await saveToGallery(exportedImageUri);
  } finally {
    await deleteCacheFile(exportedImageUri);
  }
};

// Nota: ya no creamos un PNG negro temporal. Usamos el filtro fuente `color=`
// dentro de filter_complex como base del collage. Eso evita escrituras a disco
// (la API antigua `writeAsStringAsync` está deprecada en SDK 54) y simplifica
// la limpieza.

export const exportVideoWithFfmpeg = async ({
  activeSlots,
  slots,
  layout,
  hasBlackBorders,
  duration,
  quality = 'medium',
  onProgress,
}: ExportVideoOptions): Promise<ExportVideoResult> => {
  if (isRunningInExpoGo()) {
    throw new Error(
      'EXPO_GO_UNSUPPORTED: La exportación de video usa FFmpeg, un módulo nativo que no está disponible en Expo Go. Crea un development build (npx expo run:android o eas build --profile development) para exportar collages con video.'
    );
  }

  // La exportación a video va solo por FFmpeg: el mismo encaje por slot que el preview
  // (filter_complex + overlays). Un compositor multi-pista distinto (p. ej. MediaEngine)
  // no reproducía bien fotos+vídeo ni las posiciones.

  let ffmpegModule: any;
  try {
    ffmpegModule = await import('@wokcito/ffmpeg-kit-react-native');
  } catch (err) {
    throw new Error(
      'FFMPEG_MODULE_MISSING: No se pudo cargar @wokcito/ffmpeg-kit-react-native. Asegúrate de estar usando un development build con el módulo nativo compilado (no Expo Go).'
    );
  }
  const { FFmpegKit, ReturnCode } = ffmpegModule;
  if (!FFmpegKit || typeof FFmpegKit.executeAsync !== 'function') {
    throw new Error(
      'FFMPEG_NATIVE_UNAVAILABLE: El módulo nativo de FFmpeg no está enlazado en este binario. Reconstruye la app (npx expo prebuild + npx expo run:android).'
    );
  }

  cancelRequested = false;

  // Limitamos a 30 s máximo por requisito de producto.
  const safeDuration = clamp(Math.round(duration), 1, 30);

  const slotBoundsMap = getSlotBoundsMap(layout, hasBlackBorders);
  const inputArgs: string[] = [];
  const filterChains: string[] = [];
  const overlays: string[] = [];
  const audioInputs: number[] = [];

  // Base negra como fuente del filter_complex (no requiere input ni archivo).
  filterChains.push(
    `color=c=black:s=${STORY_WIDTH}x${STORY_HEIGHT}:d=${safeDuration}:r=30,format=yuv420p[base0]`
  );

  let inputIndex = 0; // los slots empiezan en 0 ahora (no hay input de imagen negra)
  let overlayIndex = 0;

  for (const slot of activeSlots) {
    const media = slots[slot.id] ?? { kind: 'empty' as const };
    if (media.kind === 'empty' || !media.uri) continue;

    const bounds = slotBoundsMap[slot.id];
    const inputPath = quoteForFfmpeg(toFfmpegPath(media.uri));

    if (media.kind === 'photo') {
      inputArgs.push(`-loop 1 -t ${safeDuration} -i ${inputPath}`);
    } else {
      inputArgs.push(`-noautorotate -stream_loop -1 -i ${inputPath}`);
    }

    const slotLabel = `slot${inputIndex}`;
    const transform = normalizeTransform(media.transform);
    const zoom = transform.scale;

    // Contain inside slot*zoom, then pad only up to the slot on the short side.
    // Force even dimensions so yuv420p/yuvj420p pad never truncates below iw/ih.
    const toEven = (value: number) => Math.max(2, Math.ceil(value / 2) * 2);
    const canvasWidth = toEven(Math.max(Math.round(bounds.width * zoom), bounds.width));
    const canvasHeight = toEven(Math.max(Math.round(bounds.height * zoom), bounds.height));
    const panX = transform.translateX.toFixed(4);
    const panY = transform.translateY.toFixed(4);
    const cropXExpr = `max(0\\,min((iw-${bounds.width})/2*(1-(${panX}))\\,iw-${bounds.width}))`;
    const cropYExpr = `max(0\\,min((ih-${bounds.height})/2*(1-(${panY}))\\,ih-${bounds.height}))`;
    const rotationPrefix =
      media.kind === 'video' ? videoRotationFilters(media.rotation).join(',') : '';

    filterChains.push(
      `[${inputIndex}:v]` +
        `setpts=PTS-STARTPTS,` +
        (rotationPrefix ? `${rotationPrefix},` : '') +
        `scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=bicubic,` +
        `pad=max(iw+mod(iw\\,2)\\,${bounds.width}):max(ih+mod(ih\\,2)\\,${bounds.height}):(ow-iw)/2:(oh-ih)/2:color=black,` +
        `crop=${bounds.width}:${bounds.height}:${cropXExpr}:${cropYExpr},` +
        `setsar=1,trim=duration=${safeDuration},setpts=PTS-STARTPTS,format=yuv420p[${slotLabel}]`
    );

    overlays.push(
      `[base${overlayIndex}][${slotLabel}]` +
        `overlay=${bounds.x}:${bounds.y}:shortest=1[base${overlayIndex + 1}]`
    );

    if (media.kind === 'video' && !media.muted && media.uri) {
      let hasAudio = media.hasAudio;
      if (hasAudio == null) {
        hasAudio = (await probeVideoOrientation(media.uri))?.hasAudio ?? false;
      }
      if (hasAudio) audioInputs.push(inputIndex);
    }

    inputIndex += 1;
    overlayIndex += 1;
  }

  const outputFile = new FileSystem.File(FileSystem.Paths.cache, `collage_${Date.now()}.mp4`);
  const outputUri = outputFile.uri;
  const outputPath = quoteForFfmpeg(toFfmpegPath(outputUri));

  const audioChains: string[] = [];
  if (audioInputs.length === 1) {
    audioChains.push(audioPad(audioInputs[0], safeDuration, 'aout'));
  } else if (audioInputs.length > 1) {
    const pads = audioInputs.map((index, order) => {
      const label = `am${order}`;
      audioChains.push(audioPad(index, safeDuration, label));
      return `[${label}]`;
    });
    audioChains.push(
      `${pads.join('')}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0[aout]`
    );
  }

  const filterComplex = [...filterChains, ...overlays, ...audioChains].join(';');
  const finalLabel = overlayIndex === 0 ? 'base0' : `base${overlayIndex}`;
  const audioEncodingArgs =
    audioInputs.length > 0 ? ['-map "[aout]"', '-c:a', 'aac'] : ['-an'];

  const buildCommand = (videoEncodeArgs: string[]) =>
    [
      '-y',
      ...EXPORT_PROBE_ARGS,
      ...inputArgs,
      `-filter_complex "${filterComplex}"`,
      `-map "[${finalLabel}]"`,
      ...audioEncodingArgs,
      '-r 30',
      '-t',
      `${safeDuration}`,
      ...videoEncodeArgs,
      '-pix_fmt yuv420p',
      '-movflags',
      '+faststart',
      outputPath,
    ].join(' ');

  const runFfmpeg = async (command: string) => {
    const session = await new Promise<any>((resolve, reject) => {
      FFmpegKit.executeAsync(
        command,
        (completedSession: any) => resolve(completedSession),
        undefined,
        (statistics: any) => {
          const renderedMs = typeof statistics?.getTime === 'function' ? Number(statistics.getTime()) : 0;
          const ratio = clamp(renderedMs / (safeDuration * 1000), 0, 0.98);
          onProgress?.(ratio);
        }
      ).catch(reject);
    });

    const returnCode = await session.getReturnCode();
    if (cancelRequested || ReturnCode.isCancel(returnCode)) {
      throw new ExportCancelledError();
    }
    if (!ReturnCode.isSuccess(returnCode)) {
      const output = typeof session?.getOutput === 'function' ? await session.getOutput() : '';
      const failStack =
        typeof session?.getFailStackTrace === 'function' ? await session.getFailStackTrace() : '';
      throw new Error(output || failStack || 'FFmpeg export failed');
    }
  };

  const attempts = encoderAttempts(quality, await binaryHasLibx264(FFmpegKit));
  let encoded = false;
  let lastError: unknown;
  try {
    for (const args of attempts) {
      if (cancelRequested) throw new ExportCancelledError();
      try {
        await runFfmpeg(buildCommand(args));
        encoded = true;
        break;
      } catch (error) {
        if (error instanceof ExportCancelledError) throw error;
        lastError = error;
        onProgress?.(0.05);
      }
    }
    if (!encoded) {
      throw lastError instanceof Error ? lastError : new Error('FFmpeg export failed');
    }

    const codec = await probeOutputVideoCodec(outputUri);
    if (cancelRequested) throw new ExportCancelledError();
    onProgress?.(1);
    await saveToGallery(outputUri);
    return { codec, h264: isH264Codec(codec) };
  } finally {
    await deleteCacheFile(outputUri);
  }
};
