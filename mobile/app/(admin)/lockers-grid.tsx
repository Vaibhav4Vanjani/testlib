import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

export default function LockersGridScreen() {
  const { data: lockers, isLoading } = useQuery({
    queryKey: ['admin-lockers-map'],
    queryFn: async () => {
      const res = await apiRequest('/lockers');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch lockers');
      return res.data || [];
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Locker Occupancy Grid" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Locker Reservation Grid</Text>
      <Text style={styles.subTitle}>Live view of locker status, assigned student, and reservation expiry</Text>

      <View style={styles.grid}>
        {lockers?.map((locker: any) => {
          const isAvailable = locker.status === 'AVAILABLE';
          const isReserved = locker.status === 'RESERVED';
          const isOccupied = locker.status === 'OCCUPIED';

          const resInfo = locker.currentReservation;
          const studentName = resInfo?.studentId?.userId?.fullName || 'Occupant';
          const endAt = resInfo?.endAt ? new Date(resInfo.endAt).toLocaleDateString() : '';

          return (
            <View
              key={locker._id}
              style={[
                styles.card,
                isAvailable && styles.borderAvailable,
                isReserved && styles.borderReserved,
                isOccupied && styles.borderOccupied,
              ]}
            >
              <Text style={styles.lockerNum}>{locker.lockerNumber}</Text>
              <Text style={styles.statusText}>{locker.status}</Text>
              {!isAvailable && (
                <View style={styles.metaBox}>
                  <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
                  {endAt ? <Text style={styles.expiryText}>Till {endAt}</Text> : null}
                </View>
              )}
            </View>
          );
        })}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subTitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 2, minHeight: 100, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  borderAvailable: { borderColor: '#16A34A' },
  borderReserved: { borderColor: '#D97706' },
  borderOccupied: { borderColor: '#DC2626' },
  lockerNum: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  statusText: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  metaBox: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  studentName: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  expiryText: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
});
