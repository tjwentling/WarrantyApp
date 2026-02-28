import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { colors, spacing, radius, fontSize, shadow } from '../../../lib/theme';
import { Warranty } from '../../../lib/types';

function formatDateDisplay(isoDate: string | null): string {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function toISODate(input: string): string | null {
  const parts = input.replace(/[-]/g, '/').split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts.map(p => p.trim());
    // Support MM/DD/YYYY or YYYY-MM-DD
    if (c && c.length === 4 && Number(c) > 1900) {
      const month = a.padStart(2, '0');
      const day = b.padStart(2, '0');
      return `${c}-${month}-${day}`;
    }
    if (a.length === 4 && Number(a) > 1900) {
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
  }
  return null;
}

export default function WarrantyEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [itemName, setItemName] = useState('');
  const [warranty, setWarranty] = useState<Warranty | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverageNotes, setCoverageNotes] = useState('');

  useEffect(() => {
    (async () => {
      const { data: item } = await supabase
        .from('items')
        .select('name, warranties(*)')
        .eq('id', id)
        .single();

      if (item) {
        setItemName(item.name ?? 'Item');
        navigation.setOptions({ title: `Warranty — ${item.name ?? 'Item'}` });
        const existing = (item as any).warranties?.[0] ?? null;
        setWarranty(existing);
        if (existing) {
          setStartDate(existing.start_date ? formatDateDisplay(existing.start_date) : '');
          setEndDate(existing.end_date ? formatDateDisplay(existing.end_date) : '');
          setCoverageNotes(existing.coverage_notes ?? '');
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    const endISO = toISODate(endDate);
    if (!endISO) {
      Alert.alert('Missing Date', 'Please enter a valid expiry date (MM/DD/YYYY).');
      return;
    }
    const startISO = toISODate(startDate) ?? null;
    if (startISO && endISO && startISO > endISO) {
      Alert.alert('Invalid Dates', 'Expiry date must be after start date.');
      return;
    }

    setSaving(true);
    try {
      if (warranty?.id) {
        const { error } = await supabase
          .from('warranties')
          .update({ start_date: startISO, end_date: endISO, coverage_notes: coverageNotes.trim() || null })
          .eq('id', warranty.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('warranties')
          .insert({ item_id: id, start_date: startISO, end_date: endISO, coverage_notes: coverageNotes.trim() || null });
        if (error) throw error;
      }
      Alert.alert('Saved ✓', 'Warranty information saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save warranty.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!warranty?.id) return;
    Alert.alert('Remove Warranty', 'Remove the warranty information for this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('warranties').delete().eq('id', warranty.id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const isExpired = warranty?.end_date ? new Date(warranty.end_date) < new Date() : false;
  const daysLeft = warranty?.end_date
    ? Math.ceil((new Date(warranty.end_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.headerEmoji}>📋</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{warranty ? 'Edit Warranty' : 'Add Warranty'}</Text>
          <Text style={styles.headerSub}>{itemName}</Text>
        </View>
        {warranty && (
          <View style={[
            styles.statusBadge,
            { backgroundColor: isExpired ? colors.textLight : (daysLeft != null && daysLeft <= 30 ? colors.warning : colors.success) }
          ]}>
            <Text style={styles.statusText}>
              {isExpired ? 'Expired' : (daysLeft != null && daysLeft <= 30 ? `${daysLeft}d left` : 'Active')}
            </Text>
          </View>
        )}
      </View>

      {/* Form */}
      <View style={styles.formCard}>
        <Text style={styles.formSection}>Warranty Dates</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Start Date (optional)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.textLight}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Expiry Date *</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.textLight}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Coverage Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={coverageNotes}
            onChangeText={setCoverageNotes}
            placeholder="e.g. Parts and labor, manufacturer defects only…"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      <Text style={styles.hint}>
        💡 Set an expiry date within 30 days to receive a reminder notification before it expires.
      </Text>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={colors.textInverse} />
          : <Text style={styles.saveBtnText}>{warranty ? '💾 Save Changes' : '✅ Add Warranty'}</Text>
        }
      </TouchableOpacity>

      {warranty && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑 Remove Warranty</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md, ...shadow.md,
  },
  headerEmoji: { fontSize: 36 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statusText: { color: colors.textInverse, fontSize: fontSize.xs, fontWeight: '700' },

  formCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm,
  },
  formSection: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md,
  },
  fieldGroup: { marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSize.md, color: colors.text,
  },
  notesInput: { height: 88, textAlignVertical: 'top', paddingTop: 12 },

  hint: {
    fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center',
    marginBottom: spacing.lg, lineHeight: 20, paddingHorizontal: spacing.sm,
  },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginBottom: spacing.sm, ...shadow.md,
  },
  saveBtnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '700' },

  deleteBtn: {
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  deleteBtnText: { color: colors.textMuted, fontSize: fontSize.md },
});
