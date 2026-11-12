import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { type ExportQuality, QUALITY_OPTIONS } from '../constants/collage';
import { useTheme } from '../theme/ThemeContext';
import { ExportProgress } from './ExportProgress';

type Props = {
  visible: boolean;
  /** Un collage con vídeo sale como MP4; uno de solo fotos, como una foto. */
  mode: 'video' | 'photo';
  /** Ancho entre alto del lienzo, para que la miniatura tenga su forma. */
  aspectRatio: number;
  thumbnailBackground: string;
  isExporting: boolean;
  progress: number;
  status: string;
  thumbnail: ReactNode;
  summaryLines: string[];
  durationSeconds: number;
  quality: ExportQuality;
  onQualityChange: (quality: ExportQuality) => void;
  onSave: () => void;
  onCancelExport: () => void;
  onClose: () => void;
};

const THUMB_HEIGHT = 96;

const estimateMegabytes = (mbps: number, seconds: number) => Math.max(1, Math.round((mbps * seconds) / 8));

export function ExportSheet({
  visible,
  mode,
  aspectRatio,
  thumbnailBackground,
  isExporting,
  progress,
  status,
  thumbnail,
  summaryLines,
  durationSeconds,
  quality,
  onQualityChange,
  onSave,
  onCancelExport,
  onClose,
}: Props) {
  const { styles } = useTheme();
  const requestClose = () => {
    if (!isExporting) onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.sheetOuter}>
        <Pressable
          style={styles.libraryModalDim}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={requestClose}
        />
        <SafeAreaView edges={['bottom']} style={styles.sheetCard}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>{mode === 'photo' ? 'Guardar foto' : 'Guardar historia'}</Text>

          <View style={styles.sheetSummary}>
            <View
              style={[
                styles.sheetThumb,
                {
                  height: THUMB_HEIGHT,
                  width: Math.round(THUMB_HEIGHT * aspectRatio),
                  backgroundColor: thumbnailBackground,
                },
              ]}
            >
              {thumbnail}
            </View>
            <View style={styles.sheetSummaryText}>
              {summaryLines.map((line, index) => (
                <Text key={line} style={index === 0 ? styles.sheetSummaryMain : styles.sheetSummaryLine}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          {mode === 'video' && (
            <View style={styles.panelRow}>
              <Text style={styles.panelRowLabel}>Calidad</Text>
              <View style={styles.sheetQualityTrack}>
                {QUALITY_OPTIONS.map((option) => {
                  const selected = option.id === quality;
                  return (
                    <Pressable
                      key={option.id}
                      disabled={isExporting}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: isExporting }}
                      style={[styles.sheetQualityOption, selected && styles.sheetQualityOptionSelected]}
                      onPress={() => onQualityChange(option.id)}
                    >
                      <Text style={[styles.sheetQualityName, selected && styles.sheetQualityTextSelected]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.sheetQualitySize, selected && styles.sheetQualitySizeSelected]}>
                        ≈ {estimateMegabytes(option.mbps, durationSeconds)} MB
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {isExporting ? (
            <>
              <ExportProgress status={status} progress={progress} />
              <Pressable
                style={styles.sheetSecondaryButton}
                accessibilityRole="button"
                onPress={onCancelExport}
              >
                <Text style={styles.sheetSecondaryText}>Cancelar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.exportButton} accessibilityRole="button" onPress={onSave}>
                <Text style={styles.exportButtonText}>Guardar en galería</Text>
              </Pressable>
              <Pressable style={styles.sheetSecondaryButton} accessibilityRole="button" onPress={onClose}>
                <Text style={styles.sheetSecondaryText}>Ahora no</Text>
              </Pressable>
            </>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
