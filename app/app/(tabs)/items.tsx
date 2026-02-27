import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, fontSize, shadow } from '../../lib/theme';
import { Item, Category } from '../../lib/types';

const CATEGORIES: Category[] = [
  'Electronics', 'Appliances', 'Vehicles', 'Furniture',
  'Toys', 'Food & Beverage', 'Medical Devices',
  'Clothing & Accessories', 'Tools & Equipment', 'Other',
];

function categoryEmoji(cat: string | null) {
  const map: Record<string, string> = {
    Electronics: '📱', Appliances: '🏠', Vehicles: '🚗',
    Furniture: '🛋️', Toys: '🧸', 'Food & Beverage': '🥫',
    'Medical Devices': '💊', 'Clothing & Accessories': '👕',
    'Tools & Equipment': '🔧', Other: '📦',
  };
  return cat ? (map[cat] ?? '📦') : '📦';
}

export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('items')
      .select('*, warranties(id, end_date), item_recalls(id)')
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    applyFilters(data ?? [], search, activeCategory);
  };

  const applyFilters = (source: Item[], q: string, cat: string) => {
    let result = source;
    if (cat !== 'All') result = result.filter(i => i.category === cat);
    if (q.trim()) {
      const lq = q.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(lq) ||
        i.brand?.toLowerCase().includes(lq) ||
        i.model?.toLowerCase().includes(lq)
      );
    }
    setFiltered(result);
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [])
  );

  const onSearch = (q: string) => {
    setSearch(q);
    applyFilters(items, q, activeCategory);
  };

  const onCategory = (cat: string) => {
    setActiveCategory(cat);
    applyFilters(items, search, cat);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const warrantyStatus = (item: Item): { label: string; color: string } => {
    const warranties = (item as any).warranties as Array<{ end_date: string | null }>;
    if (!warranties?.length) return { label: 'No warranty', color: colors.textLight };
    const latest = warranties.reduce((a: any, b: any) =>
      new Date(a.end_date ?? 0) > new Date(b.end_date ?? 0) ? a : b
    );
    if (!latest.end_date) return { label: 'Lifetime', color: colors.success };
    const exp = new Date(latest.end_date);
    const now = new Date();
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0) return { label: 'Expired', color: colors.textLight };
    if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: colors.warning };
    return { label: `${Math.ceil(daysLeft / 30)}mo left`, color: colors.success };
  };

  const hasRecall = (item: Item) => (item as any).item_recalls?.length > 0;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Items</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/items/add')}>
          <Text style={styles.addBtnText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, brand, or model..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={onSearch}
        />
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={['All', ...CATEGORIES]}
        keyExtractor={c => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catList}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
            onPress={() => onCategory(cat)}
          >
            <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Items List */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>
              {items.length === 0 ? 'No items yet' : 'No results found'}
            </Text>
            {items.length === 0 && (
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/items/add')}>
                <Text style={styles.emptyBtnText}>Add your first item</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }) => {
          const ws = warrantyStatus(item);
          const recalled = hasRecall(item);
          return (
            <TouchableOpacity
              style={[styles.card, recalled && styles.cardRecalled]}
              onPress={() => router.push(`/items/${item.id}`)}
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconBox}>
                  <Text style={styles.iconText}>{categoryEmoji(item.category)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    {recalled && <View style={styles.recallDot} />}
                  </View>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {[item.brand, item.model].filter(Boolean).join(' · ') || 'No details'}
                  </Text>
                  <Text style={[styles.warrantyBadge, { color: ws.color }]}>{ws.label}</Text>
                </View>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBtnText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: fontSize.md, color: colors.text },
  catList: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
  catChipTextActive: { color: colors.textInverse, fontWeight: '700' },
  listContent: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  cardRecalled: {
    borderLeftWidth: 3,
    borderLeftColor: colors.recall,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 24 },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, flex: 1 },
  recallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.recall,
  },
  itemMeta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  warrantyBadge: { fontSize: fontSize.xs, fontWeight: '600', marginTop: 4 },
  arrow: { fontSize: 20, color: colors.textLight },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textMuted },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyBtnText: { color: colors.textInverse, fontWeight: '700' },
});
