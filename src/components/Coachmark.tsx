import { Pressable, Text, View } from 'react-native';
import styles from '../styles/appStyles';

type Props = {
  title: string;
  body: string;
  step: string;
  bottom: number;
  /** Horizontal position of the arrow inside the bubble, as a percentage string such as '62%'. */
  arrowLeft?: string;
  onDismiss: () => void;
};

export function Coachmark({ title, body, step, bottom, arrowLeft = '50%', onDismiss }: Props) {
  return (
    <View pointerEvents="box-none" style={[styles.coachWrap, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}. Toca para cerrar.`}
        style={styles.coachBubble}
        onPress={onDismiss}
      >
        <Text style={styles.coachTitle}>{title}</Text>
        <Text style={styles.coachBody}>{body}</Text>
        <Text style={styles.coachStep}>{step}</Text>
        <View style={[styles.coachArrow, { left: arrowLeft as `${number}%` }]} />
      </Pressable>
    </View>
  );
}
