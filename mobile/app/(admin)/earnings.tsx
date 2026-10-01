import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EarningsScreen() {
  const [preset, setPreset] = useState<'THIS_MONTH' | 'LAST_30' | 'THIS_YEAR'>('THIS_MONTH');

  const getDateRange = () => {
    const today = new Date();
    const todayStr = formatDate(today);
    if (preset === 'LAST_30') {
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { fromDate: formatDate(past30), toDate: todayStr };
    }
    if (preset === 'THIS_YEAR') {
      return { fromDate: formatDate(new Date(today.getFullYear(), 0, 1)), toDate: todayStr };
    }
    // Default: THIS_MONTH
    return { fromDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)), toDate: todayStr };
  };

  const dateRange = getDateRange();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-earnings', preset],
    queryFn: async () => {
      const res = await apiRequest(`/admin/earnings?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch earnings');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const totalRev = data?.totalRevenue || 0;
  const membershipRev = data?.membershipRevenue || 0;
  const seatRev = data?.seatRevenue || 0;
  const lockerRev = data?.lockerRevenue || 0;

  const mPercent = totalRev > 0 ? Math.round((membershipRev / totalRev) * 100) : 0;
  const sPercent = totalRev > 0 ? Math.round((seatRev / totalRev) * 100) : 0;
  const lPercent = totalRev > 0 ? Math.round((lockerRev / totalRev) * 100) : 0;

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Financial Revenue Analytics" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Financial Earnings Overview</Text>
        <Text style={styles.subTitle}>Revenue breakdown by Membership, Seats & Lockers</Text>

        {/* PRESET FILTER BUTTONS */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, preset === 'THIS_MONTH' && styles.filterChipActive]}
            onPress={() => setPreset('THIS_MONTH')}
          >
            <Text style={[styles.filterChipText, preset === 'THIS_MONTH' && styles.filterChipTextActive]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, preset === 'LAST_30' && styles.filterChipActive]}
            onPress={() => setPreset('LAST_30')}
          >
            <Text style={[styles.filterChipText, preset === 'LAST_30' && styles.filterChipTextActive]}>30 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, preset === 'THIS_YEAR' && styles.filterChipActive]}
            onPress={() => setPreset('THIS_YEAR')}
          >
            <Text style={[styles.filterChipText, preset === 'THIS_YEAR' && styles.filterChipTextActive]}>This Year</Text>
          </TouchableOpacity>
        </View>

        {/* TOTAL REVENUE HERO CARD */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL REVENUE COLLECTED</Text>
          <Text style={styles.heroValue}>₹{totalRev.toLocaleString()}</Text>
          <Text style={styles.heroMeta}>{data?.transactionCount || 0} Transactions Approved</Text>
        </View>

        {/* REVENUE CATEGORY BREAKDOWN */}
        <Text style={styles.sectionHeader}>Earnings by Category</Text>

        {/* VISUAL PROPORTION BAR */}
        {totalRev > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBarSegment, { flex: Math.max(1, mPercent), backgroundColor: '#4F46E5' }]} />
            <View style={[styles.progressBarSegment, { flex: Math.max(1, sPercent), backgroundColor: '#10B981' }]} />
            <View style={[styles.progressBarSegment, { flex: Math.max(1, lPercent), backgroundColor: '#F59E0B' }]} />
          </View>
        )}

        <View style={styles.categoryCard}>
          <View style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <View style={[styles.dot, { backgroundColor: '#4F46E5' }]} />
              <Text style={styles.categoryName}>Membership Fees</Text>
            </View>
            <Text style={styles.categoryAmount}>₹{membershipRev.toLocaleString()} <Text style={styles.categoryMeta}>({mPercent}%)</Text></Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.categoryName}>Seat Assignments</Text>
            </View>
            <Text style={styles.categoryAmount}>₹{seatRev.toLocaleString()} <Text style={styles.categoryMeta}>({sPercent}%)</Text></Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.categoryName}>Locker Assignments</Text>
            </View>
            <Text style={styles.categoryAmount}>₹{lockerRev.toLocaleString()} <Text style={styles.categoryMeta}>({lPercent}%)</Text></Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 13, color: '#64748B', marginTop: 2, marginBottom: 14 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#4F46E5' },
  filterChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterChipTextActive: { color: '#FFFFFF' },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#10B981' },
  heroLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroValue: { color: '#059669', fontSize: 32, fontWeight: '900', marginTop: 6 },
  heroMeta: { color: '#64748B', fontSize: 12, marginTop: 4 },
  sectionHeader: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
  progressContainer: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12, backgroundColor: '#E2E8F0' },
  progressBarSegment: { height: '100%' },
  categoryCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { fontSize: 13, fontWeight: '600', color: '#334155' },
  categoryAmount: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  categoryMeta: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },
});
