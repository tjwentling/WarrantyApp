import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Image, ActionSheetIOS, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/auth';
import { colors, spacing, radius, fontSize, shadow } from '../../lib/theme';
import { Item, Warranty, ItemRecall } from '../../lib/types';
import { pickAndUploadReceipt, takeAndUploadReceipt, deleteReceipt } from '../../lib/receiptUpload';

type FullItem = Item & {
  warranties: Warranty[];
  item_recalls: (ItemRecall & { recalls: any })[];
  receipt_urls?: string[];
};

type TransferRecord = {
  id: string;
  transferred_at: string;
  from_user: { full_name: string | null; username: string | null } | null;
  to_user: { full_name: string | null; username: string | null } | null;
};

function categoryEmoji(cat: string | null) {
  const map: Record<string, string> = {
    Electronics: '📱', Appliances: '🏠', Vehicles: '🚗',
    Furniture: '🛋️', Toys: '🧸', 'Food & Beverage': '🥫',
    'Medical Devices': '💊', 'Clothing & Accessories': '👕',
    'Tools & Equipment': '🔧', Other: '📦',
  };
  return cat ? (map[cat] ?? '📦') : '📦';
}

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const [item, setItem] = useState<FullItem | null>(null);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const load = async () => {
    const [itemRes, transferRes] = await Promise.all([
      supabase
        .from('items')
        .select('*, warranties(*), item_recalls(*, recalls(*))')
        .eq('id', id)
        .single(),
      supabase
        .from('ownership_transfers')
        .select(`
          id, transferred_at,
          from_user:from_user_id(full_name, username),
          to_user:to_user_id(full_name, username)
        `)
        .eq('item_id', id)
        .order('transferred_at', { ascending: false }),
    ]);
    setItem(itemRes.data as FullItem);
    setTransfers((transferRes.data ?? []) as TransferRecord[]);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [id]);

  // Refresh when navigating back from warranty screen
  useFocusEffect(
    useCallback(() => {
      if (!loading) load();
    }, [id])
  );

  useEffect(() => {
    if (item) navigation.setOptions({ title: item.name });
  }, [item]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${item?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('items').delete().eq('id', id);
            router.back();
          },
        },
      ]
    );
  };

  const handleAddReceipt = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take a Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doUpload('camera');
          if (idx === 2) await doUpload('library');
        }
      );
    } else {
      Alert.alert('Add Receipt', 'Choose a source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => doUpload('camera') },
        { text: 'Photo Library', onPress: () => doUpload('library') },
      ]);
    }
  };

  const doUpload = async (source: 'camera' | 'library') => {
    if (!user?.id || !id) return;
    setUploadingReceipt(true);
    try {
      const result = source === 'camera'
        ? await takeAndUploadReceipt(user.id, id)
        : await pickAndUploadReceipt(user.id, id);

      if (result) {
        const existingUrls: string[] = item?.receipt_urls ?? [];
        const newUrls = [...existingUrls, result.path];
        await supabase.from('items').update({ receipt_urls: newUrls }).eq('id', id);
        await load();
      }
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleDeleteReceipt = (path: string, index: number) => {
    Alert.alert('Remove Receipt', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteReceipt(path);
          const newUrls = (item?.receipt_urls ?? []).filter((_, i) => i !== index);
          await supabase.from('items').update({ receipt_urls: newUrls }).eq('id', id);
          await load();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Item not found.</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>Go back</Text></TouchableOpacity>
      </View>
    );
  }

  const recalls = item.item_recalls ?? [];
  const warranties = item.warranties ?? [];
  const activeWarranty = warranties.find(w => w.end_date && new Date(w.end_date) >= new Date());

  const warrantyStatus = () => {
    if (!warranties.length) return { label: 'No warranty registered', color: colors.textLight, bg: colors.background };
    if (!activeWarranty) return { label: 'Warranty expired', color: colors.textLight, bg: colors.background };
    const days = Math.ceil((new Date(activeWarranty.end_date!).getTime() - Date.now()) / 86400000);
    if (days <= 30) return { label: `Expires in ${days} days`, color: colors.warning, bg: colors.warningBg };
    const months = Math.ceil(days / 30);
    return { label: `${months} month${months > 1 ? 's' : ''} remaining`, color: colors.success, bg: colors.successBg };
  };
  const ws = warrantyStatus();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroEmoji}>{categoryEmoji(item.category)}</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{item.name}</Text>
          {(item.brand || item.model) && (
            <Text style={styles.heroMeta}>
              {[item.brand, item.model].filter(Boolean).join(' · ')}
            </Text>
          )}
          {item.category && <Text style={styles.heroCat}>{item.category}</Text>}
        </View>
      </View>

      {/* Recall Banner */}
      {recalls.length > 0 && (
        <View style={styles.recallBanner}>
          <Text style={styles.recallBannerIcon}>🚨</Text>
          <View style={styles.recallBannerBody}>
            <Text style={styles.recallBannerTitle}>
              {recalls.length} Active Recall{recalls.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.recallBannerSub}>This item has been recalled. Scroll down for details.</Text>
          </View>
        </View>
      )}

      {/* Details */}
      <SectionCard title="Item Details">
        <DetailRow label="Serial Number" value={item.serial_number} />
        <DetailRow label="Purchase Date" value={item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
        <DetailRow label="Added to App" value={new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
        {item.notes && <DetailRow label="Notes" value={item.notes} />}
      </SectionCard>

      {/* Warranty */}
      <View style={[styles.warrantyCard, { backgroundColor: ws.bg }]}>
        <View style={styles.warrantyHeader}>
          <Text style={styles.warrantyTitle}>📋 Warranty</Text>
          <Text style={[styles.warrantyStatus, { color: ws.color }]}>{ws.label}</Text>
        </View>
        {activeWarranty && (
          <>
            <DetailRow label="Starts" value={activeWarranty.start_date ? new Date(activeWarranty.start_date).toLocaleDateString() : 'N/A'} />
            <DetailRow label="Expires" value={activeWarranty.end_date ? new Date(activeWarranty.end_date).toLocaleDateString() : 'N/A'} />
            {activeWarranty.coverage_notes && (
              <DetailRow label="Coverage" value={activeWarranty.coverage_notes} />
            )}
          </>
        )}
        <TouchableOpacity
          style={styles.editWarrantyBtn}
          onPress={() => router.push(`/items/warranty/${item.id}`)}
        >
          <Text style={styles.editWarrantyText}>
            {warranties.length ? '✏️ Edit Warranty' : '+ Add Warranty'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Receipts & Documents */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>📷 Receipts & Documents</Text>
          <TouchableOpacity onPress={handleAddReceipt} disabled={uploadingReceipt}>
            {uploadingReceipt
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.addReceiptLink}>+ Add</Text>}
          </TouchableOpacity>
        </View>
        {item.receipt_urls && item.receipt_urls.length > 0 ? (
          <ReceiptGrid paths={item.receipt_urls} itemId={id} userId={user?.id ?? ''} onDelete={handleDeleteReceipt} />
        ) : (
          <TouchableOpacity style={styles.emptyReceipts} onPress={handleAddReceipt}>
            <Text style={styles.emptyReceiptsText}>📄 Tap to add a receipt or warranty card photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recalls */}
      {recalls.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚨 Recall Notices</Text>
          {recalls.map(ir => (
            <View key={ir.id} style={styles.recallCard}>
              <View style={styles.recallCardHeader}>
                <View style={styles.recallSourceBadge}>
                  <Text style={styles.recallSourceText}>{ir.recalls?.source}</Text>
                </View>
                <Text style={styles.recallDate}>
                  {ir.recalls?.recall_date
                    ? new Date(ir.recalls.recall_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : 'Date unknown'}
                </Text>
              </View>
              <Text style={styles.recallTitle}>{ir.recalls?.title}</Text>
              {ir.recalls?.hazard && (
                <View style={styles.recallInfo}>
                  <Text style={styles.recallInfoLabel}>⚠️ Hazard</Text>
                  <Text style={styles.recallInfoText}>{ir.recalls.hazard}</Text>
                </View>
              )}
              {ir.recalls?.remedy && (
                <View style={styles.recallInfo}>
                  <Text style={styles.recallInfoLabel}>✅ Remedy</Text>
                  <Text style={styles.recallInfoText}>{ir.recalls.remedy}</Text>
                </View>
              )}
              {ir.recalls?.url && (
                <TouchableOpacity
                  style={styles.recallLink}
                  onPress={() => Linking.openURL(ir.recalls.url)}
                >
                  <Text style={styles.recallLinkText}>View Official Notice →</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Transfer History */}
      {transfers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Ownership History</Text>
          <View style={styles.detailsCard}>
            {transfers.map((t, i) => (
              <View key={t.id} style={[styles.transferRow, i < transfers.length - 1 && styles.transferRowBorder]}>
                <Text style={styles.transferEmoji}>→</Text>
                <View style={styles.transferBody}>
                  <Text style={styles.transferText}>
                    <Text style={styles.transferName}>{t.from_user?.full_name ?? t.from_user?.username ?? 'Previous owner'}</Text>
                    {' → '}
                    <Text style={styles.transferName}>{t.to_user?.full_name ?? t.to_user?.username ?? 'New owner'}</Text>
                  </Text>
                  <Text style={styles.transferDate}>
                    {new Date(t.transferred_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.transferBtn}
          onPress={() => router.push(`/items/transfer/${item.id}`)}
        >
          <Text style={styles.transferBtnText}>🔄 Transfer Ownership</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑 Remove Item</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

/** Renders receipt thumbnails in a 3-column grid with delete support */
function ReceiptGrid({
  paths, itemId, userId, onDelete,
}: { paths: string[]; itemId: string; userId: string; onDelete: (path: string, index: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const signed = await Promise.all(
        paths.map(async (p) => {
          const { data } = await supabase.storage.from('receipts').createSignedUrl(p, 3600);
          return data?.signedUrl ?? '';
        })
      );
      setUrls(signed);
    };
    load();
  }, [paths]);

  return (
    <View style={receiptStyles.grid}>
      {paths.map((path, i) => (
        <TouchableOpacity
          key={path}
          style={receiptStyles.thumb}
          onLongPress={() => onDelete(path, i)}
        >
          {urls[i] ? (
            <Image source={{ uri: urls[i] }} style={receiptStyles.image} resizeMode="cover" />
          ) : (
            <View style={receiptStyles.placeholder}>
              <Text style={receiptStyles.placeholderText}>📄</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const receiptStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { fontSize: 28 },
});

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.detailsCard}>{children}</View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSize.lg, color: colors.textMuted },
  backLink: { color: colors.primary, marginTop: spacing.sm, fontWeight: '600' },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.md,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 38 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  heroMeta: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
  heroCat: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  recallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.recallBg,
    borderColor: colors.recallBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recallBannerIcon: { fontSize: 28 },
  recallBannerBody: { flex: 1 },
  recallBannerTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.recall },
  recallBannerSub: { fontSize: fontSize.sm, color: colors.recall, opacity: 0.8 },

  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addReceiptLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  detailRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { width: 130, fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
  detailValue: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  warrantyCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warrantyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  warrantyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  warrantyStatus: { fontSize: fontSize.sm, fontWeight: '600' },
  editWarrantyBtn: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editWarrantyText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },

  emptyReceipts: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyReceiptsText: { fontSize: fontSize.sm, color: colors.textMuted },

  recallCard: {
    backgroundColor: colors.recallBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.recallBorder,
    marginBottom: spacing.sm,
  },
  recallCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  recallSourceBadge: {
    backgroundColor: colors.recall,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  recallSourceText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: '700' },
  recallDate: { fontSize: fontSize.xs, color: colors.textMuted },
  recallTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.recall, marginBottom: spacing.sm },
  recallInfo: { marginBottom: spacing.xs },
  recallInfoLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.text, marginBottom: 2 },
  recallInfoText: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  recallLink: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.recallBorder },
  recallLinkText: { fontSize: fontSize.sm, color: colors.recall, fontWeight: '600' },

  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  transferRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  transferEmoji: { fontSize: 16, color: colors.textMuted },
  transferBody: { flex: 1 },
  transferText: { fontSize: fontSize.sm, color: colors.text },
  transferName: { fontWeight: '600', color: colors.primary },
  transferDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

  actions: { gap: spacing.sm, marginTop: spacing.md },
  transferBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadow.sm,
  },
  transferBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  deleteBtn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteBtnText: { color: colors.textMuted, fontSize: fontSize.md },
});
