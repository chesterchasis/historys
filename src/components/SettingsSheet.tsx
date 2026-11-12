import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import type { ThemePreference } from '../theme/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onHelp: () => void;
  onNewCollage: () => void;
  onResetHints: () => void;
};

const APPEARANCE_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'auto', label: 'Auto' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { styles } = useTheme();
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.settingsSectionLabel}>{title}</Text>
      <View style={styles.settingsGroup}>{children}</View>
    </View>
  );
}

type ActionRowProps = {
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
};

function ActionRow({ label, hint, danger, onPress }: ActionRowProps) {
  const { styles, colors } = useTheme();
  return (
    <Pressable style={styles.settingsRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.settingsRowText}>
        <Text style={[styles.settingsRowLabel, danger && styles.settingsRowLabelDanger]}>{label}</Text>
        {hint ? <Text style={styles.settingsRowHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink} style={{ opacity: 0.45 }} />
    </Pressable>
  );
}

type SwitchRowProps = {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  const { styles, colors } = useTheme();
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowText}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        <Text style={styles.settingsRowHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.switchOff, true: colors.switchOn }}
        thumbColor={colors.switchThumb}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function SettingsSheet({ visible, onClose, onHelp, onNewCollage, onResetHints }: Props) {
  const { styles, preference, setPreference, settings, updateSettings } = useTheme();
  const version = Constants.expoConfig?.version;

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.libraryModalOuter}>
        <Pressable
          style={styles.libraryModalDim}
          accessibilityRole="button"
          accessibilityLabel="Cerrar ajustes"
          onPress={onClose}
        />
        <View style={[styles.libraryModalCard, styles.infoModalCard]}>
          <View style={styles.infoModalHeader}>
            <Text style={styles.libraryModalTitle}>Ajustes</Text>
            <Pressable
              style={styles.panelDone}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cerrar ajustes"
            >
              <Text style={styles.panelDoneText}>Listo</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.settingsScroll}
            contentContainerStyle={styles.infoModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Section title="Apariencia">
              <View style={styles.settingsSegments}>
                <View style={[styles.segTrack, styles.settingsSegTrack]} accessibilityRole="radiogroup">
                  {APPEARANCE_OPTIONS.map((option) => {
                    const selected = option.id === preference;
                    return (
                      <Pressable
                        key={option.id}
                        style={[styles.segOption, selected && styles.segOptionSelected]}
                        onPress={() => setPreference(option.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Apariencia ${option.label}`}
                      >
                        <Text style={[styles.segText, selected && styles.segTextSelected]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.settingsRowHint}>Auto sigue el modo claro u oscuro del teléfono.</Text>
              </View>
            </Section>

            <Section title="Diseño">
              <SwitchRow
                label="Recordar mi último diseño"
                hint="Al abrir la app vuelve con el formato, fondo, forma, bordes, duración y calidad que usaste."
                value={settings.rememberDesign}
                onChange={(value) => updateSettings({ rememberDesign: value })}
              />
            </Section>

            <Section title="Vídeos">
              <SwitchRow
                label="Silenciar vídeos al cargarlos"
                hint="Los vídeos nuevos empiezan sin sonido. Puedes activarlo en cada hueco."
                value={settings.muteOnLoad}
                onChange={(value) => updateSettings({ muteOnLoad: value })}
              />
            </Section>

            <Section title="Ayuda">
              <ActionRow label="Guía rápida" hint="Cómo montar y exportar tu historia." onPress={run(onHelp)} />
              <View style={styles.menuDivider} />
              <ActionRow
                label="Repetir la guía de inicio"
                hint="Vuelve a mostrar las burbujas de ayuda."
                onPress={run(onResetHints)}
              />
            </Section>

            <Section title="Collage">
              <ActionRow
                label="Nuevo collage…"
                hint="Vacía los huecos y empieza otro."
                danger
                onPress={run(onNewCollage)}
              />
            </Section>

            <View style={styles.settingsFooterBlock}>
              <Text style={styles.settingsFooterTitle}>Historys By chesterchasis</Text>
              {version ? <Text style={styles.settingsFooter}>Versión {version}</Text> : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
