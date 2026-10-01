import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { STUDENT_MENU } from '../../src/constants/menuItems';

export default function ReferralScreen() {
  const router = useRouter();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['student-referrals'],
    queryFn: async () => {
      const res = await apiRequest('/students/referrals');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch referrals');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <HamburgerMenu title="Invite Friends & Earn Rewards" role="STUDENT" items={STUDENT_MENU} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <HamburgerMenu title="Invite Friends & Earn Rewards" role="STUDENT" items={STUDENT_MENU} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🎁</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#DC2626', marginBottom: 8, textAlign: 'center' }}>
            Referral System Disabled
          </Text>
          <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
            {(error as Error)?.message || 'Student Referral feature is currently disabled for your library.'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#2563EB', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
            onPress={() => router.push('/(student)')}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const referralCode = data?.referralCode || 'N/A';
  const referralCount = data?.referralCount || 0;
  const totalRewardEarned = data?.totalRewardEarned || 0;
  const referrals = data?.referrals || [];

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Invite Friends & Earn Rewards" role="STUDENT" items={STUDENT_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Invite Friends & Earn</Text>
        <Text style={styles.subTitle}>Share your unique referral code with fellow students</Text>

        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
          <Text style={styles.codeValue}>{referralCode}</Text>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => Alert.alert('Referral Code Copied!', `Code: ${referralCode}`)}
          >
            <Text style={styles.shareBtnText}>📋 COPY CODE</Text>
          </TouchableOpacity>
        </View>

        {/* Reward Summary */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Friends Referred</Text>
            <Text style={styles.statValue}>{referralCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={styles.statValue}>₹{totalRewardEarned}</Text>
          </View>
        </View>

        {/* List of Referred Friends
        <Text style={styles.sectionHeader}>Referred Students</Text>
        {referrals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>You haven't referred any students yet. Share your code to get started!</Text>
          </View>
        ) : (
          referrals.map((ref: any, idx: number) => (
            <View key={idx} style={styles.refCard}>
              <View>
                <Text style={styles.refName}>{ref.referredUserId?.fullName || 'Student'}</Text>
                <Text style={styles.refDate}>{new Date(ref.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={[styles.statusBadge, ref.status === 'REWARDED' ? styles.bgRewarded : styles.bgPending]}>
                <Text style={styles.statusText}>{ref.status}</Text>
              </View>
            </View>
          ))
        )} */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 20,
  },
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  codeLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  codeValue: {
    color: '#2563EB',
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 10,
    letterSpacing: 2,
  },
  shareBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  statValue: {
    color: '#16A34A',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
  },
  refCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  refName: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  refDate: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bgRewarded: {
    backgroundColor: '#DCFCE7',
  },
  bgPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 12,
  },
});
