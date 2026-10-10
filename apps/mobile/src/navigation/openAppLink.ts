import { Linking } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from './types.js';

/**
 * Opens a link from a notification, campaign popup or banner.
 * companion://… goes to a screen inside the app; https://… opens the browser.
 *
 *   companion://chat/<characterId>      a chat
 *   companion://character/<slug>        a character's profile
 *   companion://paywall                 Premium
 *   companion://notifications           the inbox
 *   companion://home | messages | profile   a tab
 */
export function openAppLink(nav: NavigationContainerRefWithCurrent<RootStackParamList>, link: string | null | undefined): boolean {
  if (!link) return false;
  if (/^https?:\/\//i.test(link)) {
    Linking.openURL(link).catch(() => undefined);
    return true;
  }
  const m = /^companion:\/\/([^?#]*)/i.exec(link.trim());
  if (!m || !nav.isReady()) return false;
  const [screen = '', id] = m[1]!.split('/').filter(Boolean);
  switch (screen.toLowerCase()) {
    case 'chat':
      if (!id) return false;
      nav.navigate('Chat', { characterId: id });
      return true;
    case 'character':
    case 'c':
      if (!id) return false;
      nav.navigate('CharacterDetail', { characterSlug: id } as RootStackParamList['CharacterDetail']);
      return true;
    case 'paywall':
    case 'premium':
      nav.navigate('Paywall', {});
      return true;
    case 'notifications':
      nav.navigate('NotificationCenter');
      return true;
    case 'messages':
    case 'chats':
      nav.navigate('MainTabs', { screen: 'Conversations' });
      return true;
    case 'profile':
      nav.navigate('MainTabs', { screen: 'Profile' });
      return true;
    case 'home':
    case '':
      nav.navigate('MainTabs', { screen: 'Home' });
      return true;
    default:
      return false;
  }
}
