import Constants from 'expo-constants';
import { useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, Text, View } from 'react-native';
import styles from '../styles/appStyles';

type Props = {
  onHelp: () => void;
  onNewCollage: () => void;
};

type MenuAnchor = { top: number };

const MENU_GAP = 6;
const MENU_RIGHT = 16;

export function TopBar({ onHelp, onNewCollage }: Props) {
  const menuButtonRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const openMenu = () => {
    menuButtonRef.current?.measureInWindow((_x, y, _width, height) => {
      setAnchor({ top: y + height + MENU_GAP });
    });
  };

  const closeMenu = () => setAnchor(null);

  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  const showAbout = () => {
    const version = Constants.expoConfig?.version ?? '';
    Alert.alert('Historys', version ? `Versión ${version}` : 'Creador de collages 9:16');
  };

  return (
    <View style={styles.titleRow}>
      <Image source={require('../../assets/icon.png')} style={styles.titleIcon} />
      <View style={styles.titleTextFlex}>
        <Text style={styles.title}>Historys</Text>
      </View>
      <View style={styles.titleToolbar}>
        <Pressable
          style={styles.titleToolButton}
          onPress={onHelp}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Guía rápida"
        >
          <Text style={styles.titleToolButtonHelp}>?</Text>
        </Pressable>
        <Pressable
          ref={menuButtonRef}
          collapsable={false}
          style={styles.titleToolButton}
          onPress={openMenu}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Menú"
        >
          <Text style={styles.titleToolButtonMenu}>···</Text>
        </Pressable>
      </View>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeMenu}
      >
        <Pressable
          style={styles.menuBackdrop}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú"
          onPress={closeMenu}
        />
        {anchor && (
          <View style={[styles.menuCard, { top: anchor.top, right: MENU_RIGHT }]}>
            <Pressable style={styles.menuItem} onPress={run(onNewCollage)} accessibilityRole="button">
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Nuevo collage…</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={run(onHelp)} accessibilityRole="button">
              <Text style={styles.menuItemText}>Guía rápida</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={run(showAbout)} accessibilityRole="button">
              <Text style={[styles.menuItemText, styles.menuItemTextMuted]}>
                Acerca de{Constants.expoConfig?.version ? ` · v${Constants.expoConfig.version}` : ''}
              </Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}
