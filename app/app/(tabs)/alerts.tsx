import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, fontSize, shadow } from '../../lib/theme';
import { Notification } from '../../lib/types';

const SOURCE_COLORS: Record<string, string> = {
  CPSC: '#7C3AED',
  NHTSA: '#0369A1',
  FDA: '#0F766E',
  USDA: '#15803D',
  EPA: '#166534',
  System: '#64748B',
};

export default function AlertsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*, items(id, name, brand), recalls(id, title, source, url, hazard, remedy)')
      .order('created_at', { ascending: false });
    setAlerts(data ?? []);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    setAlerts(prev =>
      prev.map(a => a.id === id ? { ...a, read_at: new Date().toISOString() } : a)
    );
  };

  const markAllRead = async () => {
    const ids = alerts.filter(a => !a.read_at).map(a => a.id);
    if (!ids.length) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids);
    setAlerts(prev => prev.map(a => ({ ...a, read_at: a.read_at ?? new Date().toISOString() })));
  };

  const displayed = filter === 'unread' ? alerts.filter(a => !a.read_at) : alerts;
  const unreadCount = alerts.filter(a => !a.read_at).length;

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Recall Alerts</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'unread'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All Alerts' : `Unread (${unreadCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>
              {filter === 'unread' ? 'No unread alerts' : 'No alerts yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              You'll be notified here the moment any of your items are recalled.
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const recall = (item as any).recalls;
          const itemInfo = (item as any).items;
          const source = recall?.source ?? 'System';
          const sourceColor = SOURCE_COLORS[source] ?? '#64748B';
          const isUnread = !item.read_at;

          return (
            <TouchableOpacity
              style={[styles.alertCard, isUnread && styles.alertCardUnread]}
              onPress={() => {
                if (isUnread) markRead(item.id);
              }}
            >
              {/* Source badge */}
              <View style={styles.alertHeader}>
                <View style={[styles.sourceBadge, { backgroundColor: sourceColor + '20', borderColor: sourceColor + '40' }]}>
                  <Text style={[styles.sourceBadgeText, { color: sourceColor }]}>{source}</Text>
                </View>
                {isUnread && <View style={styles.unreadDot} />}
                <Text style={styles.alertTime}>{formatTime(item.created_at)}</Text>
              </View>

              {/* Recall title */}
              {recall?.title && (
                <Text style={styles.alertTitle}>{recall.title}</Text>
              )}

              {/* Message */}
              <Text style={styles.alertMessage}>{item.message}</Text>

              {/* Affected item */}
              {itemInfo && (
                <TouchableOpacity
                  style={styles.affectedItem}
                  onPress={() => router.push(`/items/${itemInfo.id}`)}
                >
                  <Text style={styles.affectedLabel}>Your item:</Text>
                  <Text style={styles.affectedName}>
                    {[itemInfo.brand, itemInfo.name].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={styles.affectedArrow}>›</Text>
                </TouchableOpacity>
              )}

              {/* Hazard / Remedy */}
              {recall?.hazard && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>⚠️ Hazard:</Text>
                  <Text style={styles.infoText} numberOfLines={2}>{recall.hazard}</Text>
                </View>
              )}
              {recall?.remedy && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>✅ Remedy:</Text>
                  <Text style={styles.infoText} numberOfLines={2}>{recall.remedy}</Text>
                </View>
              )}

              {/* View full recall */}
              {recall?.url && (
                <TouchableOpacity
                  style={styles.viewRecallBtn}
                  onPress={() => Linking.openURL(recall.url)}
                >
                  <Text style={styles.viewRecallText}>View Full Recall Notice →</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  unreadCount: { fontSize: fontSize.sm, color: colors.recall, fontWeight: '600', marginTop: 2 },
  markAllRead: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600', paddingTop: 6 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTabText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
  filterTabTextActive: { color: colors.textInverse, fontWeight: '700' },
  listContent: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  alertCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  alertCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.recall,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sourceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  sourceBadgeText: { fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.recall,
  },
  alertTime: { fontSize: fontSize.xs, color: colors.textLight, marginLeft: 'auto' },
  alertTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  alertMessage: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  affectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  affectedLabel: { fontSize: fontSize.xs, color: colors.textMuted },
  affectedName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary, flex: 1 },
  affectedArrow: { fontSize: 16, color: colors.primary },
  infoRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  infoLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.text, minWidth: 80 },
  infoText: { fontSize: fontSize.xs, color: colors.textMuted, flex: 1, lineHeight: 18 },
  viewRecallBtn: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewRecallText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});
