import { Outlet, NavLink, Navigate } from "react-router";
import {
  LayoutDashboard,
  ScanLine,
  Receipt,
  Users,
  Sparkles,
  Wallet,
  User,
  TrendingUp,
  Wifi,
  WifiOff,
  LoaderCircle,
  LogOut,
} from "lucide-react";
import { useFinance } from "../lib/finance";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/scan", icon: ScanLine, label: "Scan" },
  { path: "/transactions", icon: Receipt, label: "Transactions" },
  { path: "/split", icon: Users, label: "Split" },
  { path: "/insights", icon: Sparkles, label: "AI Insights" },
  { path: "/budget", icon: Wallet, label: "Budget" },
  { path: "/profile", icon: User, label: "Profile" },
];

function BackendIndicator() {
  const { backendStatus, reconnect } = useFinance();

  if (backendStatus === "checking") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        Connecting backend
      </div>
    );
  }

  if (backendStatus === "connected") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-income/20 bg-income/10 px-3 py-1.5 text-xs text-income">
        <Wifi className="h-3.5 w-3.5" />
        Backend connected
      </div>
    );
  }

  return (
    <button
      onClick={() => void reconnect()}
      title="Backend unreachable. Changes are kept on this device. Click to retry."
      className="inline-flex items-center gap-2 rounded-full border border-expense/20 bg-expense/10 px-3 py-1.5 text-xs text-expense transition-colors hover:bg-expense/20"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Offline · retry
    </button>
  );
}

export function RootLayout() {
  const { profile, isAuthenticated, loading, logout } = useFinance();

  if (!loading && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-72 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-full flex-col p-6">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary-bright">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">FinanceAI</h1>
              <p className="text-xs text-muted-foreground">Smart money command center</p>
            </div>
          </div>

          <div className="mb-6">
            <BackendIndicator />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                    {isActive ? <div className="ml-auto h-2 w-2 rounded-full bg-primary-glow" /> : null}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">{profile.displayName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{profile.email}</p>
            <button
              onClick={logout}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 lg:px-8">
            <div>
              <p className="text-sm text-muted-foreground">Welcome back</p>
              <h2 className="text-xl font-semibold">{profile.displayName}</h2>
            </div>
            <div className="flex items-center gap-3">
              <BackendIndicator />
              <button
                onClick={logout}
                className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border lg:hidden">
        <div className="flex gap-1 overflow-x-auto px-2 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `min-w-max rounded-xl px-3 py-2 text-xs transition-all ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`
              }
            >
              <div className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
