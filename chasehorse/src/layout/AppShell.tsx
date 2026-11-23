import { useEffect, useRef, useState, useCallback } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate, Navigate } from 'react-router-dom';
import {
  Menu,
  ShieldAlert,
  X,
  LogIn,
  LogOut,
  Home,
  Search,
  Bell,
  ChevronDown,
  Headphones,
  User,
  Settings,
  MapPin,
} from 'lucide-react';
import { api } from '@/api';
import { AppNotification, ManagerAreaBanner } from '@/types';
import { canAccessPath, navItems, customerNavItems, roleMeta } from '@/config/access';
import { useRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ChaseHorseLogo } from '@/components/ui/ChaseHorseLogo';
import { AccessDenied } from '@/pages/AccessDenied';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { NotificationPopups } from '@/components/notifications/NotificationPopups';
import { useLiveLocationSync } from '@/hooks/useLiveLocationSync';

/** Route guard: only signed-in, ACTIVE accounts reach the portal shell. */
export function AppShell() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Fail closed: enforce authentication and approved status for all protected routes
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--muted)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        Verifying authenticated credentials...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    // A session without a server-verified profile must never receive a role.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Pending, rejected, suspended and blocked accounts all see their status (and reason) there.
  if (profile.accountStatus?.toUpperCase() !== 'ACTIVE') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <AuthedShell />;
}

