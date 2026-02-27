import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Dimensions, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { lookupUPC, ProductInfo } from '../../lib/upcLookup';
import { colors, spacing, radius, fontSize } from '../../lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FINDER_SIZE = SCREEN_W * 0.72;

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [looking, setLooking] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const cooldown = useRef(false);

  const handleBarcode = useCallback(async (result: BarcodeScanningResult) => {
    if (!scanning || cooldown.current || looking) return;
    // Only handle UPC/EAN/QR types
    const supported = ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128', 'code39', 'qr'];
    if (!supported.includes(result.type)) return;

    const raw = result.data;
    if (raw === lastScanned) return;

    cooldown.current = true;
    setLooking(true);
    setScanning(false);
    setLastScanned(raw);

    try {
      const product = await lookupUPC(raw);

      if (product && (product.name || product.brand)) {
        // Navigate to Add Item with pre-filled data
        router.replace({
          pathname: '/items/add',
          params: {
            prefill: JSON.stringify(product),
          },
        });
      } else {
        // Product not found in databases — still go to Add with just the UPC
        Alert.alert(
          'Product Not Found',
          `Barcode: ${raw}\n\nWe couldn't automatically find this product's details. You can fill them in manually.`,
          [
            {
              text: 'Add Manually',
              onPress: () =>
                router.replace({
                  pathname: '/items/add',
                  params: { prefill: JSON.stringify({ upc: raw, name: null, brand: null, model: null, category: null, description: null, imageUrl: null }) },
                }),
            },
            {
              text: 'Scan Again',
              onPress: () => {
                setScanning(true);
                setLooking(false);
                cooldown.current = false;
              },
            },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Something went wrong looking up this barcode. Please try again.');
      setScanning(true);
      setLooking(false);
      cooldown.current = false;
    }
  }, [scanning, looking, lastScanned]);

  // ── Permissions ──────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Text style={styles.permissionEmoji}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Permission Needed</Text>
        <Text style={styles.permissionSub}>
          WarrantyApp needs camera access to scan barcodes on product boxes and tags.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Allow Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelLink}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Camera view ──────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128', 'code39', 'qr'],
        }}
        onBarcodeScanned={scanning ? handleBarcode : undefined}
      />

      {/* Dark overlay with finder cutout */}
      <View style={styles.overlay}>
        {/* Top dark bar */}
        <View style={styles.overlayTop} />

        {/* Middle row: dark | finder | dark */}
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.finder}>
            {/* Corner marks */}
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
          </View>
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom dark bar */}
        <View style={styles.overlayBottom}>
          {looking ? (
            <View style={styles.lookingContainer}>
              <ActivityIndicator color={colors.textInverse} size="small" />
              <Text style={styles.lookingText}>Looking up product…</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Point at a barcode or UPC on the box</Text>
              <Text style={styles.hintSub}>Works with grocery, electronics, appliances & more</Text>
            </>
          )}

          <TouchableOpacity style={styles.manualBtn} onPress={() => router.replace('/items/add')}>
            <Text style={styles.manualBtnText}>Enter Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = pos.startsWith('t');
  const isLeft = pos.endsWith('l');
  return (
    <View
      style={[
        styles.corner,
        isTop ? styles.cornerTop : styles.cornerBottom,
        isLeft ? styles.cornerLeft : styles.cornerRight,
      ]}
    >
      <View style={[styles.cornerH, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]} />
      <View style={[styles.cornerV, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]} />
    </View>
  );
}

const CORNER = 28;
const CORNER_THICK = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  // Overlay
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: FINDER_SIZE },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },

  // Finder box
  finder: {
    width: FINDER_SIZE,
    height: FINDER_SIZE,
    position: 'relative',
  },

  // Corner marks
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  cornerTop: { top: 0 },
  cornerBottom: { bottom: 0 },
  cornerLeft: { left: 0 },
  cornerRight: { right: 0 },
  cornerH: {
    position: 'absolute',
    width: CORNER,
    height: CORNER_THICK,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  cornerV: {
    position: 'absolute',
    width: CORNER_THICK,
    height: CORNER,
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  // Status text
  lookingContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lookingText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '600' },
  hint: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '600', textAlign: 'center', paddingHorizontal: spacing.lg },
  hintSub: { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },

  // Manual button
  manualBtn: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  manualBtnText: { color: colors.textInverse, fontSize: fontSize.sm, fontWeight: '600' },

  // Permission screen
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  permissionEmoji: { fontSize: 64, marginBottom: spacing.lg },
  permissionTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  permissionSub: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: spacing.xl },
  grantBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    marginBottom: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  grantBtnText: { color: colors.textInverse, fontSize: fontSize.md, fontWeight: '700' },
  cancelLink: { color: colors.textMuted, fontSize: fontSize.md },
});
