import React from 'react';

export const Platform = {
  OS: 'ios',
  select: (obj: Record<string, any>) => obj.ios ?? obj.default,
  isTesting: true,
};

export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  flatten: (style: any) => style,
  hairlineWidth: 1,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const Alert = {
  alert: () => {},
};

export const Linking = {
  openURL: async () => {},
  canOpenURL: async () => true,
  getInitialURL: async () => null,
  addEventListener: () => ({ remove: () => {} }),
};

export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};

export const ActionSheetIOS = {
  showActionSheetWithOptions: () => {},
};

export const Animated = {
  Value: class {
    constructor(public val: number) {}
    setValue(v: number) { this.val = v; }
  },
  timing: () => ({ start: (cb?: () => void) => cb?.() }),
  spring: () => ({ start: (cb?: () => void) => cb?.() }),
};

export const View = ({ children, ...props }: any) => React.createElement('div', props, children);
export const Text = ({ children, ...props }: any) => React.createElement('span', props, children);
export const TouchableOpacity = ({ children, ...props }: any) => React.createElement('button', props, children);
export const TextInput = (props: any) => React.createElement('input', props);
export const ScrollView = ({ children, ...props }: any) => React.createElement('div', props, children);
export const FlatList = ({ data, renderItem }: any) => React.createElement('div', null, data?.map((item: any, index: number) => renderItem({ item, index })));
export const Image = (props: any) => React.createElement('img', props);
export const ActivityIndicator = () => React.createElement('div', null, 'loading');

export default {
  Platform,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  AppState,
  ActionSheetIOS,
  Animated,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
};
