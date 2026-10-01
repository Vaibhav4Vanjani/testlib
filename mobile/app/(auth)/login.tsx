import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiRequest } from '../../src/services/api.client';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [phone, setPhone] = useState('7777777777');
  const [password, setPassword] = useState('Password123');
  const [loading, setLoading] = useState(false);

  const [availableLibraries, setAvailableLibraries] = useState<any[]>([]);
  const [libraryModalVisible, setLibraryModalVisible] = useState(false);

  const handleLogin = async (selectedLibId?: string) => {
    if (!phone || !password) {
      Alert.alert('Error', 'Please enter both phone number and password');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          password,
          selectedLibraryId: selectedLibId,
        }),
      });

      if (res.success && res.data) {
        if (res.data.requiresLibrarySelection) {
          setAvailableLibraries(res.data.availableLibraries || []);
          setLibraryModalVisible(true);
          setLoading(false);
          return;
        }

        setLibraryModalVisible(false);
        const { user, accessToken, refreshToken } = res.data;
        await setAuth(user, accessToken, refreshToken);

        if (user.role === 'STUDENT') {
          router.replace('/(student)');
        } else if (user.role === 'SUPER_ADMIN') {
          router.replace('/(super-admin)/libraries');
        } else {
          router.replace('/(admin)/dashboard');
        }
      } else {
        Alert.alert('Login Failed', res.error?.message || 'Invalid credentials');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>NextLib</Text>
        <Text style={styles.subtitle}>Study Centre & Reading Room ERP</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Phone Number or Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter registered phone or student email"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#64748B"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleLogin()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo Logins (Pre-seeded):</Text>
          <Text style={styles.demoText}>👨‍🎓 Student: 7777777777 / Password123</Text>
          <Text style={styles.demoText}>👔 Admin: 8888888888 / Password123</Text>
          <Text style={styles.demoText}>🔑 Super Admin: 9999999999 / Password123</Text>
        </View>
      </View>

      {/* MULTI-LIBRARY SELECTION MODAL */}
      <Modal animationType="slide" transparent visible={libraryModalVisible} onRequestClose={() => setLibraryModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#6366F1', textAlign: 'center', marginBottom: 6 }}>
              Select Active Library
            </Text>
            <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 18 }}>
              Your account belongs to multiple libraries. Please select which library to log into:
            </Text>

            {availableLibraries.map((lib) => (
              <TouchableOpacity
                key={lib.libraryId}
                style={{
                  backgroundColor: '#0F172A',
                  borderWidth: 1,
                  borderColor: '#6366F1',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onPress={() => handleLogin(lib.libraryId)}
              >
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#F8FAFC' }}>🏛️ {lib.libraryName}</Text>
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    {lib.city ? `📍 ${lib.city} • ` : ''}Code: {lib.code}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#34D399', backgroundColor: 'rgba(52, 211, 153, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  Select ➔
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={{ backgroundColor: '#475569', paddingVertical: 12, borderRadius: 10, marginTop: 8, alignItems: 'center' }}
              onPress={() => setLibraryModalVisible(false)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#6366F1',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  demoBox: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoTitle: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  demoText: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 2,
  },
});
