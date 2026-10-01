import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { STUDENT_MENU } from '../../constants/menuItems';
import { MenuIcon } from './MenuIcon';
import { LogOut, GraduationCap, ArrowUpDown, Menu } from 'lucide-react';
import { Modal } from '../UI/Modal';
import { apiRequest } from '../../services/api.client';

export const StudentLayout: React.FC = () => {
  const { user, logout, setAuth, availableLibraries } = useAuthStore();
  const navigate = useNavigate();
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [loadingSwitch, setLoadingSwitch] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadFlags() {
      try {
        const res = await apiRequest('/students/dashboard');
        if (res.success && res.data?.library?.featureFlags) {
          setFeatureFlags(res.data.library.featureFlags);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadFlags();
  }, [user?.libraryId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSwitchLibrary = async (targetLibraryId: string) => {
    setLoadingSwitch(true);
    try {
      const res = await apiRequest('/auth/switch-library', 'POST', { libraryId: targetLibraryId });
      if (res.success && res.data) {
        const { user: updatedUser, accessToken, refreshToken } = res.data;
        setAuth(updatedUser, accessToken, refreshToken, availableLibraries);
        setSwitchModalOpen(false);
        window.location.reload();
      } else {
        alert(res.error?.message || 'Failed to switch library');
      }
    } catch (e: any) {
      alert(e.message || 'Error switching library');
    } finally {
      setLoadingSwitch(false);
    }
  };

  const flags = featureFlags || { enableReservedSeats: true, enableLockers: true, enableReferrals: true };

  const filteredMenu = STUDENT_MENU.filter((item) => {
    if (flags.enableReservedSeats === false && item.route.includes('/seats')) return false;
    if (flags.enableLockers === false && item.route.includes('/lockers')) return false;
    if (flags.enableReferrals === false && item.route.includes('/referral')) return false;
    return true;
  });

  const categories = Array.from(new Set(filteredMenu.map((item) => item.category)));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', position: 'relative' }}>
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* LEFT SIDEBAR / MOBILE DRAWER */}
      <aside
        className={`sidebar-drawer ${isMobileMenuOpen ? 'mobile-open' : ''}`}
        style={{
          width: '260px',
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
        }}
      >
        {/* Brand */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#FFF', fontSize: '18px' }}>
            🎓
          </div>
          <div>
            <h2 style={{ fontSize: '18px', color: '#1E1B4B', fontWeight: 800, lineHeight: 1.2 }}>NextLib</h2>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Student Portal
            </span>
          </div>
        </div>

        {/* Menu items list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          {categories.map((category) => (
            <div key={category} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 8px' }}>
                {category}
              </div>
              {filteredMenu.filter((item) => item.category === category).map((item) => (
                <NavLink
                  key={item.route}
                  to={item.route}
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: isActive ? '#4F46E5' : '#475569',
                    backgroundColor: isActive ? '#EEF2FF' : 'transparent',
                    textDecoration: 'none',
                    marginBottom: '4px',
                    transition: 'all 0.15s ease',
                  })}
                >
                  <MenuIcon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Logout Footer */}
        <div style={{ padding: '16px', borderTop: '1px solid #E2E8F0' }}>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: '8px', color: '#DC2626', backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="layout-main-content" style={{ flex: 1, marginLeft: '260px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOP HEADER */}
        <header
          className="layout-header"
          style={{
            height: '64px',
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          <div className="header-left-group">
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
              <Menu size={22} />
            </button>
            <GraduationCap size={22} style={{ color: '#4F46E5', flexShrink: 0 }} />
            <div className="header-title-box">
              <span className="header-title-text">
                {user?.libraryName || 'Active Reading Room'}
              </span>
              <span className="header-subtitle-text">
                Member Workspace
              </span>
            </div>
          </div>

          <div className="header-right-group">
            {availableLibraries.length > 1 && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 8px', flexShrink: 0 }}
                onClick={() => setSwitchModalOpen(true)}
              >
                <ArrowUpDown size={14} /> <span className="header-role-badge-text">Switch</span>
              </button>
            )}

            <div style={{ textAlign: 'right', minWidth: 0 }}>
              <div className="header-user-name">{user?.fullName}</div>
              <div className="header-user-subtext" style={{ fontSize: '11px', color: '#64748B' }}>{user?.phone}</div>
            </div>
          </div>
        </header>

        {/* ROUTE OUTLET */}
        <main className="layout-main-padding" style={{ flex: 1, padding: '24px' }}>
          <Outlet />
        </main>
      </div>

      {/* MULTI LIBRARY SWITCHING MODAL */}
      <Modal isOpen={switchModalOpen} onClose={() => setSwitchModalOpen(false)} title="Switch Active Library">
        <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '16px' }}>
          Select which library profile you would like to switch into:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {availableLibraries.map((lib) => (
            <button
              key={lib.libraryId}
              disabled={loadingSwitch}
              onClick={() => handleSwitchLibrary(lib.libraryId)}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #4F46E5',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>🏛️ {lib.libraryName}</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>Code: {lib.code} {lib.city ? `• ${lib.city}` : ''}</div>
              </div>
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>Select ➔</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};
