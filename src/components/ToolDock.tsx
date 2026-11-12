import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import styles from '../styles/appStyles';

export type IconName = keyof typeof Ionicons.glyphMap;

export type DockItem = {
  key: string;
  label: string;
  icon: IconName;
  value?: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  emphasis?: boolean;
};

type Props = {
  items: DockItem[];
};

export function ToolDock({ items }: Props) {
  return (
    <View style={styles.dock}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          disabled={item.disabled}
          accessibilityRole="button"
          accessibilityLabel={item.value ? `${item.label}, ${item.value}` : item.label}
          accessibilityState={{ selected: Boolean(item.active), disabled: Boolean(item.disabled) }}
          onPress={item.onPress}
          style={[
            styles.dockButton,
            item.active && styles.dockButtonActive,
            item.emphasis && styles.dockButtonEmphasis,
            item.disabled && styles.dockButtonDisabled,
          ]}
        >
          <Ionicons name={item.icon} size={20} color={item.emphasis ? '#f4f2ee' : '#2f3638'} />
          <Text
            numberOfLines={1}
            style={[styles.dockLabel, item.emphasis && styles.dockLabelEmphasis]}
          >
            {item.label}
          </Text>
          {item.value ? (
            <Text numberOfLines={1} style={styles.dockValue}>
              {item.value}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
