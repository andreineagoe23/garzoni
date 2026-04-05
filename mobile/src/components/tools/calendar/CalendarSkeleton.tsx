import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../../theme/ThemeContext';
import { spacing, radius } from '../../../theme/tokens';

function Shimmer({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]} />;
}

export function CalendarSkeleton() {
  const c = useThemeColors();
  const bg = c.surfaceOffset;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {[0, 1, 2].map((group) => (
        <View key={group} style={styles.group}>
          <Shimmer style={[styles.dateBar, { backgroundColor: bg }]} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Shimmer style={[styles.smBar, { backgroundColor: bg }]} />
                  <Shimmer style={[styles.lgBar, { backgroundColor: bg }]} />
                </View>
                <Shimmer style={[styles.badge, { backgroundColor: bg }]} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  group: { gap: spacing.sm },
  dateBar: { height: 12, width: 100, borderRadius: 6 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { gap: spacing.xs, flex: 1 },
  smBar: { height: 10, width: '40%', borderRadius: 5 },
  lgBar: { height: 14, width: '70%', borderRadius: 5 },
  badge: { height: 22, width: 48, borderRadius: 11 },
});
