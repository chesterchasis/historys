import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { captureRef } from 'react-native-view-shot';
import {
  Alert,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type MediaType = 'empty' | 'photo' | 'video';
type LayoutType =
  | 'three-horizontal'
  | 'two-vertical-one-horizontal'
  | 'one-horizontal-two-vertical';
type BorderMode = 'black' | 'none';

type SlotSpec = {
  id: string;
  style: 'horizontal' | 'vertical';
};

type SlotStyle = SlotSpec['style'];

type PhotoTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type SlotMedia = {
  kind: MediaType;
  uri?: string;
  previewUri?: string;
  transform?: PhotoTransform;
};

type SlotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const LAYOUT_LABELS: Record<LayoutType, string> = {
  'three-horizontal': '3 slots horizontales',
  'two-vertical-one-horizontal': '2 verticales + 1 horizontal',
  'one-horizontal-two-vertical': '1 horizontal + 2 verticales',
};

const BORDER_LABELS: Record<BorderMode, string> = {
  black: 'Con bordes negros',
  none: 'Sin bordes',
};

const DURATION_OPTIONS = [5, 10, 15, 30];
const MIN_PHOTO_SCALE = 1;
const MAX_PHOTO_SCALE = 4;
const MAX_TRANSLATE = 220;
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

const LAYOUT_SPECS: Record<LayoutType, SlotSpec[]> = {
  'three-horizontal': [
    { id: 'slot-1', style: 'horizontal' },
    { id: 'slot-2', style: 'horizontal' },
    { id: 'slot-3', style: 'horizontal' },
  ],
  'two-vertical-one-horizontal': [
    { id: 'slot-1', style: 'vertical' },
    { id: 'slot-2', style: 'vertical' },
    { id: 'slot-3', style: 'horizontal' },
  ],
  'one-horizontal-two-vertical': [
    { id: 'slot-1', style: 'horizontal' },
    { id: 'slot-2', style: 'vertical' },
    { id: 'slot-3', style: 'vertical' },
  ],
};

export default function App() {
  const [layout, setLayout] = useState<LayoutType>('three-horizontal');
  const [borderMode, setBorderMode] = useState<BorderMode>('black');
  const [duration, setDuration] = useState<number>(10);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewRemaining, setPreviewRemaining] = useState(0);
  const [previewSession, setPreviewSession] = useState(0);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotStyle, setEditingSlotStyle] = useState<SlotStyle>('vertical');
  const [draftTransform, setDraftTransform] = useState<PhotoTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [slots, setSlots] = useState<Record<string, SlotMedia>>({
    'slot-1': { kind: 'empty' },
    'slot-2': { kind: 'empty' },
    'slot-3': { kind: 'empty' },
  });

  const activeSlots = useMemo(() => LAYOUT_SPECS[layout], [layout]);
  const hasBlackBorders = borderMode === 'black';

  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const draftTransformRef = useRef(draftTransform);
  const exportCanvasRef = useRef<View | null>(null);

  useEffect(() => {
    draftTransformRef.current = draftTransform;
  }, [draftTransform]);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const getSlotTransform = (slotId: string): PhotoTransform => {
    const media = slots[slotId];
    return media?.transform ?? { scale: 1, translateX: 0, translateY: 0 };
  };

  const getTouchesDistance = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (touches.length < 2) return null;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.hypot(dx, dy);
  };

  const photoEditorResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const current = draftTransformRef.current;
        panStartRef.current = {
          x: current.translateX,
          y: current.translateY,
        };

        pinchStartDistanceRef.current = getTouchesDistance(event);
        pinchStartScaleRef.current = current.scale;
      },
      onPanResponderMove: (event, gestureState) => {
        if (gestureState.numberActiveTouches >= 2) {
          const currentDistance = getTouchesDistance(event);
          const startDistance = pinchStartDistanceRef.current;

          if (!currentDistance) return;

          if (!startDistance || startDistance <= 0) {
            pinchStartDistanceRef.current = currentDistance;
            pinchStartScaleRef.current = draftTransformRef.current.scale;
            return;
          }

          const nextScale = clamp(
            (currentDistance / startDistance) * pinchStartScaleRef.current,
            MIN_PHOTO_SCALE,
            MAX_PHOTO_SCALE
          );
          setDraftTransform((prev) => ({ ...prev, scale: nextScale }));
          return;
        }

        setDraftTransform((prev) => ({
          ...prev,
          translateX: clamp(
            panStartRef.current.x + gestureState.dx,
            -MAX_TRANSLATE,
            MAX_TRANSLATE
          ),
          translateY: clamp(
            panStartRef.current.y + gestureState.dy,
            -MAX_TRANSLATE,
            MAX_TRANSLATE
          ),
        }));
      },
      onPanResponderRelease: () => {
        const current = draftTransformRef.current;
        panStartRef.current = { x: current.translateX, y: current.translateY };
        pinchStartDistanceRef.current = null;
      },
      onPanResponderTerminate: () => {
        pinchStartDistanceRef.current = null;
      },
    })
  ).current;

  const filledCount = activeSlots.filter((slot) => slots[slot.id]?.kind !== 'empty').length;

  useEffect(() => {
    if (!isPreviewOpen) return;

    setPreviewRemaining(duration);

    const endTimeout = setTimeout(() => {
      setIsPreviewOpen(false);
    }, duration * 1000);

    const countdownInterval = setInterval(() => {
      setPreviewRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(endTimeout);
      clearInterval(countdownInterval);
    };
  }, [isPreviewOpen, duration, previewSession]);

  const pickMediaForSlot = async (slotId: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tu librería para cargar fotos y videos.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      selectionLimit: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const kind: MediaType = asset.type === 'video' ? 'video' : 'photo';

    let previewUri: string | undefined = asset.uri;
    if (kind === 'video') {
      try {
        const thumbnail = await VideoThumbnails.getThumbnailAsync(asset.uri, {
          time: 700,
        });
        previewUri = thumbnail.uri;
      } catch {
        previewUri = undefined;
      }
    }

    setSlots((prev) => ({
      ...prev,
      [slotId]: {
        kind,
        uri: asset.uri,
        previewUri,
        transform: kind === 'photo' ? { scale: 1, translateX: 0, translateY: 0 } : undefined,
      },
    }));
  };

  const onPressLoadSlot = (slotId: string) => {
    Alert.alert(
      'Acceder a librería',
      '¿Quieres permitir acceso a la librería para cargar foto o video?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            pickMediaForSlot(slotId).catch(() => {
              Alert.alert('Error', 'No se pudo abrir la librería. Intenta nuevamente.');
            });
          },
        },
      ]
    );
  };

  const onClearSlot = (slotId: string) => {
    setSlots((prev) => ({
      ...prev,
      [slotId]: { kind: 'empty' },
    }));
  };

  const onOpenPreview = () => {
    if (filledCount === 0) {
      Alert.alert('Preview no disponible', 'Carga al menos una foto o video para previsualizar.');
      return;
    }

    setPreviewSession((prev) => prev + 1);
    setIsPreviewOpen(true);
  };

  const onOpenPhotoEditor = (slotId: string) => {
    const slotMedia = slots[slotId];
    if (!slotMedia || slotMedia.kind !== 'photo' || !slotMedia.uri) return;

    const slotSpec = activeSlots.find((slot) => slot.id === slotId);
    setEditingSlotStyle(slotSpec?.style ?? 'vertical');
    setEditingSlotId(slotId);
    setDraftTransform(getSlotTransform(slotId));
  };

  const onSavePhotoEditor = () => {
    if (!editingSlotId) return;
    setSlots((prev) => ({
      ...prev,
      [editingSlotId]: {
        ...prev[editingSlotId],
        transform: draftTransform,
      },
    }));
    setEditingSlotId(null);
  };

  const onZoomStep = (delta: number) => {
    setDraftTransform((prev) => ({
      ...prev,
      scale: clamp(prev.scale + delta, MIN_PHOTO_SCALE, MAX_PHOTO_SCALE),
    }));
  };

  const getSlotBoundsMap = (): Record<string, SlotBounds> => {
    const padding = hasBlackBorders ? 24 : 0;
    const gap = hasBlackBorders ? 24 : 0;
    const innerWidth = STORY_WIDTH - padding * 2;
    const innerHeight = STORY_HEIGHT - padding * 2;

    if (layout === 'three-horizontal') {
      const h1 = Math.floor((innerHeight - gap * 2) / 3);
      const h2 = h1;
      const h3 = innerHeight - h1 - h2 - gap * 2;
      return {
        'slot-1': { x: padding, y: padding, width: innerWidth, height: h1 },
        'slot-2': { x: padding, y: padding + h1 + gap, width: innerWidth, height: h2 },
        'slot-3': {
          x: padding,
          y: padding + h1 + gap + h2 + gap,
          width: innerWidth,
          height: h3,
        },
      };
    }

    if (layout === 'two-vertical-one-horizontal') {
      const topHeight = Math.floor((innerHeight - gap) * (2 / 3));
      const bottomHeight = innerHeight - topHeight - gap;
      const leftWidth = Math.floor((innerWidth - gap) / 2);
      const rightWidth = innerWidth - leftWidth - gap;
      return {
        'slot-1': { x: padding, y: padding, width: leftWidth, height: topHeight },
        'slot-2': {
          x: padding + leftWidth + gap,
          y: padding,
          width: rightWidth,
          height: topHeight,
        },
        'slot-3': {
          x: padding,
          y: padding + topHeight + gap,
          width: innerWidth,
          height: bottomHeight,
        },
      };
    }

    const topHeight = Math.floor((innerHeight - gap) / 3);
    const bottomHeight = innerHeight - topHeight - gap;
    const leftWidth = Math.floor((innerWidth - gap) / 2);
    const rightWidth = innerWidth - leftWidth - gap;
    return {
      'slot-1': { x: padding, y: padding, width: innerWidth, height: topHeight },
      'slot-2': {
        x: padding,
        y: padding + topHeight + gap,
        width: leftWidth,
        height: bottomHeight,
      },
      'slot-3': {
        x: padding + leftWidth + gap,
        y: padding + topHeight + gap,
        width: rightWidth,
        height: bottomHeight,
      },
    };
  };

  const quoteForFfmpeg = (uri: string) => `"${uri.replace(/"/g, '\\"')}"`;
  const toFfmpegPath = (uri: string) => (uri.startsWith('file://') ? uri.replace('file://', '') : uri);

  const saveToGallery = async (assetUri: string) => {
    const asset = await MediaLibrary.createAssetAsync(assetUri);
    const albumName = 'Collage Motion';
    const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);

    if (existingAlbum) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], existingAlbum, false);
    } else {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
    }
  };

  const exportAsImageFallback = async () => {
    if (!exportCanvasRef.current) {
      throw new Error('No export canvas');
    }

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

  const exportVideoWithFfmpeg = async () => {
    const ffmpegModule = await import('ffmpeg-kit-react-native');
    const { FFmpegKit, ReturnCode } = ffmpegModule;

    const slotBoundsMap = getSlotBoundsMap();
    const inputArgs: string[] = [];
    const filterChains: string[] = [];
    const overlays: string[] = ['[0:v]setpts=PTS-STARTPTS[base0]'];

    let inputIndex = 1;
    let overlayIndex = 0;

    for (const slot of activeSlots) {
      const media = slots[slot.id] ?? { kind: 'empty' as MediaType };
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
      const zoom = clamp(transform.scale, MIN_PHOTO_SCALE, MAX_PHOTO_SCALE);

      let translateExpressionX = '';
      let translateExpressionY = '';

      if (media.kind === 'photo') {
        const maxOffsetX = Math.round(bounds.width * 0.32);
        const maxOffsetY = Math.round(bounds.height * 0.32);
        const offsetX = Math.round((transform.translateX / MAX_TRANSLATE) * maxOffsetX);
        const offsetY = Math.round((transform.translateY / MAX_TRANSLATE) * maxOffsetY);

        translateExpressionX =
          offsetX === 0 ? '' : offsetX > 0 ? `-${offsetX}` : `+${Math.abs(offsetX)}`;
        translateExpressionY =
          offsetY === 0 ? '' : offsetY > 0 ? `-${offsetY}` : `+${Math.abs(offsetY)}`;
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

      inputIndex += 1;
      overlayIndex += 1;
    }

    const outputUri = new FileSystem.File(
      FileSystem.Paths.cache,
      `collage_${Date.now()}.mp4`
    ).uri;
    const outputPath = quoteForFfmpeg(toFfmpegPath(outputUri));

    const filterComplex = [...filterChains, ...overlays].join(';');
    const command = [
      '-y',
      '-f lavfi',
      `-i color=c=black:s=${STORY_WIDTH}x${STORY_HEIGHT}:r=30:d=${duration}`,
      ...inputArgs,
      `-filter_complex "${filterComplex}"`,
      `-map "[base${overlayIndex}]"`,
      '-r 30',
      '-t',
      `${duration}`,
      '-an',
      '-c:v libx264',
      '-pix_fmt yuv420p',
      outputPath,
    ].join(' ');

    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!ReturnCode.isSuccess(returnCode)) {
      throw new Error('FFmpeg export failed');
    }

    await saveToGallery(outputUri);
  };

  const onExportCollage = async () => {
    if (filledCount === 0) {
      Alert.alert('Exportación no disponible', 'Carga al menos una foto o video para exportar.');
      return;
    }

    try {
      setIsExporting(true);
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso necesario',
          'Necesitamos permiso para guardar el collage en tu galería.'
        );
        return;
      }

      try {
        await exportVideoWithFfmpeg();
        Alert.alert('Exportación completada', 'Tu collage en video se guardó en la galería.');
      } catch {
        await exportAsImageFallback();
        Alert.alert(
          'Exportación parcial',
          'No se pudo exportar video en este entorno. Se guardó una imagen del collage.'
        );
      }
    } catch {
      Alert.alert('Error de exportación', 'No se pudo exportar el collage. Intenta nuevamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderSlot = (slot: SlotSpec) => {
    const slotMedia = slots[slot.id] ?? { kind: 'empty' };
    const media = slotMedia.kind;
    const typeLabel = media === 'empty' ? 'Vacío' : media === 'photo' ? 'Foto' : 'Video';
    const hasPreview = Boolean(slotMedia.previewUri);
    const transform = getSlotTransform(slot.id);

    return (
      <View
        key={slot.id}
        style={[
          styles.slot,
          hasBlackBorders ? styles.slotWithBlackBorders : styles.slotWithoutBorders,
          slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot,
          media !== 'empty' && styles.slotFilled,
        ]}
      >
        {media === 'photo' && slotMedia.uri && (
          <Image
            source={{ uri: slotMedia.uri }}
            style={[
              styles.slotPreviewImage,
              {
                transform: [
                  { scale: transform.scale },
                  { translateX: transform.translateX },
                  { translateY: transform.translateY },
                ],
              },
            ]}
          />
        )}

        {media === 'video' && hasPreview && (
          <Image source={{ uri: slotMedia.previewUri }} style={styles.slotPreviewImage} />
        )}

        {media === 'video' && (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>VIDEO</Text>
          </View>
        )}

        <Text style={styles.slotTitle}>{slot.id.toUpperCase()}</Text>
        <Text style={styles.slotType}>{typeLabel}</Text>
        <Text style={styles.slotHint}>
          {media === 'empty' ? 'Sin contenido cargado' : 'Contenido cargado desde librería'}
        </Text>

        <View style={styles.slotActions}>
          <Pressable style={styles.slotButton} onPress={() => onPressLoadSlot(slot.id)}>
            <Text style={styles.slotButtonText}>{media === 'empty' ? 'Cargar' : 'Reemplazar'}</Text>
          </Pressable>
          {media === 'photo' && (
            <Pressable style={styles.slotButtonGhost} onPress={() => onOpenPhotoEditor(slot.id)}>
              <Text style={styles.slotButtonGhostText}>Ajustar</Text>
            </Pressable>
          )}
          {media !== 'empty' && (
            <Pressable style={styles.slotButtonGhost} onPress={() => onClearSlot(slot.id)}>
              <Text style={styles.slotButtonGhostText}>Quitar</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderPreviewSlot = (slot: SlotSpec) => {
    const slotMedia = slots[slot.id] ?? { kind: 'empty' };
    const media = slotMedia.kind;
    const transform = getSlotTransform(slot.id);

    return (
      <View
        key={`preview-${slot.id}`}
        style={[
          styles.previewSlot,
          hasBlackBorders ? styles.previewSlotWithBlackBorders : styles.previewSlotWithoutBorders,
          slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot,
        ]}
      >
        {media === 'photo' && slotMedia.uri && (
          <Image
            source={{ uri: slotMedia.uri }}
            style={[
              styles.previewMedia,
              {
                transform: [
                  { scale: transform.scale },
                  { translateX: transform.translateX },
                  { translateY: transform.translateY },
                ],
              },
            ]}
          />
        )}

        {media === 'video' && slotMedia.uri && (
          <Video
            key={`video-${slot.id}-${previewSession}`}
            source={{ uri: slotMedia.uri }}
            style={styles.previewMedia}
            shouldPlay
            isLooping
            isMuted
            resizeMode={ResizeMode.COVER}
          />
        )}

        {media === 'empty' && (
          <View style={styles.previewEmptyState}>
            <Text style={styles.previewEmptyText}>Sin contenido</Text>
          </View>
        )}
      </View>
    );
  };

  const renderExportSlot = (slot: SlotSpec) => {
    const slotMedia = slots[slot.id] ?? { kind: 'empty' };
    const media = slotMedia.kind;
    const transform = getSlotTransform(slot.id);

    return (
      <View
        key={`export-${slot.id}`}
        style={[
          styles.exportSlot,
          hasBlackBorders ? styles.exportSlotWithBlackBorders : styles.exportSlotWithoutBorders,
          slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot,
        ]}
      >
        {media === 'photo' && slotMedia.uri && (
          <Image
            source={{ uri: slotMedia.uri }}
            style={[
              styles.exportMedia,
              {
                transform: [
                  { scale: transform.scale },
                  { translateX: transform.translateX },
                  { translateY: transform.translateY },
                ],
              },
            ]}
          />
        )}

        {media === 'video' && (slotMedia.previewUri || slotMedia.uri) && (
          <Image source={{ uri: slotMedia.previewUri ?? slotMedia.uri }} style={styles.exportMedia} />
        )}

        {media === 'empty' && <View style={styles.exportEmptyFill} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Collage Motion</Text>
        <Text style={styles.subtitle}>Boceto inicial para Android en formato móvil</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estilo del collage</Text>
          <View style={styles.chipRow}>
            {(Object.keys(LAYOUT_LABELS) as LayoutType[]).map((layoutKey) => (
              <Pressable
                key={layoutKey}
                style={[styles.chip, layout === layoutKey && styles.chipSelected]}
                onPress={() => setLayout(layoutKey)}
              >
                <Text
                  style={[
                    styles.chipText,
                    layout === layoutKey && styles.chipTextSelected,
                  ]}
                >
                  {LAYOUT_LABELS[layoutKey]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bordes del collage</Text>
          <View style={styles.chipRow}>
            {(Object.keys(BORDER_LABELS) as BorderMode[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.chip, borderMode === mode && styles.chipSelected]}
                onPress={() => setBorderMode(mode)}
              >
                <Text style={[styles.chipText, borderMode === mode && styles.chipTextSelected]}>
                  {BORDER_LABELS[mode]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Slots multimedia</Text>
          <View
            style={[
              styles.previewFrame,
              hasBlackBorders ? styles.previewFrameBlackBorders : styles.previewFrameNoBorders,
            ]}
          >
            {layout === 'three-horizontal' ? (
              <View
                style={[
                  styles.verticalStack,
                  { gap: hasBlackBorders ? 6 : 0 },
                ]}
              >
                {activeSlots.map(renderSlot)}
              </View>
            ) : layout === 'two-vertical-one-horizontal' ? (
              <>
                <View
                  style={[
                    styles.topRow,
                    {
                      gap: hasBlackBorders ? 6 : 0,
                      marginBottom: hasBlackBorders ? 6 : 0,
                    },
                  ]}
                >
                  {activeSlots.slice(0, 2).map(renderSlot)}
                </View>
                <View style={styles.bottomRow}>{renderSlot(activeSlots[2])}</View>
              </>
            ) : (
              <>
                <View style={styles.bottomRow}>{renderSlot(activeSlots[0])}</View>
                <View
                  style={[
                    styles.bottomSplitRow,
                    {
                      gap: hasBlackBorders ? 6 : 0,
                      marginTop: hasBlackBorders ? 6 : 0,
                    },
                  ]}
                >
                  {activeSlots.slice(1, 3).map(renderSlot)}
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duración del collage</Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map((seconds) => (
              <Pressable
                key={seconds}
                style={[styles.chip, duration === seconds && styles.chipSelected]}
                onPress={() => setDuration(seconds)}
              >
                <Text
                  style={[styles.chipText, duration === seconds && styles.chipTextSelected]}
                >
                  {seconds}s
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>Estilo: {LAYOUT_LABELS[layout]}</Text>
          <Text style={styles.summaryText}>Bordes: {BORDER_LABELS[borderMode]}</Text>
          <Text style={styles.summaryText}>Duración: {duration} segundos</Text>
          <Text style={styles.summaryText}>Dimensión Story: 1080 x 1920 (9:16)</Text>
          <Text style={styles.summaryText}>Slots con contenido: {filledCount}/3</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.curveButtonOuter} onPress={onOpenPreview}>
            <View style={styles.curveButtonInner}>
              <Text style={styles.curveButtonText}>Preview</Text>
            </View>
          </Pressable>

          <Pressable style={styles.curveButtonOuterPrimary} onPress={onExportCollage}>
            <View style={styles.curveButtonInnerPrimary}>
              <Text style={styles.curveButtonTextPrimary}>
                {isExporting ? 'Exportando...' : 'Exportar'}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.exportHiddenWrapper} pointerEvents="none">
        <View
          ref={exportCanvasRef}
          collapsable={false}
          style={[
            styles.exportCanvas,
            hasBlackBorders ? styles.exportCanvasBlackBorders : styles.exportCanvasNoBorders,
          ]}
        >
          {layout === 'three-horizontal' ? (
            <View style={[styles.verticalStack, { gap: hasBlackBorders ? 6 : 0 }]}>
              {activeSlots.map(renderExportSlot)}
            </View>
          ) : layout === 'two-vertical-one-horizontal' ? (
            <>
              <View
                style={[
                  styles.topRow,
                  {
                    gap: hasBlackBorders ? 6 : 0,
                    marginBottom: hasBlackBorders ? 6 : 0,
                  },
                ]}
              >
                {activeSlots.slice(0, 2).map(renderExportSlot)}
              </View>
              <View style={styles.bottomRow}>{renderExportSlot(activeSlots[2])}</View>
            </>
          ) : (
            <>
              <View style={styles.bottomRow}>{renderExportSlot(activeSlots[0])}</View>
              <View
                style={[
                  styles.bottomSplitRow,
                  {
                    gap: hasBlackBorders ? 6 : 0,
                    marginTop: hasBlackBorders ? 6 : 0,
                  },
                ]}
              >
                {activeSlots.slice(1, 3).map(renderExportSlot)}
              </View>
            </>
          )}
        </View>
      </View>

      <Modal
        visible={isPreviewOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setIsPreviewOpen(false)}
      >
        <SafeAreaView style={styles.previewSafeArea}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Preview en reproducción</Text>
            <Text style={styles.previewTimer}>{previewRemaining}s</Text>
          </View>

          <View
            style={[
              styles.previewCanvas,
              hasBlackBorders ? styles.previewCanvasBlackBorders : styles.previewCanvasNoBorders,
            ]}
          >
            {layout === 'three-horizontal' ? (
              <View
                style={[
                  styles.verticalStack,
                  { gap: hasBlackBorders ? 6 : 0 },
                ]}
              >
                {activeSlots.map(renderPreviewSlot)}
              </View>
            ) : layout === 'two-vertical-one-horizontal' ? (
              <>
                <View
                  style={[
                    styles.topRow,
                    {
                      gap: hasBlackBorders ? 6 : 0,
                      marginBottom: hasBlackBorders ? 6 : 0,
                    },
                  ]}
                >
                  {activeSlots.slice(0, 2).map(renderPreviewSlot)}
                </View>
                <View style={styles.bottomRow}>{renderPreviewSlot(activeSlots[2])}</View>
              </>
            ) : (
              <>
                <View style={styles.bottomRow}>{renderPreviewSlot(activeSlots[0])}</View>
                <View
                  style={[
                    styles.bottomSplitRow,
                    {
                      gap: hasBlackBorders ? 6 : 0,
                      marginTop: hasBlackBorders ? 6 : 0,
                    },
                  ]}
                >
                  {activeSlots.slice(1, 3).map(renderPreviewSlot)}
                </View>
              </>
            )}
          </View>

          <Pressable style={styles.previewCloseButton} onPress={() => setIsPreviewOpen(false)}>
            <Text style={styles.previewCloseButtonText}>Cerrar preview</Text>
          </Pressable>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(editingSlotId)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setEditingSlotId(null)}
      >
        <SafeAreaView style={styles.editorSafeArea}>
          <Text style={styles.editorTitle}>Ajustar Foto</Text>
          <Text style={styles.editorSubtitle}>Arrastra para mover. Pinza o +/- para zoom.</Text>

          <View
            style={[
              styles.editorCanvas,
              editingSlotStyle === 'horizontal'
                ? styles.editorCanvasHorizontal
                : styles.editorCanvasVertical,
            ]}
            {...photoEditorResponder.panHandlers}
          >
            {editingSlotId && slots[editingSlotId]?.uri && (
              <Image
                source={{ uri: slots[editingSlotId]?.uri }}
                style={[
                  styles.editorImage,
                  {
                    transform: [
                      { scale: draftTransform.scale },
                      { translateX: draftTransform.translateX },
                      { translateY: draftTransform.translateY },
                    ],
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.editorZoomRow}>
            <Pressable style={styles.editorZoomButton} onPress={() => onZoomStep(-0.1)}>
              <Text style={styles.editorZoomButtonText}>-</Text>
            </Pressable>
            <Text style={styles.editorZoomLabel}>Zoom {(draftTransform.scale * 100).toFixed(0)}%</Text>
            <Pressable style={styles.editorZoomButton} onPress={() => onZoomStep(0.1)}>
              <Text style={styles.editorZoomButtonText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.editorActionsRow}>
            <Pressable
              style={styles.editorGhostButton}
              onPress={() =>
                setDraftTransform({
                  scale: 1,
                  translateX: 0,
                  translateY: 0,
                })
              }
            >
              <Text style={styles.editorGhostButtonText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.editorGhostButton} onPress={() => setEditingSlotId(null)}>
              <Text style={styles.editorGhostButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.editorPrimaryButton} onPress={onSavePhotoEditor}>
              <Text style={styles.editorPrimaryButtonText}>Guardar</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f1efeb',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1f2527',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 14,
    color: '#626a6e',
    marginTop: -4,
  },
  section: {
    backgroundColor: '#f9f8f6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dbd7d1',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    color: '#31393d',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#c7c2bc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f2efea',
  },
  chipSelected: {
    backgroundColor: '#2f3638',
    borderColor: '#2f3638',
  },
  chipText: {
    color: '#4f575b',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#f3f2ef',
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 9 / 16,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  previewFrameBlackBorders: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#000000',
    padding: 6,
  },
  previewFrameNoBorders: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: '#ece9e4',
    padding: 0,
  },
  verticalStack: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    flex: 2,
  },
  bottomRow: {
    flex: 1,
  },
  bottomSplitRow: {
    flexDirection: 'row',
    flex: 2,
  },
  slot: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f5f1',
    padding: 12,
    gap: 2,
  },
  slotWithBlackBorders: {
    borderRadius: 12,
    borderWidth: 0,
  },
  slotWithoutBorders: {
    borderRadius: 0,
    borderWidth: 0,
  },
  slotPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    opacity: 0.95,
  },
  videoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(31, 37, 39, 0.78)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#a9b1b4',
  },
  videoBadgeText: {
    color: '#f5f3ef',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  horizontalSlot: {
    flex: 1,
  },
  verticalSlot: {
    flex: 1,
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: '#677073',
    backgroundColor: '#d9dee0',
  },
  slotTitle: {
    fontSize: 12,
    color: '#596165',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  slotType: {
    fontSize: 18,
    color: '#242c2f',
    fontWeight: '700',
  },
  slotHint: {
    fontSize: 11,
    color: '#5e666a',
    textAlign: 'center',
  },
  slotActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  slotButton: {
    backgroundColor: '#2f3638',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  slotButtonText: {
    color: '#f4f2ee',
    fontSize: 12,
    fontWeight: '700',
  },
  slotButtonGhost: {
    backgroundColor: '#e9e5df',
    borderWidth: 1,
    borderColor: '#b5ada3',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  slotButtonGhostText: {
    color: '#41484b',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#e2dfd8',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cdc8c0',
    gap: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#343d40',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  curveButtonOuter: {
    flex: 1,
    borderRadius: 26,
    borderTopLeftRadius: 36,
    borderBottomRightRadius: 36,
    backgroundColor: '#d7d2cb',
    padding: 3,
  },
  curveButtonInner: {
    borderRadius: 22,
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#f1eeea',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b9b2a8',
  },
  curveButtonOuterPrimary: {
    flex: 1,
    borderRadius: 26,
    borderTopLeftRadius: 36,
    borderBottomRightRadius: 36,
    backgroundColor: '#40494c',
    padding: 3,
  },
  curveButtonInnerPrimary: {
    borderRadius: 22,
    borderTopLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#2f3638',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6b7477',
  },
  curveButtonText: {
    color: '#2d3437',
    fontSize: 16,
    fontWeight: '700',
  },
  curveButtonTextPrimary: {
    color: '#f0ede8',
    fontSize: 16,
    fontWeight: '700',
  },
  previewSafeArea: {
    flex: 1,
    backgroundColor: '#14191a',
    paddingHorizontal: 14,
    paddingBottom: 16,
    paddingTop: 10,
    gap: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    color: '#e8e5e0',
    fontSize: 18,
    fontWeight: '700',
  },
  previewTimer: {
    color: '#f2efe9',
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: '#283032',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  previewCanvas: {
    width: '100%',
    aspectRatio: 9 / 16,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  previewCanvasBlackBorders: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4f595b',
    backgroundColor: '#000000',
    padding: 6,
  },
  previewCanvasNoBorders: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: '#21292b',
    padding: 0,
  },
  previewSlot: {
    overflow: 'hidden',
    backgroundColor: '#0e1314',
  },
  previewSlotWithBlackBorders: {
    borderRadius: 12,
    borderWidth: 0,
  },
  previewSlotWithoutBorders: {
    borderRadius: 0,
    borderWidth: 0,
  },
  previewMedia: {
    width: '100%',
    height: '100%',
  },
  previewEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    color: '#b4bdc0',
    fontSize: 13,
    fontWeight: '600',
  },
  previewCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#596466',
    backgroundColor: '#20282a',
    paddingVertical: 12,
    alignItems: 'center',
  },
  previewCloseButtonText: {
    color: '#f1eee8',
    fontSize: 15,
    fontWeight: '700',
  },
  editorSafeArea: {
    flex: 1,
    backgroundColor: '#121719',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
  },
  editorTitle: {
    color: '#ece9e2',
    fontSize: 20,
    fontWeight: '700',
  },
  editorSubtitle: {
    color: '#b8c0c3',
    fontSize: 13,
    marginTop: -6,
  },
  editorCanvas: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#060909',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3f494c',
  },
  editorCanvasVertical: {
    aspectRatio: 9 / 16,
  },
  editorCanvasHorizontal: {
    aspectRatio: 16 / 9,
  },
  editorImage: {
    width: '100%',
    height: '100%',
  },
  editorZoomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  editorZoomButton: {
    backgroundColor: '#2f3638',
    borderRadius: 999,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorZoomButtonText: {
    color: '#efece6',
    fontSize: 24,
    fontWeight: '700',
    marginTop: -2,
  },
  editorZoomLabel: {
    flex: 1,
    color: '#d9d4cc',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  editorActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editorGhostButton: {
    flex: 1,
    backgroundColor: '#2a3133',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#556063',
    paddingVertical: 11,
    alignItems: 'center',
  },
  editorGhostButtonText: {
    color: '#d7d2ca',
    fontSize: 13,
    fontWeight: '700',
  },
  editorPrimaryButton: {
    flex: 1,
    backgroundColor: '#f0ebe3',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d3cdc4',
    paddingVertical: 11,
    alignItems: 'center',
  },
  editorPrimaryButtonText: {
    color: '#21282a',
    fontSize: 13,
    fontWeight: '800',
  },
  exportHiddenWrapper: {
    position: 'absolute',
    top: 0,
    right: -360,
    opacity: 0.01,
  },
  exportCanvas: {
    width: 220,
    aspectRatio: 9 / 16,
    overflow: 'hidden',
  },
  exportCanvasBlackBorders: {
    backgroundColor: '#000000',
    padding: 6,
    borderRadius: 0,
  },
  exportCanvasNoBorders: {
    backgroundColor: '#000000',
    padding: 0,
    borderRadius: 0,
  },
  exportSlot: {
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  exportSlotWithBlackBorders: {
    borderRadius: 0,
  },
  exportSlotWithoutBorders: {
    borderRadius: 0,
  },
  exportMedia: {
    width: '100%',
    height: '100%',
  },
  exportEmptyFill: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
