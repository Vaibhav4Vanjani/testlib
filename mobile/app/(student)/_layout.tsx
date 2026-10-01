import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function StudentLayout() {
  const { user } = useAuthStore();

  if (user && user.role === 'LIBRARY_ADMIN') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (user && user.role === 'SUPER_ADMIN') {
    return <Redirect href="/(super-admin)/libraries" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8FAFC' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="qr-scanner" />
      <Stack.Screen name="seats" />
      <Stack.Screen name="study-report" />
      <Stack.Screen name="lockers" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="referral" />
      <Stack.Screen name="complaints" />
    </Stack>
  );
}
