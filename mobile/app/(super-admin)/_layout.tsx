import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function SuperAdminLayout() {
  const { user } = useAuthStore();

  if (user && user.role === 'STUDENT') {
    return <Redirect href="/(student)" />;
  }

  if (user && user.role === 'LIBRARY_ADMIN') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <Stack.Screen name="libraries" />
      <Stack.Screen name="onboard-library" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="feature-flags" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
