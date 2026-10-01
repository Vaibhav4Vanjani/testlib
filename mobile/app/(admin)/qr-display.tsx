import * as React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'react-native-qrcode-svg';
import { apiRequest } from '../../src/services/api.client';
import { HamburgerMenu } from '../../src/components/HamburgerMenu';
import { LOCAL_ADMIN_MENU } from '../../src/constants/menuItems';

export default function AdminQRDisplayScreen() {
  const { data: qrData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-qr-code'],
    queryFn: async () => {
      const res = await apiRequest('/admin/qr-code');
      if (!res.success) throw new Error(res.error?.message || 'Failed to generate QR');
      return res.data;
    },
    refetchInterval: 12 * 60 * 60 * 1000, // Auto refresh every 12 hours (Valid for 1 Day)
  });

  const qrStringPayload = qrData ? JSON.stringify(qrData) : '';

  return (
    <View style={styles.container}>
      <HamburgerMenu title="Desk Attendance QR" role="LIBRARY_ADMIN" items={LOCAL_ADMIN_MENU} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Daily Attendance Desk QR Code</Text>
        <Text style={styles.subtitle}>
          Students scan this QR code using their NextLib Mobile App for Check-In & Check-Out
        </Text>

        <View style={styles.qrCard}>
          {isLoading || isRefetching ? (
            <ActivityIndicator size="large" color="#2563EB" style={{ padding: 60 }} />
          ) : qrStringPayload ? (
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrStringPayload}
                size={240}
                color="#0F172A"
                backgroundColor="#FFFFFF"
              />
            </View>
          ) : (
            <Text style={styles.errorText}>Failed to load QR code</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, (isLoading || isRefetching) && styles.refreshBtnDisabled]}
          onPress={() => refetch()}
          disabled={isLoading || isRefetching}
          activeOpacity={0.8}
        >
          <Text style={styles.refreshBtnText}>
            {isRefetching ? '🔄 Refreshing QR Code...' : '🔄 Refresh QR Code'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            📅 Valid for 1 Day.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '85%',
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  qrWrapper: {
    alignItems: 'center',
  },
  securityBadgeContainer: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  securityBadge: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#DC2626',
    fontWeight: '700',
    padding: 40,
  },
  refreshBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  refreshBtnDisabled: {
    backgroundColor: '#93C5FD',
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  footerNote: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    maxWidth: 340,
  },
  footerText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
});

