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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../src/services/api.client';

export default function StudentComplaintsScreen() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('AC / Ventilation');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: async () => {
      const res = await apiRequest('/complaints/my-complaints');
      return res.data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/complaints', {
        method: 'POST',
        body: JSON.stringify({ category, title, description }),
      });
      if (!res.success) throw new Error(res.error?.message || 'Submission failed');
      return res.data;
    },
    onSuccess: () => {
      Alert.alert('Complaint Logged', 'Your complaint has been submitted to the Reading Room Admin.');
      setTitle('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message);
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>Need Help or Reporting an Issue?</Text>
      <Text style={styles.subtitle}>Log a complaint directly to your Reading Room management team.</Text>

      {/* New Complaint Form */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Submit New Ticket</Text>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {['AC / Ventilation', 'Seat / Desk', 'Wi-Fi / Noise', 'Cleanliness'].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Issue Summary / Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. AC cooling low in Row B"
          placeholderTextColor="#64748B"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Detailed Description</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="Describe the issue clearly..."
          placeholderTextColor="#64748B"
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Complaint Ticket</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Complaint History */}
      <Text style={styles.historyTitle}>Your Ticket History ({complaints?.length || 0})</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 20 }} />
      ) : (
        complaints?.map((item: any) => (
          <View key={item._id} style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketCategory}>[{item.category}] {item.title}</Text>
              <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.ticketDesc}>{item.description}</Text>
            {item.adminResponse ? (
              <View style={styles.responseBox}>
                <Text style={styles.responseTitle}>Admin Resolution Note:</Text>
                <Text style={styles.responseText}>{item.adminResponse}</Text>
              </View>
            ) : null}
            <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        ))
      )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return { backgroundColor: '#065F46' };
    case 'IN_PROGRESS':
      return { backgroundColor: '#92400E' };
    default:
      return { backgroundColor: '#1E293B' };
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
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  catChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catChipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  catText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  catTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  historyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  ticketCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketCategory: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 10,
  },
  ticketDesc: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 4,
  },
  responseBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#34D399',
  },
  responseTitle: {
    color: '#34D399',
    fontWeight: '700',
    fontSize: 12,
  },
  responseText: {
    color: '#F8FAFC',
    fontSize: 13,
    marginTop: 2,
  },
  dateText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 8,
  },
});
