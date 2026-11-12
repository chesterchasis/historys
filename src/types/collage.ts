export type MediaType = 'empty' | 'photo' | 'video';

export type LayoutType =
  | 'three-horizontal'
  | 'two-vertical-one-horizontal'
  | 'one-horizontal-two-vertical';

export type BorderMode = 'black' | 'none';

export type CollageFormat = 'story' | 'feed' | 'square';

export type BackgroundMode = 'black' | 'white';

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
  /** Clip length in milliseconds, as reported by the picker. Videos only. */
  durationMs?: number;
  /** Where the story starts inside a clip longer than the story, in milliseconds. Videos only. */
  trimStartMs?: number;
  /** Transfer curve of an HDR clip. It is converted to SDR on export. Unset for SDR. Videos only. */
  hdr?: HdrKind;
};

export type HdrKind = 'hlg' | 'pq';

export type SlotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
