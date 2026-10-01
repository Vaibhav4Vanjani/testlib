import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

export default function ActiveLogsScreen() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['active-attendance-logs'],
    queryFn: async () => {
      const res = await apiRequest('/attendance/active-logs');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch logs');
      return res.data;
    },
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const activeCount = data?.activeCount || 0;
  const activeSessions = data?.activeSessions || [];
  const recentHistory = data?.recentHistory || [];

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Active Entry/Exit Logs" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#38BDF8" />}
      >
        <Text style={styles.headerTitle}>Today's Entry / Exit Logs</Text>
        <Text style={styles.subTitle}>Showing current day's active check-ins & completed check-outs</Text>

        <View style={styles.activeCounterCard}>
          <Text style={styles.counterLabel}>STUDENTS CURRENTLY INSIDE</Text>
          <Text style={styles.counterValue}>🟢 {activeCount}</Text>
        </View>

        <Text style={styles.sectionHeader}>Active Check-Ins Today</Text>
        {activeSessions.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>No active check-ins recorded today.</Text></View>
        ) : (
          activeSessions.map((sess: any) => (
            <View key={sess._id} style={styles.logCard}>
              <View>
                <Text style={styles.studentName}>{sess.studentId?.userId?.fullName || 'Student'}</Text>
                <Text style={styles.timeText}>Checked in at {new Date(sess.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={styles.badgeActive}><Text style={styles.badgeText}>INSIDE</Text></View>
            </View>
          ))
        )}

        <Text style={styles.sectionHeader}>Today's Completed Checkouts</Text>
      {recentHistory.map((sess: any) => (
        <View key={sess._id} style={styles.logCard}>
          <View>
            <Text style={styles.studentName}>{sess.studentId?.userId?.fullName || 'Student'}</Text>
            <Text style={styles.timeText}>Duration: {sess.durationMinutes || 0} mins</Text>
          </View>
          <View style={styles.badgeCompleted}><Text style={styles.badgeText}>EXITED</Text></View>
        </View>
      ))}
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
  activeCounterCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#16A34A', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  counterLabel: { color: '#64748B', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  counterValue: { color: '#16A34A', fontSize: 32, fontWeight: '900', marginTop: 6 },
  sectionHeader: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { color: '#64748B' },
  logCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  studentName: { color: '#0F172A', fontWeight: '700', fontSize: 15 },
  timeText: { color: '#64748B', fontSize: 12, marginTop: 2 },
  badgeActive: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeCompleted: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#15803D', fontWeight: '800', fontSize: 11 },
});
