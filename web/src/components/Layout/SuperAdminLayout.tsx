import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { SUPER_ADMIN_MENU } from '../../constants/menuItems';
import { MenuIcon } from './MenuIcon';
import { LogOut, Crown, ShieldAlert, Menu } from 'lucide-react';

export const SuperAdminLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const categories = Array.from(new Set(SUPER_ADMIN_MENU.map((item) => item.category)));

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
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#FFF', fontSize: '18px' }}>
            👑
          </div>
          <div>
            <h2 style={{ fontSize: '18px', color: '#B45309', fontWeight: 800, lineHeight: 1.2 }}>NextLib</h2>
            <span style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Super Admin SaaS
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
              {SUPER_ADMIN_MENU.filter((item) => item.category === category).map((item) => (
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
                    color: isActive ? '#D97706' : '#475569',
                    backgroundColor: isActive ? '#FFFBEB' : 'transparent',
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
            <Crown size={22} style={{ color: '#D97706', flexShrink: 0 }} />
            <div className="header-title-box">
              <span className="header-title-text">
                Platform SaaS Administration
              </span>
              <span className="header-subtitle-text">
                Global Controls & Revenue Portal
              </span>
            </div>
          </div>

          <div className="header-right-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#FFFBEB', padding: '4px 10px', borderRadius: '20px', border: '1px solid #FDE68A', flexShrink: 0 }}>
              <ShieldAlert size={14} style={{ color: '#D97706', flexShrink: 0 }} />
              <span className="header-role-badge-text" style={{ fontSize: '12px', fontWeight: 700, color: '#B45309' }}>Super Admin</span>
            </div>

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
    </div>
  );
};
