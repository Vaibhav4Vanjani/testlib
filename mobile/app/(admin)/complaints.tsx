import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';

export default function AdminComplaintsScreen() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [resolutionText, setResolutionText] = useState('');

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ['admin-library-complaints'],
    queryFn: async () => {
      const res = await apiRequest('/complaints/library-complaints');
      return res.data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminResponse }: { id: string; status: string; adminResponse?: string }) => {
      const res = await apiRequest(`/complaints/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminResponse }),
      });
      if (!res.success) throw new Error(res.error?.message || 'Update failed');
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Updated', 'Complaint status and resolution note saved.');
      setSelectedTicket(null);
      setResolutionText('');
      queryClient.invalidateQueries({ queryKey: ['admin-library-complaints'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message);
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>Reading Room Complaint Tickets</Text>
      <Text style={styles.subtitle}>Review and resolve issues reported by your students.</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 40 }} />
      ) : complaints?.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>🎉 No active complaint tickets!</Text>
        </View>
      ) : (
        complaints?.map((ticket: any) => (
          <View key={ticket._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.ticketCat}>[{ticket.category}] {ticket.title}</Text>
              <Text style={[styles.statusTag, getTagColor(ticket.status)]}>{ticket.status}</Text>
            </View>

            <Text style={styles.studentInfo}>
              👤 Student: {ticket.studentId?.userId?.fullName || 'Student'} ({ticket.studentId?.userId?.phone})
            </Text>
            <Text style={styles.ticketDesc}>{ticket.description}</Text>

            {ticket.adminResponse ? (
              <View style={styles.existingNote}>
                <Text style={styles.noteTitle}>Current Note:</Text>
                <Text style={styles.noteBody}>{ticket.adminResponse}</Text>
              </View>
            ) : null}

            {/* Quick Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#D97706' }]}
                onPress={() =>
                  updateStatusMutation.mutate({
                    id: ticket._id,
                    status: 'IN_PROGRESS',
                    adminResponse: 'Under inspection by staff',
                  })
                }
              >
                <Text style={styles.btnText}>In Progress</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#059669' }]}
                onPress={() =>
                  updateStatusMutation.mutate({
                    id: ticket._id,
                    status: 'RESOLVED',
                    adminResponse: 'Issue resolved by management team',
                  })
                }
              >
                <Text style={styles.btnText}>Mark Resolved</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function getTagColor(status: string) {
  switch (status) {
    case 'RESOLVED':
      return { backgroundColor: '#065F46', color: '#6EE7B7' };
    case 'IN_PROGRESS':
      return { backgroundColor: '#78350F', color: '#FCD34D' };
    default:
      return { backgroundColor: '#1E293B', color: '#94A3B8' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  emptyBox: {
    backgroundColor: '#1E293B',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketCat: {
    color: '#38BDF8',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '800',
    fontSize: 11,
    overflow: 'hidden',
  },
  studentInfo: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  ticketDesc: {
    color: '#CBD5E1',
    fontSize: 13,
    marginBottom: 10,
  },
  existingNote: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
  },
  noteTitle: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 11,
  },
  noteBody: {
    color: '#F8FAFC',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  btnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
