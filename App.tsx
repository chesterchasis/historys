import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import {
  Alert,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CollageLayout } from './src/components/CollageLayout';
import { FramedMedia } from './src/components/FramedMedia';
import { LayoutThumb } from './src/components/LayoutThumb';
import {
  BORDER_LABELS,
  DURATION_OPTIONS,
  LAYOUT_CHOICES,
  LAYOUT_SPECS,
  MAX_PHOTO_SCALE,
  MIN_PHOTO_SCALE,
  QUALITY_OPTIONS,
  type ExportQuality,
} from './src/constants/collage';
import styles from './src/styles/appStyles';
import { BorderMode, LayoutType, MediaType, PhotoTransform, SlotMedia, SlotSpec } from './src/types/collage';
import {
  exportAsImageFallback,
  exportVideoWithFfmpeg,
  hasVideoSlots,
  isRunningInExpoGo,
  openDeviceGallery,
  probeVideoOrientation,
} from './src/utils/collageExport';
import { clamp, getSlotBoundsMap } from './src/utils/collageMath';
import { normalizeQuarterTurn, normalizeTransform, placedMediaRect } from './src/utils/frameTransform';

const fitFrame = (width: number, height: number, ratio: number) => {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const safeWidth = Math.max(0, width - 1);
  const safeHeight = Math.max(0, height - 1);
  const heightFromWidth = safeWidth / ratio;
  if (heightFromWidth <= safeHeight) return { width: safeWidth, height: heightFromWidth };
  return { width: safeHeight * ratio, height: safeHeight };
};

const EMPTY_SLOTS: Record<string, SlotMedia> = {
  'slot-1': { kind: 'empty' },
  'slot-2': { kind: 'empty' },
  'slot-3': { kind: 'empty' },
};

