import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import {
  Alert,
  Animated,
  Easing,
  GestureResponderEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  BACKGROUND_COLORS,
  DURATION_OPTIONS,
  FORMAT_SIZES,
  getFormatRatio,
  LAYOUT_CHOICES,
  LAYOUT_SPECS,
  MAX_PHOTO_SCALE,
  MIN_PHOTO_SCALE,
  PHOTO_EXPORT_SCALE,
  type ExportQuality,
} from './src/constants/collage';
import { TrimBar } from './src/components/TrimBar';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import {
  BackgroundMode,
  BorderMode,
  CollageFormat,
  LayoutType,
  PhotoTransform,
  SlotMedia,
  SlotSpec,
} from './src/types/collage';
import {
  ExportCancelledError,
  exportAsImageFallback,
  exportStillWithFfmpeg,
  exportVideoWithFfmpeg,
  hasVideoSlots,
  isRunningInExpoGo,
  requestCancelExport,
} from './src/utils/collageExport';
import { clamp, fitFrame, getSlotBoundsMap } from './src/utils/collageMath';
import { normalizeQuarterTurn, normalizeTransform, placedMediaRect } from './src/utils/frameTransform';
import { type HintStep, loadOnboarding, type OnboardingSeen, saveOnboarding } from './src/utils/onboarding';
import { buildSlotMedia, clipStrip, clipThumbnail, formatClipDuration } from './src/utils/slotMedia';
import { canTrimClip, effectiveTrimStartMs } from './src/utils/trim';

/** Altura aproximada de la barra, Exportar y márgenes: la burbuja queda justo encima de la barra. */
const HINT_BOTTOM = 152;
/** Aire entre la burbuja y lo que señala. */
const HINT_GAP = 12;
const SCREEN_PADDING = 16;
const DOCK_PADDING = 6;
const DOCK_GAP = 4;
const DOCK_ITEMS = 4;
const ARROW_MARGIN = 22;

const EMPTY_SLOTS: Record<string, SlotMedia> = {
  'slot-1': { kind: 'empty' },
  'slot-2': { kind: 'empty' },
  'slot-3': { kind: 'empty' },
};

/** Margen entre el panel abierto y el borde inferior del lienzo. */
const PANEL_GAP = 12;
const PANEL_ENTER_MS = 240;
const PANEL_EXIT_MS = 170;
const CANVAS_SPRING = { damping: 26, stiffness: 240, mass: 1, useNativeDriver: true } as const;

