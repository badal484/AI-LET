import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { darkThemeColors } from '../../theme/index.js';

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
  | 'check-double';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  focused?: boolean;
  style?: ViewStyle;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = darkThemeColors.textPrimary,
  focused = false,
  style,
}) => {
  const iconColor = focused ? darkThemeColors.accent : color;

  const renderShape = () => {
    switch (name) {
      case 'bell': {
        const domeWidth = size * 0.58;
        const domeHeight = size * 0.52;
        const clapperSize = size * 0.2;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Top Loop */}
            <View
              style={{
                width: size * 0.16,
                height: size * 0.12,
                borderTopLeftRadius: size * 0.08,
                borderTopRightRadius: size * 0.08,
                borderWidth: 1.5,
                borderColor: iconColor,
                borderBottomWidth: 0,
                marginBottom: -1,
              }}
            />
            {/* Bell Dome */}
            <View
              style={{
                width: domeWidth,
                height: domeHeight,
                borderTopLeftRadius: domeWidth * 0.5,
                borderTopRightRadius: domeWidth * 0.5,
                borderBottomLeftRadius: 2,
                borderBottomRightRadius: 2,
                borderWidth: 1.8,
                borderColor: iconColor,
                backgroundColor: focused ? `${iconColor}33` : 'transparent',
              }}
            />
            {/* Base Lip */}
            <View
              style={{
                width: domeWidth + 4,
                height: 2,
                borderRadius: 1,
                backgroundColor: iconColor,
                marginTop: -1,
              }}
            />
            {/* Clapper */}
            <View
              style={{
                width: clapperSize,
                height: clapperSize * 0.65,
                borderBottomLeftRadius: clapperSize * 0.5,
                borderBottomRightRadius: clapperSize * 0.5,
                backgroundColor: iconColor,
                marginTop: 1,
              }}
            />
          </View>
        );
      }

      case 'search': {
        const ringSize = size * 0.54;
        const handleLength = size * 0.36;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Magnifier Glass Ring */}
            <View
              style={{
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize * 0.5,
                borderWidth: 2,
                borderColor: iconColor,
                backgroundColor: focused ? `${iconColor}22` : 'transparent',
                position: 'absolute',
                top: size * 0.1,
                left: size * 0.12,
              }}
            />
            {/* Handle */}
            <View
              style={{
                width: 2.2,
                height: handleLength,
                backgroundColor: iconColor,
                borderRadius: 1.5,
                position: 'absolute',
                bottom: size * 0.12,
                right: size * 0.18,
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        );
      }

      case 'home': {
        const roofSize = size * 0.52;
        const bodyWidth = size * 0.52;
        const bodyHeight = size * 0.44;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Roof Peak */}
            <View
              style={{
                width: roofSize,
                height: roofSize,
                borderTopWidth: 2,
                borderLeftWidth: 2,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                position: 'absolute',
                top: size * 0.15,
                backgroundColor: focused ? `${iconColor}33` : 'transparent',
              }}
            />
            {/* House Body */}
            <View
              style={{
                width: bodyWidth,
                height: bodyHeight,
                borderWidth: 2,
                borderColor: iconColor,
                borderTopWidth: 0,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
                position: 'absolute',
                bottom: size * 0.12,
                alignItems: 'center',
                justifyContent: 'flex-end',
                backgroundColor: focused ? `${iconColor}22` : 'transparent',
              }}
            >
              {/* Door */}
              <View
                style={{
                  width: size * 0.18,
                  height: size * 0.22,
                  borderTopLeftRadius: size * 0.09,
                  borderTopRightRadius: size * 0.09,
                  backgroundColor: iconColor,
                }}
              />
            </View>
          </View>
        );
      }

      case 'compass': {
        const outerSize = size * 0.76;
        const needleSize = size * 0.38;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Outer Circle */}
            <View
              style={{
                width: outerSize,
                height: outerSize,
                borderRadius: outerSize * 0.5,
                borderWidth: 1.8,
                borderColor: iconColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Diamond Needle */}
              <View
                style={{
                  width: needleSize,
                  height: needleSize,
                  borderTopWidth: needleSize * 0.5,
                  borderLeftWidth: needleSize * 0.5,
                  borderRightWidth: needleSize * 0.5,
                  borderBottomWidth: needleSize * 0.5,
                  borderTopColor: iconColor,
                  borderLeftColor: `${iconColor}55`,
                  borderRightColor: `${iconColor}55`,
                  borderBottomColor: 'transparent',
                  transform: [{ rotate: '45deg' }],
                }}
              />
            </View>
          </View>
        );
      }

      case 'chat': {
        const bubbleWidth = size * 0.72;
        const bubbleHeight = size * 0.54;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Chat Bubble Body */}
            <View
              style={{
                width: bubbleWidth,
                height: bubbleHeight,
                borderRadius: bubbleHeight * 0.4,
                borderWidth: 1.8,
                borderColor: iconColor,
                backgroundColor: focused ? `${iconColor}33` : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2.5,
              }}
            >
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: iconColor }} />
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: iconColor }} />
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: iconColor }} />
            </View>
            {/* Speech Tail */}
            <View
              style={{
                position: 'absolute',
                bottom: size * 0.12,
                left: size * 0.22,
                width: 0,
                height: 0,
                borderLeftWidth: 4,
                borderRightWidth: 4,
                borderTopWidth: 5,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: iconColor,
                transform: [{ rotate: '40deg' }],
              }}
            />
          </View>
        );
      }

      case 'user': {
        const headSize = size * 0.32;
        const shoulderWidth = size * 0.64;
        const shoulderHeight = size * 0.28;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Head */}
            <View
              style={{
                width: headSize,
                height: headSize,
                borderRadius: headSize * 0.5,
                borderWidth: 1.8,
                borderColor: iconColor,
                backgroundColor: focused ? iconColor : 'transparent',
                marginBottom: 2,
              }}
            />
            {/* Shoulders */}
            <View
              style={{
                width: shoulderWidth,
                height: shoulderHeight,
                borderTopLeftRadius: shoulderWidth * 0.5,
                borderTopRightRadius: shoulderWidth * 0.5,
                borderWidth: 1.8,
                borderColor: iconColor,
                borderBottomWidth: 0,
                backgroundColor: focused ? `${iconColor}33` : 'transparent',
              }}
            />
          </View>
        );
      }

      case 'heart':
      case 'heart-filled': {
        const isFilled = name === 'heart-filled' || focused;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.4,
                height: size * 0.6,
                borderTopLeftRadius: size * 0.2,
                borderTopRightRadius: size * 0.2,
                backgroundColor: isFilled ? '#ef4444' : 'transparent',
                borderWidth: isFilled ? 0 : 1.8,
                borderColor: '#ef4444',
                position: 'absolute',
                left: size * 0.2,
                top: size * 0.16,
                transform: [{ rotate: '-45deg' }],
              }}
            />
            <View
              style={{
                width: size * 0.4,
                height: size * 0.6,
                borderTopLeftRadius: size * 0.2,
                borderTopRightRadius: size * 0.2,
                backgroundColor: isFilled ? '#ef4444' : 'transparent',
                borderWidth: isFilled ? 0 : 1.8,
                borderColor: '#ef4444',
                position: 'absolute',
                right: size * 0.2,
                top: size * 0.16,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'voice':
      case 'mic': {
        const capsuleWidth = size * 0.28;
        const capsuleHeight = size * 0.46;
        const arcWidth = size * 0.52;
        const arcHeight = size * 0.32;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Capsule */}
            <View
              style={{
                width: capsuleWidth,
                height: capsuleHeight,
                borderRadius: capsuleWidth * 0.5,
                backgroundColor: iconColor,
                marginBottom: -arcHeight * 0.5,
                zIndex: 2,
              }}
            />
            {/* Arc */}
            <View
              style={{
                width: arcWidth,
                height: arcHeight,
                borderBottomLeftRadius: arcWidth * 0.5,
                borderBottomRightRadius: arcWidth * 0.5,
                borderWidth: 1.8,
                borderColor: iconColor,
                borderTopWidth: 0,
                zIndex: 1,
              }}
            />
            {/* Stand Stem */}
            <View
              style={{
                width: 1.8,
                height: size * 0.14,
                backgroundColor: iconColor,
              }}
            />
            {/* Stand Base */}
            <View
              style={{
                width: size * 0.36,
                height: 1.8,
                borderRadius: 1,
                backgroundColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'phone': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.6,
                height: size * 0.6,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: iconColor,
                borderTopRightRadius: size * 0.3,
                transform: [{ rotate: '-35deg' }],
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: size * 0.25,
                  height: size * 0.25,
                  borderRadius: size * 0.12,
                  borderWidth: 1.5,
                  borderColor: iconColor,
                }}
              />
            </View>
          </View>
        );
      }

      case 'close': {
        const barLength = size * 0.6;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: barLength,
                height: 2,
                borderRadius: 1,
                backgroundColor: iconColor,
                transform: [{ rotate: '45deg' }],
                position: 'absolute',
              }}
            />
            <View
              style={{
                width: barLength,
                height: 2,
                borderRadius: 1,
                backgroundColor: iconColor,
                transform: [{ rotate: '-45deg' }],
                position: 'absolute',
              }}
            />
          </View>
        );
      }

      case 'arrow-left': {
        const chevronSize = size * 0.36;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: chevronSize,
                height: chevronSize,
                borderLeftWidth: 2.4,
                borderBottomWidth: 2.4,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                marginLeft: size * 0.08,
              }}
            />
          </View>
        );
      }

      case 'arrow-up':
      case 'send': {
        const stemHeight = size * 0.44;
        const arrowHead = size * 0.28;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: arrowHead,
                height: arrowHead,
                borderTopWidth: 2.2,
                borderLeftWidth: 2.2,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                marginBottom: -arrowHead * 0.4,
              }}
            />
            <View
              style={{
                width: 2.2,
                height: stemHeight,
                backgroundColor: iconColor,
                borderRadius: 1,
              }}
            />
          </View>
        );
      }

      case 'sparkles': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Primary Diamond */}
            <View
              style={{
                width: size * 0.4,
                height: size * 0.4,
                borderRadius: 2,
                backgroundColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
            {/* Small Side Sparkle */}
            <View
              style={{
                width: size * 0.18,
                height: size * 0.18,
                borderRadius: 1,
                backgroundColor: iconColor,
                position: 'absolute',
                top: size * 0.12,
                right: size * 0.12,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'diamond': {
        const topWidth = size * 0.7;
        const topHeight = size * 0.25;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Upper Facets */}
            <View
              style={{
                width: topWidth,
                height: topHeight,
                borderWidth: 1.8,
                borderColor: iconColor,
                borderBottomWidth: 0,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                backgroundColor: focused ? `${iconColor}33` : 'transparent',
                flexDirection: 'row',
                justifyContent: 'space-around',
                alignItems: 'center',
              }}
            >
              <View style={{ width: 1.5, height: '100%', backgroundColor: iconColor }} />
              <View style={{ width: 1.5, height: '100%', backgroundColor: iconColor }} />
            </View>
            {/* Lower V-point */}
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: topWidth * 0.5,
                borderRightWidth: topWidth * 0.5,
                borderTopWidth: size * 0.45,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: iconColor,
                marginTop: -1,
                alignItems: 'center',
              }}
            />
          </View>
        );
      }

      case 'settings': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.65,
                height: size * 0.65,
                borderRadius: size * 0.32,
                borderWidth: 2,
                borderColor: iconColor,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: size * 0.24,
                  height: size * 0.24,
                  borderRadius: size * 0.12,
                  backgroundColor: iconColor,
                }}
              />
            </View>
          </View>
        );
      }

      case 'warning': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: size * 0.34,
                borderRightWidth: size * 0.34,
                borderBottomWidth: size * 0.6,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderBottomColor: '#f59e0b',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <View
                style={{
                  width: 2,
                  height: size * 0.18,
                  backgroundColor: '#000000',
                  position: 'absolute',
                  top: size * 0.22,
                }}
              />
              <View
                style={{
                  width: 2.4,
                  height: 2.4,
                  borderRadius: 1.2,
                  backgroundColor: '#000000',
                  position: 'absolute',
                  top: size * 0.44,
                }}
              />
            </View>
          </View>
        );
      }

      case 'flag': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: 2,
                height: size * 0.65,
                backgroundColor: iconColor,
                position: 'absolute',
                left: size * 0.25,
              }}
            />
            <View
              style={{
                width: size * 0.42,
                height: size * 0.32,
                borderTopRightRadius: 2,
                borderBottomRightRadius: 2,
                backgroundColor: iconColor,
                position: 'absolute',
                left: size * 0.25 + 2,
                top: size * 0.18,
              }}
            />
          </View>
        );
      }

      case 'trash': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Lid */}
            <View
              style={{
                width: size * 0.52,
                height: 2,
                backgroundColor: iconColor,
                marginBottom: 2,
              }}
            />
            {/* Can */}
            <View
              style={{
                width: size * 0.42,
                height: size * 0.44,
                borderWidth: 1.8,
                borderColor: iconColor,
                borderTopWidth: 0,
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
              }}
            />
          </View>
        );
      }

      case 'check': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.28,
                height: size * 0.5,
                borderBottomWidth: 2.4,
                borderRightWidth: 2.4,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                marginBottom: size * 0.1,
              }}
            />
          </View>
        );
      }

      case 'plus': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View style={{ width: size * 0.56, height: 2, backgroundColor: iconColor, position: 'absolute' }} />
            <View style={{ width: 2, height: size * 0.56, backgroundColor: iconColor, position: 'absolute' }} />
          </View>
        );
      }

      case 'more': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size, flexDirection: 'row', gap: 3 }]}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: iconColor }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: iconColor }} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: iconColor }} />
          </View>
        );
      }

      case 'more-vertical': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size, flexDirection: 'column', gap: 3 }]}>
            <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: iconColor }} />
            <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: iconColor }} />
            <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: iconColor }} />
          </View>
        );
      }

      case 'chevron-down-double': {
        const chevronSize = size * 0.28;
        return (
          <View style={[styles.centerContainer, { width: size, height: size, justifyContent: 'center' }]}>
            <View
              style={{
                width: chevronSize,
                height: chevronSize,
                borderBottomWidth: 2,
                borderRightWidth: 2,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                marginBottom: -3,
              }}
            />
            <View
              style={{
                width: chevronSize,
                height: chevronSize,
                borderBottomWidth: 2,
                borderRightWidth: 2,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'check-double': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
            <View
              style={{
                width: size * 0.22,
                height: size * 0.42,
                borderBottomWidth: 1.8,
                borderRightWidth: 1.8,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                marginRight: -size * 0.08,
              }}
            />
            <View
              style={{
                width: size * 0.22,
                height: size * 0.42,
                borderBottomWidth: 1.8,
                borderRightWidth: 1.8,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'gift': {
        const boxWidth = size * 0.58;
        const boxHeight = size * 0.42;
        const lidWidth = size * 0.68;
        const lidHeight = size * 0.14;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View style={{ flexDirection: 'row', gap: 2, marginBottom: -1 }}>
              <View style={{ width: size * 0.18, height: size * 0.14, borderRadius: size * 0.08, borderWidth: 1.5, borderColor: iconColor }} />
              <View style={{ width: size * 0.18, height: size * 0.14, borderRadius: size * 0.08, borderWidth: 1.5, borderColor: iconColor }} />
            </View>
            <View style={{ width: lidWidth, height: lidHeight, backgroundColor: iconColor, borderRadius: 2 }} />
            <View style={{ width: boxWidth, height: boxHeight, borderWidth: 1.5, borderColor: iconColor, borderTopWidth: 0, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: 'center' }}>
              <View style={{ width: 2, height: '100%', backgroundColor: iconColor }} />
            </View>
          </View>
        );
      }

      case 'arrow-right': {
        const chevronSize = size * 0.36;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: chevronSize,
                height: chevronSize,
                borderRightWidth: 2.4,
                borderTopWidth: 2.4,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
                marginRight: size * 0.08,
              }}
            />
          </View>
        );
      }

      case 'lock': {
        const bodyWidth = size * 0.52;
        const bodyHeight = size * 0.38;
        const shackleSize = size * 0.34;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            {/* Shackle */}
            <View
              style={{
                width: shackleSize,
                height: shackleSize,
                borderTopLeftRadius: shackleSize * 0.5,
                borderTopRightRadius: shackleSize * 0.5,
                borderWidth: 2,
                borderColor: iconColor,
                borderBottomWidth: 0,
                marginBottom: -2,
              }}
            />
            {/* Body */}
            <View
              style={{
                width: bodyWidth,
                height: bodyHeight,
                borderRadius: 3,
                backgroundColor: iconColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 2.5,
                  height: 4,
                  backgroundColor: '#121212',
                  borderRadius: 1,
                }}
              />
            </View>
          </View>
        );
      }

      case 'share': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: iconColor, position: 'absolute', right: size * 0.18, top: size * 0.18 }} />
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: iconColor, position: 'absolute', left: size * 0.18, top: size * 0.44 }} />
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: iconColor, position: 'absolute', right: size * 0.18, bottom: size * 0.18 }} />
            {/* Lines */}
            <View
              style={{
                width: size * 0.42,
                height: 1.5,
                backgroundColor: iconColor,
                position: 'absolute',
                top: size * 0.34,
                left: size * 0.28,
                transform: [{ rotate: '-28deg' }],
              }}
            />
            <View
              style={{
                width: size * 0.42,
                height: 1.5,
                backgroundColor: iconColor,
                position: 'absolute',
                bottom: size * 0.34,
                left: size * 0.28,
                transform: [{ rotate: '28deg' }],
              }}
            />
          </View>
        );
      }

      case 'shield': {
        const shieldWidth = size * 0.58;
        const shieldHeight = size * 0.65;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: shieldWidth,
                height: shieldHeight,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                borderBottomLeftRadius: shieldWidth * 0.5,
                borderBottomRightRadius: shieldWidth * 0.5,
                borderWidth: 1.8,
                borderColor: iconColor,
                backgroundColor: focused ? `${iconColor}33` : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 2,
                  height: shieldHeight * 0.4,
                  backgroundColor: iconColor,
                }}
              />
            </View>
          </View>
        );
      }

      case 'brain': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size, flexDirection: 'row', gap: 2 }]}>
            {/* Left Hemisphere */}
            <View
              style={{
                width: size * 0.28,
                height: size * 0.58,
                borderTopLeftRadius: size * 0.18,
                borderBottomLeftRadius: size * 0.18,
                borderTopRightRadius: size * 0.08,
                borderBottomRightRadius: size * 0.08,
                borderWidth: 1.8,
                borderColor: iconColor,
              }}
            />
            {/* Right Hemisphere */}
            <View
              style={{
                width: size * 0.28,
                height: size * 0.58,
                borderTopRightRadius: size * 0.18,
                borderBottomRightRadius: size * 0.18,
                borderTopLeftRadius: size * 0.08,
                borderBottomLeftRadius: size * 0.08,
                borderWidth: 1.8,
                borderColor: iconColor,
              }}
            />
          </View>
        );
      }

      case 'book': {
        const pageW = size * 0.28;
        const pageH = size * 0.52;
        return (
          <View style={[styles.centerContainer, { width: size, height: size, flexDirection: 'row', gap: 2 }]}>
            <View
              style={{
                width: pageW,
                height: pageH,
                borderWidth: 1.8,
                borderColor: iconColor,
                borderRightWidth: 0.8,
                borderTopLeftRadius: 2,
                borderBottomLeftRadius: 2,
              }}
            />
            <View
              style={{
                width: pageW,
                height: pageH,
                borderWidth: 1.8,
                borderColor: iconColor,
                borderLeftWidth: 0.8,
                borderTopRightRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
          </View>
        );
      }

      case 'palette': {
        const palSize = size * 0.62;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: palSize,
                height: palSize * 0.85,
                borderRadius: palSize * 0.42,
                borderWidth: 1.8,
                borderColor: iconColor,
                position: 'relative',
              }}
            >
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: iconColor, position: 'absolute', top: 3, left: 6 }} />
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: iconColor, position: 'absolute', top: 3, right: 6 }} />
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: iconColor, position: 'absolute', bottom: 4, left: 8 }} />
            </View>
          </View>
        );
      }

      case 'moon': {
        const moonSize = size * 0.6;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: moonSize,
                height: moonSize,
                borderRadius: moonSize * 0.5,
                borderWidth: 2,
                borderColor: iconColor,
                borderRightColor: 'transparent',
                borderBottomColor: 'transparent',
                transform: [{ rotate: '-45deg' }],
              }}
            />
          </View>
        );
      }

      case 'coffee': {
        const cupW = size * 0.46;
        const cupH = size * 0.42;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: cupW,
                  height: cupH,
                  borderWidth: 1.8,
                  borderColor: iconColor,
                  borderBottomLeftRadius: cupW * 0.35,
                  borderBottomRightRadius: cupW * 0.35,
                }}
              />
              <View
                style={{
                  width: size * 0.16,
                  height: size * 0.24,
                  borderWidth: 1.8,
                  borderColor: iconColor,
                  borderLeftWidth: 0,
                  borderTopRightRadius: size * 0.1,
                  borderBottomRightRadius: size * 0.1,
                }}
              />
            </View>
          </View>
        );
      }

      case 'zap': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.32,
                height: size * 0.34,
                borderLeftWidth: 2,
                borderBottomWidth: 2,
                borderColor: iconColor,
                transform: [{ skewX: '-20deg' }],
                marginBottom: -3,
              }}
            />
            <View
              style={{
                width: size * 0.32,
                height: size * 0.34,
                borderRightWidth: 2,
                borderTopWidth: 2,
                borderColor: iconColor,
                transform: [{ skewX: '-20deg' }],
              }}
            />
          </View>
        );
      }

      case 'ban': {
        const banSize = size * 0.62;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: banSize,
                height: banSize,
                borderRadius: banSize * 0.5,
                borderWidth: 2,
                borderColor: iconColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: banSize * 0.88,
                  height: 2,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '45deg' }],
                }}
              />
            </View>
          </View>
        );
      }

      case 'star': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.44,
                height: size * 0.44,
                borderRadius: 2,
                borderWidth: 1.8,
                borderColor: iconColor,
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'mic-off': {
        const capsuleWidth = size * 0.28;
        const capsuleHeight = size * 0.46;
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: capsuleWidth,
                height: capsuleHeight,
                borderRadius: capsuleWidth * 0.5,
                borderWidth: 1.8,
                borderColor: iconColor,
              }}
            />
            {/* Slash */}
            <View
              style={{
                width: size * 0.65,
                height: 2,
                backgroundColor: '#ef4444',
                position: 'absolute',
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'speaker':
      case 'speaker-off': {
        const isOff = name === 'speaker-off';
        return (
          <View style={[styles.centerContainer, { width: size, height: size, flexDirection: 'row', alignItems: 'center' }]}>
            {/* Speaker Cone */}
            <View
              style={{
                width: size * 0.22,
                height: size * 0.28,
                backgroundColor: iconColor,
                borderTopLeftRadius: 2,
                borderBottomLeftRadius: 2,
              }}
            />
            <View
              style={{
                width: 0,
                height: 0,
                borderTopWidth: size * 0.22,
                borderBottomWidth: size * 0.22,
                borderRightWidth: size * 0.24,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderRightColor: iconColor,
              }}
            />
            {isOff ? (
              <View
                style={{
                  width: size * 0.4,
                  height: 2,
                  backgroundColor: '#ef4444',
                  position: 'absolute',
                  transform: [{ rotate: '45deg' }],
                }}
              />
            ) : (
              <View
                style={{
                  width: size * 0.2,
                  height: size * 0.36,
                  borderRightWidth: 2,
                  borderTopRightRadius: size * 0.18,
                  borderBottomRightRadius: size * 0.18,
                  borderColor: iconColor,
                  marginLeft: 3,
                }}
              />
            )}
          </View>
        );
      }

      case 'phone-off': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.6,
                height: size * 0.6,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: '#ef4444',
                borderTopRightRadius: size * 0.3,
                transform: [{ rotate: '-35deg' }],
                justifyContent: 'center',
                alignItems: 'center',
              }}
            />
            <View
              style={{
                width: size * 0.7,
                height: 2,
                backgroundColor: '#ef4444',
                position: 'absolute',
                transform: [{ rotate: '45deg' }],
              }}
            />
          </View>
        );
      }

      case 'thumbs-up': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size }]}>
            <View
              style={{
                width: size * 0.22,
                height: size * 0.38,
                borderRadius: 2,
                borderWidth: 1.5,
                borderColor: iconColor,
                position: 'absolute',
                left: size * 0.1,
                bottom: size * 0.16,
              }}
            />
            <View
              style={{
                width: size * 0.44,
                height: size * 0.38,
                borderTopRightRadius: size * 0.18,
                borderBottomRightRadius: size * 0.14,
                borderWidth: 1.5,
                borderColor: iconColor,
                position: 'absolute',
                left: size * 0.36,
                bottom: size * 0.16,
              }}
            />
            <View
              style={{
                width: size * 0.18,
                height: size * 0.35,
                borderTopLeftRadius: size * 0.1,
                borderTopRightRadius: size * 0.1,
                borderWidth: 1.5,
                borderColor: iconColor,
                borderBottomWidth: 0,
                position: 'absolute',
                left: size * 0.36,
                top: size * 0.12,
                transform: [{ rotate: '-15deg' }],
              }}
            />
          </View>
        );
      }

      case 'thumbs-down': {
        return (
          <View style={[styles.centerContainer, { width: size, height: size, transform: [{ rotate: '180deg' }] }]}>
            <View
              style={{
                width: size * 0.22,
                height: size * 0.38,
                borderRadius: 2,
                borderWidth: 1.5,
                borderColor: iconColor,
                position: 'absolute',
                left: size * 0.1,
                bottom: size * 0.16,
              }}
            />
            <View
              style={{
                width: size * 0.44,
                height: size * 0.38,
                borderTopRightRadius: size * 0.18,
                borderBottomRightRadius: size * 0.14,
                borderWidth: 1.5,
                borderColor: iconColor,
                position: 'absolute',
                left: size * 0.36,
                bottom: size * 0.16,
              }}
            />
            <View
              style={{
                width: size * 0.18,
                height: size * 0.35,
                borderTopLeftRadius: size * 0.1,
                borderTopRightRadius: size * 0.1,
                borderWidth: 1.5,
                borderColor: iconColor,
                borderBottomWidth: 0,
                position: 'absolute',
                left: size * 0.36,
                top: size * 0.12,
                transform: [{ rotate: '-15deg' }],
              }}
            />
          </View>
        );
      }

      default:
        return (
          <View
            style={{
              width: size * 0.5,
              height: size * 0.5,
              borderRadius: size * 0.25,
              borderWidth: 1.5,
              borderColor: iconColor,
            }}
          />
        );
    }
  };

  return <View style={[styles.container, { width: size, height: size }, style]}>{renderShape()}</View>;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});
