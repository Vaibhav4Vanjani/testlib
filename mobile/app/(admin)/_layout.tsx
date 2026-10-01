import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function AdminLayout() {
  const { user } = useAuthStore();

  if (user && user.role === 'STUDENT') {
    return <Redirect href="/(student)" />;
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
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="students" />
      <Stack.Screen name="enrollment" />
      <Stack.Screen name="active-logs" />
      <Stack.Screen name="pending-payments" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="payment-master" />
      <Stack.Screen name="seats-grid" />
      <Stack.Screen name="seat-master" />
      <Stack.Screen name="lockers-grid" />
      <Stack.Screen name="locker-master" />
      <Stack.Screen name="qr-display" />
      <Stack.Screen name="send-notification" />
      <Stack.Screen name="complaints" />
    </Stack>
  );
}