type PanelKind = 'design' | 'duration';

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  useFonts(Ionicons.font);
  const { styles, colors, scheme, settings, updateSettings } = useTheme();
  // Los ajustes ya están cargados cuando entra la app, así que el diseño recordado se usa desde el primer fotograma.
  const [startDesign] = useState(() => (settings.rememberDesign ? settings.design : null));
  const [layout, setLayout] = useState<LayoutType>(startDesign?.layout ?? 'three-horizontal');
  const [borderMode, setBorderMode] = useState<BorderMode>(startDesign?.borderMode ?? 'black');
  const [format, setFormat] = useState<CollageFormat>(startDesign?.format ?? 'story');
  const [background, setBackground] = useState<BackgroundMode>(startDesign?.background ?? 'black');
  const [duration, setDuration] = useState<number>(startDesign?.duration ?? 10);
  const [quality, setQuality] = useState<ExportQuality>(startDesign?.quality ?? 'medium');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [previewRemaining, setPreviewRemaining] = useState(0);
  const [previewSession, setPreviewSession] = useState(0);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
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
  const [openPanel, setOpenPanel] = useState<PanelKind | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<PanelKind | null>(null);
  const [canvasBox, setCanvasBox] = useState({ width: 0, height: 0 });
  const [zoneRect, setZoneRect] = useState({ y: 0, height: 0 });
  const [stackRect, setStackRect] = useState({ y: 0, height: 0 });
  const [screenHeight, setScreenHeight] = useState(0);
  const [panelHeight, setPanelHeight] = useState(0);
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const [editorBox, setEditorBox] = useState({ width: 0, height: 0 });
  const [draftTransform, setDraftTransform] = useState<PhotoTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [draftTrimMs, setDraftTrimMs] = useState(0);
  const [trimSession, setTrimSession] = useState(0);
  const [trimStrip, setTrimStrip] = useState<string[]>([]);
  const [slots, setSlots] = useState<Record<string, SlotMedia>>({ ...EMPTY_SLOTS });

  const activeSlots = useMemo(() => LAYOUT_SPECS[layout], [layout]);
  const hasBlackBorders = borderMode === 'black';
  const formatRatio = getFormatRatio(format);
  const bgColor = BACKGROUND_COLORS[background];
  const isWhiteBackground = background === 'white';
  const previewFrame = fitFrame(previewBox.width, previewBox.height, formatRatio);
  const canvasFrame = fitFrame(canvasBox.width, canvasBox.height, formatRatio);

  // El panel abierto se dibuja encima de la barra. En lugar de redimensionar el lienzo (un salto),
  // se escala y se sube con una transformación nativa hasta que quede justo encima del panel.
  const panelShift =
    openPanel && panelHeight > 0 && screenHeight > 0
      ? Math.max(0, zoneRect.y + zoneRect.height - (stackRect.y + stackRect.height - panelHeight - PANEL_GAP))
      : 0;
  const shrunkFrame = fitFrame(canvasBox.width, canvasBox.height - panelShift, formatRatio);
  const canvasScaleTarget =
    canvasFrame.width > 0 && shrunkFrame.width > 0 ? shrunkFrame.width / canvasFrame.width : 1;
  const canvasLiftTarget = -panelShift / 2;
  const panelBottom = Math.max(0, screenHeight - (stackRect.y + stackRect.height));

  const canvasScale = useRef(new Animated.Value(1)).current;
  const canvasLift = useRef(new Animated.Value(0)).current;
  const panelProgress = useRef(new Animated.Value(0)).current;
  const idleOpacity = useMemo(
    () => panelProgress.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
    [panelProgress]
  );
  const panelRise = useMemo(
    () => panelProgress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
    [panelProgress]
  );

  useEffect(() => {
    Animated.parallel([
      Animated.spring(canvasScale, { toValue: canvasScaleTarget, ...CANVAS_SPRING }),
      Animated.spring(canvasLift, { toValue: canvasLiftTarget, ...CANVAS_SPRING }),
    ]).start();
  }, [canvasScale, canvasLift, canvasScaleTarget, canvasLiftTarget]);

  useEffect(() => {
    if (openPanel) {
      setRenderedPanel(openPanel);
      Animated.timing(panelProgress, {
        toValue: 1,
        duration: PANEL_ENTER_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(panelProgress, {
      toValue: 0,
      duration: PANEL_EXIT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setRenderedPanel(null);
    });
  }, [openPanel, panelProgress]);

  const editingBounds = editingSlotId ? getSlotBoundsMap(layout, hasBlackBorders, format)[editingSlotId] : undefined;
  const editorRatio =
    editingBounds && editingBounds.height > 0 ? editingBounds.width / editingBounds.height : formatRatio;
  const editorFrame = fitFrame(editorBox.width, editorBox.height, editorRatio);
  const editorMetricsRef = useRef({ slotWidth: 0, slotHeight: 0, mediaWidth: 0, mediaHeight: 0 });
  const editingMedia = editingSlotId ? slots[editingSlotId] : undefined;
  const editingTrimmable = Boolean(editingMedia && canTrimClip(editingMedia, duration));
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

  useEffect(() => {
    if (!settings.rememberDesign) return;
    const design = { layout, format, background, borderMode, duration, quality };
    if (JSON.stringify(design) !== JSON.stringify(settings.design)) updateSettings({ design });
  }, [settings.rememberDesign, settings.design, updateSettings, layout, format, background, borderMode, duration, quality]);

  const resetHints = () => {
    const cleared: OnboardingSeen = { add: false, adjust: false, export: false };
    onboardingRef.current = cleared;
    setOnboarding(cleared);
    saveOnboarding(cleared);
    showNotice('Las burbujas de ayuda volverán a salir');
  };

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

  // Cada burbuja señala lo suyo: Añadir en la barra, el primer hueco con contenido, o el botón Exportar.
  const { width: windowWidth } = useWindowDimensions();
  const bubbleWidth = windowWidth - SCREEN_PADDING * 2;
  const clampArrow = (x: number) => clamp(x, ARROW_MARGIN, bubbleWidth - ARROW_MARGIN);
  const dockItemWidth = (bubbleWidth - DOCK_PADDING * 2 - DOCK_GAP * (DOCK_ITEMS - 1)) / DOCK_ITEMS;
  const firstFilledSlot = activeSlots.find((slot) => (slots[slot.id]?.kind ?? 'empty') !== 'empty');
  const hintSlotBounds = firstFilledSlot
    ? getSlotBoundsMap(layout, hasBlackBorders, format)[firstFilledSlot.id]
    : undefined;
  const hintCanvasScale = canvasFrame.height / FORMAT_SIZES[format].height;
  const hintTargets = {
    addX: clampArrow(DOCK_PADDING + 2 * (dockItemWidth + DOCK_GAP) + dockItemWidth / 2),
    exportX: bubbleWidth / 2,
    exportBottom: Math.max(0, screenHeight - (stackRect.y + stackRect.height + 10)) + 8,
    slot:
      hintSlotBounds && canvasFrame.width > 0
        ? {
            bottom:
              zoneRect.y +
              (canvasBox.height - canvasFrame.height) / 2 +
              (hintSlotBounds.y + hintSlotBounds.height) * hintCanvasScale,
            centerX: clampArrow(
              (canvasBox.width - canvasFrame.width) / 2 + (hintSlotBounds.x + hintSlotBounds.width / 2) * hintCanvasScale
            ),
          }
        : null,
  };

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

  const pickMediaForSlots = async (slotIds: string[]): Promise<'picked' | 'canceled'> => {
    // El selector del sistema no necesita permiso de acceso a la galería: solo recibe lo que eliges.
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
          muted: media.kind === 'video' ? prev[slotId]?.muted ?? settings.muteOnLoad : undefined,
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
    setDraftTrimMs(effectiveTrimStartMs(slotMedia, duration));
    setTrimStrip([]);
    setTrimSession((prev) => prev + 1);
  };

  const onSavePhotoEditor = () => {
    if (!editingSlotId) return;
    const slotId = editingSlotId;
    const media = slots[slotId];
    const trimmable = Boolean(media && canTrimClip(media, duration));
    const previousTrim = media ? effectiveTrimStartMs(media, duration) : 0;
    const nextTrim = trimmable ? Math.round(draftTrimMs) : media?.trimStartMs;

    setSlots((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        transform: normalizeTransform(draftTransform),
        trimStartMs: nextTrim,
      },
    }));
    setEditingSlotId(null);

    // La miniatura del hueco debe enseñar el primer fotograma del tramo elegido.
    if (trimmable && media?.uri && Math.abs((nextTrim ?? 0) - previousTrim) > 50) {
      clipThumbnail(media.uri, (nextTrim ?? 0) + 700).then((previewUri) => {
        if (!previewUri) return;
        setSlots((prev) =>
          prev[slotId]?.uri === media.uri ? { ...prev, [slotId]: { ...prev[slotId], previewUri } } : prev
        );
      });
    }
  };

  useEffect(() => {
    if (!editingSlotId || !editingTrimmable || !editingMedia?.uri || !editingMedia.durationMs) return;
    let active = true;
    clipStrip(editingMedia.uri, editingMedia.durationMs, 7).then((frames) => {
      if (active) setTrimStrip(frames);
    });
    return () => {
      active = false;
    };
  }, [editingSlotId, editingTrimmable, editingMedia?.uri, editingMedia?.durationMs]);

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
      // Solo se pide permiso de escritura: en Android 13 o superior no hace falta ninguno para guardar.
      const permission = await MediaLibrary.requestPermissionsAsync(true);
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

      const emptyNote =
        emptySlotCount > 0 ? ` Los huecos vacíos quedaron en ${isWhiteBackground ? 'blanco' : 'negro'}.` : '';
      const common = {
        activeSlots,
        slots,
        layout,
        hasBlackBorders,
        format,
        background,
        onProgress: (value: number) => updateExportProgress(value),
      };

      try {
        if (containsVideo) {
          setExportStatus('Renderizando vídeo...');
          updateExportProgress(0.08);
          const exported = await exportVideoWithFfmpeg({ ...common, duration, quality });
          setExportStatus('Guardando vídeo en galería...');
          updateExportProgress(1);
          const lines = [`Está en el álbum Historys.${emptyNote}`];
          if (exported.hdrConverted) lines.push('El HDR se convirtió a SDR para conservar el color.');
          if (!exported.h264 && exported.codec) {
            lines.push(`Guardado en formato compatible (${exported.codec.toUpperCase()}).`);
          }
          setExportSheetOpen(false);
          setFeedbackDialog({ kind: 'ready', title: 'Guardada en tu galería', body: lines.join('\n') });
        } else {
          setExportStatus('Renderizando foto...');
          updateExportProgress(0.08);
          const photo = await exportStillWithFfmpeg(common);
          setExportStatus('Guardando foto en galería...');
          updateExportProgress(1);
          setExportSheetOpen(false);
          setFeedbackDialog({
            kind: 'ready',
            title: 'Foto guardada en tu galería',
            body: `${photo.width} × ${photo.height} px, en el álbum Historys.${emptyNote}`,
          });
        }
      } catch (error) {
        if (error instanceof ExportCancelledError) return;
        console.error('Export failed', error);

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
        await exportAsImageFallback({ exportCanvasRef, format });
        setExportStatus('Guardando imagen en galería...');
        updateExportProgress(1);
        const size = FORMAT_SIZES[format];
        setExportSheetOpen(false);
        setFeedbackDialog({
          kind: 'ready',
          title: 'Foto guardada en tu galería',
          body: `No se pudo usar el modo de alta resolución, así que se guardó a ${size.width} × ${size.height} px en el álbum Historys.${emptyNote}`,
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

  const hasVideo = hasVideoSlots(activeSlots, slots);

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
      value: hasVideo ? `${duration} s` : 'Solo vídeo',
      disabled: !hasVideo,
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
        style={[
          styles.slot,
          slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot,
          { backgroundColor: bgColor },
        ]}
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
            {slotMedia.hdr ? <Text style={styles.videoBadgeText}>HDR</Text> : null}
            {slotMedia.durationMs ? (
              <Text style={styles.videoBadgeText}>{formatClipDuration(slotMedia.durationMs)}</Text>
            ) : null}
          </View>
        )}

        {media === 'empty' && (
          <View style={styles.slotEmpty}>
            <View style={[styles.slotEmptyPlus, isWhiteBackground && styles.slotEmptyPlusOnWhite]}>
              <Text style={[styles.slotEmptyPlusText, isWhiteBackground && styles.slotEmptyTextOnWhite]}>+</Text>
            </View>
            <Text
              style={[styles.slotEmptyLabel, isWhiteBackground && styles.slotEmptyTextOnWhite]}
              numberOfLines={1}
            >
              Añadir
            </Text>
          </View>
        )}

        {isSelected && (
          <View
            pointerEvents="none"
            style={[styles.slotSelectedRing, isWhiteBackground && styles.slotSelectedRingOnWhite]}
          />
        )}
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
        style={[
          styles.previewSlot,
          slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot,
          { backgroundColor: bgColor },
        ]}
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
            trimStartMs={
              canTrimClip(slotMedia, duration) ? effectiveTrimStartMs(slotMedia, duration) : undefined
            }
            trimLengthMs={canTrimClip(slotMedia, duration) ? duration * 1000 : undefined}
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
        style={[
          styles.exportSlot,
          slot.style === 'horizontal' ? styles.horizontalSlot : styles.verticalSlot,
          { backgroundColor: bgColor },
        ]}
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

        {media === 'empty' && <View style={[styles.exportEmptyFill, { backgroundColor: bgColor }]} />}
      </View>
    );
  };

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={styles.screen}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          setScreenHeight((prev) => (prev === height ? prev : height));
        }}
      >
        <TopBar
          onHelp={() => setInfoModalVisible(true)}
          onNewCollage={onRequestResetCollage}
          onResetHints={resetHints}
        />

        <Pressable
          style={styles.canvasZone}
          accessible={false}
          onPress={() => {
            setSelectedSlotId(null);
            setOpenPanel(null);
          }}
          onLayout={(event) => {
            const { width, height, y } = event.nativeEvent.layout;
            setCanvasBox((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height }
            );
            setZoneRect((prev) => (prev.y === y && prev.height === height ? prev : { y, height }));
          }}
        >
          <Animated.View style={{ transform: [{ translateY: canvasLift }, { scale: canvasScale }] }}>
          <View style={[styles.canvasFrame, canvasFrame, { backgroundColor: bgColor }]}>
            <CollageLayout
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              format={format}
              slots={activeSlots}
              renderSlot={renderSlot}
            />
            <SlotGestureLayer
              layout={layout}
              hasBlackBorders={hasBlackBorders}
              format={format}
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
              onDragChange={(active) => {
                setIsDraggingSlot(active);
                if (active) setOpenPanel(null);
              }}
            />
            {isWhiteBackground && <View pointerEvents="none" style={styles.canvasOutline} />}
          </View>
          </Animated.View>
        </Pressable>

        <View
          style={styles.bottomStack}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setStackRect((prev) => (prev.y === y && prev.height === height ? prev : { y, height }));
          }}
        >
          <Animated.View style={{ opacity: idleOpacity }}>
            <Text style={styles.caption}>{captionText}</Text>
          </Animated.View>
          <Animated.View style={{ opacity: idleOpacity }} pointerEvents={openPanel ? 'none' : 'auto'}>
            <ToolDock items={dockItems} />
          </Animated.View>
        </View>

        <Pressable
          style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
          accessibilityRole="button"
          onPress={onOpenExportSheet}
          disabled={isExporting}
        >
          <Text style={styles.exportButtonText}>{isExporting ? 'Exportando...' : 'Exportar'}</Text>
        </Pressable>

        {renderedPanel && (
          <Animated.View
            pointerEvents={openPanel ? 'auto' : 'none'}
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              setPanelHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
            }}
            style={[
              styles.panelOverlay,
              { bottom: panelBottom, opacity: panelProgress, transform: [{ translateY: panelRise }] },
            ]}
          >
            {renderedPanel === 'design' ? (
              <DesignPanel
                layout={layout}
                borderMode={borderMode}
                format={format}
                background={background}
                onLayoutChange={setLayout}
                onBorderModeChange={setBorderMode}
                onFormatChange={setFormat}
                onBackgroundChange={setBackground}
                onClose={() => setOpenPanel(null)}
              />
            ) : (
              <DurationPanel
                duration={duration}
                durationOptions={DURATION_OPTIONS}
                onDurationChange={setDuration}
                onClose={() => setOpenPanel(null)}
              />
            )}
          </Animated.View>
        )}

        {activeHint === 'add' && (
          <Coachmark
            title="Empieza aquí"
            body="Elige hasta 3 fotos o vídeos con Añadir, o toca un hueco."
            step="1 de 3"
            bottom={HINT_BOTTOM}
            arrowX={hintTargets.addX}
            onDismiss={() => markHintSeen('add')}
          />
        )}
        {activeHint === 'adjust' && hintTargets.slot && (
          <Coachmark
            title="Toca un hueco"
            body="Ajusta el encuadre, cambia el clip o silencia el sonido. Mantén pulsado y arrastra para cambiar de sitio."
            step="2 de 3"
            top={hintTargets.slot.bottom + HINT_GAP}
            arrowX={hintTargets.slot.centerX}
            onDismiss={() => markHintSeen('adjust')}
          />
        )}
        {activeHint === 'export' && (
          <Coachmark
            title="Cuando termines"
            body="Pulsa Exportar para guardar tu historia en la galería."
            step="3 de 3"
            bottom={hintTargets.exportBottom}
            arrowX={hintTargets.exportX}
            onDismiss={() => markHintSeen('export')}
          />
        )}
      </View>

      <ExportSheet
        visible={exportSheetOpen}
        mode={hasVideo ? 'video' : 'photo'}
        aspectRatio={formatRatio}
        thumbnailBackground={bgColor}
        isExporting={isExporting}
        progress={exportProgress}
        status={exportStatus}
        thumbnail={
          <CollageLayout
            layout={layout}
            hasBlackBorders={hasBlackBorders}
            format={format}
            slots={activeSlots}
            renderSlot={renderExportSlot}
          />
        }
        summaryLines={
          hasVideo
            ? [
                `${filledCount} de ${activeSlots.length} huecos · ${duration} s`,
                audibleCount >= 2
                  ? `Sonido: ${audibleCount} vídeos mezclados`
                  : audibleCount === 1
                    ? 'Sonido: 1 vídeo'
                    : 'Sin sonido',
                `${FORMAT_SIZES[format].width} × ${FORMAT_SIZES[format].height} · MP4`,
                emptySlotCount > 0
                  ? `Álbum Historys · huecos vacíos en ${isWhiteBackground ? 'blanco' : 'negro'}`
                  : 'Álbum Historys',
              ]
            : [
                `${filledCount} de ${activeSlots.length} huecos · solo fotos`,
                `Foto · ${FORMAT_SIZES[format].width * PHOTO_EXPORT_SCALE} × ${FORMAT_SIZES[format].height * PHOTO_EXPORT_SCALE} · JPG`,
                emptySlotCount > 0
                  ? `Álbum Historys · huecos vacíos en ${isWhiteBackground ? 'blanco' : 'negro'}`
                  : 'Álbum Historys',
              ]
        }
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
          style={[styles.exportCanvas, { aspectRatio: formatRatio, backgroundColor: bgColor }]}
        >
          <CollageLayout
            layout={layout}
            hasBlackBorders={hasBlackBorders}
            format={format}
            slots={activeSlots}
            renderSlot={renderExportSlot}
          />
        </View>
      </View>

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
              <View
                style={[
                  styles.successThumb,
                  { width: Math.round(192 * formatRatio), backgroundColor: bgColor },
                ]}
              >
                <CollageLayout
                  layout={layout}
                  hasBlackBorders={hasBlackBorders}
                  format={format}
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
                    accessibilityRole="button"
                    onPress={() => setFeedbackDialog({ kind: 'closed' })}
                  >
                    <Text style={styles.slotButtonText}>Seguir editando</Text>
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
                    <Text style={styles.infoInlineStrong}>1+2</Text> sin perder lo que ya habías cargado. Elige el{' '}
                    <Text style={styles.infoInlineStrong}>Formato</Text> (9:16 para historias, 4:5 para el feed o 1:1) y
                    el <Text style={styles.infoInlineStrong}>Fondo</Text> (negro o blanco). El interruptor{' '}
                    <Text style={styles.infoInlineStrong}>Bordes</Text> quita o pone el margen entre huecos.
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
                      <Text style={styles.infoInlineStrong}>• Ajustar:</Text> mueve y haz zoom sobre la proporción exacta de ese hueco. En un vídeo más largo que la historia, desliza el tramo para elegir qué parte se usa.
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
                      <Text style={styles.infoInlineStrong}>• Quitar:</Text> deja ese hueco vacío, con el color del fondo (no hace falta llenar los tres).
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
                    guardas. Puedes cancelar mientras se genera. El vídeo se guarda en H.264 (
                    <Text style={styles.infoInlineStrong}>1080×1920</Text> en historias) dentro del álbum{' '}
                    <Text style={styles.infoInlineStrong}>Historys</Text>. Si solo hay fotos, se guarda una{' '}
                    <Text style={styles.infoInlineStrong}>foto JPG a doble resolución</Text>. Tu collage sigue en
                    pantalla por si quieres hacer otro cambio.
                  </Text>
                </View>
              </View>

              <View style={styles.infoQuickCard}>
                <Text style={styles.infoQuickTitle}>Ajustes y etiquetas</Text>
                <View style={styles.infoQuickRow}>
                  <View style={styles.infoKeyPill}>
                    <Ionicons name="settings-outline" size={14} color={colors.onInk} />
                  </View>
                  <Text style={styles.infoQuickText}>
                    Arriba a la derecha: cambia entre aspecto claro, oscuro o automático, elige si se recuerda tu último
                    diseño o si los vídeos entran silenciados, abre esta guía o empieza un Nuevo collage (vacía los 3
                    huecos y vuelve a 10s, con confirmación).
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
                style={[styles.previewCanvas, previewFrame, { backgroundColor: bgColor }]}
              >
                <CollageLayout
                  layout={layout}
                  hasBlackBorders={hasBlackBorders}
                  format={format}
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
              <View style={[styles.editorCanvas, { backgroundColor: bgColor }]}>
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
                    sessionKey={trimSession}
                    trimStartMs={editingTrimmable ? draftTrimMs : undefined}
                    trimLengthMs={editingTrimmable ? duration * 1000 : undefined}
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

          {editingTrimmable && editingMedia?.durationMs ? (
            <TrimBar
              clipMs={editingMedia.durationMs}
              windowMs={duration * 1000}
              startMs={draftTrimMs}
              stripUris={trimStrip}
              onChange={setDraftTrimMs}
              onRelease={(next) => {
                setDraftTrimMs(next);
                setTrimSession((prev) => prev + 1);
              }}
            />
          ) : null}

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
