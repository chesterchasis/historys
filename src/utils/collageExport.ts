import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import {
  MAX_PHOTO_SCALE,
  MAX_TRANSLATE,
  STORY_HEIGHT,
  STORY_WIDTH,
} from '../constants/collage';
import { LayoutType, SlotMedia, SlotSpec } from '../types/collage';
import { clamp, getSlotBoundsMap } from './collageMath';

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
  onProgress?: (value: number) => void;
};

type ExportImageOptions = {
  exportCanvasRef: { current: any };
};

const quoteForFfmpeg = (uri: string) => `"${uri.replace(/"/g, '\\"')}"`;
const toFfmpegPath = (uri: string) => (uri.startsWith('file://') ? uri.replace('file://', '') : uri);

/** Más tolerante con MP4/MOV raros (cámara, HDR metadata, contenedores largos). */
const EXPORT_PROBE_ARGS = ['-analyzeduration', '100M', '-probesize', '100M'];

/**
 * Salida ~Full HD vertical (1080×1920): H.264 por hardware en Android (MediaCodec) o
 * VideoToolbox en iOS, con bitrate alto. Si no hay encoder nativo, MPEG-4 Part 2 con bitrate alto.
 * Decodificación: FFmpeg intenta leer la mayoría de códecs que incluya el binario (H.264, HEVC según build).
 * La rotación por metadatos (p. ej. selfie) depende del decodificador del binario; este build no incluye el filtro lavfi `autorotate`.
 */
const getExportVideoEncodingArgs = (): string[] => {
  if (Platform.OS === 'android') {
    return ['-c:v', 'h264_mediacodec', '-b:v', '15M', '-maxrate', '18M', '-bufsize', '36M'];
  }
  if (Platform.OS === 'ios') {
    return ['-c:v', 'h264_videotoolbox', '-b:v', '15M', '-allow_sw', '1'];
  }
  return ['-c:v', 'mpeg4', '-b:v', '12M'];
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

  await saveToGallery(exportedImageUri);
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
  onProgress,
}: ExportVideoOptions) => {
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

  // Limitamos a 30 s máximo por requisito de producto.
  const safeDuration = clamp(Math.round(duration), 1, 30);

  const slotBoundsMap = getSlotBoundsMap(layout, hasBlackBorders);
  const inputArgs: string[] = [];
  const filterChains: string[] = [];
  const overlays: string[] = [];
  const audioMappings: string[] = [];

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
      inputArgs.push(`-stream_loop -1 -i ${inputPath}`);
    }

    const slotLabel = `slot${inputIndex}`;
    const transform = media.transform ?? { scale: 1, translateX: 0, translateY: 0 };
    const zoom = clamp(transform.scale, 1, MAX_PHOTO_SCALE);

    // Lienzo intermedio: la foto/video se ajusta dentro de un canvas zoom*bounds
    // manteniendo aspect-ratio (contain), y se rellena con negro si sobra.
    // Después se recorta al tamaño exacto del slot, con desplazamiento del usuario.
    const canvasWidth = Math.max(Math.round(bounds.width * zoom), bounds.width);
    const canvasHeight = Math.max(Math.round(bounds.height * zoom), bounds.height);

    // Desplazamiento del usuario mapeado a píxeles dentro del canvas.
    // Solo tiene efecto cuando el contenido ocupa más que el slot
    // (zoom > 1 o foto del lado largo del slot). Limitamos al margen libre.
    const maxOffsetX = Math.round((canvasWidth - bounds.width) / 2);
    const maxOffsetY = Math.round((canvasHeight - bounds.height) / 2);
    const offsetX = Math.round((transform.translateX / MAX_TRANSLATE) * maxOffsetX);
    const offsetY = Math.round((transform.translateY / MAX_TRANSLATE) * maxOffsetY);

    const sx = offsetX === 0 ? '' : offsetX > 0 ? `-${offsetX}` : `+${Math.abs(offsetX)}`;
    const sy = offsetY === 0 ? '' : offsetY > 0 ? `-${offsetY}` : `+${Math.abs(offsetY)}`;

    // En filter_graph las comas separan opciones: dentro de max()/min() hay que usar \, o FFmpeg
    // parte mal pad/crop ("Failed to configure input pad", "Error reinitializing filters").
    const cropXExpr = `max(min((iw-${bounds.width})/2${sx}\\,iw-${bounds.width})\\,0)`;
    const cropYExpr = `max(min((ih-${bounds.height})/2${sy}\\,ih-${bounds.height})\\,0)`;

    filterChains.push(
      `[${inputIndex}:v]` +
        `setpts=PTS-STARTPTS,` +
        // 1) Encajar dentro de canvasWxH manteniendo aspect ratio (contain)
        `scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=decrease:flags=bicubic,` +
        // 2) Pad defensivo (max con comas escapadas)
        `pad=max(iw\\,${canvasWidth}):max(ih\\,${canvasHeight}):(ow-iw)/2:(oh-ih)/2:color=black,` +
        // 3) Recortar al slot con pan del usuario
        `crop=${bounds.width}:${bounds.height}:${cropXExpr}:${cropYExpr},` +
        `setsar=1,trim=duration=${safeDuration},setpts=PTS-STARTPTS,format=yuv420p[${slotLabel}]`
    );

    overlays.push(
      `[base${overlayIndex}][${slotLabel}]` +
        `overlay=${bounds.x}:${bounds.y}:shortest=1[base${overlayIndex + 1}]`
    );

    if (media.kind === 'video' && !media.muted) {
      audioMappings.push(`-map ${inputIndex}:a:0?`);
    }

    inputIndex += 1;
    overlayIndex += 1;
  }

  const outputUri = new FileSystem.File(FileSystem.Paths.cache, `collage_${Date.now()}.mp4`).uri;
  const outputPath = quoteForFfmpeg(toFfmpegPath(outputUri));

  const filterComplex = [...filterChains, ...overlays].join(';');
  const finalLabel = overlayIndex === 0 ? 'base0' : `base${overlayIndex}`;
  const audioEncodingArgs =
    audioMappings.length > 0 ? [...audioMappings, '-c:a', 'aac'] : ['-an'];

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
    if (!ReturnCode.isSuccess(returnCode)) {
      const output = typeof session?.getOutput === 'function' ? await session.getOutput() : '';
      const failStack =
        typeof session?.getFailStackTrace === 'function' ? await session.getFailStackTrace() : '';
      throw new Error(output || failStack || 'FFmpeg export failed');
    }
  };

  const primaryEncode = getExportVideoEncodingArgs();
  try {
    await runFfmpeg(buildCommand(primaryEncode));
  } catch (firstErr) {
    const canTryMpeg4Fallback =
      (Platform.OS === 'android' && primaryEncode.includes('h264_mediacodec')) ||
      (Platform.OS === 'ios' && primaryEncode.includes('h264_videotoolbox'));
    if (canTryMpeg4Fallback) {
      onProgress?.(0.05);
      await runFfmpeg(buildCommand(['-c:v', 'mpeg4', '-b:v', '14M']));
    } else {
      throw firstErr;
    }
  }

  onProgress?.(1);
  await saveToGallery(outputUri);
};
