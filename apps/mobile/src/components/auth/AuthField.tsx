import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, Lock, Mail, UserRound, type LucideIcon } from 'lucide-react-native';

const ICONS: Record<'mail' | 'lock' | 'user', LucideIcon> = { mail: Mail, lock: Lock, user: UserRound };

/**
 * A sign-in / sign-up field: an icon, a label, a soft glowing ring while focused, and — for passwords — an eye to
 * show what they typed (fewer wrong-password attempts on a phone keyboard).
 */
export const AuthField: React.FC<
  TextInputProps & { label: string; icon: 'mail' | 'lock' | 'user'; password?: boolean; accessory?: React.ReactNode }
> = ({ label, icon, password, accessory, onFocus, onBlur, ...input }) => {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const ring = useRef(new Animated.Value(0)).current;
  const animate = (to: number) => Animated.timing(ring, { toValue: to, duration: 160, useNativeDriver: false }).start();
  const Glyph = ICONS[icon];

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {accessory}
      </View>
      <Animated.View
        style={[
          styles.field,
          {
            borderColor: ring.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.08)', '#A78BFA'] }),
            backgroundColor: ring.interpolate({ inputRange: [0, 1], outputRange: ['#15111F', '#1A1428'] }),
          },
        ]}
      >
        <Glyph size={19} color={focused ? '#C4B5FD' : '#6B6680'} strokeWidth={1.9} />
        <TextInput
          {...input}
          style={styles.input}
          placeholderTextColor="#5E586F"
          selectionColor="#A78BFA"
          secureTextEntry={password && !visible}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            animate(1);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            animate(0);
            onBlur?.(e);
          }}
        />
        {password && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff size={19} color="#8E87A3" strokeWidth={1.9} /> : <Eye size={19} color="#8E87A3" strokeWidth={1.9} />}
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  group: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#B9B2CC', fontSize: 13.5, fontWeight: '700', letterSpacing: 0.2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16, paddingVertical: 14 },
});
