import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import {
  Alert,
  GestureResponderEvent,
  Linking,
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
import { Coachmark } from './src/components/Coachmark';
import { ExportSheet } from './src/components/ExportSheet';
import { FramedMedia } from './src/components/FramedMedia';
import { DesignPanel, DurationPanel } from './src/components/SettingsPanels';
import { SlotGestureLayer } from './src/components/SlotGestureLayer';
import { type DockItem, type IconName, ToolDock } from './src/components/ToolDock';
import { TopBar } from './src/components/TopBar';
import { ZoomSlider } from './src/components/ZoomSlider';
import {
  DURATION_OPTIONS,
  LAYOUT_CHOICES,
  LAYOUT_SPECS,
  MAX_PHOTO_SCALE,
  MIN_PHOTO_SCALE,
  type ExportQuality,
} from './src/constants/collage';
import styles from './src/styles/appStyles';
import { BorderMode, LayoutType, PhotoTransform, SlotMedia, SlotSpec } from './src/types/collage';
import {
  ExportCancelledError,
  exportAsImageFallback,
  exportVideoWithFfmpeg,
  hasVideoSlots,
  isRunningInExpoGo,
  openDeviceGallery,
  requestCancelExport,
} from './src/utils/collageExport';
import { clamp, fitFrame, getSlotBoundsMap } from './src/utils/collageMath';
import { normalizeQuarterTurn, normalizeTransform, placedMediaRect } from './src/utils/frameTransform';
import { type HintStep, loadOnboarding, type OnboardingSeen, saveOnboarding } from './src/utils/onboarding';
import { buildSlotMedia, formatClipDuration } from './src/utils/slotMedia';

/** Altura aproximada de la barra, Exportar y márgenes: la burbuja queda justo encima de la barra. */
const HINT_BOTTOM = 152;

const EMPTY_SLOTS: Record<string, SlotMedia> = {
  'slot-1': { kind: 'empty' },
  'slot-2': { kind: 'empty' },
  'slot-3': { kind: 'empty' },
};

export default function App() {
  useFonts(Ionicons.font);
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
  const [permissionDeniedVisible, setPermissionDeniedVisible] = useState(false);
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
  const [notice, setNotice] = useState<string | null>(null);
  const [isDraggingSlot, setIsDraggingSlot] = useState(false);
  const [isEditorGesture, setIsEditorGesture] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingSeen | null>(null);
  const onboardingRef = useRef<OnboardingSeen | null>(null);
  const [openPanel, setOpenPanel] = useState<'design' | 'duration' | null>(null);
  const [canvasBox, setCanvasBox] = useState({ width: 0, height: 0 });
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
  const canvasFrame = fitFrame(canvasBox.width, canvasBox.height, 9 / 16);
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
    setOpenPanel(null);
    setEditingSlotId(null);
    setIsPreviewOpen(false);
    setPermissionDeniedVisible(false);
    setExportSheetOpen(false);
    setResetDialog({ kind: 'closed' });
    setFeedbackDialog({ kind: 'closed' });
    setConfirmNewCollage(false);
  }, []);

  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const editorTouchStartRef = useRef(0);
  const editorLastTapRef = useRef(0);
  const draftTransformRef = useRef(draftTransform);
  const exportProgressRef = useRef(0);
  const isExportingRef = useRef(false);
  const isPickingRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    []
  );
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
        editorTouchStartRef.current = Date.now();
        setIsEditorGesture(true);
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
      onPanResponderRelease: (_event, gestureState) => {
        const current = draftTransformRef.current;
        panStartRef.current = { x: current.translateX, y: current.translateY };
        pinchStartDistanceRef.current = null;
        setIsEditorGesture(false);

        const now = Date.now();
        const isTap =
          Math.hypot(gestureState.dx, gestureState.dy) < 8 && now - editorTouchStartRef.current < 250;
        if (!isTap) return;
        if (now - editorLastTapRef.current < 300) {
          editorLastTapRef.current = 0;
          setDraftTransform((prev) => ({ ...prev, scale: prev.scale > 1.05 ? MIN_PHOTO_SCALE : 2 }));
          return;
        }
        editorLastTapRef.current = now;
      },
      onPanResponderTerminate: () => {
        pinchStartDistanceRef.current = null;
        setIsEditorGesture(false);
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

  const markHintSeen = (step: HintStep) => {
    const current = onboardingRef.current;
    if (!current || current[step]) return;
    const next = { ...current, [step]: true };
    onboardingRef.current = next;
    setOnboarding(next);
    saveOnboarding(next);
  };

  useEffect(() => {
    let active = true;
    loadOnboarding().then((seen) => {
      if (!active) return;
      onboardingRef.current = seen;
      setOnboarding(seen);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!onboarding) return;
    if (!onboarding.add && filledCount > 0) markHintSeen('add');
    else if (onboarding.add && !onboarding.adjust && selectedSlotId) markHintSeen('adjust');
    else if (onboarding.adjust && !onboarding.export && exportSheetOpen) markHintSeen('export');
  }, [onboarding, filledCount, selectedSlotId, exportSheetOpen]);

  const hintBusy = Boolean(openPanel) || Boolean(selectedSlotId) || exportSheetOpen || isExporting || isDraggingSlot;
  let activeHint: HintStep | null = null;
  if (onboarding && !hintBusy) {
    if (!onboarding.add) activeHint = filledCount === 0 ? 'add' : null;
    else if (!onboarding.adjust) activeHint = filledCount > 0 ? 'adjust' : null;
    else if (!onboarding.export) activeHint = filledCount > 0 ? 'export' : null;
  }

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

  const showNotice = (message: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3500);
  };

  const pickMediaForSlots = async (slotIds: string[]): Promise<'picked' | 'denied' | 'canceled'> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return 'denied';
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 1,
      selectionLimit: slotIds.length,
      allowsMultipleSelection: slotIds.length > 1,
      orderedSelection: true,
    });

    if (result.canceled || !result.assets?.length) return 'canceled';

    const chosen = result.assets.slice(0, slotIds.length);
    const built: SlotMedia[] = [];
    for (const asset of chosen) {
      built.push(await buildSlotMedia(asset));
    }

    setSlots((prev) => {
      const next = { ...prev };
      built.forEach((media, index) => {
        const slotId = slotIds[index];
        next[slotId] = {
          ...media,
          muted: media.kind === 'video' ? prev[slotId]?.muted ?? false : undefined,
        };
      });
      return next;
    });
    if (built.some((media) => media.kind === 'video' && normalizeQuarterTurn(media.rotation) !== 0)) {
      showNotice('Vídeo vertical enderezado automáticamente');
    }
    return 'picked';
  };

  const loadIntoSlots = (slotIds: string[]) => {
    if (slotIds.length === 0 || isPickingRef.current) return;
    isPickingRef.current = true;
    pickMediaForSlots(slotIds)
      .then((outcome) => {
        if (outcome === 'denied') {
          setPermissionDeniedVisible(true);
        }
      })
      .catch(() => {
        Alert.alert('Error', 'No se pudo abrir la librería. Intenta nuevamente.');
      })
      .finally(() => {
        isPickingRef.current = false;
      });
  };

  const onPressLoadSlot = (slotId: string) => {
    loadIntoSlots([slotId]);
  };

  const onPressAdd = () => {
    setOpenPanel(null);
    setSelectedSlotId(null);
    loadIntoSlots(activeSlots.filter((slot) => slots[slot.id]?.kind === 'empty' || !slots[slot.id]).map((slot) => slot.id));
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
    setOpenPanel(null);
    setSelectedSlotId(null);
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

  const updateExportProgress = (nextValue: number) => {
    const clamped = clamp(nextValue, 0, 1);
    if (Math.abs(clamped - exportProgressRef.current) < 0.01 && clamped !== 1) return;
    setExportProgress(clamped);
  };

  const onOpenExportSheet = () => {
    if (isExportingRef.current) return;
    if (filledCount === 0) {
      Alert.alert('Exportación no disponible', 'Carga al menos una foto o video para exportar.');
      return;
    }
    setOpenPanel(null);
    setSelectedSlotId(null);
    setExportSheetOpen(true);
  };

  const onCancelExport = () => {
    setExportStatus('Cancelando...');
    requestCancelExport();
  };

  const onExportCollage = async () => {
    if (isExportingRef.current) return;
    if (filledCount === 0) {
      Alert.alert('Exportación no disponible', 'Carga al menos una foto o video para exportar.');
      return;
    }

    isExportingRef.current = true;
    try {
      setOpenPanel(null);
      setSelectedSlotId(null);
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
        setExportSheetOpen(false);
        setFeedbackDialog({
          kind: 'ready',
          title: 'Listo',
          body: videoLines.join('\n'),
        });
      } catch (error) {
        if (error instanceof ExportCancelledError) return;
        console.error('Video export failed', error);

        // Si hay videos en los slots, el fallback de imagen no sirve (saldría negro).
        if (containsVideo) {
          Alert.alert(
            'No pudimos exportar tu historia',
            'Ocurrió un inconveniente al procesar uno de los vídeos. Prueba con la calidad Ligera o vuelve a cargar el clip.'
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
        setExportSheetOpen(false);
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

  const selectedSlot = activeSlots.find((slot) => slot.id === selectedSlotId);
  const selectedMedia: SlotMedia | undefined = selectedSlot ? slots[selectedSlot.id] ?? { kind: 'empty' } : undefined;

  const togglePanel = (panel: 'design' | 'duration') => {
    setSelectedSlotId(null);
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const onToggleSlotMute = (slotId: string) => {
    setSlots((prev) => ({
      ...prev,
      [slotId]: { ...prev[slotId], muted: !prev[slotId]?.muted },
    }));
  };

  let captionText = filledCount === 0
    ? 'Toca un hueco para cargar una foto o un vídeo.'
    : 'Toca un hueco para cambiarlo o ajustarlo.';
  if (selectedSlot && selectedMedia) {
    const kindLabel = selectedMedia.kind === 'photo' ? 'Foto' : selectedMedia.kind === 'video' ? 'Vídeo' : 'Vacío';
    const soundLabel =
      selectedMedia.kind !== 'video'
        ? ''
        : selectedMedia.hasAudio === false
          ? ' · Sin sonido'
          : selectedMedia.muted
            ? ' · Silenciado'
            : ' · Con sonido';
    captionText = `Hueco ${selectedSlot.id.replace('slot-', '')} · ${kindLabel}${soundLabel}`;
  }
  if (notice) captionText = notice;
  if (isDraggingSlot) captionText = 'Suelta sobre otro hueco para intercambiarlos';

  const globalDockItems: DockItem[] = [
    {
      key: 'design',
      label: 'Diseño',
      icon: 'grid-outline',
      value: LAYOUT_CHOICES.find((choice) => choice.id === layout)?.label,
      onPress: () => togglePanel('design'),
    },
    {
      key: 'duration',
      label: 'Duración',
      icon: 'time-outline',
      value: `${duration} s`,
      onPress: () => togglePanel('duration'),
    },
    {
      key: 'add',
      label: 'Añadir',
      icon: 'add-circle-outline',
      value: emptySlotCount > 0 ? `${emptySlotCount} ${emptySlotCount === 1 ? 'libre' : 'libres'}` : 'Completo',
      disabled: emptySlotCount === 0,
      onPress: onPressAdd,
    },
    { key: 'preview', label: 'Vista previa', icon: 'play-circle-outline', onPress: onOpenPreview },
  ];

  const slotDockItems: DockItem[] = selectedSlot && selectedMedia
    ? [
        {
          key: 'load',
          label: 'Cambiar',
          icon: 'images-outline',
          onPress: () => onPressLoadSlot(selectedSlot.id),
        },
        {
          key: 'adjust',
          label: 'Ajustar',
          icon: 'crop-outline',
          onPress: () => onOpenPhotoEditor(selectedSlot.id),
        },
        ...(selectedMedia.kind === 'video'
          ? [
              {
                key: 'sound',
                label: 'Sonido',
                icon: (selectedMedia.muted ? 'volume-mute-outline' : 'volume-high-outline') as IconName,
                active: Boolean(selectedMedia.muted),
                onPress: () => onToggleSlotMute(selectedSlot.id),
              },
            ]
          : []),
        {
          key: 'clear',
          label: 'Quitar',
          icon: 'trash-outline',
          onPress: () => onClearSlot(selectedSlot.id),
        },
        {
          key: 'done',
          label: 'Listo',
          icon: 'checkmark',
          emphasis: true,
          onPress: () => setSelectedSlotId(null),
        },
      ]
    : [];

  const dockItems = selectedSlot ? slotDockItems : globalDockItems;

  const onSlotPress = (slotId: string) => {
    setOpenPanel(null);
    if ((slots[slotId]?.kind ?? 'empty') === 'empty') {
      setSelectedSlotId(null);
      onPressLoadSlot(slotId);
      return;
    }
    setSelectedSlotId((current) => (current === slotId ? null : slotId));
  };

  const onSlotDoubleTap = (slotId: string) => {
    setOpenPanel(null);
    setSelectedSlotId(slotId);
    onOpenPhotoEditor(slotId);
  };

  const onSwapSlots = (fromId: string, toId: string) => {
    setSlots((prev) => ({
      ...prev,
      [fromId]: prev[toId] ?? { kind: 'empty' },
      [toId]: prev[fromId] ?? { kind: 'empty' },
    }));
    setSelectedSlotId(null);
    setOpenPanel(null);
  };

  const onTapOutsideSlots = () => {
    setSelectedSlotId(null);
    setOpenPanel(null);
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
        onPress={() => onSlotPress(slot.id)}
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
            {(slotMedia.muted || slotMedia.hasAudio === false) && (
              <Ionicons name="volume-mute" size={12} color="#f5f3ef" />
            )}
            <Ionicons name="play" size={10} color="#f5f3ef" />
            {slotMedia.durationMs ? (
              <Text style={styles.videoBadgeText}>{formatClipDuration(slotMedia.durationMs)}</Text>
            ) : null}
          </View>
        )}

        {media === 'empty' && (
          <View style={styles.slotEmpty}>
            <View style={styles.slotEmptyPlus}>
              <Text style={styles.slotEmptyPlusText}>+</Text>
            </View>
            <Text style={styles.slotEmptyLabel} numberOfLines={1}>
              Añadir
            </Text>
          </View>
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
      <View style={styles.screen}>
        <TopBar onHelp={() => setInfoModalVisible(true)} onNewCollage={onRequestResetCollage} />

        <Pressable
          style={styles.canvasZone}
          accessible={false}
          onPress={() => {
            setSelectedSlotId(null);
            setOpenPanel(null);
          }}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setCanvasBox((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height }
            );
          }}
        >
          <View style={[styles.canvasFrame, canvasFrame]}>
            <CollageLayout
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              slots={activeSlots}
              renderSlot={renderSlot}
            />
            <SlotGestureLayer
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              slots={activeSlots}
              width={canvasFrame.width}
              height={canvasFrame.height}
              disabled={isExporting}
              canDrag={(slotId) => (slots[slotId]?.kind ?? 'empty') !== 'empty'}
              canAdjust={(slotId) => (slots[slotId]?.kind ?? 'empty') !== 'empty'}
              renderGhost={(slotId) => {
                const ghostSlot = activeSlots.find((slot) => slot.id === slotId);
                return ghostSlot ? renderExportSlot(ghostSlot) : null;
              }}
              onTapSlot={onSlotPress}
              onDoubleTapSlot={onSlotDoubleTap}
              onTapOutside={onTapOutsideSlots}
              onSwap={onSwapSlots}
              onDragChange={setIsDraggingSlot}
            />
          </View>
        </Pressable>

        {!openPanel && <Text style={styles.caption}>{captionText}</Text>}

        {openPanel === 'design' ? (
          <DesignPanel
            layout={layout}
            borderMode={borderMode}
            onLayoutChange={setLayout}
            onBorderModeChange={setBorderMode}
            onClose={() => setOpenPanel(null)}
          />
        ) : openPanel === 'duration' ? (
          <DurationPanel
            duration={duration}
            durationOptions={DURATION_OPTIONS}
            onDurationChange={setDuration}
            onClose={() => setOpenPanel(null)}
          />
        ) : (
          <ToolDock items={dockItems} />
        )}

        <Pressable
          style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
          accessibilityRole="button"
          onPress={onOpenExportSheet}
          disabled={isExporting}
        >
          <Text style={styles.exportButtonText}>{isExporting ? 'Exportando...' : 'Exportar'}</Text>
        </Pressable>

        {activeHint === 'add' && (
          <Coachmark
            title="Empieza aquí"
            body="Elige hasta 3 fotos o vídeos con Añadir, o toca un hueco."
            step="1 de 3"
            bottom={HINT_BOTTOM}
            arrowLeft="60%"
            onDismiss={() => markHintSeen('add')}
          />
        )}
        {activeHint === 'adjust' && (
          <Coachmark
            title="Toca un hueco"
            body="Ajusta el encuadre, cambia el clip o silencia el sonido. Mantén pulsado y arrastra para cambiar de sitio."
            step="2 de 3"
            bottom={HINT_BOTTOM}
            onDismiss={() => markHintSeen('adjust')}
          />
        )}
        {activeHint === 'export' && (
          <Coachmark
            title="Cuando termines"
            body="Pulsa Exportar para guardar tu historia en la galería."
            step="3 de 3"
            bottom={HINT_BOTTOM}
            onDismiss={() => markHintSeen('export')}
          />
        )}
      </View>

      <ExportSheet
        visible={exportSheetOpen}
        isExporting={isExporting}
        progress={exportProgress}
        status={exportStatus}
        thumbnail={
          <CollageLayout
            layout={layout}
            hasBlackBorders={hasBlackBorders}
            slots={activeSlots}
            renderSlot={renderExportSlot}
          />
        }
        summaryLines={[
          `${filledCount} de ${activeSlots.length} huecos · ${duration} s`,
          audibleCount >= 2
            ? `Sonido: ${audibleCount} vídeos mezclados`
            : audibleCount === 1
              ? 'Sonido: 1 vídeo'
              : 'Sin sonido',
          '1080 × 1920 · MP4',
          emptySlotCount > 0 ? 'Álbum Historys · huecos vacíos en negro' : 'Álbum Historys',
        ]}
        durationSeconds={duration}
        quality={quality}
        onQualityChange={setQuality}
        onSave={onExportCollage}
        onCancelExport={onCancelExport}
        onClose={() => setExportSheetOpen(false)}
      />

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
        visible={permissionDeniedVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPermissionDeniedVisible(false)}
      >
        <View style={styles.libraryModalOuter}>
          <Pressable
            style={styles.libraryModalDim}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => setPermissionDeniedVisible(false)}
          />
          <View style={styles.libraryModalCard}>
            <Text style={styles.libraryModalTitle}>Permiso necesario</Text>
            <Text style={styles.libraryModalMessage}>
              Necesitamos acceso a tu librería para cargar fotos y videos. Puedes activarlo en
              los ajustes del sistema.
            </Text>
            <View style={styles.libraryModalActions}>
              <Pressable
                style={[styles.slotButtonGhost, { flex: 1, alignItems: 'center' }]}
                onPress={() => setPermissionDeniedVisible(false)}
              >
                <Text style={styles.slotButtonGhostText}>Ahora no</Text>
              </Pressable>
              <Pressable
                style={[styles.slotButton, { flex: 1, alignItems: 'center' }]}
                onPress={() => {
                  setPermissionDeniedVisible(false);
                  Linking.openSettings().catch(() => {
                    Alert.alert('Ajustes', 'Abre los ajustes del teléfono y da acceso a fotos a Historys.');
                  });
                }}
              >
                <Text style={styles.slotButtonText}>Abrir ajustes</Text>
              </Pressable>
            </View>
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
                    <Text style={styles.slotButtonText}>Ver en galería</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.slotButtonGhost, { alignItems: 'center' }]}
                    onPress={() => setFeedbackDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonGhostText}>Seguir editando</Text>
                  </Pressable>
                  <Pressable
                    style={styles.successLink}
                    hitSlop={8}
                    accessibilityRole="button"
                    onPress={() => setConfirmNewCollage(true)}
                  >
                    <Text style={styles.successLinkText}>Empezar otra historia</Text>
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
                    Toca <Text style={styles.infoInlineStrong}>Diseño</Text> en la barra de abajo y cambia entre{' '}
                    <Text style={styles.infoInlineStrong}>3 bandas</Text>,{' '}
                    <Text style={styles.infoInlineStrong}>2+1</Text> o{' '}
                    <Text style={styles.infoInlineStrong}>1+2</Text> sin perder lo que ya habías cargado. El interruptor{' '}
                    <Text style={styles.infoInlineStrong}>Bordes</Text> quita o pone el margen negro.
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
                    Toca <Text style={styles.infoInlineStrong}>Añadir</Text> en la barra para elegir varias fotos o
                    vídeos de una vez (se reparten por los huecos libres, en el orden en que los marques), o toca un
                    hueco vacío (<Text style={styles.infoInlineStrong}>+</Text>) para llenar solo ese. Si ya tiene contenido, la barra de abajo muestra sus controles:
                  </Text>
                  <View style={styles.infoTagList}>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Cambiar:</Text> sustituye el contenido por otra foto o vídeo.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Ajustar:</Text> mueve y haz zoom sobre la proporción exacta de ese hueco.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Sonido:</Text> activa o silencia cada vídeo (el altavoz se tacha cuando está silenciado). Si hay dos o más con sonido, se mezclan en una sola pista.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Doble toque:</Text> abre Ajustar directamente.
                    </Text>
                    <Text style={styles.infoTagItem}>
                      <Text style={styles.infoInlineStrong}>• Mantener y arrastrar:</Text> suelta un hueco sobre otro para intercambiarlos; el encuadre y el sonido viajan con él.
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
                    Toca <Text style={styles.infoInlineStrong}>Duración</Text> en la barra para elegir los segundos (
                    <Text style={styles.infoInlineStrong}>5s a 30s</Text>). Al pulsar{' '}
                    <Text style={styles.infoInlineStrong}>Exportar</Text> eliges la calidad (
                    <Text style={styles.infoInlineStrong}>Ligera, Normal o Máxima</Text>, con el peso aproximado) y
                    guardas. Puedes cancelar mientras se genera. El vídeo se guarda en{' '}
                    <Text style={styles.infoInlineStrong}>1080×1920 (H.264)</Text> dentro del álbum{' '}
                    <Text style={styles.infoInlineStrong}>Historys</Text> y tu collage sigue en pantalla por si quieres hacer otro cambio.
                  </Text>
                </View>
              </View>

              <View style={styles.infoQuickCard}>
                <Text style={styles.infoQuickTitle}>Menú y etiquetas</Text>
                <View style={styles.infoQuickRow}>
                  <View style={styles.infoKeyPill}>
                    <Text style={styles.infoKeyPillText}>···</Text>
                  </View>
                  <Text style={styles.infoQuickText}>
                    Nuevo collage… vacía los 3 huecos y vuelve a 10s (pide confirmación).
                  </Text>
                </View>
                <View style={styles.infoQuickRow}>
                  <View style={[styles.infoKeyPill, styles.infoKeyPillSoft]}>
                    <Text style={styles.infoKeyPillTextDark}>▶ 0:12</Text>
                  </View>
                  <Text style={styles.infoQuickText}>
                    Marca los vídeos con su duración. Un altavoz tachado indica que no sonará. Si un vídeo vertical de
                    cámara se endereza solo, lo avisamos al cargarlo.
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
          <View style={styles.editorHeader}>
            <Pressable
              style={styles.editorHeaderSide}
              onPress={() => setEditingSlotId(null)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.editorCancelText}>Cancelar</Text>
            </Pressable>
            <Text style={styles.editorTitle}>
              {editingMedia?.kind === 'video' ? 'Ajustar vídeo' : 'Ajustar foto'}
            </Text>
            <View style={[styles.editorHeaderSide, styles.editorHeaderSideEnd]}>
              <Pressable style={styles.editorDoneButton} onPress={onSavePhotoEditor} accessibilityRole="button">
                <Text style={styles.editorPrimaryButtonText}>Hecho</Text>
              </Pressable>
            </View>
          </View>

          <View
            style={styles.editorCanvasSlot}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setEditorBox((prev) =>
                prev.width === width && prev.height === height ? prev : { width, height }
              );
            }}
            {...photoEditorResponder.panHandlers}
          >
            <View style={{ width: editorFrame.width, height: editorFrame.height }}>
              {editingSlotId && editingMedia?.kind === 'photo' && editingMedia.uri && (
                <View style={styles.editorDim}>
                  <FramedMedia
                    uri={editingMedia.uri}
                    kind="photo"
                    displayWidth={editingMedia.width}
                    displayHeight={editingMedia.height}
                    transform={draftTransform}
                    slotWidth={editorFrame.width}
                    slotHeight={editorFrame.height}
                    opacity={0.35}
                  />
                </View>
              )}
              {editingSlotId && editingMedia?.kind === 'video' && editingMedia.previewUri && (
                <View style={styles.editorDim}>
                  <FramedMedia
                    uri={editingMedia.previewUri}
                    kind="video"
                    displayWidth={editingMedia.width}
                    displayHeight={editingMedia.height}
                    stillWidth={editingMedia.stillWidth}
                    stillHeight={editingMedia.stillHeight}
                    rotation={editingMedia.rotation}
                    transform={draftTransform}
                    slotWidth={editorFrame.width}
                    slotHeight={editorFrame.height}
                    opacity={0.35}
                  />
                </View>
              )}
              <View style={styles.editorCanvas}>
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
                {isEditorGesture && (
                  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    <View style={[styles.editorGridLine, styles.editorGridV, { left: '33.33%' }]} />
                    <View style={[styles.editorGridLine, styles.editorGridV, { left: '66.66%' }]} />
                    <View style={[styles.editorGridLine, styles.editorGridH, { top: '33.33%' }]} />
                    <View style={[styles.editorGridLine, styles.editorGridH, { top: '66.66%' }]} />
                  </View>
                )}
              </View>
              <View pointerEvents="none" style={styles.editorFrameBorder} />
            </View>
          </View>

          <Text style={styles.editorHint}>Arrastra para mover · pellizca o desliza para el zoom</Text>

          <View style={styles.editorZoomBlock}>
            <Text style={styles.editorZoomLabel}>Zoom {(draftTransform.scale * 100).toFixed(0)}%</Text>
            <View style={styles.editorSliderRow}>
              <Text style={styles.editorSliderEnd}>{MIN_PHOTO_SCALE}×</Text>
              <View style={styles.editorSliderFlex}>
                <ZoomSlider
                  value={draftTransform.scale}
                  min={MIN_PHOTO_SCALE}
                  max={MAX_PHOTO_SCALE}
                  onChange={(next) => setDraftTransform((prev) => ({ ...prev, scale: next }))}
                />
              </View>
              <Text style={styles.editorSliderEnd}>{MAX_PHOTO_SCALE}×</Text>
            </View>
          </View>

          <Pressable
            style={styles.editorResetLink}
            onPress={() => setDraftTransform(normalizeTransform(null))}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.editorResetText}>Restablecer</Text>
          </Pressable>
          <Text style={styles.editorHintSmall}>Doble toque: alterna 1× y 2×</Text>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}
