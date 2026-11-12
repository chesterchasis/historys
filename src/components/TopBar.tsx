import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SettingsSheet } from './SettingsSheet';

type Props = {
  onHelp: () => void;
  onNewCollage: () => void;
  onResetHints: () => void;
};

export function TopBar({ onHelp, onNewCollage, onResetHints }: Props) {
  const { styles, colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.titleRow}>
      <Image source={require('../../assets/icon.png')} style={styles.titleIcon} />
      <View style={styles.titleTextFlex}>
        <Text style={styles.title}>Historys</Text>
      </View>
      <Pressable
        style={styles.titleToolButton}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Ajustes"
      >
        <Ionicons name="settings-outline" size={20} color={colors.ink} />
      </Pressable>

      <SettingsSheet
        visible={open}
        onClose={() => setOpen(false)}
        onHelp={onHelp}
        onNewCollage={onNewCollage}
        onResetHints={onResetHints}
      />
    </View>
  );
}
