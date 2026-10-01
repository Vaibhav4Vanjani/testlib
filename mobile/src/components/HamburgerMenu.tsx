import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { apiRequest } from '../services/api.client';

export interface MenuItem {
  label: string;
  route: string;
  icon: string;
  category?: string;
}

interface HamburgerMenuProps {
  title: string;
  role: 'STUDENT' | 'LIBRARY_ADMIN' | 'SUPER_ADMIN';
  items: MenuItem[];
}

export function HamburgerMenu({ title, role, items }: HamburgerMenuProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();
  const currentPath = usePathname() || '';
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  // Fetch live library feature flags for Local Admin / Local Student
  const { data: featureFlags } = useQuery({
    queryKey: ['my-library-feature-flags', user?.libraryId, role],
    queryFn: async () => {
      if (role === 'SUPER_ADMIN' || !user?.libraryId) return null;
      if (role === 'LIBRARY_ADMIN') {
        const res = await apiRequest('/admin/dashboard-metrics');
        return res.data?.featureFlags || null;
      }
      if (role === 'STUDENT') {
        const res = await apiRequest('/students/dashboard');
        return res.data?.library?.featureFlags || null;
      }
      return null;
    },
    enabled: role !== 'SUPER_ADMIN' && !!user?.libraryId,
    staleTime: 0,
  });

  const handleNavigate = (route: string) => {
    setModalVisible(false);
    router.push(route as any);
  };

  const handleLogout = async () => {
    setModalVisible(false);
    await logout();
    router.replace('/(auth)/login');
  };

  const flags = featureFlags || { enableReservedSeats: true, enableLockers: true, enableReferrals: true };

  const filteredItems = (items || []).filter((item) => {
    if (flags.enableReservedSeats === false) {
      if (item.route.includes('seat-master') || item.route.includes('seats-grid') || item.route === '/(student)/seats') {
        return false;
      }
    }
    if (flags.enableLockers === false) {
      if (item.route.includes('locker-master') || item.route.includes('lockers-grid') || item.route === '/(student)/lockers') {
        return false;
      }
    }
    if (flags.enableReferrals === false) {
      if (item.route.includes('referral') || item.route === '/(student)/referral') {
        return false;
      }
    }
    return true;
  });

  // Group menu items by category if provided
  const categorized: Record<string, MenuItem[]> = {};
  filteredItems.forEach((item) => {
    const cat = item.category || 'General Navigation';
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(item);
  });

  return (
    <>
      {/* Top Header Bar with SafeAreaView for camera cutout / status bar */}
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeHeaderArea}>
        <View style={styles.headerBar}>
          <View style={styles.titleContainer}>
            <Text style={styles.roleTag}>
              {role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : role === 'LIBRARY_ADMIN' ? 'ADMIN' : 'STUDENT'}
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.hamburgerIcon}>☰</Text>
            <Text style={styles.menuText}>MENU</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Hamburger Drawer Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />

          <SafeAreaView edges={['top', 'bottom', 'right']} style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerUser}>{user?.fullName || 'User'}</Text>
                <Text style={styles.drawerRole}>
                  {role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'LIBRARY_ADMIN' ? 'Library Admin' : 'Student'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuList} contentContainerStyle={styles.menuContent}>
              {Object.keys(categorized).map((category, catIdx) => (
                <View key={catIdx} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{category}</Text>
                  {categorized[category].map((item, idx) => {
                    const isActive = !!currentPath && currentPath.includes(item.route);

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.menuRow, isActive && styles.activeMenuRow]}
                        onPress={() => handleNavigate(item.route)}
                      >
                        <Text style={styles.menuIcon}>{item.icon}</Text>
                        <Text style={[styles.menuLabel, isActive && styles.activeMenuLabel]}>
                          {item.label}
                        </Text>
                        {isActive && <Text style={styles.activeDot}>●</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {/* Logout Option */}
              <View style={styles.categorySection}>
                <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
                  <Text style={styles.menuIcon}>🚪</Text>
                  <Text style={styles.logoutLabel}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeHeaderArea: {
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  roleTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563EB',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 2,
  },
  hamburgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  hamburgerIcon: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    flexDirection: 'row',
  },
  backdrop: {
    flex: 0.2,
  },
  drawerContainer: {
    flex: 0.8,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  drawerHeader: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  drawerUser: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  drawerRole: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#E2E8F0',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuList: {
    flex: 1,
  },
  menuContent: {
    padding: 16,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeMenuRow: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuLabel: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  activeMenuLabel: {
    color: '#2563EB',
    fontWeight: 'bold',
  },
  activeDot: {
    color: '#2563EB',
    fontSize: 12,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  logoutLabel: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
