import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';

const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Entitlements', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

export default function FeatureFlagsScreen() {
  const queryClient = useQueryClient();
  const [updatingLibId, setUpdatingLibId] = useState<string | null>(null);

  const { data: libraries, isLoading } = useQuery({
    queryKey: ['super-admin-libraries-summary'],
    queryFn: async () => {
      const res = await apiRequest('/super-admin/libraries/summary');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch summary');
      return res.data || [];
    },
  });

  const handleToggleFeature = async (lib: any, featureKey: string, newValue: boolean) => {
    try {
      setUpdatingLibId(lib.libraryId);
      const newFlags = {
        ...lib.featureFlags,
        [featureKey]: newValue,
      };

      const res = await apiRequest(`/super-admin/libraries/${lib.libraryId}/features`, 'PATCH', {
        featureFlags: newFlags,
      });

      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['super-admin-libraries-summary'] });
        queryClient.invalidateQueries({ queryKey: ['my-library-feature-flags'] });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-metrics'] });
      } else {
        Alert.alert('Error', res.error?.message || 'Failed to update feature flags');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setUpdatingLibId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Feature Entitlements" role="SUPER_ADMIN" items={SUPER_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Feature Visibility Management</Text>
        <Text style={styles.subTitle}>Enable or disable platform features dynamically per local library</Text>

        {libraries?.map((lib: any) => {
          const flags = lib.featureFlags || {
            enableReservedSeats: true,
            enableLockers: true,
            enableReferrals: true,
          };

          const isReservedSeatActive = flags.enableReservedSeats !== false;
          const isLockerActive = flags.enableLockers !== false;
          const isReferralActive = flags.enableReferrals !== false;

          return (
            <View key={lib.libraryId} style={styles.card}>
              <Text style={styles.libName}>{lib.name} ({lib.code})</Text>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>🪑 Reserved Seat Module</Text>
                  <Text style={styles.switchSub}>Enable or disable seat reservation for this library</Text>
                </View>
                <Switch
                  value={isReservedSeatActive}
                  onValueChange={(val: boolean) => handleToggleFeature(lib, 'enableReservedSeats', val)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>🔒 Locker Management Module</Text>
                  <Text style={styles.switchSub}>Enable or disable locker allocation for this library</Text>
                </View>
                <Switch
                  value={isLockerActive}
                  onValueChange={(val: boolean) => handleToggleFeature(lib, 'enableLockers', val)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>🎁 Student Referral System</Text>
                  <Text style={styles.switchSub}>Enable or disable referral program & coupons for this library</Text>
                </View>
                <Switch
                  value={isReferralActive}
                  onValueChange={(val: boolean) => handleToggleFeature(lib, 'enableReferrals', val)}
                  trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  libName: { color: '#0F172A', fontSize: 17, fontWeight: '800', marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  switchLabel: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  switchSub: { color: '#64748B', fontSize: 11, marginTop: 1 },
});
