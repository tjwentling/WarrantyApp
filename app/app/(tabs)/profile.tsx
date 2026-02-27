import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/auth';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, fontSize, shadow } from '../../lib/theme';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), username: username.trim() || null })
      .eq('id', user!.id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      await refreshProfile();
      setEditing(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
        },
      },
    ]);
  };

  const initials = (profile?.full_name ?? user?.email ?? '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        {editing ? (
          <View style={styles.editFields}>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={colors.textLight}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username (optional)"
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
            />
            <View style={styles.editBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setFullName(profile?.full_name ?? '');
                  setUsername(profile?.username ?? '');
                  setEditing(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={colors.textInverse} size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameSection}>
            <Text style={styles.displayName}>{profile?.full_name ?? 'Your Name'}</Text>
            {profile?.username && <Text style={styles.username}>@{profile.username}</Text>}
            <Text style={styles.email}>{user?.email}</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Settings rows */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <SettingsRow
          emoji="🔔"
          label="Recall Alerts"
          sublabel="Immediate push notification for any recall"
          value="On"
        />
        <SettingsRow
          emoji="⚠️"
          label="Warranty Expiry Reminders"
          sublabel="30 days before warranty expires"
          value="On"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Sources</Text>
        <SettingsRow emoji="🛡️" label="CPSC" sublabel="Consumer Product Safety Commission" value="Active" />
        <SettingsRow emoji="🚗" label="NHTSA" sublabel="Vehicle & tire recalls" value="Active" />
        <SettingsRow emoji="💊" label="FDA" sublabel="Food, drugs & medical devices" value="Active" />
        <SettingsRow emoji="🥩" label="USDA" sublabel="Meat & poultry recalls" value="Active" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <SettingsRow emoji="📧" label="Email" sublabel={user?.email ?? ''} />
        <SettingsRow
          emoji="🔐"
          label="Member since"
          sublabel={new Date(user?.created_at ?? '').toLocaleDateString('en-US', {
            month: 'long', year: 'numeric',
          })}
        />
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut
          ? <ActivityIndicator color={colors.recall} />
          : <Text style={styles.signOutText}>Sign Out</Text>
        }
      </TouchableOpacity>

      <Text style={styles.version}>WarrantyApp v1.0.0</Text>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function SettingsRow({ emoji, label, sublabel, value }: {
  emoji: string; label: string; sublabel?: string; value?: string;
}) {
  return (
    <View style={styles.settingsRow}>
      <Text style={styles.settingsEmoji}>{emoji}</Text>
      <View style={styles.settingsInfo}>
        <Text style={styles.settingsLabel}>{label}</Text>
        {sublabel && <Text style={styles.settingsSublabel}>{sublabel}</Text>}
      </View>
      {value && <Text style={styles.settingsValue}>{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: spacing.xl },
  avatarSection: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.textInverse },
  nameSection: { alignItems: 'center' },
  displayName: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  username: { fontSize: fontSize.md, color: colors.textMuted, marginTop: 2 },
  email: { fontSize: fontSize.sm, color: colors.textLight, marginTop: 4 },
  editBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editBtnText: { color: colors.primary, fontWeight: '600', fontSize: fontSize.sm },
  editFields: { width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  editBtns: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.textInverse, fontWeight: '700' },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadow.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  settingsEmoji: { fontSize: 20 },
  settingsInfo: { flex: 1 },
  settingsLabel: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  settingsSublabel: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  settingsValue: { fontSize: fontSize.sm, color: colors.success, fontWeight: '600' },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.recall,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutText: { color: colors.recall, fontSize: fontSize.md, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.textLight },
});
