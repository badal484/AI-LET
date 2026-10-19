import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '../../services/api/client.js';
import { ChatBackdrop } from '../chat/ChatBackdrop.js';
import { useReduceMotion } from '../../utils/motion.js';

const LOGO = require('../../assets/brand/logo.png');

/**
 * The top of sign-in / sign-up: the logo, what Loveek is, and a row of real character faces — the first thing a
 * new user sees should be the people they can talk to, not an empty form. Fades in; nothing moves when the phone
 * asks for reduced motion. Faces come from the public character list (no sign-in needed); without it the row hides.
 */
export const AuthHero: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const reduceMotion = useReduceMotion();
  // Public list, fetched without the session token: right after signing out the old token is already revoked,
  // and the normal client would send it (and get a 401) — the faces row then never appeared.
  const { data } = useQuery({
    queryKey: ['auth-faces'],
    queryFn: async () => {
      const res = await fetch(`${ApiClient.getBaseUrl()}/characters?limit=6`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`faces ${res.status}`);
      return (await res.json()) as { data: Array<{ id: string; avatarUrl?: string | null }>; meta?: { total?: number } };
    },
    staleTime: 60 * 60_000,
    retry: 2,
  });
  const faces = (data?.data ?? []).filter((c) => c.avatarUrl).slice(0, 5);
  const total = data?.meta?.total;

  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 6 }).start();
  }, [enter, reduceMotion]);

  return (
    <View style={styles.wrap}>
      <ChatBackdrop />
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        }}
      >
        <View style={styles.logoGlow}>
          <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
        </View>
        <Text style={styles.wordmark}>Loveek</Text>

        {faces.length > 0 && (
          <View style={styles.facesRow} accessibilityLabel={`${total ?? faces.length} people to talk to`}>
            {faces.map((c, i) => (
              <Image key={c.id} source={{ uri: c.avatarUrl! }} style={[styles.face, { marginLeft: i === 0 ? 0 : -12, zIndex: 10 - i }]} />
            ))}
            <Text style={styles.facesText}>{total ? `${total} people who remember you` : 'People who remember you'}</Text>
          </View>
        )}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 36, paddingBottom: 8 },
  logoGlow: {
    width: 76,
    height: 76,
    borderRadius: 38,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
  },
  logo: { width: 76, height: 76, borderRadius: 38 },
  wordmark: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginTop: 12 },
  facesRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, paddingHorizontal: 8 },
  face: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#0A0812' },
  facesText: { color: '#C9C2DA', fontSize: 13, fontWeight: '600', marginLeft: 10, flexShrink: 1 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 26, textAlign: 'center' },
  subtitle: { color: '#9E97B0', fontSize: 14.5, lineHeight: 21, marginTop: 6, textAlign: 'center', paddingHorizontal: 12 },
});
