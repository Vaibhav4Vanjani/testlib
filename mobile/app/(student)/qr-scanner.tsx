import * as React from 'react';
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';

export default function QRScannerScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: sessionData, refetch: refetchSession, isRefetching } = useQuery({
    queryKey: ['student-current-session'],
    queryFn: async () => {
      const res = await apiRequest('/attendance/current-session');
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch current session');
      return res.data;
    },
  });

  const isPending = sessionData?.state === 'PENDING';

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.containerCenter}>
        <Text style={styles.permissionText}>Camera permission required to scan attendance QR</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading || isPending) return;
    setScanned(true);
    setLoading(true);

    try {
      let qrPayload: any;
      try {
        qrPayload = JSON.parse(data);
      } catch {
        throw new Error('Scanned code is not a valid NextLib attendance QR');
      }

      const res = await apiRequest('/attendance/scan-qr', {
        method: 'POST',
        body: JSON.stringify(qrPayload),
      });

      if (res.success) {
        // Invalidate queries so dashboard & stats update instantly
        queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['student-current-session'] });
        queryClient.invalidateQueries({ queryKey: ['student-attendance-history'] });
        queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['admin-attendance-requests'] });
        queryClient.invalidateQueries({ queryKey: ['admin-active-logs'] });

        Alert.alert('Attendance Status', res.message || 'Check-in/out successful', [
          { text: 'OK', onPress: () => router.replace('/(student)') },
        ]);
      } else {
        Alert.alert('Check-In Failed', res.error?.message || 'Verification failed', [
          { text: 'Try Again', onPress: () => setScanned(false) },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Invalid QR Code', err.message || 'Scanned code verification failed', [
        { text: 'Scan Again', onPress: () => setScanned(false) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={(scanned || isPending) ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        {isPending ? (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingBadge}>⏳ PENDING APPROVAL</Text>
            <Text style={styles.pendingTitle}>Attendance Request Sent</Text>
            <Text style={styles.pendingSub}>
              Your check-in request is awaiting approval from Local Admin. You cannot submit another QR scan until approved or rejected.
            </Text>

            <TouchableOpacity style={styles.refreshBtn} onPress={() => refetchSession()} disabled={isRefetching}>
              {isRefetching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.refreshBtnText}>🔄 REFRESH STATUS</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(student)')}>
              <Text style={styles.backBtnText}>◀ Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.scanTarget} />
            <Text style={styles.instructionText}>
              Align the QR code displayed on your Study Centre screen within the frame
            </Text>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.verifyingText}>Verifying...</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  containerCenter: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#F8FAFC',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanTarget: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#6366F1',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  instructionText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  verifyingText: {
    color: '#F8FAFC',
    marginTop: 12,
    fontWeight: '700',
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  pendingBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  pendingSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  refreshBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  backBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
  },
});
