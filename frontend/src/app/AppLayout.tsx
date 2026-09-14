/* AppLayout.tsx — design.md §5, §23–§29: authenticated application shell.
   Wires header + sidebar (desktop) / drawer (mobile) + footer and bootstraps
   nav (from permissions) and society config. */

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppFooter } from '@/components/layout/AppFooter';
import { Drawer } from '@/components/ui/Drawer';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { authStore } from '@/state/authStore';
import { navStore, getNavSnapshot, subscribeNav, type NavItem } from '@/state/navStore';
import { configStore } from '@/state/configStore';
import { themeStore } from '@/state/themeStore';
import { setAuthErrorHandler } from '@/services/apiClient';
import { getConfig, getEnums } from '@/services/configService';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<NavItem[]>(() => getNavSnapshot());
  const [user] = useState(authStore.user);

  useEffect(() => {
    if (authStore.user) {
      navStore.init(authStore.user.permissions);
      setItems(getNavSnapshot());
    }

    setAuthErrorHandler(() => {
      authStore.clearAuth();
      navStore.clear();
      configStore.clear();
      navigate('/auth/login', { replace: true });
    });

    getConfig().then((c) => configStore.setConfig(c)).catch(() => {});
    getEnums().then((e) => configStore.setEnums(e)).catch(() => {});
  }, [navigate]);

  useEffect(() => subscribeNav(() => setItems(getNavSnapshot())), []);

  const handleNavigate = (route: string) => {
    setDrawerOpen(false);
    navigate(route);
  };

  const handleLogout = async () => {
    try {
      const { logout } = await import('@/services/authService');
      await logout();
    } catch {
      /* server logout is best-effort */
    }
    authStore.clearAuth();
    navStore.clear();
    configStore.clear();
    navigate('/auth/login', { replace: true });
  };

  const toggleTheme = () => {
    themeStore.setMode(themeStore.resolved === 'dark' ? 'light' : 'dark');
  };

  const sidebarItems = items.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    route: item.route,
  }));

  const activeRoute = location.pathname;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppHeader
        onMenuToggle={isDesktop ? undefined : () => setDrawerOpen(true)}
        userName={user?.fullName ?? user?.username}
        onLogout={handleLogout}
        actions={
          <IconButton
            icon={<Icon name="theme" />}
            label="Toggle theme"
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
          />
        }
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {isDesktop && (
          <AppSidebar items={sidebarItems} activeRoute={activeRoute} onNavigate={handleNavigate} />
        )}
        <main style={{ flex: 1, minWidth: 0, padding: 'var(--space-5)', overflow: 'auto' }}>
          <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
            <Outlet />
          </div>
        </main>
      </div>

      {!isDesktop && (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Menu">
          <div style={{ padding: 'var(--space-2)' }}>
            {sidebarItems.map((item) => {
              const isActive = activeRoute === item.route || activeRoute.startsWith(item.route + '/');
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavigate(item.route)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    width: '100%',
                    padding: 'var(--space-3) var(--space-3)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: isActive ? 'var(--color-brand-soft)' : 'transparent',
                    color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-base)',
                    fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                    textAlign: 'left',
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </Drawer>
      )}

      <AppFooter version={import.meta.env.VITE_APP_VERSION} />
    </div>
  );
}
