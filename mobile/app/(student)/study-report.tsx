import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { STUDENT_MENU } from '../../src/constants/menuItems';

export default function StudyReportScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['monthly-study-report', selectedMonth],
    queryFn: async () => {
      const res = await apiRequest(`/attendance/monthly-report?month=${selectedMonth}`);
      if (!res.success) throw new Error(res.error?.message || 'Failed to load report');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const dailyBreakdown = data?.dailyBreakdown || [];
  const totalHours = data?.totalStudyHours || 0;
  const sessionCount = data?.sessionCount || 0;

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Monthly Study Hours Report" role="STUDENT" items={STUDENT_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Monthly Study Report</Text>
      <Text style={styles.subTitle}>Track your productivity and attendance consistency</Text>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Total Study Hours</Text>
          <Text style={styles.cardValue}>{totalHours} hrs</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Total Sessions</Text>
          <Text style={styles.cardValue}>{sessionCount}</Text>
        </View>
      </View>

      {/* Daily Breakdown List */}
      <Text style={styles.sectionHeader}>Daily Breakdown ({selectedMonth})</Text>

      {dailyBreakdown.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No completed study sessions recorded for this month.</Text>
        </View>
      ) : (
        dailyBreakdown.map((item: any, idx: number) => (
          <View key={idx} style={styles.dayCard}>
            <View>
              <Text style={styles.dateText}>{item.date}</Text>
              <Text style={styles.minText}>{item.minutes} minutes logged</Text>
            </View>
            <View style={styles.hoursBadge}>
              <Text style={styles.hoursText}>{item.hours} hrs</Text>
            </View>
          </View>
        ))
      )}
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
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
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
  cardLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  cardValue: {
    color: '#16A34A',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
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
  dayCard: {
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
  dateText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  minText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  hoursBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hoursText: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 14,
  },
});
