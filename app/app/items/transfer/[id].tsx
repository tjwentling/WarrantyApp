import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/auth';
import { colors, spacing, radius, fontSize } from '../../../lib/theme';

export default function TransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [itemName, setItemName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<{ id: string; full_name: string | null; email: string } | null>(null);

  useEffect(() => {
    supabase.from('items').select('name').eq('id', id).single()
      .then(({ data }) => { if (data) setItemName(data.name); });
  }, [id]);

  const searchRecipient = async () => {
    if (!recipientEmail.trim()) return;
    setSearching(true);
    setRecipient(null);

    // Look up by email in auth users (via profiles joined to auth)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id',
        (await supabase.rpc('get_user_id_by_email', { p_email: recipientEmail.trim() })).data
      )
      .single();

    setSearching(false);
    if (data) {
      setRecipient({ ...data, email: recipientEmail.trim() });
    } else {
      Alert.alert('User not found', 'No WarrantyApp account found with that email address.');
    }
  };

  const handleTransfer = async () => {
    if (!recipient) {
      Alert.alert('Find recipient first', 'Search for the recipient by email before transferring.');
      return;
    }

    Alert.alert(
      'Confirm Transfer',
      `Transfer "${itemName}" to ${recipient.full_name ?? recipient.email}?\n\nThey will receive all warranty info and future recall notifications. You will no longer be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);

            // Record the transfer
            await supabase.from('ownership_transfers').insert({
              item_id: id,
              from_user_id: user!.id,
              to_user_id: recipient!.id,
              notes: notes.trim() || null,
            });

            // Update item ownership
            await supabase.from('items').update({ user_id: recipient!.id }).eq('id', id);

            setLoading(false);
            Alert.alert(
              'Transfer Complete',
              `"${itemName}" has been transferred to ${recipient!.full_name ?? recipient!.email}.`,
              [{ text: 'Done', onPress: () => router.replace('/(tabs)/items') }]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Item info */}
      <View style={styles.itemCard}>
        <Text style={styles.itemCardLabel}>Transferring</Text>
        <Text style={styles.itemCardName}>{itemName}</Text>
      </View>

      {/* What this does */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What happens when you transfer?</Text>
        <InfoPoint emoji="📦" text="The new owner takes full ownership of the item" />
        <InfoPoint emoji="🔔" text="All future recall alerts go to the new owner" />
        <InfoPoint emoji="📋" text="Warranty information transfers with the item" />
        <InfoPoint emoji="📜" text="Transfer history is recorded for both parties" />
        <InfoPoint emoji="🔕" text="You will no longer receive notifications for this item" />
      </View>

      {/* Recipient */}
      <Text style={styles.sectionLabel}>Recipient Email</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="recipient@example.com"
          placeholderTextColor={colors.textLight}
          value={recipientEmail}
          onChangeText={text => { setRecipientEmail(text); setRecipient(null); }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity
          style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
          onPress={searchRecipient}
          disabled={searching}
        >
          {searching
            ? <ActivityIndicator color={colors.textInverse} size="small" />
            : <Text style={styles.searchBtnText}>Find</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Recipient found */}
      {recipient && (
        <View style={styles.recipientCard}>
          <View style={styles.recipientAvatar}>
            <Text style={styles.recipientAvatarText}>
              {(recipient.full_name ?? recipient.email)[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.recipientName}>{recipient.full_name ?? 'WarrantyApp User'}</Text>
            <Text style={styles.recipientEmail}>{recipient.email}</Text>
          </View>
          <Text style={styles.recipientCheck}>✓</Text>
        </View>
      )}

      {/* Notes */}
      <Text style={styles.sectionLabel}>Transfer Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Any notes for the new owner (condition, accessories included, etc.)"
        placeholderTextColor={colors.textLight}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Transfer button */}
      <TouchableOpacity
        style={[styles.transferBtn, (!recipient || loading) && styles.transferBtnDisabled]}
        onPress={handleTransfer}
        disabled={!recipient || loading}
      >
        {loading
          ? <ActivityIndicator color={colors.textInverse} />
          : <Text style={styles.transferBtnText}>Transfer Ownership</Text>
        }
      </TouchableOpacity>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function InfoPoint({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.infoPoint}>
      <Text style={styles.infoEmoji}>{emoji}</Text>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  itemCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  itemCardLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemCardName: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textInverse, marginTop: 4 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  infoPoint: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, alignItems: 'flex-start' },
  infoEmoji: { fontSize: 16 },
  infoText: { fontSize: fontSize.sm, color: colors.textMuted, flex: 1, lineHeight: 20 },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.card,
  },
  textArea: { minHeight: 80, paddingTop: 12, marginBottom: spacing.md },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: colors.textInverse, fontWeight: '700' },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginBottom: spacing.lg,
  },
  recipientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientAvatarText: { color: colors.textInverse, fontWeight: '700', fontSize: fontSize.lg },
  recipientName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  recipientEmail: { fontSize: fontSize.sm, color: colors.textMuted },
  recipientCheck: { marginLeft: 'auto', fontSize: 22, color: colors.success, fontWeight: '700' },
  transferBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  transferBtnDisabled: { opacity: 0.4 },
  transferBtnText: { color: colors.textInverse, fontSize: fontSize.lg, fontWeight: '700' },
});
