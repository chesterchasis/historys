import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ResizeMode, Video } from 'expo-av';
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
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { CollageLayout } from './src/components/CollageLayout';
import {
  BORDER_LABELS,
  DURATION_OPTIONS,
  LAYOUT_LABELS,
  LAYOUT_SPECS,
  MAX_PHOTO_SCALE,
  MAX_TRANSLATE,
  MIN_PHOTO_SCALE,
} from './src/constants/collage';
import styles from './src/styles/appStyles';
import { BorderMode, LayoutType, MediaType, PhotoTransform, SlotMedia, SlotStyle, SlotSpec } from './src/types/collage';
import { exportAsImageFallback, exportVideoWithFfmpeg } from './src/utils/collageExport';
import { clamp } from './src/utils/collageMath';

export default function App() {
  const [layout, setLayout] = useState<LayoutType>('three-horizontal');
  const [borderMode, setBorderMode] = useState<BorderMode>('black');
  const [duration, setDuration] = useState<number>(10);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [previewRemaining, setPreviewRemaining] = useState(0);
  const [previewSession, setPreviewSession] = useState(0);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotStyle, setEditingSlotStyle] = useState<SlotStyle>('vertical');
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
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
  const exportProgressRef = useRef(0);
  const exportCanvasRef = useRef<View | null>(null);

  useEffect(() => {
    draftTransformRef.current = draftTransform;
  }, [draftTransform]);

  useEffect(() => {
    exportProgressRef.current = exportProgress;
  }, [exportProgress]);

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

  const updateExportProgress = (nextValue: number) => {
    const clamped = clamp(nextValue, 0, 1);
    if (Math.abs(clamped - exportProgressRef.current) < 0.01 && clamped !== 1) return;
    setExportProgress(clamped);
  };

  const onExportCollage = async () => {
    if (filledCount === 0) {
      Alert.alert('Exportación no disponible', 'Carga al menos una foto o video para exportar.');
      return;
    }

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

      try {
        setExportStatus('Renderizando video...');
        updateExportProgress(0.08);
        await exportVideoWithFfmpeg({
          activeSlots,
          slots,
          layout,
          hasBlackBorders,
          duration,
          onProgress: (value) => updateExportProgress(value),
        });
        setExportStatus('Guardando video en galería...');
        updateExportProgress(1);
        Alert.alert('Exportación completada', 'Tu collage en video se guardó en la galería.');
      } catch {
        setExportStatus('Video no disponible aquí, exportando imagen...');
        updateExportProgress(0.4);
        await exportAsImageFallback({ exportCanvasRef });
        setExportStatus('Guardando imagen en galería...');
        updateExportProgress(1);
        Alert.alert(
          'Exportación parcial',
          'No se pudo exportar video en este entorno. Se guardó una imagen del collage.'
        );
      }
    } catch {
      Alert.alert('Error de exportación', 'No se pudo exportar el collage. Intenta nuevamente.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStatus('');
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
          {media === 'video' && (
            <Pressable 
              style={[styles.slotButtonGhost, slotMedia.muted && styles.slotButtonGhostMuted]}
              onPress={() => setSlots((prev) => ({
                ...prev,
                [slot.id]: { ...prev[slot.id], muted: !prev[slot.id]?.muted },
              }))}
            >
              <Text style={styles.slotButtonGhostText}>
                {slotMedia.muted ? '🔇 Silenciado' : '🔊 Sonido'}
              </Text>
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
        <Text style={styles.title}>Historys</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estilo del collage</Text>
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setIsLayoutModalOpen(true)}
          >
            <Text style={styles.dropdownButtonText}>{LAYOUT_LABELS[layout]}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>
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
            <CollageLayout
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              slots={activeSlots}
              renderSlot={renderSlot}
            />
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
          style={[
            styles.exportCanvas,
            hasBlackBorders ? styles.exportCanvasBlackBorders : styles.exportCanvasNoBorders,
          ]}
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
        visible={isLayoutModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsLayoutModalOpen(false)}
      >
        <View style={styles.layoutModalOverlay}>
          <View style={styles.layoutModalContent}>
            <Text style={styles.layoutModalTitle}>Elige el estilo</Text>
            {(Object.keys(LAYOUT_LABELS) as LayoutType[]).map((layoutKey) => (
              <Pressable
                key={layoutKey}
                style={[
                  styles.layoutModalOption,
                  layout === layoutKey && styles.layoutModalOptionSelected,
                ]}
                onPress={() => {
                  setLayout(layoutKey);
                  setIsLayoutModalOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.layoutModalOptionText,
                    layout === layoutKey && styles.layoutModalOptionTextSelected,
                  ]}
                >
                  {LAYOUT_LABELS[layoutKey]}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.layoutModalCloseButton}
              onPress={() => setIsLayoutModalOpen(false)}
            >
              <Text style={styles.layoutModalCloseButtonText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
            <CollageLayout
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              slots={activeSlots}
              renderSlot={renderPreviewSlot}
            />
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
