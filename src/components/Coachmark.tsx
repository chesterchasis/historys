import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Props = {
  title: string;
  body: string;
  step: string;
  /** Distancia al borde inferior de la pantalla: la burbuja queda encima de lo que señala. */
  bottom?: number;
  /** Distancia al borde superior: la burbuja queda debajo de lo que señala. */
  top?: number;
  /** Posición horizontal de la punta, en píxeles desde el borde izquierdo de la burbuja. */
  arrowX: number;
  onDismiss: () => void;
};

const ARROW_SIZE = 14;

export function Coachmark({ title, body, step, bottom, top, arrowX, onDismiss }: Props) {
  const { styles } = useTheme();
  const pointsUp = top != null;

  return (
    <View pointerEvents="box-none" style={[styles.coachWrap, pointsUp ? { top } : { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}. Toca para cerrar.`}
        style={styles.coachBubble}
        onPress={onDismiss}
      >
        <Text style={styles.coachTitle}>{title}</Text>
        <Text style={styles.coachBody}>{body}</Text>
        <Text style={styles.coachStep}>{step}</Text>
        <View
          style={[styles.coachArrow, pointsUp ? styles.coachArrowUp : null, { left: arrowX - ARROW_SIZE / 2 }]}
        />
      </Pressable>
    </View>
  );
}
