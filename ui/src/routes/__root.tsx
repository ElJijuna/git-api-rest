import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Layout } from '@gnome-ui/layout';
import {
  HeaderBar,
  ViewSwitcher,
  ViewSwitcherItem,
  ViewSwitcherBar,
  useBreakpoint,
} from '@gnome-ui/react';
import { GoHome, Applications, Information, Refresh } from '@gnome-ui/icons';

export const Route = createRootRoute({
  component: RootLayout,
});

const VIEWS = [
  { to: '/', label: 'Dashboard', icon: GoHome },
  { to: '/repos', label: 'Repos', icon: Applications },
  { to: '/metrics', label: 'Metrics', icon: Refresh },
  { to: '/logs', label: 'Logs', icon: Information },
];

function NavItems() {
  const navigate = useNavigate();
  const { location } = useRouterState();

  return VIEWS.map(({ to, label, icon }) => (
    <ViewSwitcherItem
      key={to}
      label={label}
      icon={icon}
      active={location.pathname === to || (to !== '/' && location.pathname.startsWith(to))}
      onClick={() => { void navigate({ to }); }}
    />
  ));
}

function RootLayout() {
  const { isMedium } = useBreakpoint();

  return (
    <Layout
      topBar={
        <HeaderBar
          flat
          variant="default"
          title={
            !isMedium
              ? <ViewSwitcher aria-label="View"><NavItems /></ViewSwitcher>
              : 'git-api-rest'
          }
        />
      }
      bottomBar={
        <ViewSwitcherBar reveal={isMedium}>
          <NavItems />
        </ViewSwitcherBar>
      }
    >
      <Outlet />
    </Layout>
  );
}