export default function App() {
  const [layout, setLayout] = useState<LayoutType>('three-horizontal');
  const [borderMode, setBorderMode] = useState<BorderMode>('black');
  const [duration, setDuration] = useState<number>(10);
  const [quality, setQuality] = useState<ExportQuality>('medium');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [previewRemaining, setPreviewRemaining] = useState(0);
  const [previewSession, setPreviewSession] = useState(0);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [libraryDialog, setLibraryDialog] = useState<
    { kind: 'closed' } | { kind: 'confirm'; slotId: string } | { kind: 'denied' }
  >({ kind: 'closed' });
  const [resetDialog, setResetDialog] = useState<
    { kind: 'closed' } | { kind: 'empty' } | { kind: 'confirm' }
  >({ kind: 'closed' });
  const [feedbackDialog, setFeedbackDialog] = useState<
    | { kind: 'closed' }
    | { kind: 'ready'; title: string; body: string }
  >({ kind: 'closed' });
  const [confirmNewCollage, setConfirmNewCollage] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const [editorBox, setEditorBox] = useState({ width: 0, height: 0 });
  const [draftTransform, setDraftTransform] = useState<PhotoTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [slots, setSlots] = useState<Record<string, SlotMedia>>({ ...EMPTY_SLOTS });

  const activeSlots = useMemo(() => LAYOUT_SPECS[layout], [layout]);
  const hasBlackBorders = borderMode === 'black';
  const previewFrame = fitFrame(previewBox.width, previewBox.height, 9 / 16);
  const editingBounds = editingSlotId ? getSlotBoundsMap(layout, hasBlackBorders)[editingSlotId] : undefined;
  const editorRatio =
    editingBounds && editingBounds.height > 0 ? editingBounds.width / editingBounds.height : 9 / 16;
  const editorFrame = fitFrame(editorBox.width, editorBox.height, editorRatio);
  const editorMetricsRef = useRef({ slotWidth: 0, slotHeight: 0, mediaWidth: 0, mediaHeight: 0 });
  const editingMedia = editingSlotId ? slots[editingSlotId] : undefined;
  editorMetricsRef.current = {
    slotWidth: editorFrame.width,
    slotHeight: editorFrame.height,
    mediaWidth: editingMedia?.width ?? 0,
    mediaHeight: editingMedia?.height ?? 0,
  };

  const resetCollage = useCallback(() => {
    setSlots({ ...EMPTY_SLOTS });
    setDuration(10);
    setSelectedSlotId(null);
    setEditingSlotId(null);
    setIsPreviewOpen(false);
    setLibraryDialog({ kind: 'closed' });
    setResetDialog({ kind: 'closed' });
    setFeedbackDialog({ kind: 'closed' });
    setConfirmNewCollage(false);
  }, []);

  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const draftTransformRef = useRef(draftTransform);
  const exportProgressRef = useRef(0);
  const isExportingRef = useRef(false);
  const exportCanvasRef = useRef<View | null>(null);

  useEffect(() => {
    draftTransformRef.current = draftTransform;
  }, [draftTransform]);

  useEffect(() => {
    exportProgressRef.current = exportProgress;
  }, [exportProgress]);

  const getSlotTransform = (slotId: string): PhotoTransform => {
    const media = slots[slotId];
    return normalizeTransform(media?.transform);
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

        const metrics = editorMetricsRef.current;
          const placed = placedMediaRect(
            metrics.slotWidth,
            metrics.slotHeight,
            metrics.mediaWidth,
            metrics.mediaHeight,
            { scale: draftTransformRef.current.scale, translateX: 0, translateY: 0 }
          );
          const overflowX = placed ? Math.max(0, placed.width - metrics.slotWidth) : 0;
          const overflowY = placed ? Math.max(0, placed.height - metrics.slotHeight) : 0;
          setDraftTransform((prev) => ({
            ...prev,
            translateX:
              overflowX > 1
                ? clamp(panStartRef.current.x + (gestureState.dx * 2) / overflowX, -1, 1)
                : panStartRef.current.x,
            translateY:
              overflowY > 1
                ? clamp(panStartRef.current.y + (gestureState.dy * 2) / overflowY, -1, 1)
                : panStartRef.current.y,
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
  const audibleCount = activeSlots.filter((slot) => {
    const media = slots[slot.id];
    return media?.kind === 'video' && Boolean(media.uri) && !media.muted && media.hasAudio !== false;
  }).length;

  const onRequestResetCollage = () => {
    if (filledCount === 0) {
      setResetDialog({ kind: 'empty' });
      return;
    }
    setResetDialog({ kind: 'confirm' });
  };

  const onConfirmResetCollage = () => {
    resetCollage();
  };

  const emptySlotCount = activeSlots.length - filledCount;

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

  const pickMediaForSlot = async (slotId: string): Promise<'picked' | 'denied' | 'canceled'> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return 'denied';
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      selectionLimit: 1,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets?.[0]) return 'canceled';

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

    const readImageSize = (imageUri: string) =>
      new Promise<{ width: number; height: number } | null>((resolve) => {
        Image.getSize(
          imageUri,
          (width, height) => resolve(width > 0 && height > 0 ? { width, height } : null),
          () => resolve(null)
        );
      });

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

    setSlots((prev) => ({
      ...prev,
      [slotId]: {
        kind,
        uri: asset.uri,
        previewUri,
        width,
        height,
        stillWidth,
        stillHeight,
        rotation: kind === 'video' ? rotation : undefined,
        hasAudio: kind === 'video' ? hasAudio : undefined,
        transform: { scale: 1, translateX: 0, translateY: 0 },
        muted: kind === 'video' ? prev[slotId]?.muted ?? false : undefined,
      },
    }));
    return 'picked';
  };

  const onPressLoadSlot = (slotId: string) => {
    setLibraryDialog({ kind: 'confirm', slotId });
  };

  const onConfirmLibraryAccess = () => {
    if (libraryDialog.kind !== 'confirm') return;
    const { slotId } = libraryDialog;
    setLibraryDialog({ kind: 'closed' });
    pickMediaForSlot(slotId)
      .then((outcome) => {
        if (outcome === 'denied') {
          setLibraryDialog({ kind: 'denied' });
        }
      })
      .catch(() => {
        Alert.alert('Error', 'No se pudo abrir la librería. Intenta nuevamente.');
      });
  };

  const onClearSlot = (slotId: string) => {
    setSlots((prev) => ({
      ...prev,
      [slotId]: { kind: 'empty' },
    }));
    setSelectedSlotId(null);
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
    if (!slotMedia || (slotMedia.kind !== 'photo' && slotMedia.kind !== 'video') || !slotMedia.uri) return;

    setEditingSlotId(slotId);
    setDraftTransform(normalizeTransform(getSlotTransform(slotId)));
  };

  const onSavePhotoEditor = () => {
    if (!editingSlotId) return;
    setSlots((prev) => ({
      ...prev,
      [editingSlotId]: {
        ...prev[editingSlotId],
        transform: normalizeTransform(draftTransform),
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

  const updateExportProgress = (nextValue: number) => {
    const clamped = clamp(nextValue, 0, 1);
    if (Math.abs(clamped - exportProgressRef.current) < 0.01 && clamped !== 1) return;
    setExportProgress(clamped);
  };

  const onExportCollage = async () => {
    if (isExportingRef.current) return;
    if (filledCount === 0) {
      Alert.alert('Exportación no disponible', 'Carga al menos una foto o video para exportar.');
      return;
    }

    isExportingRef.current = true;
    try {
      setIsExporting(true);
      setExportStatus('Preparando exportación...');
      updateExportProgress(0.03);
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso necesario',
          'Necesitamos permiso para guardar el collage en tu galería.'
        );
        return;
      }

      const containsVideo = hasVideoSlots(activeSlots, slots);

      // Expo Go no puede ejecutar FFmpeg ni capturar Video correctamente.
      if (containsVideo && isRunningInExpoGo()) {
        Alert.alert(
          'Exportación de vídeo no disponible',
          'Para exportar historias con vídeo necesitas abrir la app desde su versión instalada en el teléfono (no desde Expo Go).'
        );
        return;
      }

      try {
        setExportStatus('Renderizando video...');
        updateExportProgress(0.08);
        const exported = await exportVideoWithFfmpeg({
          activeSlots,
          slots,
          layout,
          hasBlackBorders,
          duration,
          quality,
          onProgress: (value) => updateExportProgress(value),
        });
        setExportStatus('Guardando video en galería...');
        updateExportProgress(1);
        const codecLine = exported.h264
          ? null
          : exported.codec
            ? `Guardado en formato compatible (${exported.codec.toUpperCase()}).`
            : null;
        const videoLines = [
          emptySlotCount > 0
            ? 'Tu historia se guardó en el álbum Historys de la galería. Los huecos vacíos quedaron en negro.'
            : 'Tu historia se guardó en el álbum Historys de la galería.',
          ...(codecLine ? ['', codecLine] : []),
        ];
        setFeedbackDialog({
          kind: 'ready',
          title: 'Listo',
          body: videoLines.join('\n'),
        });
      } catch (error) {
        console.error('Video export failed', error);

        // Si hay videos en los slots, el fallback de imagen no sirve (saldría negro).
        if (containsVideo) {
          Alert.alert(
            'No pudimos exportar tu historia',
            'Ocurrió un inconveniente al procesar uno de los vídeos. Prueba con una calidad más baja o vuelve a cargar el clip.'
          );
          return;
        }

        setExportStatus('Guardando como imagen...');
        updateExportProgress(0.4);
        await exportAsImageFallback({ exportCanvasRef });
        setExportStatus('Guardando imagen en galería...');
        updateExportProgress(1);
        const fallbackBase =
          'El vídeo no estaba disponible en este dispositivo, así que guardamos tu collage como imagen en el álbum Historys.';
        const imageLines = [
          emptySlotCount > 0 ? `${fallbackBase} Los huecos vacíos quedaron en negro.` : fallbackBase,
        ];
        setFeedbackDialog({
          kind: 'ready',
          title: 'Listo',
          body: imageLines.join('\n'),
        });
      }
    } catch {
      Alert.alert(
        'No pudimos guardar el collage',
        'Comprueba que tienes espacio libre en el teléfono e inténtalo de nuevo.'
      );
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
    }
  };

  const renderSlot = (slot: SlotSpec) => {
    const slotMedia = slots[slot.id] ?? { kind: 'empty' };
    const media = slotMedia.kind;
    const hasPreview = Boolean(slotMedia.previewUri);
    const transform = getSlotTransform(slot.id);
    const isSelected = selectedSlotId === slot.id;
    const holeLabel = `Hueco ${slot.id.replace('slot-', '')}`;

    return (
      <Pressable
        key={slot.id}
        disabled={isExporting}
        accessibilityRole="button"
        accessibilityLabel={
          media === 'empty' ? `${holeLabel}, vacío` : media === 'photo' ? `${holeLabel}, foto` : `${holeLabel}, vídeo`
        }
        onPress={() => {
          setSelectedSlotId((current) => (current === slot.id ? null : slot.id));
        }}
        style={[styles.slot, slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot]}
      >
        {media === 'photo' && slotMedia.uri && (
          <FramedMedia
            uri={slotMedia.uri}
            kind="photo"
            displayWidth={slotMedia.width}
            displayHeight={slotMedia.height}
            transform={transform}
          />
        )}

        {media === 'video' && hasPreview && slotMedia.previewUri && (
          <FramedMedia
            uri={slotMedia.previewUri}
            kind="video"
            displayWidth={slotMedia.width}
            displayHeight={slotMedia.height}
            stillWidth={slotMedia.stillWidth}
            stillHeight={slotMedia.stillHeight}
            rotation={slotMedia.rotation}
            transform={transform}
          />
        )}

        {media === 'video' && (
          <View style={styles.videoBadge}>
            <Text style={styles.videoBadgeText}>VIDEO</Text>
          </View>
        )}

        {media === 'video' && normalizeQuarterTurn(slotMedia.rotation) !== 0 && (
          <View style={styles.correctedChip}>
            <Text style={styles.correctedChipText}>Corregido</Text>
          </View>
        )}

        {media === 'empty' && (
          <Text style={styles.slotEmptyLabel} numberOfLines={2}>
            Toca para cargar
          </Text>
        )}

        {isSelected && <View pointerEvents="none" style={styles.slotSelectedRing} />}
      </Pressable>
    );
  };

  const renderPreviewSlot = (slot: SlotSpec) => {
    const slotMedia = slots[slot.id] ?? { kind: 'empty' };
    const media = slotMedia.kind;
    const transform = getSlotTransform(slot.id);

    return (
      <View
        key={`preview-${slot.id}`}
        style={[styles.previewSlot, slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot]}
      >
        {media === 'photo' && slotMedia.uri && (
          <FramedMedia
            uri={slotMedia.uri}
            kind="photo"
            displayWidth={slotMedia.width}
            displayHeight={slotMedia.height}
            transform={transform}
          />
        )}

        {media === 'video' && slotMedia.uri && (
          <FramedMedia
            uri={slotMedia.uri}
            kind="video"
            displayWidth={slotMedia.width}
            displayHeight={slotMedia.height}
            transform={transform}
            playVideo
            muted={Boolean(slotMedia.muted) || slotMedia.hasAudio === false}
            sessionKey={previewSession}
          />
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
        style={[styles.exportSlot, slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot]}
      >
        {media === 'photo' && slotMedia.uri && (
          <FramedMedia
            uri={slotMedia.uri}
            kind="photo"
            displayWidth={slotMedia.width}
            displayHeight={slotMedia.height}
            transform={transform}
          />
        )}

        {media === 'video' && (slotMedia.previewUri || slotMedia.uri) && (
          <FramedMedia
            uri={(slotMedia.previewUri ?? slotMedia.uri) as string}
            kind="video"
            displayWidth={slotMedia.width}
            displayHeight={slotMedia.height}
            stillWidth={slotMedia.stillWidth}
            stillHeight={slotMedia.stillHeight}
            rotation={slotMedia.rotation}
            transform={transform}
          />
        )}

        {media === 'empty' && <View style={styles.exportEmptyFill} />}
      </View>
    );
  };

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleRow}>
          <Image source={require('./assets/icon.png')} style={styles.titleIcon} />
          <View style={styles.titleTextFlex}>
            <Text style={styles.title}>Historys</Text>
          </View>
          <View style={styles.titleToolbar}>
            <Pressable
              style={styles.titleToolButton}
              onPress={() => setInfoModalVisible(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Información"
            >
              <Text style={styles.titleToolButtonInfo}>i</Text>
            </Pressable>
            <Pressable
              style={[styles.titleToolButton, styles.titleToolButtonFilled]}
              onPress={onRequestResetCollage}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Resetear collage"
            >
              <Text style={styles.titleToolButtonReset}>R</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estilo del collage</Text>
          <View style={styles.layoutRow}>
            {LAYOUT_CHOICES.map((choice) => {
              const selected = layout === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  disabled={isExporting}
                  accessibilityRole="button"
                  accessibilityLabel={choice.label}
                  accessibilityState={{ selected }}
                  style={[styles.layoutChoice, selected && styles.layoutChoiceSelected]}
                  onPress={() => setLayout(choice.id)}
                >
                  <LayoutThumb layout={choice.id} hasBlackBorders={hasBlackBorders} selected={selected} />
                  <Text style={[styles.layoutChoiceLabel, selected && styles.chipTextSelected]}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
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
          <View style={styles.previewFrame}>
            <CollageLayout
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              slots={activeSlots}
              renderSlot={renderSlot}
            />
          </View>
          {(() => {
            const selected = activeSlots.find((slot) => slot.id === selectedSlotId);
            if (!selected) {
              return <Text style={styles.slotBarHint}>Toca un hueco para cargarlo o ajustarlo.</Text>;
            }
            const media = slots[selected.id] ?? { kind: 'empty' };
            const kindLabel = media.kind === 'photo' ? 'Foto' : media.kind === 'video' ? 'Vídeo' : 'Vacío';
            const soundLabel = media.kind !== 'video' ? '' : media.muted ? ' · Silencio' : ' · Audio';
            return (
              <View style={styles.slotBar}>
                <Text style={styles.slotBarTitle}>
                  Hueco {selected.id.replace('slot-', '')} · {kindLabel}
                  {soundLabel}
                </Text>
                <View style={styles.slotBarGrid}>
                  <Pressable
                    style={[styles.slotButton, styles.slotBarButton]}
                    disabled={isExporting}
                    onPress={() => onPressLoadSlot(selected.id)}
                  >
                    <Text style={styles.slotButtonText}>Cargar</Text>
                  </Pressable>
                  {media.kind !== 'empty' && (
                    <Pressable
                      style={[styles.slotButtonGhost, styles.slotBarButton]}
                      disabled={isExporting}
                      onPress={() => onOpenPhotoEditor(selected.id)}
                    >
                      <Text style={styles.slotButtonGhostText}>Ajustar</Text>
                    </Pressable>
                  )}
                  {media.kind === 'video' && (
                    <Pressable
                      style={[
                        styles.slotButtonGhost,
                        styles.slotBarButton,
                        media.muted && styles.slotButtonGhostMuted,
                      ]}
                      disabled={isExporting}
                      accessibilityLabel={media.muted ? 'Silencio' : 'Audio'}
                      onPress={() =>
                        setSlots((prev) => ({
                          ...prev,
                          [selected.id]: { ...prev[selected.id], muted: !prev[selected.id]?.muted },
                        }))
                      }
                    >
                      <Text style={styles.slotButtonGhostText}>{media.muted ? 'Silencio' : 'Audio'}</Text>
                    </Pressable>
                  )}
                  {media.kind !== 'empty' && (
                    <Pressable
                      style={[styles.slotButtonGhost, styles.slotBarButton]}
                      disabled={isExporting}
                      onPress={() => onClearSlot(selected.id)}
                    >
                      <Text style={styles.slotButtonGhostText}>Quitar</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })()}
          {audibleCount >= 2 && <Text style={styles.mixHint}>Se mezclarán en una pista</Text>}
        </View>

        <View style={styles.section}>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((seconds) => (
              <Pressable
                key={seconds}
                style={[styles.durationChip, duration === seconds && styles.chipSelected]}
                onPress={() => setDuration(seconds)}
              >
                <Text
                  style={[styles.durationChipText, duration === seconds && styles.chipTextSelected]}
                >
                  {seconds}s
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.durationRow}>
            {QUALITY_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                disabled={isExporting}
                style={[styles.durationChip, quality === option.id && styles.chipSelected]}
                onPress={() => setQuality(option.id)}
              >
                <Text
                  style={[styles.durationChipText, quality === option.id && styles.chipTextSelected]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.curveButtonOuter, isExporting && styles.curveButtonOuterDisabled]}
            onPress={onOpenPreview}
            disabled={isExporting}
          >
            <View style={styles.curveButtonInner}>
              <Text style={styles.curveButtonText}>Preview</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.curveButtonOuterPrimary, isExporting && styles.curveButtonOuterDisabled]}
            onPress={onExportCollage}
            disabled={isExporting}
          >
            <View style={styles.curveButtonInnerPrimary}>
              <Text style={styles.curveButtonTextPrimary}>
                {isExporting ? 'Exportando...' : 'Exportar'}
              </Text>
            </View>
          </Pressable>
        </View>

        {isExporting && (
          <View style={styles.exportProgressCard}>
            <View style={styles.exportProgressHeader}>
              <Text style={styles.exportProgressLabel}>{exportStatus || 'Exportando...'}</Text>
              <Text style={styles.exportProgressPercent}>{Math.round(exportProgress * 100)}%</Text>
            </View>
            <View style={styles.exportProgressTrack}>
              <View
                style={[
                  styles.exportProgressFill,
                  { width: `${Math.max(4, Math.round(exportProgress * 100))}%` },
                ]}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.exportHiddenWrapper} pointerEvents="none">
        <View
          ref={exportCanvasRef}
          collapsable={false}
          style={styles.exportCanvas}
        >
          <CollageLayout
            layout={layout}
            hasBlackBorders={hasBlackBorders}
            slots={activeSlots}
            renderSlot={renderExportSlot}
          />
        </View>
      </View>

      <Modal
        visible={libraryDialog.kind !== 'closed'}
        animationType="fade"
        transparent
        onRequestClose={() => setLibraryDialog({ kind: 'closed' })}
      >
        <View style={styles.libraryModalOuter}>
          <Pressable
            style={styles.libraryModalDim}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => setLibraryDialog({ kind: 'closed' })}
          />
          <View style={styles.libraryModalCard}>
            {libraryDialog.kind === 'confirm' && (
              <>
                <Text style={styles.libraryModalTitle}>Acceder a librería</Text>
                <Text style={styles.libraryModalMessage}>
                  ¿Quieres permitir acceso a la librería para cargar foto o video?
                </Text>
                <View style={styles.libraryModalActions}>
                  <Pressable
                    style={[styles.slotButtonGhost, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setLibraryDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonGhostText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                    onPress={onConfirmLibraryAccess}
                  >
                    <Text style={styles.slotButtonText}>Continuar</Text>
                  </Pressable>
                </View>
              </>
            )}
            {libraryDialog.kind === 'denied' && (
              <>
                <Text style={styles.libraryModalTitle}>Permiso necesario</Text>
                <Text style={styles.libraryModalMessage}>
                  Necesitamos acceso a tu librería para cargar fotos y videos. Puedes activarlo en
                  los ajustes del sistema.
                </Text>
                <View style={styles.libraryModalActions}>
                  <Pressable
                    style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setLibraryDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonText}>Entendido</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={resetDialog.kind !== 'closed'}
        animationType="fade"
        transparent
        onRequestClose={() => setResetDialog({ kind: 'closed' })}
      >
        <View style={styles.libraryModalOuter}>
          <Pressable
            style={styles.libraryModalDim}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => setResetDialog({ kind: 'closed' })}
          />
          <View style={styles.libraryModalCard}>
            {resetDialog.kind === 'empty' && (
              <>
                <Text style={styles.libraryModalTitle}>Collage vacío</Text>
                <Text style={styles.libraryModalMessage}>Todos los slots ya están vacíos.</Text>
                <View style={styles.libraryModalActions}>
                  <Pressable
                    style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setResetDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonText}>Entendido</Text>
                  </Pressable>
                </View>
              </>
            )}
            {resetDialog.kind === 'confirm' && (
              <>
                <Text style={styles.libraryModalTitle}>Vaciar collage</Text>
                <Text style={styles.libraryModalMessage}>
                  Se quitarán las fotos y videos de todos los slots y la duración volverá a 10 s. El estilo del collage
                  y los bordes no cambian.
                </Text>
                <View style={styles.libraryModalActions}>
                  <Pressable
                    style={[styles.slotButtonGhost, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setResetDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonGhostText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                    onPress={onConfirmResetCollage}
                  >
                    <Text style={styles.slotButtonText}>Vaciar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={feedbackDialog.kind !== 'closed'}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setConfirmNewCollage(false);
          setFeedbackDialog({ kind: 'closed' });
        }}
      >
        <View style={styles.libraryModalOuter}>
          <Pressable
            style={styles.libraryModalDim}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => {
              setConfirmNewCollage(false);
              setFeedbackDialog({ kind: 'closed' });
            }}
          />
          {feedbackDialog.kind === 'ready' && (
            <View style={styles.libraryModalCard}>
              <View style={styles.successThumb}>
                <CollageLayout
                  layout={layout}
                  hasBlackBorders={hasBlackBorders}
                  slots={activeSlots}
                  renderSlot={renderExportSlot}
                />
              </View>
              <Text style={styles.libraryModalTitle}>
                {confirmNewCollage ? 'Nuevo collage' : feedbackDialog.title}
              </Text>
              <Text style={styles.libraryModalMessage}>
                {confirmNewCollage
                  ? 'Se quitarán las fotos y los vídeos. La forma y los bordes se quedan.'
                  : feedbackDialog.body}
              </Text>
              {confirmNewCollage ? (
                <View style={styles.libraryModalActions}>
                  <Pressable
                    style={[styles.slotButtonGhost, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setConfirmNewCollage(false)}
                  >
                    <Text style={styles.slotButtonGhostText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                    onPress={onConfirmResetCollage}
                  >
                    <Text style={styles.slotButtonText}>Borrar</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.successActions}>
                  <Pressable
                    style={[styles.slotButton, { alignItems: 'center' }]}
                    onPress={async () => {
                      const opened = await openDeviceGallery();
                      if (!opened) {
                        Alert.alert(
                          'Galería',
                          'No se pudo abrir la galería. El archivo está en el álbum Historys.'
                        );
                      }
                    }}
                  >
                    <Text style={styles.slotButtonText}>Ver galería</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.slotButtonGhost, { alignItems: 'center' }]}
                    onPress={() => setConfirmNewCollage(true)}
                  >
                    <Text style={styles.slotButtonGhostText}>Nuevo collage</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.slotButtonGhost, { alignItems: 'center' }]}
                    onPress={() => setFeedbackDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonGhostText}>Seguir editando</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={infoModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.libraryModalOuter}>
          <Pressable
            style={styles.libraryModalDim}
            accessibilityLabel="Cerrar"
            onPress={() => setInfoModalVisible(false)}
          />
          <View style={[styles.libraryModalCard, styles.infoModalCard]}>
            <View style={styles.infoModalHeader}>
              <View>
                <Text style={styles.libraryModalTitle}>Cómo usar Historys</Text>
                <Text style={styles.infoModalSubtitle}>Collages 9:16 en tres pasos</Text>
              </View>
              <View style={styles.infoVersionPill}>
                <Text style={styles.infoVersionText}>v1.0.9</Text>
              </View>
            </View>

            <ScrollView
              style={styles.infoModalScroll}
              contentContainerStyle={styles.infoModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.infoStepCard}>
                <View style={styles.infoStepBadge}>
                  <Text style={styles.infoStepBadgeText}>1</Text>
                </View>
                <View style={styles.infoStepBody}>
                  <Text style={styles.infoStepTitle}>Elige el diseño y los bordes</Text>
                  <Text style={styles.infoStepText}>
                    Cambia entre <Text style={styles.infoInlineStrong}>3 bandas</Text>,{' '}
                    <Text style={styles.infoInlineStrong}>2+1</Text> o{' '}
                    <Text style={styles.infoInlineStrong}>1+2</Text> sin perder lo que ya habías cargado. Usa{' '}
                    <Text style={styles.infoInlineStrong}>Con bordes</Text> o{' '}
                    <Text style={styles.infoInlineStrong}>Sin bordes</Text> para ajustar el margen negro.
                  </Text>
                </View>
              </View>

              <View style={styles.infoStepCard}>
                <View style={styles.infoStepBadge}>
                  <Text style={styles.infoStepBadgeText}>2</Text>
                </View>
                <View style={styles.infoStepBody}>
                  <Text style={styles.infoStepTitle}>Toca un hueco para editarlo</Text>
                  <Text style={styles.infoStepText}>
                    Al tocar un hueco aparecen debajo sus controles:
                  </Text>
                  <View style={styles.infoTagList}>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Cargar:</Text> elige una foto o un vídeo de tu galería.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Ajustar:</Text> mueve y haz zoom sobre la proporción exacta de ese hueco.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Audio / Silencio:</Text> activa o calla cada vídeo. Si hay dos o más con sonido, se mezclan en una sola pista.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Quitar:</Text> deja ese hueco en negro (no hace falta llenar los tres).
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoStepCard}>
                <View style={styles.infoStepBadge}>
                  <Text style={styles.infoStepBadgeText}>3</Text>
                </View>
                <View style={styles.infoStepBody}>
                  <Text style={styles.infoStepTitle}>Previsualiza y exporta en Full HD</Text>
                  <Text style={styles.infoStepText}>
                    Elige la duración (<Text style={styles.infoInlineStrong}>5s a 30s</Text>) y el peso del archivo (
                    <Text style={styles.infoInlineStrong}>Baja, Media o Alta</Text>). El vídeo se guarda en{' '}
                    <Text style={styles.infoInlineStrong}>1080×1920 (H.264)</Text> dentro del álbum{' '}
                    <Text style={styles.infoInlineStrong}>Historys</Text> y tu collage sigue en pantalla por si quieres hacer otro cambio.
                  </Text>
                </View>
              </View>

              <View style={styles.infoQuickCard}>
                <Text style={styles.infoQuickTitle}>Atajos y etiquetas</Text>
                <View style={styles.infoQuickRow}>
                  <View style={styles.infoKeyPill}>
                    <Text style={styles.infoKeyPillText}>R</Text>
                  </View>
                  <Text style={styles.infoQuickText}>
                    Vacía los 3 huecos y vuelve a 10s (pide confirmación).
                  </Text>
                </View>
                <View style={styles.infoQuickRow}>
                  <View style={[styles.infoKeyPill, styles.infoKeyPillSoft]}>
                    <Text style={styles.infoKeyPillTextDark}>Corregido</Text>
                  </View>
                  <Text style={styles.infoQuickText}>
                    Indica que un vídeo vertical de cámara se enderezó automáticamente.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <Pressable
              style={[styles.slotButton, { alignItems: 'center', marginTop: 6 }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.slotButtonText}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPreviewOpen}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setIsPreviewOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SafeAreaView style={styles.previewSafeArea}>
            <StatusBar style="light" />
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Preview en reproducción</Text>
              <Text style={styles.previewTimer}>{previewRemaining}s</Text>
            </View>

            <View
              style={styles.previewStage}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setPreviewBox((prev) =>
                  prev.width === width && prev.height === height ? prev : { width, height }
                );
              }}
            >
              <View
                style={[styles.previewCanvas, previewFrame]}
              >
                <CollageLayout
                  layout={layout}
                  hasBlackBorders={hasBlackBorders}
                  slots={activeSlots}
                  renderSlot={renderPreviewSlot}
                />
              </View>
            </View>

            <Pressable style={styles.previewCloseButton} onPress={() => setIsPreviewOpen(false)}>
              <Text style={styles.previewCloseButtonText}>Cerrar preview</Text>
            </Pressable>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      <Modal
        visible={Boolean(editingSlotId)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setEditingSlotId(null)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={styles.editorSafeArea}>
          <StatusBar style="light" />
          <Text style={styles.editorTitle}>
            {editingMedia?.kind === 'video' ? 'Ajustar vídeo' : 'Ajustar foto'}
          </Text>
          <Text style={styles.editorSubtitle}>Arrastra para mover. Pinza o +/- para zoom.</Text>

          <View
            style={styles.editorCanvasSlot}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setEditorBox((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height }
              );
            }}
          >
          <View
            style={[styles.editorCanvas, editorFrame]}
            {...photoEditorResponder.panHandlers}
          >
            {editingSlotId && editingMedia?.uri && editingMedia.kind === 'photo' && (
              <FramedMedia
                uri={editingMedia.uri}
                kind="photo"
                displayWidth={editingMedia.width}
                displayHeight={editingMedia.height}
                transform={draftTransform}
                slotWidth={editorFrame.width}
                slotHeight={editorFrame.height}
              />
            )}
            {editingSlotId && editingMedia?.uri && editingMedia.kind === 'video' && (
              <FramedMedia
                uri={editingMedia.uri}
                kind="video"
                displayWidth={editingMedia.width}
                displayHeight={editingMedia.height}
                transform={draftTransform}
                playVideo
                muted
                slotWidth={editorFrame.width}
                slotHeight={editorFrame.height}
              />
            )}
          </View>
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
              onPress={() => setDraftTransform(normalizeTransform(null))}
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
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}
