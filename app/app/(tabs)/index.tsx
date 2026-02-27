import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/auth';
import { colors, spacing, radius, fontSize, shadow } from '../../lib/theme';
import { Item, Notification, Warranty } from '../../lib/types';

interface Stats {
  totalItems: number;
  activeWarranties: number;
  expiringWarranties: number;
  unreadAlerts: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    activeWarranties: 0,
    expiringWarranties: 0,
    unreadAlerts: 0,
  });
  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const [
      { count: totalItems },
      { data: warranties },
      { count: unreadAlerts },
      { data: items },
      { data: notifications },
    ] = await Promise.all([
      supabase.from('items').select('*', { count: 'exact', head: true }),
      supabase.from('warranties').select('end_date, item_id'),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
      supabase.from('items').select('*').order('created_at', { ascending: false }).limit(3),
      supabase.from('notifications').select('*, items(id, name, brand), recalls(id, title, source)').order('created_at', { ascending: false }).limit(4),
    ]);

    const now = new Date(today);
    const soon = new Date(in30Days);
    const active = (warranties ?? []).filter(w => w.end_date && new Date(w.end_date) >= now);
    const expiring = active.filter(w => w.end_date && new Date(w.end_date) <= soon);

    setStats({
      totalItems: totalItems ?? 0,
      activeWarranties: active.length,
      expiringWarranties: expiring.length,
      unreadAlerts: unreadAlerts ?? 0,
    });
    setRecentItems(items ?? []);
    setRecentAlerts(notifications ?? []);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          <Text style={styles.subtitle}>Here's your protection overview</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/items/add')}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          emoji="📦"
          value={stats.totalItems}
          label="Items"
          color={colors.primary}
          onPress={() => router.push('/(tabs)/items')}
        />
        <StatCard
          emoji="📋"
          value={stats.activeWarranties}
          label="Warranties"
          color={colors.success}
          onPress={() => router.push('/(tabs)/items')}
        />
        <StatCard
          emoji="⚠️"
          value={stats.expiringWarranties}
          label="Expiring"
          color={colors.warning}
          onPress={() => router.push('/(tabs)/items')}
        />
        <StatCard
          emoji="🔔"
          value={stats.unreadAlerts}
          label="Alerts"
          color={colors.recall}
          onPress={() => router.push('/(tabs)/alerts')}
        />
      </View>

      {/* Recall Banner */}
      {stats.unreadAlerts > 0 && (
        <TouchableOpacity
          style={styles.recallBanner}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <Text style={styles.recallBannerIcon}>🚨</Text>
          <View style={styles.recallBannerText}>
            <Text style={styles.recallBannerTitle}>
              {stats.unreadAlerts} unread recall alert{stats.unreadAlerts > 1 ? 's' : ''}
            </Text>
            <Text style={styles.recallBannerSub}>Tap to view and take action</Text>
          </View>
          <Text style={styles.recallBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Recent Items */}
      <SectionHeader title="Recent Items" onPress={() => router.push('/(tabs)/items')} />
      {recentItems.length === 0 ? (
        <EmptyCard
          emoji="📦"
          message="No items yet"
          action="Add your first possession"
          onPress={() => router.push('/items/add')}
        />
      ) : (
        recentItems.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.itemRow}
            onPress={() => router.push(`/items/${item.id}`)}
          >
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>{categoryEmoji(item.category)}</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>
                {[item.brand, item.model].filter(Boolean).join(' · ') || 'No details'}
              </Text>
            </View>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        ))
      )}

      {/* Recent Alerts */}
      <SectionHeader title="Recent Alerts" onPress={() => router.push('/(tabs)/alerts')} />
      {recentAlerts.length === 0 ? (
        <EmptyCard
          emoji="✅"
          message="No alerts"
          action="All your items are safe"
        />
      ) : (
        recentAlerts.map(alert => (
          <View key={alert.id} style={[styles.alertRow, !alert.read_at && styles.alertRowUnread]}>
            <Text style={styles.alertSource}>{(alert.recalls as any)?.source ?? 'System'}</Text>
            <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
            <Text style={styles.alertTime}>{formatTime(alert.created_at)}</Text>
          </View>
        ))
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

/* ─── Sub-components ─────────────────────────────── */

function StatCard({ emoji, value, label, color, onPress }: {
  emoji: string; value: number; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.statCard, shadow.sm]} onPress={onPress}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onPress && (
        <TouchableOpacity onPress={onPress}>
          <Text style={styles.sectionLink}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyCard({ emoji, message, action, onPress }: {
  emoji: string; message: string; action: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.emptyCard}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      <Text style={styles.emptyAction}>{action}</Text>
    </TouchableOpacity>
  );
}

/* ─── Helpers ────────────────────────────────────── */

function categoryEmoji(cat: string | null) {
  const map: Record<string, string> = {
    Electronics: '📱', Appliances: '🏠', Vehicles: '🚗',
    Furniture: '🛋️', Toys: '🧸', 'Food & Beverage': '🥫',
    'Medical Devices': '💊', 'Clothing & Accessories': '👕',
    'Tools & Equipment': '🔧', Other: '📦',
  };
  return cat ? (map[cat] ?? '📦') : '📦';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

/* ─── Styles ─────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
  greeting: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.sm },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statEmoji: { fontSize: 24, marginBottom: spacing.xs },
  statValue: { fontSize: fontSize.xxl, fontWeight: '800' },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, fontWeight: '600' },

  recallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.recallBg,
    borderColor: colors.recallBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  recallBannerIcon: { fontSize: 24 },
  recallBannerText: { flex: 1 },
  recallBannerTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.recall },
  recallBannerSub: { fontSize: fontSize.sm, color: colors.recall, opacity: 0.8 },
  recallBannerArrow: { fontSize: 24, color: colors.recall, fontWeight: '300' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  sectionLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.sm,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconText: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  arrowText: { fontSize: 20, color: colors.textLight },

  alertRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  alertRowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.recall,
  },
  alertSource: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  alertMessage: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  alertTime: { fontSize: fontSize.xs, color: colors.textLight, marginTop: spacing.xs },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyEmoji: { fontSize: 32, marginBottom: spacing.sm },
  emptyMessage: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  emptyAction: { fontSize: fontSize.sm, color: colors.primary, marginTop: spacing.xs },
});
