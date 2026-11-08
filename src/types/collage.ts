export type MediaType = 'empty' | 'photo' | 'video';

export type LayoutType =
  | 'three-horizontal'
  | 'two-vertical-one-horizontal'
  | 'one-horizontal-two-vertical';

export type BorderMode = 'black' | 'none';

export type SlotSpec = {
  id: string;
  style: 'horizontal' | 'vertical';
};

export type SlotStyle = SlotSpec['style'];

export type PhotoTransform = {
  scale: number;
  /** -1..1, fraction of the overflow past the slot. Positive moves the image right or down. */
  translateX: number;
  translateY: number;
};

export type SlotMedia = {
  kind: MediaType;
  uri?: string;
  previewUri?: string;
  transform?: PhotoTransform;
  muted?: boolean;
  /** Display size after rotation. Photos use the oriented pixel size. */
  width?: number;
  height?: number;
  /** Thumbnail pixel size, before a display turn. Photos match width/height. */
  stillWidth?: number;
  stillHeight?: number;
  /** Quarter-turn counterclockwise that FFmpeg must apply. Photos stay unset. */
  rotation?: number;
  /** False when ffprobe found no audio stream. Unset if the probe did not run. */
  hasAudio?: boolean;
};

export type SlotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
