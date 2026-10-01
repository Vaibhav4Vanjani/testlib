import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';

const SUPER_ADMIN_MENU = [
  { label: 'Search Libraries', route: '/(super-admin)/libraries', icon: '🏛️', category: 'Library Operations' },
  { label: 'Onboard New Library', route: '/(super-admin)/onboard-library', icon: '➕', category: 'Library Operations' },
  { label: 'Platform Revenue', route: '/(super-admin)/analytics', icon: '📈', category: 'SaaS Platform Analytics' },
  { label: 'Feature Entitlements', route: '/(super-admin)/feature-flags', icon: '⚡', category: 'SaaS Platform Analytics' },
];

export default function SuperAdminAnalyticsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-earnings'],
    queryFn: async () => {
      const res = await apiRequest('/super-admin/earnings');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch platform earnings');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  const totalMonthlyEarnings = data?.totalMonthlyEarnings || 0;
  const perLibraryEarnings = data?.perLibraryEarnings || [];

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Platform Earnings Analytics" role="SUPER_ADMIN" items={SUPER_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Platform Financial Analytics</Text>
        <Text style={styles.subTitle}>SaaS platform earnings per month and library breakdown</Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL PLATFORM EARNINGS (THIS MONTH)</Text>
          <Text style={styles.heroValue}>₹{totalMonthlyEarnings.toLocaleString()}</Text>
        </View>

        <Text style={styles.sectionHeader}>Earnings Breakdown per Library</Text>
        {perLibraryEarnings.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>No revenue generated yet this month.</Text></View>
        ) : (
          perLibraryEarnings.map((lib: any) => (
            <View key={lib.libraryId} style={styles.rowCard}>
              <View>
                <Text style={styles.libName}>{lib.libraryName} ({lib.libraryCode})</Text>
              </View>
              <Text style={styles.libEarnings}>₹{lib.total.toLocaleString()}</Text>
            </View>
          ))
        )}
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
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#2563EB', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  heroLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: '#2563EB', fontSize: 36, fontWeight: '900', marginTop: 8 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { color: '#64748B' },
  rowCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  libName: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
  libEarnings: { color: '#16A34A', fontWeight: '900', fontSize: 18 },
});
