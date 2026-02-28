import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, fontSize, shadow } from '../lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🛡️',
    title: 'Welcome to WarrantyApp',
    body: 'Your personal possession register. Track everything you own, store warranties, and stay ahead of safety recalls — all in one place.',
    bg: '#EFF6FF',
  },
  {
    emoji: '📦',
    title: 'Register Your Items',
    body: 'Scan a barcode or type in any possession — from appliances and electronics to vehicles and toys. Takes just seconds.',
    bg: '#F0FDF4',
  },
  {
    emoji: '📋',
    title: 'Store Your Warranties',
    body: 'Add warranty start and end dates to any item. We\'ll send you a push notification before your warranty expires so you can act in time.',
    bg: '#FFFBEB',
  },
  {
    emoji: '🚨',
    title: 'Instant Recall Alerts',
    body: 'We check CPSC, FDA, USDA, and NHTSA every 6 hours. If anything you own is recalled, you\'ll know before anyone else.',
    bg: '#FEF2F2',
  },
  {
    emoji: '🔄',
    title: 'Transfer Ownership',
    body: 'Selling or giving away an item? Transfer it to any WarrantyApp user and the full warranty and recall history goes with it.',
    bg: '#F5F3FF',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_W, animated: true });
    setPage(index);
  };

  const handleScroll = (e: any) => {
    const newPage = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setPage(newPage);
  };

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', '1');
    router.replace('/(tabs)');
  };

  const isLast = page === SLIDES.length - 1;
  const slide = SLIDES[page];

  return (
    <View style={[styles.container, { backgroundColor: slide.bg }]}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width: SCREEN_W, backgroundColor: s.bg }]}>
            <Text style={styles.slideEmoji}>{s.emoji}</Text>
            <Text style={styles.slideTitle}>{s.title}</Text>
            <Text style={styles.slideBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => goTo(i)}>
            <View style={[styles.dot, i === page && styles.dotActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        {isLast ? (
          <TouchableOpacity style={styles.getStartedBtn} onPress={finish}>
            <Text style={styles.getStartedText}>Get Started 🚀</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={() => goTo(page + 1)}>
            <Text style={styles.nextText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  skipBtn: {
    position: 'absolute',
    top: 56,
    right: spacing.lg,
    zIndex: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  skipText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },

  scrollView: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    paddingBottom: 40,
  },
  slideEmoji: { fontSize: 80, marginBottom: spacing.xl },
  slideTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 34,
  },
  slideBody: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
  },
  getStartedBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    ...shadow.md,
  },
  getStartedText: { color: colors.textInverse, fontSize: fontSize.lg, fontWeight: '800' },
  nextBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: '700' },
});
