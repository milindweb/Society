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
import { GlobalSearchBox } from '@/features/reports/components/GlobalSearchBox';
import { authStore } from '@/state/authStore';
import { navStore, getNavSnapshot, subscribeNav, type NavItem } from '@/state/navStore';
import { configStore } from '@/state/configStore';
import { nextThemeMode, useTheme } from '@/lib/useTheme';
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
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [items, setItems] = useState<NavItem[]>(() => getNavSnapshot());
  const [societyName, setSocietyName] = useState('');
  const [user] = useState(authStore.user);

  useEffect(() => {
    if (authStore.user) {
      const permissions = Array.isArray(authStore.user.permissions) ? authStore.user.permissions : [];
      navStore.init(permissions);
      setItems(getNavSnapshot());
    }

    setAuthErrorHandler(() => {
      authStore.clearAuth();
      navStore.clear();
      configStore.clear();
      navigate('/auth/login', { replace: true });
    });

    // Refresh the profile to get authoritative permissions (auth.me returns them).
    import('@/services/authService')
      .then(({ me }) => me())
      .then((freshUser) => {
        if (authStore.token) {
          authStore.setAuth(authStore.token, freshUser);
          navStore.init(freshUser.permissions ?? []);
          setItems(getNavSnapshot());
        }
      })
      .catch(() => {});

    getConfig()
      .then((c) => {
        configStore.setConfig(c);
        /* The brand is config-driven (SRS §15). Kept in component state because
           the header must re-render when config arrives — reading the store
           snapshot during render would leave the brand empty until the next
           unrelated re-render. */
        setSocietyName(c.societyName ?? '');
      })
      .catch(() => {});
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

  /* Cycles light → dark → system (design.md §7 requires all three to be
     reachable). Previously only light/dark were selectable from the UI, so
     "system" was available on first load and then unreachable. */
  const toggleTheme = () => {
    theme.setMode(nextThemeMode(theme.mode));
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
        societyName={societyName}
        onLogout={handleLogout}
        onChangePassword={() => navigate('/auth/change-password')}
        /* FE-12 §17: the header carries the global search entry point. Hidden on
         * mobile, where the header has no room — the /search route is still
         * reachable directly, and the sidebar links to it. */
        searchSlot={isDesktop ? <GlobalSearchBox /> : undefined}
        actions={
          <IconButton
            icon={<Icon name="theme" />}
            label={`Theme: ${theme.mode}`}
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
