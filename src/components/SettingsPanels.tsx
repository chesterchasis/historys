import type { ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { LAYOUT_CHOICES } from '../constants/collage';
import styles from '../styles/appStyles';
import { BorderMode, LayoutType } from '../types/collage';
import { LayoutThumb } from './LayoutThumb';

type PanelShellProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function PanelShell({ title, onClose, children }: PanelShellProps) {
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

type DesignPanelProps = {
  layout: LayoutType;
  borderMode: BorderMode;
  onLayoutChange: (layout: LayoutType) => void;
  onBorderModeChange: (mode: BorderMode) => void;
  onClose: () => void;
};

export function DesignPanel({
  layout,
  borderMode,
  onLayoutChange,
  onBorderModeChange,
  onClose,
}: DesignPanelProps) {
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
              <LayoutThumb layout={choice.id} hasBlackBorders={hasBlackBorders} selected={selected} />
              <Text style={[styles.layoutChoiceLabel, selected && styles.chipTextSelected]}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.panelRowLabel}>Bordes</Text>
          <Text style={styles.panelHint}>Margen negro entre huecos y alrededor</Text>
        </View>
        <Switch
          value={hasBlackBorders}
          onValueChange={(on) => onBorderModeChange(on ? 'black' : 'none')}
          trackColor={{ false: '#cbc6be', true: '#2f3638' }}
          thumbColor="#f9f8f6"
          accessibilityLabel="Bordes"
        />
      </View>
    </PanelShell>
  );
}

type ChoiceRowProps<T extends string | number> = {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

function ChoiceRow<T extends string | number>({ label, options, value, onChange }: ChoiceRowProps<T>) {
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

type DurationPanelProps = {
  duration: number;
  durationOptions: number[];
  onDurationChange: (seconds: number) => void;
  onClose: () => void;
};

export function DurationPanel({ duration, durationOptions, onDurationChange, onClose }: DurationPanelProps) {
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
