import { type ComponentProps, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type {
  PortalMobileNavIconName,
  PortalMobileNavIconProps,
} from './portal-mobile-nav-icon-types';

let featherFontLoaded = false;
let featherFontPromise: Promise<void> | null = null;

function loadFeatherFont() {
  if (featherFontLoaded) return Promise.resolve();
  featherFontPromise ??= Feather.loadFont().then(() => {
    featherFontLoaded = true;
  });
  return featherFontPromise;
}

export function PortalMobileNavIcon({ color, name }: PortalMobileNavIconProps) {
  const [fontReady, setFontReady] = useState(featherFontLoaded);

  useEffect(() => {
    let mounted = true;
    if (!fontReady) {
      void loadFeatherFont()
        .then(() => {
          if (mounted) setFontReady(true);
        })
        .catch(() => {
          featherFontPromise = null;
        });
    }
    return () => {
      mounted = false;
    };
  }, [fontReady]);

  if (!fontReady) return <View style={styles.iconPlaceholder} />;

  return (
    <Feather
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no"
      name={featherIconName(name)}
      size={24}
    />
  );
}

function featherIconName(name: PortalMobileNavIconName): ComponentProps<typeof Feather>['name'] {
  switch (name) {
    case 'activity':
      return 'clipboard';
    case 'attendance':
      return 'check-square';
    case 'behaviour':
      return 'star';
    case 'calendar':
      return 'calendar';
    case 'clubs':
    case 'students':
      return 'users';
    case 'community':
      return 'message-circle';
    case 'dashboard':
      return 'home';
    case 'faith':
    case 'pace':
      return 'book-open';
    case 'fees':
      return 'credit-card';
    case 'incidents':
      return 'shield';
    case 'leaderboard':
      return 'award';
    case 'markets':
      return 'trending-up';
    case 'messages':
      return 'message-square';
    case 'mobile':
      return 'smartphone';
    case 'more':
      return 'more-horizontal';
    case 'notices':
      return 'bell';
    case 'profile':
      return 'user';
    case 'reports':
    case 'slips':
      return 'file-text';
    case 'settings':
      return 'settings';
    case 'shop':
      return 'shopping-bag';
    case 'wallet':
      return 'dollar-sign';
  }
}

const styles = StyleSheet.create({
  iconPlaceholder: {
    height: 24,
    width: 24,
  },
});
