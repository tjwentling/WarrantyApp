import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, fontSize } from '../../lib/theme';
import { Category } from '../../lib/types';
import { ProductInfo } from '../../lib/upcLookup';

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
  const params = useLocalSearchParams<{ prefill?: string }>();
  const [loading, setLoading] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ProductInfo | null>(null);

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

  // Pre-fill from scan result
  useEffect(() => {
    if (params.prefill) {
      try {
        const product: ProductInfo = JSON.parse(params.prefill as string);
        setScannedProduct(product);
        if (product.name) setName(product.name);
        if (product.brand) setBrand(product.brand);
        if (product.model) setModel(product.model);
        if (product.category) setCategory(product.category as Category);
        if (product.description) setNotes(product.description);
      } catch {}
    }
  }, [params.prefill]);

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
      {
        text: 'Add Another',
        onPress: () => {
          setScannedProduct(null);
          setName(''); setBrand(''); setModel(''); setSerial('');
          setCategory(null); setPurchaseDate(''); setNotes('');
          setAddWarranty(false); setWarrantyStart(''); setWarrantyEnd('');
          setCoverageNotes('');
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Scan Banner ──────────────────────── */}
        {!scannedProduct ? (
          <TouchableOpacity
            style={styles.scanBanner}
            onPress={() => router.push('/items/scan')}
          >
            <Text style={styles.scanBannerIcon}>📷</Text>
            <View style={styles.scanBannerText}>
              <Text style={styles.scanBannerTitle}>Scan a Barcode</Text>
              <Text style={styles.scanBannerSub}>
                Point your camera at any UPC or barcode to auto-fill this form
              </Text>
            </View>
            <Text style={styles.scanBannerArrow}>›</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.scannedBanner}>
            {scannedProduct.imageUrl ? (
              <Image source={{ uri: scannedProduct.imageUrl }} style={styles.scannedImage} />
            ) : (
              <View style={styles.scannedImagePlaceholder}>
                <Text style={{ fontSize: 28 }}>
                  {category ? categoryEmoji(category as Category) : '📦'}
                </Text>
              </View>
            )}
            <View style={styles.scannedInfo}>
              <Text style={styles.scannedLabel}>✅ Barcode Scanned</Text>
              <Text style={styles.scannedName} numberOfLines={2}>
                {scannedProduct.name ?? 'Unknown product'}
              </Text>
              {scannedProduct.brand && (
                <Text style={styles.scannedBrand}>{scannedProduct.brand}</Text>
              )}
              <Text style={styles.scannedUpc}>UPC: {scannedProduct.upc}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/items/scan')}
              style={styles.rescanBtn}
            >
              <Text style={styles.rescanBtnText}>Rescan</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Item Details</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* ── Item Details ─────────────────────── */}
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
          placeholder="Found on the label or in the manual"
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

  scanBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryDark, borderRadius: radius.md,
    padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  scanBannerIcon: { fontSize: 28 },
  scanBannerText: { flex: 1 },
  scanBannerTitle: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '700' },
  scanBannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs, marginTop: 2 },
  scanBannerArrow: { color: colors.textInverse, fontSize: 22 },

  scannedBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.successBg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.successBorder,
    padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md,
  },
  scannedImage: { width: 56, height: 56, borderRadius: radius.sm },
  scannedImagePlaceholder: {
    width: 56, height: 56, borderRadius: radius.sm,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
  },
  scannedInfo: { flex: 1 },
  scannedLabel: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.success,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  scannedName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginTop: 2 },
  scannedBrand: { fontSize: fontSize.xs, color: colors.textMuted },
  scannedUpc: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
  rescanBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.success,
  },
  rescanBtnText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
  },

  sectionLabel: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSize.md, color: colors.text, backgroundColor: colors.card, marginBottom: spacing.md,
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfField: { flex: 1 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  catBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  catBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  catLabelActive: { color: colors.textInverse, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginVertical: spacing.md, padding: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  toggleLabel: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
  warrantyCard: {
    backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.textInverse, fontSize: fontSize.lg, fontWeight: '700' },
});
