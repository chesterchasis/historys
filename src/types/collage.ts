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
  translateX: number;
  translateY: number;
};

export type SlotMedia = {
  kind: MediaType;
  uri?: string;
  previewUri?: string;
  transform?: PhotoTransform;
};

export type SlotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
