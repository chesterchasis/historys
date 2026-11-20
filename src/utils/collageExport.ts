import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ExportQuality, FORMAT_SIZES, PHOTO_EXPORT_SCALE } from '../constants/collage';
import { BackgroundMode, CollageFormat, HdrKind, LayoutType, SlotMedia, SlotSpec } from '../types/collage';
import { clamp, getSlotBoundsMap } from './collageMath';
import { buildCollageGraph, type GraphItem, scaleBounds } from './exportGraph';
import { normalizeQuarterTurn } from './frameTransform';

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

type CollageOptions = {
  activeSlots: SlotSpec[];
  slots: Record<string, SlotMedia>;
  layout: LayoutType;
  hasBlackBorders: boolean;
  format: CollageFormat;
  background: BackgroundMode;
  onProgress?: (value: number) => void;
};

type ExportVideoOptions = CollageOptions & {
  duration: number;
  quality?: ExportQuality;
};

export type ExportVideoResult = {
  codec: string;
  h264: boolean;
  /** Algún clip HDR se convirtió a SDR con tone mapping. */
  hdrConverted: boolean;
};

type ExportImageOptions = {
  exportCanvasRef: { current: any };
  format: CollageFormat;
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

const readHdrKind = (properties: Record<string, any> | undefined): HdrKind | undefined => {
  const transfer = String(properties?.color_transfer ?? '').toLowerCase();
  if (transfer === 'arib-std-b67') return 'hlg';
  if (transfer === 'smpte2084') return 'pq';
  return undefined;
};

export const probeVideoOrientation = async (
  uri: string
): Promise<{
  width: number;
  height: number;
  rotation: number;
  hasAudio: boolean;
  hdr?: HdrKind;
} | null> => {
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

    const properties = stream.getAllProperties?.();
    const rotation = normalizeQuarterTurn(readCounterClockwiseRotation(properties));
    const swap = rotation === 90 || rotation === 270;
    const hasAudio = streams.some((item: { getType?: () => string }) => item.getType?.() === 'audio');
    return {
      width: swap ? codedHeight : codedWidth,
      height: swap ? codedWidth : codedHeight,
      rotation,
      hasAudio,
      hdr: readHdrKind(properties),
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

const ALBUM_NAME = 'Historys';

export const saveToGallery = async (assetUri: string) => {
  if (Platform.OS === 'android') {
    // Crea el archivo directamente dentro del álbum. No consulta la galería, así que
    // no hace falta permiso de lectura de fotos y vídeos.
    try {
      await MediaLibrary.createAlbumAsync(ALBUM_NAME, undefined, false, assetUri);
    } catch (error) {
      console.warn('Album save failed, saving to the default folder', error);
      await MediaLibrary.saveToLibraryAsync(assetUri);
    }
    return;
  }

  const asset = await MediaLibrary.createAssetAsync(assetUri);
  const albumName = ALBUM_NAME;
  const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);

  if (existingAlbum) {
    await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
  } else {
    await MediaLibrary.createAlbumAsync(albumName, asset, false);
  }
};

/** Respaldo cuando FFmpeg no está disponible: captura la vista, a menos resolución que la foto normal. */
export const exportAsImageFallback = async ({ exportCanvasRef, format }: ExportImageOptions) => {
  if (!exportCanvasRef.current) throw new Error('No export canvas');

  await new Promise((resolve) => setTimeout(resolve, 120));

  const size = FORMAT_SIZES[format];
  const exportedImageUri = await captureRef(exportCanvasRef.current, {
    format: 'jpg',
    quality: 1,
    result: 'tmpfile',
    width: size.width,
    height: size.height,
  });

  try {
    await saveToGallery(exportedImageUri);
  } finally {
    await deleteCacheFile(exportedImageUri);
  }
};

const loadFfmpeg = async () => {
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
  return { FFmpegKit, ReturnCode };
};

const assertNotExpoGo = () => {
  if (isRunningInExpoGo()) {
    throw new Error(
      'EXPO_GO_UNSUPPORTED: La exportación usa FFmpeg, un módulo nativo que no está disponible en Expo Go. Crea un development build (npx expo run:android o eas build --profile development) para exportar collages.'
    );
  }
};

const runFfmpeg = async (
  { FFmpegKit, ReturnCode }: { FFmpegKit: any; ReturnCode: any },
  command: string,
  onStatistics?: (renderedMs: number) => void
) => {
  const session = await new Promise<any>((resolve, reject) => {
    FFmpegKit.executeAsync(
      command,
      (completedSession: any) => resolve(completedSession),
      undefined,
      (statistics: any) => {
        const renderedMs = typeof statistics?.getTime === 'function' ? Number(statistics.getTime()) : 0;
        onStatistics?.(renderedMs);
      }
    ).catch(reject);
  });

  const returnCode = await session.getReturnCode();
  if (cancelRequested || ReturnCode.isCancel(returnCode)) {
    throw new ExportCancelledError();
  }
  if (!ReturnCode.isSuccess(returnCode)) {
    const output = typeof session?.getOutput === 'function' ? await session.getOutput() : '';
    const failStack = typeof session?.getFailStackTrace === 'function' ? await session.getFailStackTrace() : '';
    throw new Error(output || failStack || 'FFmpeg export failed');
  }
};

/** Resuelve el audio de cada vídeo: usa el dato guardado o lo pregunta a ffprobe si falta. */
const buildGraphItems = async (
  { activeSlots, slots, layout, hasBlackBorders, format }: CollageOptions,
  factor: number
): Promise<GraphItem[]> => {
  const boundsMap = getSlotBoundsMap(layout, hasBlackBorders, format);
  const items: GraphItem[] = [];
  for (const slot of activeSlots) {
    const media = slots[slot.id] ?? { kind: 'empty' as const };
    if (media.kind === 'empty' || !media.uri) continue;

    let hasAudio = false;
    if (media.kind === 'video' && !media.muted) {
      hasAudio = media.hasAudio ?? (await probeVideoOrientation(media.uri))?.hasAudio ?? false;
    }
    items.push({ media, bounds: scaleBounds(boundsMap[slot.id], factor), hasAudio });
  }
  return items;
};

export const exportVideoWithFfmpeg = async (options: ExportVideoOptions): Promise<ExportVideoResult> => {
  assertNotExpoGo();

  // La exportación a video va solo por FFmpeg: el mismo encaje por slot que el preview
  // (filter_complex + overlays). Un compositor multi-pista distinto (p. ej. MediaEngine)
  // no reproducía bien fotos+vídeo ni las posiciones.
  const ffmpeg = await loadFfmpeg();
  const { background, format, quality = 'medium', onProgress } = options;

  cancelRequested = false;

  // Limitamos a 30 s máximo por requisito de producto.
  const safeDuration = clamp(Math.round(options.duration), 1, 30);
  const { width, height } = FORMAT_SIZES[format];
  const items = await buildGraphItems(options, 1);

  const outputFile = new FileSystem.File(FileSystem.Paths.cache, `collage_${Date.now()}.mp4`);
  const outputUri = outputFile.uri;
  const outputPath = quoteForFfmpeg(toFfmpegPath(outputUri));

  const buildCommand = (graph: ReturnType<typeof buildCollageGraph>, videoEncodeArgs: string[]) =>
    [
      '-y',
      ...EXPORT_PROBE_ARGS,
      ...graph.inputArgs,
      `-filter_complex "${graph.filterComplex}"`,
      `-map "[${graph.videoLabel}]"`,
      ...(graph.hasAudio ? ['-map "[aout]"', '-c:a', 'aac'] : ['-an']),
      '-r 30',
      '-t',
      `${safeDuration}`,
      ...videoEncodeArgs,
      '-pix_fmt yuv420p',
      '-colorspace bt709',
      '-color_primaries bt709',
      '-color_trc bt709',
      '-color_range tv',
      '-movflags',
      '+faststart',
      outputPath,
    ].join(' ');

  const encoders = encoderAttempts(quality, await binaryHasLibx264(ffmpeg.FFmpegKit));
  const hasHdrClip = items.some((item) => item.media.kind === 'video' && item.media.hdr);
  // Si la conversión HDR fallara en este dispositivo, se reintenta sin ella antes de rendirse.
  const hdrModes: ('tonemap' | 'none')[] = hasHdrClip ? ['tonemap', 'none'] : ['none'];

  let hdrConverted = false;
  let encoded = false;
  let lastError: unknown;
  try {
    for (const hdr of hdrModes) {
      const graph = buildCollageGraph({ mode: 'video', width, height, items, background, duration: safeDuration, hdr });
      for (const args of encoders) {
        if (cancelRequested) throw new ExportCancelledError();
        try {
          await runFfmpeg(ffmpeg, buildCommand(graph, args), (renderedMs) => {
            onProgress?.(clamp(renderedMs / (safeDuration * 1000), 0, 0.98));
          });
          encoded = true;
          hdrConverted = graph.hdrConverted;
          break;
        } catch (error) {
          if (error instanceof ExportCancelledError) throw error;
          lastError = error;
          onProgress?.(0.05);
        }
      }
      if (encoded) break;
    }
    if (!encoded) {
      throw lastError instanceof Error ? lastError : new Error('FFmpeg export failed');
    }

    const codec = await probeOutputVideoCodec(outputUri);
    if (cancelRequested) throw new ExportCancelledError();
    onProgress?.(1);
    await saveToGallery(outputUri);
    return { codec, h264: isH264Codec(codec), hdrConverted };
  } finally {
    await deleteCacheFile(outputUri);
  }
};

/** Un collage de solo fotos sale como un JPG al doble de tamaño, con la misma geometría que el vídeo. */
export const exportStillWithFfmpeg = async (options: CollageOptions): Promise<{ width: number; height: number }> => {
  assertNotExpoGo();

  const ffmpeg = await loadFfmpeg();
  const { background, format, onProgress } = options;

  cancelRequested = false;

  const base = FORMAT_SIZES[format];
  const width = base.width * PHOTO_EXPORT_SCALE;
  const height = base.height * PHOTO_EXPORT_SCALE;
  const items = await buildGraphItems(options, PHOTO_EXPORT_SCALE);
  const graph = buildCollageGraph({ mode: 'still', width, height, items, background, duration: 1, hdr: 'none' });

  const outputFile = new FileSystem.File(FileSystem.Paths.cache, `collage_${Date.now()}.jpg`);
  const outputUri = outputFile.uri;
  const command = [
    '-y',
    ...EXPORT_PROBE_ARGS,
    ...graph.inputArgs,
    `-filter_complex "${graph.filterComplex}"`,
    `-map "[${graph.videoLabel}]"`,
    '-frames:v 1',
    '-q:v 2',
    '-pix_fmt yuvj420p',
    quoteForFfmpeg(toFfmpegPath(outputUri)),
  ].join(' ');

  try {
    onProgress?.(0.15);
    await runFfmpeg(ffmpeg, command);
    if (cancelRequested) throw new ExportCancelledError();
    onProgress?.(0.9);
    await saveToGallery(outputUri);
    onProgress?.(1);
    return { width, height };
  } finally {
    await deleteCacheFile(outputUri);
  }
};