/** Hooks live here, after the guards, so their order never changes between renders. */
function AuthedShell() {
  const { role, actorName } = useRole();
  const { user, profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [navOpen, setNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [areaBanner, setAreaBanner] = useState<ManagerAreaBanner | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // 30-minute enterprise session inactivity timeout with 1-minute countdown warning
  const handleInactivityTimeout = useCallback(async () => {
    await signOut();
    navigate('/login?reason=inactivity');
  }, [signOut, navigate]);

  const { showWarning, secondsRemaining, resetTimer } = useInactivityTimer({
    timeoutMs: 30 * 60 * 1000,
    warningMs: 1 * 60 * 1000,
    onTimeout: handleInactivityTimeout,
    enabled: Boolean(user && profile),
  });

  // Use specialized enterprise customer navigation when role is customer
  const items = role === 'customer' ? customerNavItems : navItems.filter((n) => n.roles.includes(role));
  const allowed = canAccessPath(role, location.pathname);

  // Close drawers & dropdowns on route changes
  useEffect(() => {
    setNavOpen(false);
    setProfileMenuOpen(false);
    setNotifMenuOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Handle ESC key for popovers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setProfileMenuOpen(false);
        setNotifMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchNotifs = async () => {
      try {
        const [items, count] = await Promise.all([
          api.getNotifications(),
          api.getUnreadNotificationCount(),
        ]);
        if (active) {
          setNotifications(items);
          setUnreadCount(count);
        }
      } catch (err) {
        console.warn('Failed to load notifications', err);
      }
    };
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user]);

  // Load manager area jurisdiction banner if manager role
  useEffect(() => {
    if (!user) return;
    const isManagerRole = role === 'operations_manager' || role === 'manager' || (profile?.roles?.includes('MANAGER') ?? false);
    if (isManagerRole) {
      api.getMyArea().then((res) => {
        setAreaBanner(res);
      }).catch((err) => {
        console.warn('Failed to load manager area banner', err);
      });
    }
  }, [user, role, profile]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed mark all read', err);
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn('Failed mark read', err);
    }
  };

  const profilePath = role === 'employee' ? '/employee/profile' : role === 'customer' ? '/customer/profile' : '/profile';
  const settingsPath = role === 'employee' ? '/employee/profile?tab=account' : role === 'customer' ? '/customer/profile?tab=security' : '/profile';
  const supportPath = role === 'customer' ? '/customer/support' : '/support';

  // Field workers who agreed to share location: keep their task radius live on every page.
  useLiveLocationSync((role === 'employee' || role === 'field_worker') && Boolean(profile?.locationConsent));

  /** Where a notification leads, per role. */
  const notificationHref = (n: AppNotification): string | null => {
    if (n.entityType === 'ENQUIRY' && n.entityId) return `/enquiries?open=${encodeURIComponent(n.entityId)}`;
    if (n.entityType === 'TICKET') return supportPath;
    if (n.entityType === 'WALLET') return '/wallet';
    if (n.entityType === 'TASK') {
      if (role === 'customer') return n.entityId ? `/customer/tasks/${n.entityId}` : '/customer/tasks';
      if (role === 'employee' || role === 'field_worker') return '/tasks';
      return n.entityId ? `/tasks/${n.entityId}` : '/tasks';
    }
    return null;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toUpperCase();
    if (q) {
      if (q.startsWith('TCK') || q.includes('TICKET')) {
        navigate(supportPath);
      } else if (q.startsWith('CH') && role === 'customer') {
        navigate('/customer/tracking');
      } else {
        navigate('/tasks');
      }
    }
  };

  const displayName = profile?.displayName || (user?.email ? user.email.split('@')[0] : actorName);
  const userInitials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CH';

  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/employee/dashboard')) return 'Worker Home';
    if (pathname.includes('/customer/dashboard')) return 'Customer Portal';
    if (pathname.includes('/nearby')) return 'Nearby Tasks';
    if (pathname.includes('/tasks')) return role === 'customer' ? 'My Requests' : (role === 'employee' || role === 'field_worker' ? 'My Tasks' : 'Field Operations');
    if (pathname.includes('/wallet')) return 'Rewards Wallet';
    if (pathname.includes('/profile')) return 'Profile & Settings';
    if (pathname.includes('/support')) return 'Operations Support';
    if (pathname.includes('/checklists')) return 'Checklists';
    if (pathname.includes('/approvals')) return 'Review & Approvals';
    if (pathname.includes('/employees')) return 'Workers & Staff';
    if (pathname.includes('/overview')) return 'Operations Overview';
    if (pathname.includes('/admin/areas')) return 'State Area Coverage & Jurisdiction';
    return 'Dashboard';
  };

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Primary Sidebar */}
      <aside id="primary-nav" className={`sidebar ${navOpen ? 'sidebar--open' : ''}`} aria-label="Primary">
        {/* Brand */}
        <div className="sidebar__brand" style={{ padding: '1.25rem 1.15rem' }}>
          <Link to="/" style={{ display: 'flex', flexDirection: 'column', gap: '4px', textDecoration: 'none', color: 'inherit' }}>
            <ChaseHorseLogo theme="dark" size="sm" withSubtitle={true} />
          </Link>
          <button
            type="button"
            className="icon-btn sidebar__close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="sidebar__nav" aria-label="Main navigation" style={{ flex: 1, padding: '0.5rem 0.85rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    backgroundColor: isActive ? 'var(--accent-orange)' : 'transparent',
                    boxShadow: isActive ? '0 2px 8px rgba(232, 84, 30, 0.4)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                  })}
                >
                  <Icon size={18} aria-hidden />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Customer Sidebar Bottom Widget: Need Help? */}
        {role === 'customer' && (
          <div style={{ padding: '0.85rem 1.15rem 1rem 1.15rem' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}>
                  <Headphones size={15} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                    Need Help?
                  </p>
                  <p style={{ margin: 0, fontSize: '0.725rem', color: '#94a3b8' }}>
                    Get support for your tasks
                  </p>
                </div>
              </div>
              <Link
                to="/customer/support"
                className="btn btn--primary"
                style={{
                  width: '100%',
                  fontSize: '0.775rem',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#eb5724',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'block',
                  boxSizing: 'border-box',
                }}
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}

        {/* Sidebar Footer Identity */}
        <div className="sidebar__foot" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <p className="sidebar__foot-label" style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
              {roleMeta[role]?.label || 'OPERATOR'}
            </p>
            <Link to="/" className="icon-btn" title="Back to Public Site" aria-label="Public website" style={{ color: '#94a3b8' }}>
              <Home size={14} />
            </Link>
          </div>
          <div className="sidebar__who" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Avatar name={displayName} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="sidebar__who-name" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </p>
              <p className="sidebar__who-sub" style={{ margin: 0, fontSize: '0.75rem', color: '#38bdf8' }}>
                {roleMeta[role]?.label || role}
              </p>
            </div>
            {user && (
              <button
                type="button"
                onClick={() => signOut()}
                className="icon-btn"
                title="Sign Out"
                aria-label="Sign out"
                style={{ color: '#94a3b8', cursor: 'pointer' }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden />}

      {/* Main Shell Content & Topbar */}
      <div className="shell__main">
        {/* Polished Topbar Navigation */}
        <header
          className="topbar"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            padding: '12px clamp(16px, 3vw, 32px)',
            background: 'var(--surface, #0f1b30)',
            borderBottom: '1px solid var(--border, #1e3354)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Left: Mobile hamburger menu & Page Title / Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="icon-btn topbar__menu"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-controls="primary-nav"
              style={{ color: 'var(--color-text, #f8fafc)' }}
            >
              <Menu size={20} aria-hidden />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500 }}>ChaseHorse</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink)' }}>/</span>
              <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text, #f8fafc)' }}>
                {getPageTitle(location.pathname)}
              </h2>
            </div>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ flex: '1', maxWidth: '420px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, tracking ID, or support..."
              className="input"
              style={{
                width: '100%',
                paddingLeft: '36px',
                paddingRight: '12px',
                fontSize: '0.825rem',
                borderRadius: '8px',
                height: '38px',
                boxSizing: 'border-box',
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--color-border, #334155)',
              }}
            />
          </form>

          {/* Right Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Single GPS & Connectivity Status Dot */}
            <div
              title="Online • GPS Telemetry High Accuracy"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#10b981',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              <span style={{ display: 'none' }} className="user-text-wrap">GPS High</span>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications Menu */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                className="icon-btn"
                aria-label="Notifications"
                style={{
                  position: 'relative',
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted, #94a3b8)',
                  background: notifMenuOpen ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: '1px solid var(--color-border, #334155)',
                  cursor: 'pointer',
                }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    minWidth: '16px',
                    height: '16px',
                    padding: '0 4px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--accent-orange)',
                    color: '#ffffff',
                    fontSize: '0.625rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notifMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '46px',
                    width: '340px',
                    maxHeight: '440px',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--color-surface, #1e293b)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #334155)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                    padding: '1rem',
                    zIndex: 50,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text, #f8fafc)' }}>
                        Notifications
                      </h4>
                      {unreadCount > 0 && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '999px', background: 'rgba(232, 84, 30, 0.15)', color: 'var(--accent-orange)', fontWeight: 700 }}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        style={{ background: 'none', border: 'none', fontSize: '0.725rem', color: '#38bdf8', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '340px' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
                        <Bell size={24} style={{ opacity: 0.4, margin: '0 auto 8px auto', display: 'block' }} />
                        <p style={{ margin: 0, fontSize: '0.825rem', fontWeight: 600 }}>No notifications</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.725rem' }}>Real field events will appear here</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) handleMarkOneRead(n.id);
                            const href = notificationHref(n);
                            if (href) {
                              setNotifMenuOpen(false);
                              navigate(href);
                            }
                          }}
                          style={{
                            padding: '10px',
                            borderRadius: '8px',
                            background: n.read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(232, 84, 30, 0.08)',
                            border: n.read ? '1px solid transparent' : '1px solid rgba(232, 84, 30, 0.25)',
                            fontSize: '0.8rem',
                            cursor: n.read && !notificationHref(n) ? 'default' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <p style={{ margin: '0 0 2px 0', fontWeight: 700, color: 'var(--color-text, #f8fafc)', fontSize: '0.825rem' }}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-orange)', flexShrink: 0, marginTop: '4px' }} />
                            )}
                          </div>
                          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.75rem', lineHeight: 1.35 }}>
                            {n.body}
                          </p>
                          <span style={{ display: 'block', marginTop: '4px', fontSize: '0.675rem', color: 'var(--muted)' }}>
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '8px',
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #102443 0%, #1769F5 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(56, 189, 248, 0.4)',
                }}>
                  {userInitials}
                </div>
                <div style={{ textAlign: 'left', display: 'none', minWidth: '80px' }} className="user-text-wrap">
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text, #f8fafc)', lineHeight: 1.2 }}>
                    {displayName}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {roleMeta[role]?.label || 'Customer'}
                  </p>
                </div>
                <ChevronDown size={14} color="#94a3b8" />
              </button>

              {/* Profile Dropdown */}
              {profileMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '46px',
                    width: '230px',
                    background: 'var(--color-surface, #1e293b)',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border, #334155)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                    padding: '0.75rem',
                    zIndex: 50,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border, #334155)', marginBottom: '0.5rem' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text, #f8fafc)' }}>
                      {displayName}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {user?.email || ''}
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.725rem', color: '#10b981', fontWeight: 600 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                      Account: {profile?.accountStatus || 'ACTIVE'}
                    </div>
                  </div>

                  <Link
                    to={profilePath}
                    onClick={() => setProfileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      color: 'var(--color-text, #f8fafc)',
                      fontSize: '0.825rem',
                      textDecoration: 'none',
                    }}
                  >
                    <User size={15} color="#94a3b8" /> Profile
                  </Link>
                  <Link
                    to={settingsPath}
                    onClick={() => setProfileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      color: 'var(--color-text, #f8fafc)',
                      fontSize: '0.825rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Settings size={15} color="#94a3b8" /> Settings
                  </Link>
                  <Link
                    to={supportPath}
                    onClick={() => setProfileMenuOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      color: 'var(--color-text, #f8fafc)',
                      fontSize: '0.825rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Headphones size={15} color="#94a3b8" /> Support
                  </Link>

                  <div style={{ borderTop: '1px solid var(--color-border, #334155)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    {user ? (
                      <button
                        type="button"
                        onClick={() => signOut()}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          color: '#f87171',
                          background: 'none',
                          border: 'none',
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <LogOut size={15} /> Sign Out
                      </button>
                    ) : (
                      <Link
                        to="/login"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          color: '#38bdf8',
                          fontSize: '0.825rem',
                          textDecoration: 'none',
                        }}
                      >
                        <LogIn size={15} /> Sign In
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Manager Operational State Jurisdiction Banner */}
        {(role === 'operations_manager' || role === 'manager' || (profile?.roles?.includes('MANAGER') ?? false)) && (
          <aside
            aria-label="Operational Area Jurisdiction"
            style={{
              background: 'linear-gradient(90deg, #101c30 0%, #0d1524 100%)',
              borderBottom: '1px solid rgba(232, 84, 30, 0.35)',
              padding: '10px clamp(16px, 3vw, 32px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  background: areaBanner?.isAssigned ? 'rgba(232, 84, 30, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${areaBanner?.isAssigned ? 'rgba(232, 84, 30, 0.45)' : 'rgba(245, 158, 11, 0.45)'}`,
                  color: areaBanner?.isAssigned ? '#ff8a50' : '#fbbf24',
                  fontWeight: 700,
                  fontSize: '0.775rem',
                  letterSpacing: '0.04em',
                }}
              >
                <MapPin size={13} />
                {areaBanner?.isAssigned && areaBanner.stateCode
                  ? `Area: ${areaBanner.stateName} (${areaBanner.stateCode})`
                  : 'Area: Unassigned'}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 500 }}>
                {areaBanner?.isAssigned
                  ? '(Assigned by admin • Exclusive operational jurisdiction over field workers, tasks, wallets & tickets in this state)'
                  : 'No operational jurisdiction assigned. Contact Platform Admin to allocate your state.'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: '#10b981', fontWeight: 600 }}>
              <ShieldAlert size={14} style={{ color: '#10b981' }} />
              <span>Area Scope Enforced by Database</span>
            </div>
          </aside>
        )}

        {/* Page Main Content */}
        <main id="main" ref={mainRef} tabIndex={-1} className="content">
          {allowed ? (
            <div key={location.pathname} className="page-enter">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          ) : (
            <AccessDenied />
          )}
        </main>

        <footer className="footer">
          <ShieldAlert size={14} aria-hidden />
          <span>ChaseHorse ERP • End-to-End Field Task Lifecycle & Immutable Reward Ledger • Pan-India</span>
        </footer>
      </div>

      {showWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inactivity-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              color: 'var(--ink)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏱️</div>
            <h3 id="inactivity-title" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--ink)' }}>
              Session Expiring Soon
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              You have been inactive. For enterprise security, your ChaseHorse session will automatically disconnect in{' '}
              <strong style={{ color: '#F97316', fontSize: '1.1rem' }}>
                {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
              </strong>
              .
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={resetTimer}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#D9531E',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                Stay Logged In
              </button>
              <button
                type="button"
                onClick={handleInactivityTimeout}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: 'transparent',
                  color: 'var(--muted)',
                  border: '1px solid #475569',
                  borderRadius: '10px',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Sign Out Now
              </button>
            </div>
          </div>
        </div>
      )}
      <NotificationPopups
        notifications={notifications}
        hrefFor={notificationHref}
        onOpen={(n) => {
          if (!n.read) handleMarkOneRead(n.id);
        }}
      />
    </div>
  );
}
