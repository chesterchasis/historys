import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  status: string;
  progress: number;
};

export function ExportProgress({ status, progress }: Props) {
  const { styles } = useTheme();
  const percent = Math.round(progress * 100);

  return (
    <View style={styles.exportProgressCard}>
      <View style={styles.exportProgressHeader}>
        <Text style={styles.exportProgressLabel}>{status || 'Exportando...'}</Text>
        <Text style={styles.exportProgressPercent}>{percent}%</Text>
      </View>
      <View style={styles.exportProgressTrack}>
        <View style={[styles.exportProgressFill, { width: `${Math.max(4, percent)}%` }]} />
      </View>
    </View>
  );
}
