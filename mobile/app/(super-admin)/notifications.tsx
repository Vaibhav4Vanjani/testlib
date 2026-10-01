import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';

const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Entitlements', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

export default function SuperAdminNotificationsScreen() {
  const [target, setTarget] = useState<'ALL' | 'SINGLE'>('ALL');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBroadcast = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Validation Error', 'Please enter a title and message body.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/super-admin/broadcast-notification', 'POST', {
        targetLibraryId: 'ALL',
        title: title.trim(),
        body: body.trim(),
      });

      if (res.success) {
        Alert.alert('Broadcast Sent!', 'Super Admin announcement sent to all local library admins.');
        setTitle('');
        setBody('');
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to send broadcast');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Super Admin Broadcast" role="SUPER_ADMIN" items={SUPER_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Global Broadcast System</Text>
        <Text style={styles.subTitle}>Publish system notifications to local libraries platform-wide</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Broadcast Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Platform Maintenance / Policy Update"
            placeholderTextColor="#64748B"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Broadcast Message *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write announcement body..."
            placeholderTextColor="#64748B"
            multiline
            numberOfLines={4}
            value={body}
            onChangeText={setBody}
          />

          <TouchableOpacity style={[styles.sendBtn, submitting && styles.btnDisabled]} onPress={handleBroadcast} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.sendText}>Send Global Broadcast to All Libraries</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#0F172A', fontSize: 15, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 14 },
  textArea: { height: 100, textAlignVertical: 'top' },
  sendBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  sendText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
});
