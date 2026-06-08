import React, { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, BedDouble, Users, Settings, Image as ImageIcon, LogOut, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEnsureProperty } from '@/hooks/useSupabase';

const navItems = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Calendar', href: '/admin/calendar', icon: Calendar },
  { name: 'Rooms', href: '/admin/rooms', icon: BedDouble },
  { name: 'Guests', href: '/admin/bookings', icon: Users },
  { name: 'Sync', href: '/admin/sync', icon: RefreshCw },
  { name: 'Gallery', href: '/admin/gallery', icon: ImageIcon },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const { mutate: ensureProperty } = useEnsureProperty();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  useEffect(() => {
    ensureProperty();
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      });
    });
  }, [ensureProperty]);

  const initials = userEmail ? userEmail.substring(0, 2).toUpperCase() : 'A';
  const displayEmail = userEmail || 'Admin';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <div className="font-bold text-xl tracking-tight flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs">
              B
            </div>
            Brandspire
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium leading-none truncate" title={displayEmail}>{displayEmail}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                import('@/lib/supabase').then(({ supabase }) => {
                  supabase.auth.signOut().then(() => {
                    window.location.href = '/admin/login';
                  });
                });
              }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-2"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-8">
          <h2 className="text-lg font-medium text-foreground">
            {navItems.find(i => location.pathname.startsWith(i.href))?.name || 'Admin'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              v1.0.0
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
