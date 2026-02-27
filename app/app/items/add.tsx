import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, fontSize } from '../../lib/theme';
import { Category } from '../../lib/types';

const CATEGORIES: Category[] = [
  'Electronics', 'Appliances', 'Vehicles', 'Furniture',
  'Toys', 'Food & Beverage', 'Medical Devices',
  'Clothing & Accessories', 'Tools & Equipment', 'Other',
];

function categoryEmoji(cat: Category) {
  const map: Record<Category, string> = {
    Electronics: '📱', Appliances: '🏠', Vehicles: '🚗',
    Furniture: '🛋️', Toys: '🧸', 'Food & Beverage': '🥫',
    'Medical Devices': '💊', 'Clothing & Accessories': '👕',
    'Tools & Equipment': '🔧', Other: '📦',
  };
  return map[cat];
}

export default function AddItemScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Item fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');

  // Warranty fields
  const [addWarranty, setAddWarranty] = useState(false);
  const [warrantyStart, setWarrantyStart] = useState('');
  const [warrantyEnd, setWarrantyEnd] = useState('');
  const [coverageNotes, setCoverageNotes] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name for this item.');
      return;
    }

    setLoading(true);
    const { data: item, error } = await supabase
      .from('items')
      .insert({
        name: name.trim(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        serial_number: serial.trim() || null,
        category: category ?? null,
        purchase_date: purchaseDate.trim() || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      setLoading(false);
      Alert.alert('Error', error.message);
      return;
    }

    if (addWarranty && item) {
      await supabase.from('warranties').insert({
        item_id: item.id,
        start_date: warrantyStart.trim() || null,
        end_date: warrantyEnd.trim() || null,
        coverage_notes: coverageNotes.trim() || null,
      });
    }

    setLoading(false);
    Alert.alert('Item Added!', `${name} has been added to your possessions.`, [
      { text: 'View Item', onPress: () => router.replace(`/items/${item!.id}`) },
      { text: 'Add Another', onPress: () => {
        setName(''); setBrand(''); setModel(''); setSerial('');
        setCategory(null); setPurchaseDate(''); setNotes('');
        setAddWarranty(false); setWarrantyStart(''); setWarrantyEnd(''); setCoverageNotes('');
      }},
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Item Details ─────────────────────── */}
        <SectionLabel title="Item Details" />

        <FieldLabel>Item Name *</FieldLabel>
        <TextInput
          style={styles.input}
          placeholder="e.g. Samsung 65″ TV"
          placeholderTextColor={colors.textLight}
          value={name}
          onChangeText={setName}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <FieldLabel>Brand</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="Samsung"
              placeholderTextColor={colors.textLight}
              value={brand}
              onChangeText={setBrand}
            />
          </View>
          <View style={styles.halfField}>
            <FieldLabel>Model</FieldLabel>
            <TextInput
              style={styles.input}
              placeholder="QN65QN90B"
              placeholderTextColor={colors.textLight}
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        <FieldLabel>Serial Number</FieldLabel>
        <TextInput
          style={styles.input}
          placeholder="Found on the label or manual"
          placeholderTextColor={colors.textLight}
          value={serial}
          onChangeText={setSerial}
          autoCapitalize="characters"
        />

        <FieldLabel>Purchase Date</FieldLabel>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textLight}
          value={purchaseDate}
          onChangeText={setPurchaseDate}
          keyboardType="numbers-and-punctuation"
        />

        {/* ── Category ─────────────────────────── */}
        <SectionLabel title="Category" />
        <View style={styles.catGrid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catBtn, category === cat && styles.catBtnActive]}
              onPress={() => setCategory(cat === category ? null : cat)}
            >
              <Text style={styles.catEmoji}>{categoryEmoji(cat)}</Text>
              <Text style={[styles.catLabel, category === cat && styles.catLabelActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Notes ────────────────────────────── */}
        <SectionLabel title="Notes" />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Where purchased, any known issues, special instructions..."
          placeholderTextColor={colors.textLight}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* ── Warranty ─────────────────────────── */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setAddWarranty(v => !v)}
        >
          <View style={[styles.checkbox, addWarranty && styles.checkboxActive]}>
            {addWarranty && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.toggleLabel}>Add warranty information</Text>
        </TouchableOpacity>

        {addWarranty && (
          <View style={styles.warrantyCard}>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <FieldLabel>Warranty Start</FieldLabel>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                  value={warrantyStart}
                  onChangeText={setWarrantyStart}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.halfField}>
                <FieldLabel>Warranty End</FieldLabel>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                  value={warrantyEnd}
                  onChangeText={setWarrantyEnd}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <FieldLabel>Coverage Notes</FieldLabel>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's covered, exclusions, service center info..."
              placeholderTextColor={colors.textLight}
              value={coverageNotes}
              onChangeText={setCoverageNotes}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* ── Save Button ───────────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.textInverse} />
            : <Text style={styles.saveBtnText}>Save Item</Text>
          }
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.card,
    marginBottom: spacing.md,
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfField: { flex: 1 },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  catLabelActive: { color: colors.textInverse, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  toggleLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  warrantyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.textInverse, fontSize: fontSize.lg, fontWeight: '700' },
});
