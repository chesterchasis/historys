import type { BackgroundMode, HdrKind, SlotBounds, SlotMedia } from '../types/collage';
import { normalizeQuarterTurn, normalizeTransform } from './frameTransform';
import { effectiveTrimStartMs } from './trim';

/**
 * Construye el filter_complex del collage. Es una función pura (sin React Native ni FFmpeg)
 * para poder probar el comando en un ordenador con el mismo grafo que usa el móvil.
 */

export type GraphItem = {
  media: SlotMedia;
  bounds: SlotBounds;
  /** Solo vídeos: hay una pista de audio que entra en la mezcla. */
  hasAudio: boolean;
};

export type GraphOptions = {
  mode: 'video' | 'still';
  width: number;
  height: number;
  items: GraphItem[];
  background: BackgroundMode;
  /** Segundos de la historia. Solo cuenta en modo vídeo. */
  duration: number;
  /** `tonemap` convierte los clips HDR a SDR; `none` los deja como llegan. */
  hdr: 'tonemap' | 'none';
};

export type GraphResult = {
  inputArgs: string[];
  filterComplex: string;
  videoLabel: string;
  hasAudio: boolean;
  /** Algún clip pasó por la conversión HDR → SDR. */
  hdrConverted: boolean;
};

/** Cuánto se aclara la luz de la escena antes de comprimir las luces altas. Sube para una imagen más luminosa. */
export const HDR_EXPOSURE = 2.2;

const esc = (expression: string) => expression.replace(/,/g, '\\,');

const lut = (expression: string) => {
  const e = esc(expression);
  return `lutrgb=r=${e}:g=${e}:b=${e}`;
};

const X = '(val/maxval)';

/** Señal HDR → luz lineal de la escena, normalizada a 0..1 (16 bits). */
const toLinear = (kind: HdrKind) => {
  if (kind === 'hlg') {
    return `if(lt(${X},0.5),${X}*${X}/3,(exp((${X}-0.55991073)/0.17883277)+0.28466892)/12)*maxval`;
  }
  const p = `pow(${X},0.0126833135)`;
  return `pow(max(${p}-0.8359375,0)/(18.8515625-18.6875*${p}),6.2773946)*13.05*maxval`;
};

/** Hombro suave: lo claro se comprime hacia el blanco sin recortarse de golpe. */
const softKnee = () => {
  const l = `(${X}*${HDR_EXPOSURE})`;
  return `if(lte(${l},0.6),${l},0.6+0.4*(1-exp(-(${l}-0.6)/0.4)))*maxval`;
};

const bt709Oetf = () => `if(lt(${X},0.018),4.5*${X},1.099*pow(${X},0.45)-0.099)*maxval`;

const BT2020_TO_BT709 =
  'colorchannelmixer=rr=1.6605:rg=-0.5876:rb=-0.0728:gr=-0.1246:gg=1.1329:gb=-0.0083:br=-0.0182:bg=-0.1006:bb=1.1187';

/**
 * El binario de FFmpeg que usamos no trae zscale. Se hace a mano: YUV 10 bits → RGB de 16 bits,
 * luz lineal, primarios BT.2020 → BT.709, compresión de luces y curva BT.709, y vuelta a YUV 709.
 */
const hdrToSdrFilters = (kind: HdrKind): string[] => [
  'scale=in_color_matrix=bt2020:in_range=tv:out_range=pc:flags=bicubic',
  'format=gbrp16le',
  lut(toLinear(kind)),
  BT2020_TO_BT709,
  lut(softKnee()),
  lut(bt709Oetf()),
  'scale=out_color_matrix=bt709:out_range=tv:flags=bicubic',
];

const videoRotationFilters = (rotation?: number): string[] => {
  const turns = normalizeQuarterTurn(rotation);
  if (turns === 90) return ['transpose=2'];
  if (turns === 270) return ['transpose=1'];
  if (turns === 180) return ['hflip', 'vflip'];
  return [];
};

const toEven = (value: number) => Math.max(2, Math.ceil(value / 2) * 2);

const quote = (path: string) => `"${path.replace(/"/g, '\\"')}"`;
const toPath = (uri: string) => (uri.startsWith('file://') ? uri.replace('file://', '') : uri);

const audioPad = (inputIndex: number, duration: number, label: string) =>
  `[${inputIndex}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[${label}]`;

export const scaleBounds = (bounds: SlotBounds, factor: number): SlotBounds => ({
  x: Math.round(bounds.x * factor),
  y: Math.round(bounds.y * factor),
  width: Math.round(bounds.width * factor),
  height: Math.round(bounds.height * factor),
});

