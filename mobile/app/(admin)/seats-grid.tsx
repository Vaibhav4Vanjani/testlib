import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';
import { sortItemsNaturally } from '../../src/utils/sorting';

export default function SeatsGridScreen() {
  const { data: seats, isLoading } = useQuery({
    queryKey: ['admin-seats-map'],
    queryFn: async () => {
      const res = await apiRequest('/seats');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch seats');
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
      <HamburgerMenu title="Seat Occupancy Grid" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Seat Reservation Grid</Text>
      <Text style={styles.subTitle}>Live view of seat status, assigned student, and reservation expiry</Text>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}><View style={[styles.dot, styles.bgAvailable]} /><Text style={styles.legendText}>Available</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.bgReserved]} /><Text style={styles.legendText}>Reserved (Unpaid)</Text></View>
        <View style={styles.legendItem}><View style={[styles.dot, styles.bgOccupied]} /><Text style={styles.legendText}>Occupied</Text></View>
      </View>

      <View style={styles.grid}>
        {sortItemsNaturally(seats || [], 'seatNumber').map((seat: any) => {
          const isAvailable = seat.status === 'AVAILABLE';
          const isReserved = seat.status === 'RESERVED';
          const isOccupied = seat.status === 'OCCUPIED';

          const resInfo = seat.currentReservation;
          const studentName = resInfo?.studentId?.userId?.fullName || 'Occupant';
          const endAt = resInfo?.endAt ? new Date(resInfo.endAt).toLocaleDateString() : '';

          return (
            <View
              key={seat._id}
              style={[
                styles.seatCard,
                isAvailable && styles.borderAvailable,
                isReserved && styles.borderReserved,
                isOccupied && styles.borderOccupied,
              ]}
            >
              <Text style={styles.seatNum}>{seat.seatNumber}</Text>
              <Text style={styles.statusText}>{seat.status}</Text>
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
  legendRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  seatCard: { width: '47%', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, borderWidth: 2, minHeight: 100, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  borderAvailable: { borderColor: '#16A34A' },
  borderReserved: { borderColor: '#D97706' },
  borderOccupied: { borderColor: '#DC2626' },
  bgAvailable: { backgroundColor: '#16A34A' },
  bgReserved: { backgroundColor: '#D97706' },
  bgOccupied: { backgroundColor: '#DC2626' },
  seatNum: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  statusText: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 2 },
  metaBox: { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  studentName: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  expiryText: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
});
