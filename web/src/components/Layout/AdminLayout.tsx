import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LOCAL_ADMIN_MENU } from '../../constants/menuItems';
import { MenuIcon } from './MenuIcon';
import { LogOut, Building, Menu } from 'lucide-react';
import { apiRequest } from '../../services/api.client';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [featureFlags, setFeatureFlags] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadFlags() {
      try {
        const res = await apiRequest('/admin/dashboard-metrics');
        if (res.success && res.data?.featureFlags) {
          setFeatureFlags(res.data.featureFlags);
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

  const flags = featureFlags || { enableReservedSeats: true, enableLockers: true, enableReferrals: true };

  const filteredMenu = LOCAL_ADMIN_MENU.filter((item) => {
    if (flags.enableReservedSeats === false && item.route.includes('seat-master')) return false;
    if (flags.enableLockers === false && item.route.includes('locker-master')) return false;
    return true;
  });

  const categories = Array.from(new Set(filteredMenu.map((item) => item.category)));

  const getUserInitials = (name?: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
          boxShadow: '4px 0 24px rgba(15, 23, 42, 0.03)',
        }}
      >
        {/* Brand */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            color: '#FFFFFF',
            fontSize: '20px',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
          }}>
            N
          </div>
          <div>
            <h2 style={{ fontSize: '19px', color: '#0F172A', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>NextLib</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: '#EEF2FF', padding: '1px 6px', borderRadius: '4px' }}>
                ADMIN PORTAL
              </span>
            </div>
          </div>
        </div>

        {/* Menu items list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
          {categories.map((category) => (
            <div key={category} style={{ marginBottom: '22px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '0 12px 8px' }}>
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
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#4F46E5' : '#475569',
                    backgroundColor: isActive ? '#EEF2FF' : 'transparent',
                    borderLeft: isActive ? '3.5px solid #4F46E5' : '3.5px solid transparent',
                    textDecoration: 'none',
                    marginBottom: '4px',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
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
        <div style={{ padding: '16px', borderTop: '1px solid #F1F5F9', backgroundColor: '#FAFAFA' }}>
          <button
            onClick={handleLogout}
            className="btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              gap: '8px',
              color: '#DC2626',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '9px 14px',
              fontWeight: 700,
              fontSize: '13px',
              transition: 'all 0.2s ease',
            }}
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
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03)',
          }}
        >
          <div className="header-left-group">
            <button className="hamburger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu">
              <Menu size={22} />
            </button>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={18} style={{ color: '#4F46E5', flexShrink: 0 }} />
            </div>
            <div className="header-title-box">
              <span className="header-title-text" style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                {user?.libraryName || 'Active Library Centre'}
              </span>
              <span className="header-subtitle-text" style={{ fontSize: '11px', color: '#64748B' }}>
                Centre Management Portal
              </span>
            </div>
          </div>

          <div className="header-right-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFDF5', padding: '4px 12px', borderRadius: '20px', border: '1px solid #A7F3D0', flexShrink: 0 }}>
              <span className="live-indicator-dot" />
              <span className="header-role-badge-text" style={{ fontSize: '12px', fontWeight: 700, color: '#059669' }}>Local Admin</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right', minWidth: 0 }}>
                <div className="header-user-name" style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{user?.fullName}</div>
                <div className="header-user-subtext" style={{ fontSize: '11px', color: '#64748B' }}>{user?.phone}</div>
              </div>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                flexShrink: 0,
              }}>
                {getUserInitials(user?.fullName)}
              </div>
            </div>
          </div>
        </header>

        {/* ROUTE OUTLET */}
        <main className="layout-main-padding" style={{ flex: 1, padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