export function buildCollageGraph(options: GraphOptions): GraphResult {
  const { mode, width, height, items, background, duration, hdr } = options;
  const isStill = mode === 'still';
  const bg = background === 'white' ? 'white' : 'black';

  const inputArgs: string[] = [];
  const chains: string[] = [];
  const overlays: string[] = [];
  const audioInputs: number[] = [];
  let hdrConverted = false;

  chains.push(
    isStill
      ? `color=c=${bg}:s=${width}x${height}:d=1:r=1,format=gbrp[base0]`
      : `color=c=${bg}:s=${width}x${height}:d=${duration}:r=30,format=yuv420p[base0]`
  );

  let index = 0;
  for (const { media, bounds, hasAudio } of items) {
    if (media.kind === 'empty' || !media.uri) continue;

    const path = quote(toPath(media.uri));
    if (media.kind === 'photo') {
      inputArgs.push(isStill ? `-i ${path}` : `-loop 1 -t ${duration} -i ${path}`);
    } else {
      const startMs = effectiveTrimStartMs(media, duration);
      const seek = startMs > 0 ? `-ss ${(startMs / 1000).toFixed(3)} ` : '';
      inputArgs.push(`-noautorotate ${seek}-stream_loop -1 -i ${path}`);
    }

    const label = `slot${index}`;
    const transform = normalizeTransform(media.transform);
    const zoom = transform.scale;
    const canvasWidth = toEven(Math.max(Math.round(bounds.width * zoom), bounds.width));
    const canvasHeight = toEven(Math.max(Math.round(bounds.height * zoom), bounds.height));
    const panX = transform.translateX.toFixed(4);
    const panY = transform.translateY.toFixed(4);
    const cropX = `max(0\\,min((iw-${bounds.width})/2*(1-(${panX}))\\,iw-${bounds.width}))`;
    const cropY = `max(0\\,min((ih-${bounds.height})/2*(1-(${panY}))\\,ih-${bounds.height}))`;
    const rotation = media.kind === 'video' ? videoRotationFilters(media.rotation) : [];

    const chain = [
      `[${index}:v]setpts=PTS-STARTPTS`,
      ...rotation,
      `scale=${canvasWidth}:${canvasHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=bicubic`,
      `pad=max(iw+mod(iw\\,2)\\,${bounds.width}):max(ih+mod(ih\\,2)\\,${bounds.height}):(ow-iw)/2:(oh-ih)/2:color=${bg}`,
      `crop=${bounds.width}:${bounds.height}:${cropX}:${cropY}`,
      'setsar=1',
    ];

    if (media.kind === 'video' && media.hdr && hdr === 'tonemap') {
      chain.push(...hdrToSdrFilters(media.hdr));
      hdrConverted = true;
    } else if (media.kind === 'photo' && !isStill) {
      // Las fotos JPEG vienen en BT.601; el vídeo final va en BT.709.
      chain.push('scale=out_color_matrix=bt709:out_range=tv:flags=bicubic');
    }

    if (isStill) {
      chain.push('format=gbrp');
    } else {
      chain.push(`trim=duration=${duration}`, 'setpts=PTS-STARTPTS', 'format=yuv420p');
    }
    chains.push(`${chain.join(',')}[${label}]`);

    overlays.push(
      `[base${index}][${label}]overlay=${bounds.x}:${bounds.y}${isStill ? ':format=gbrp' : ''}:shortest=1[base${index + 1}]`
    );

    if (!isStill && media.kind === 'video' && !media.muted && hasAudio) audioInputs.push(index);
    index += 1;
  }

  const lastBase = `base${index}`;
  const videoLabel = 'vout';
  const finish = isStill
    ? `[${lastBase}]null[${videoLabel}]`
    : `[${lastBase}]setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[${videoLabel}]`;

  const audioChains: string[] = [];
  if (audioInputs.length === 1) {
    audioChains.push(audioPad(audioInputs[0], duration, 'aout'));
  } else if (audioInputs.length > 1) {
    const pads = audioInputs.map((inputIndex, order) => {
      const padLabel = `am${order}`;
      audioChains.push(audioPad(inputIndex, duration, padLabel));
      return `[${padLabel}]`;
    });
    audioChains.push(`${pads.join('')}amix=inputs=${audioInputs.length}:duration=longest:dropout_transition=0[aout]`);
  }

  return {
    inputArgs,
    filterComplex: [...chains, ...overlays, finish, ...audioChains].join(';'),
    videoLabel,
    hasAudio: audioInputs.length > 0,
    hdrConverted,
  };
}
