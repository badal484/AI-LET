import React from 'react';
import { View, ViewStyle } from 'react-native';
import {
  ArrowRight,
  ArrowUp,
  AudioLines,
  Ban,
  Bell,
  BookOpen,
  Brain,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronsDown,
  Coffee,
  Compass,
  Copy,
  Crown,
  Ellipsis,
  EllipsisVertical,
  Flag,
  Gift,
  Heart,
  House,
  Lock,
  MessageCircleHeart,
  Mic,
  MicOff,
  Moon,
  Palette,
  Phone,
  PhoneOff,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash,
  TriangleAlert,
  UserRound,
  Volume2,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { darkThemeColors } from '../../theme/index.js';

/**
 * The app's icons: Lucide (open-source, ISC licence), drawn as vectors with react-native-svg — crisp at every
 * size and on every screen. The names stay the app's own, so screens never import Lucide directly.
 * `focused` (an active tab) draws a slightly bolder outline with a soft fill.
 */
export type IconName =
  | 'bell'
  | 'search'
  | 'home'
  | 'compass'
  | 'chat'
  | 'user'
  | 'heart'
  | 'heart-filled'
  | 'voice'
  | 'mic'
  | 'mic-off'
  | 'speaker'
  | 'speaker-off'
  | 'phone'
  | 'phone-off'
  | 'close'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-right'
  | 'send'
  | 'settings'
  | 'warning'
  | 'flag'
  | 'sparkles'
  | 'trash'
  | 'check'
  | 'plus'
  | 'more'
  | 'lock'
  | 'share'
  | 'shield'
  | 'brain'
  | 'book'
  | 'palette'
  | 'moon'
  | 'coffee'
  | 'zap'
  | 'ban'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'star'
  | 'gift'
  | 'diamond'
  | 'more-vertical'
  | 'chevron-down-double'
  | 'check-double'
  | 'copy';

const ICONS: Record<IconName, LucideIcon> = {
  bell: Bell,
  search: Search,
  home: House,
  compass: Compass,
  chat: MessageCircleHeart,
  user: UserRound,
  heart: Heart,
  'heart-filled': Heart,
  voice: AudioLines,
  mic: Mic,
  'mic-off': MicOff,
  speaker: Volume2,
  'speaker-off': VolumeX,
  phone: Phone,
  'phone-off': PhoneOff,
  close: X,
  'arrow-left': ChevronLeft,
  'arrow-up': ArrowUp,
  'arrow-right': ArrowRight,
  send: SendHorizontal,
  settings: Settings,
  warning: TriangleAlert,
  flag: Flag,
  sparkles: Sparkles,
  trash: Trash,
  check: Check,
  plus: Plus,
  more: Ellipsis,
  lock: Lock,
  share: Share2,
  shield: Shield,
  brain: Brain,
  book: BookOpen,
  palette: Palette,
  moon: Moon,
  coffee: Coffee,
  zap: Zap,
  ban: Ban,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  star: Star,
  gift: Gift,
  // "Premium" (the Buy Pro tab): a crown reads as premium better than a gem.
  diamond: Crown,
  'more-vertical': EllipsisVertical,
  'chevron-down-double': ChevronsDown,
  'check-double': CheckCheck,
  copy: Copy,
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  focused?: boolean;
  style?: ViewStyle;
}

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = darkThemeColors.textPrimary, focused = false, style }) => {
  const Glyph = ICONS[name] ?? Sparkles;
  const solid = name === 'heart-filled';
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      <Glyph
        size={size}
        color={color}
        strokeWidth={focused ? 2.3 : 1.9}
        fill={solid || focused ? color : 'none'}
        fillOpacity={solid ? 1 : focused ? 0.18 : 0}
      />
    </View>
  );
};
