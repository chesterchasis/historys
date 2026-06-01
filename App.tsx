import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import {
  Animated,
  Alert,
  Easing,
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
import {
  exportAsImageFallback,
  exportVideoWithFfmpeg,
  hasVideoSlots,
  isRunningInExpoGo,
} from './src/utils/collageExport';
import { clamp } from './src/utils/collageMath';

const EMPTY_SLOTS: Record<string, SlotMedia> = {
  'slot-1': { kind: 'empty' },
  'slot-2': { kind: 'empty' },
  'slot-3': { kind: 'empty' },
};

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
  const [libraryDialog, setLibraryDialog] = useState<
    { kind: 'closed' } | { kind: 'confirm'; slotId: string } | { kind: 'denied' }
  >({ kind: 'closed' });
  const [resetDialog, setResetDialog] = useState<
    { kind: 'closed' } | { kind: 'empty' } | { kind: 'confirm' }
  >({ kind: 'closed' });
  const [feedbackDialog, setFeedbackDialog] = useState<
    | { kind: 'closed' }
    | { kind: 'notice'; title: string; body: string; confirmLabel: string }
  >({ kind: 'closed' });
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [draftTransform, setDraftTransform] = useState<PhotoTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [slots, setSlots] = useState<Record<string, SlotMedia>>({ ...EMPTY_SLOTS });

  const activeSlots = useMemo(() => LAYOUT_SPECS[layout], [layout]);
  const hasBlackBorders = borderMode === 'black';

  const resetCollage = useCallback(() => {
    setSlots({ ...EMPTY_SLOTS });
    setDuration(10);
    setEditingSlotId(null);
    setIsPreviewOpen(false);
    setLibraryDialog({ kind: 'closed' });
    setResetDialog({ kind: 'closed' });
    setFeedbackDialog({ kind: 'closed' });
  }, []);

  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const draftTransformRef = useRef(draftTransform);
  const exportProgressRef = useRef(0);
  const exportCanvasRef = useRef<View | null>(null);

  useEffect(() => {
    draftTransformRef.current = draftTransform;
  }, [draftTransform]);

  useEffect(() => {
    exportProgressRef.current = exportProgress;
  }, [exportProgress]);

  useEffect(() => {
    Animated.timing(dropdownAnimation, {
      toValue: isLayoutDropdownOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dropdownAnimation, isLayoutDropdownOpen]);

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
  const dropdownHeight = dropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 156],
  });
  const dropdownOpacity = dropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const dropdownTranslateY = dropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });
  const dropdownRotate = dropdownAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

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

    setSlots((prev) => ({
      ...prev,
      [slotId]: {
        kind,
        uri: asset.uri,
        previewUri,
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

      const containsVideo = hasVideoSlots(activeSlots, slots);

      // Expo Go no puede ejecutar FFmpeg ni capturar Video correctamente.
      if (containsVideo && isRunningInExpoGo()) {
        Alert.alert(
          'Exportación de video no disponible en Expo Go',
          'Tu collage contiene video. La exportación a video usa FFmpeg, un módulo nativo que Expo Go no incluye, y la captura de imagen de un Video tampoco funciona aquí.\n\nCrea un development build:\n  • npx expo run:android\n  • o eas build --profile development -p android'
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
        const videoLines = [
          emptySlotCount > 0
            ? 'El video se guardó en la galería (álbum Historys). Los huecos vacíos salieron en negro.'
            : 'El video se guardó en la galería (álbum Historys).',
          '',
          'El lienzo se vació solo: ya puedes cargar material para otro collage.',
        ];
        resetCollage();
        setFeedbackDialog({
          kind: 'notice',
          title: 'Exportación completada',
          body: videoLines.join('\n'),
          confirmLabel: 'Genial',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        console.error('Video export failed', error);

        // Si hay videos en los slots, el fallback de imagen no sirve (saldría negro).
        if (containsVideo) {
          Alert.alert(
            'No se pudo exportar el video',
            errorMessage ||
              'FFmpeg no pudo renderizar el collage. Verifica que estás usando un development build con el módulo nativo compilado.'
          );
          return;
        }

        setExportStatus('Video no disponible aquí, exportando imagen...');
        updateExportProgress(0.4);
        await exportAsImageFallback({ exportCanvasRef });
        setExportStatus('Guardando imagen en galería...');
        updateExportProgress(1);
        const fallbackBase = errorMessage
          ? `No se pudo exportar video. ${errorMessage}. Se guardó una imagen del collage.`
          : 'No se pudo exportar video en este entorno. Se guardó una imagen del collage.';
        const imageLines = [
          emptySlotCount > 0 ? `${fallbackBase} Los huecos vacíos salieron en negro.` : fallbackBase,
          '',
          'El lienzo se vació solo: listo para otro collage.',
        ];
        resetCollage();
        setFeedbackDialog({
          kind: 'notice',
          title: 'Exportación parcial',
          body: imageLines.join('\n'),
          confirmLabel: 'Entendido',
        });
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

    const actionsLayout =
      slot.style === 'vertical' ? styles.slotActionsColumn : styles.slotActionsRow;

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
        <View style={styles.slotPreviewBlock}>
          {media === 'photo' && slotMedia.uri && (
            <Image
              source={{ uri: slotMedia.uri }}
              resizeMode="contain"
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
            <Image source={{ uri: slotMedia.previewUri }} resizeMode="contain" style={styles.slotPreviewImage} />
          )}

          {media === 'video' && (
            <View style={styles.videoBadge}>
              <Text style={styles.videoBadgeText}>VIDEO</Text>
            </View>
          )}
        </View>

        <View style={styles.slotFooter}>
          <View style={styles.slotMetaRow}>
            <Text style={styles.slotTitle} numberOfLines={1}>
              {slot.id.toUpperCase()}
            </Text>
            <Text style={styles.slotType} numberOfLines={1}>
              {typeLabel}
            </Text>
            <Text style={styles.slotHint} numberOfLines={media === 'empty' ? 2 : 1}>
              {media === 'empty' ? 'Sin contenido cargado' : 'Desde librería'}
            </Text>
          </View>

          <View style={[styles.slotActions, actionsLayout]}>
            <Pressable style={styles.slotButton} onPress={() => onPressLoadSlot(slot.id)}>
              <Text style={styles.slotButtonText}>{media === 'empty' ? 'Cargar' : 'Reemplazar'}</Text>
            </Pressable>
            {media === 'photo' && (
              <Pressable style={styles.slotButtonGhost} onPress={() => onOpenPhotoEditor(slot.id)}>
                <Text style={styles.slotButtonGhostText}>Ajustar</Text>
              </Pressable>
            )}
            {media === 'video' && (
              <Pressable style={styles.slotButtonGhost} onPress={() => onOpenPhotoEditor(slot.id)}>
                <Text style={styles.slotButtonGhostText}>Ajustar</Text>
              </Pressable>
            )}
            {media === 'video' && (
              <Pressable
                style={[styles.slotButtonGhost, slotMedia.muted && styles.slotButtonGhostMuted]}
                onPress={() =>
                  setSlots((prev) => ({
                    ...prev,
                    [slot.id]: { ...prev[slot.id], muted: !prev[slot.id]?.muted },
                  }))
                }
              >
                <Text style={styles.slotButtonGhostText}>
                  {slotMedia.muted ? 'Silencio' : 'Audio'}
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
            resizeMode="contain"
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
            shouldPlay
            isLooping
            isMuted={Boolean(slotMedia.muted)}
            resizeMode={ResizeMode.CONTAIN}
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
            resizeMode="contain"
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
          <Image
            source={{ uri: slotMedia.previewUri ?? slotMedia.uri }}
            resizeMode="contain"
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

        {media === 'empty' && <View style={styles.exportEmptyFill} />}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} onScrollBeginDrag={() => setIsLayoutDropdownOpen(false)}>
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
          <Pressable
            style={styles.dropdownButton}
            onPress={() => setIsLayoutDropdownOpen(!isLayoutDropdownOpen)}
          >
            <Text style={styles.dropdownButtonText}>{LAYOUT_LABELS[layout]}</Text>
            <Animated.Text style={[styles.dropdownArrow, { transform: [{ rotate: dropdownRotate }] }]}>▼</Animated.Text>
          </Pressable>
          <Animated.View
            pointerEvents={isLayoutDropdownOpen ? 'auto' : 'none'}
            style={[
              styles.dropdownMenu,
              {
                maxHeight: dropdownHeight,
                opacity: dropdownOpacity,
                transform: [{ translateY: dropdownTranslateY }],
                marginTop: isLayoutDropdownOpen ? 8 : 0,
              },
            ]}
          >
              {(Object.keys(LAYOUT_LABELS) as LayoutType[]).map((layoutKey) => (
                <Pressable
                  key={layoutKey}
                  style={[
                    styles.dropdownMenuItem,
                    layout === layoutKey && styles.dropdownMenuItemSelected,
                  ]}
                  onPress={() => {
                    setLayout(layoutKey);
                    setIsLayoutDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownMenuItemText,
                      layout === layoutKey && styles.dropdownMenuItemTextSelected,
                    ]}
                  >
                    {LAYOUT_LABELS[layoutKey]}
                  </Text>
                </Pressable>
              ))}
          </Animated.View>
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
        onRequestClose={() => setFeedbackDialog({ kind: 'closed' })}
      >
        <View style={styles.libraryModalOuter}>
          <Pressable
            style={styles.libraryModalDim}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => setFeedbackDialog({ kind: 'closed' })}
          />
          {feedbackDialog.kind === 'notice' && (
            <View style={styles.libraryModalCard}>
              <Text style={styles.libraryModalTitle}>{feedbackDialog.title}</Text>
              <Text style={styles.libraryModalMessage}>{feedbackDialog.body}</Text>
              <View style={styles.libraryModalActions}>
                <Pressable
                  style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                  onPress={() => setFeedbackDialog({ kind: 'closed' })}
                >
                  <Text style={styles.slotButtonText}>{feedbackDialog.confirmLabel}</Text>
                </Pressable>
              </View>
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
            <Text style={styles.libraryModalTitle}>Información</Text>
            <ScrollView style={styles.infoModalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.infoModalSectionTitle, styles.infoModalSectionTitleFirst]}>
                Botón R — reset
              </Text>
              <Text style={styles.infoModalParagraph}>
                Vacía los tres slots y deja la duración en 10 s. El estilo del collage (disposición) y los bordes no
                cambian. Si ya hay fotos o videos cargados, pedirá confirmación para no borrar nada por accidente.
              </Text>
              <Text style={styles.infoModalSectionTitle}>Botón i</Text>
              <Text style={styles.infoModalParagraph}>
                Abre este panel de ayuda cuando quieras repasar cómo funciona la app.
              </Text>
              <Text style={styles.infoModalSectionTitle}>Slots multimedia</Text>
              <Text style={styles.infoModalParagraph}>
                No hace falta llenar los tres huecos: los que queden vacíos se ven negros en el preview y en la
                exportación (vídeo o imagen).
              </Text>
              <Text style={styles.infoModalSectionTitle}>Exportar</Text>
              <Text style={styles.infoModalParagraph}>
                El vídeo se exporta en Full HD vertical (1080×1920) con H.264 de alta calidad cuando el móvil lo
                permite; si no, se usa un códec compatible de respaldo. FFmpeg intenta admitir los formatos habituales
                de galería (según el binario de la app). La orientación de algunos clips depende del decodificador del
                binario (este build no incluye el filtro lavfi «autorotate»). Cuando la exportación termina bien, el
                lienzo se vacía solo. La exportación MP4 con FFmpeg no está en Expo Go; si el entorno no puede usar
                FFmpeg, puede guardarse una imagen del collage.
              </Text>
            </ScrollView>
            <Pressable
              style={[styles.slotButton, { alignItems: 'center', marginTop: 10 }]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={styles.slotButtonText}>Cerrar</Text>
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
            {editingSlotId && slots[editingSlotId]?.uri && slots[editingSlotId]?.kind === 'photo' && (
              <Image
                source={{ uri: slots[editingSlotId]?.uri }}
                resizeMode="contain"
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
            {editingSlotId && slots[editingSlotId]?.uri && slots[editingSlotId]?.kind === 'video' && (
              <Video
                source={{ uri: slots[editingSlotId]?.uri as string }}
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
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                isMuted
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
