import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { getAccessToken, getRefreshToken } from '../src/utils/secureStore';
import { apiRequest } from '../src/services/api.client';

export default function IndexScreen() {
  const router = useRouter();
  const { user, isAuthenticated, setAuth } = useAuthStore();

  useEffect(() => {
    async function checkAuth() {
      const token = await getAccessToken();
      if (!token) {
        router.replace('/(auth)/login');
        return;
      }

      const res = await apiRequest('/auth/me');
      if (res.success && res.data) {
        const userData = res.data;
        const role = userData.role;
        const libraryId = userData.studentProfile?.libraryId?._id || userData.adminProfile?.libraryId?._id;
        const studentProfileId = userData.studentProfile?._id;

        const refreshToken = await getRefreshToken();
        setAuth(
          {
            id: userData._id,
            fullName: userData.fullName,
            phone: userData.phone,
            role,
            libraryId,
            studentProfileId,
          },
          token,
          refreshToken || ''
        );

        if (role === 'STUDENT') {
          router.replace('/(student)');
        } else if (role === 'SUPER_ADMIN') {
          router.replace('/(super-admin)/libraries');
        } else {
          router.replace('/(admin)/dashboard');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
