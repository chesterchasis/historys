import type { ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { BACKGROUND_CHOICES, FORMAT_CHOICES, LAYOUT_CHOICES } from '../constants/collage';
import { useTheme } from '../theme/ThemeContext';
import { BackgroundMode, BorderMode, CollageFormat, LayoutType } from '../types/collage';
import { LayoutThumb } from './LayoutThumb';

type PanelShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function PanelShell({ title, onClose, children }: PanelShellProps) {
  const { styles } = useTheme();
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Pressable
          style={styles.panelDone}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Cerrar ${title}`}
        >
          <Text style={styles.panelDoneText}>Listo</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

type ChoiceRowProps<T extends string | number> = {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

function ChoiceRow<T extends string | number>({ label, options, value, onChange }: ChoiceRowProps<T>) {
  const { styles } = useTheme();
  return (
    <View style={styles.panelRow}>
      <Text style={styles.panelRowLabel}>{label}</Text>
      <View style={styles.durationRow}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={String(option.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} ${option.label}`}
              style={[styles.durationChip, selected && styles.chipSelected]}
              onPress={() => onChange(option.id)}
            >
              <Text style={[styles.durationChipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type DesignPanelProps = {
  layout: LayoutType;
  borderMode: BorderMode;
  format: CollageFormat;
  background: BackgroundMode;
  onLayoutChange: (layout: LayoutType) => void;
  onBorderModeChange: (mode: BorderMode) => void;
  onFormatChange: (format: CollageFormat) => void;
  onBackgroundChange: (background: BackgroundMode) => void;
  onClose: () => void;
};

export function DesignPanel({
  layout,
  borderMode,
  format,
  background,
  onLayoutChange,
  onBorderModeChange,
  onFormatChange,
  onBackgroundChange,
  onClose,
}: DesignPanelProps) {
  const { styles, colors } = useTheme();
  const hasBlackBorders = borderMode === 'black';

  return (
    <PanelShell title="Diseño" onClose={onClose}>
      <View style={styles.layoutRow}>
        {LAYOUT_CHOICES.map((choice) => {
          const selected = layout === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={choice.label}
              accessibilityState={{ selected }}
              style={[styles.layoutChoice, selected && styles.layoutChoiceSelected]}
              onPress={() => onLayoutChange(choice.id)}
            >
              <LayoutThumb
                layout={choice.id}
                hasBlackBorders={hasBlackBorders}
                selected={selected}
                format={format}
                background={background}
              />
              <Text style={[styles.layoutChoiceLabel, selected && styles.chipTextSelected]}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.panelColumns}>
        <View style={styles.panelColumn}>
          <ChoiceRow label="Formato" options={FORMAT_CHOICES} value={format} onChange={onFormatChange} />
        </View>
        <View style={styles.panelColumn}>
          <ChoiceRow label="Fondo" options={BACKGROUND_CHOICES} value={background} onChange={onBackgroundChange} />
        </View>
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.panelRowLabel}>Bordes</Text>
          <Text style={styles.panelHint}>Margen entre huecos y alrededor</Text>
        </View>
        <Switch
          value={hasBlackBorders}
          onValueChange={(on) => onBorderModeChange(on ? 'black' : 'none')}
          trackColor={{ false: colors.switchOff, true: colors.switchOn }}
          thumbColor={colors.switchThumb}
          accessibilityLabel="Bordes"
        />
      </View>
    </PanelShell>
  );
}

type DurationPanelProps = {
  duration: number;
  durationOptions: number[];
  onDurationChange: (seconds: number) => void;
  onClose: () => void;
};

export function DurationPanel({ duration, durationOptions, onDurationChange, onClose }: DurationPanelProps) {
  const { styles } = useTheme();
  return (
    <PanelShell title="Duración" onClose={onClose}>
      <ChoiceRow
        label="Segundos"
        options={durationOptions.map((seconds) => ({ id: seconds, label: `${seconds} s` }))}
        value={duration}
        onChange={onDurationChange}
      />
      <Text style={styles.panelHint}>Vale para la vista previa y para el vídeo final.</Text>
    </PanelShell>
  );
}
