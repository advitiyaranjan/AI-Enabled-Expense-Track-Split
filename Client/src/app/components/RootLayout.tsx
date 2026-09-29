import { Outlet, NavLink, Navigate, ScrollRestoration } from "react-router";
import { MobileNav } from "./MobileNav";
import {
  LayoutDashboard,
  ScanLine,
  Receipt,
  Users,
  Sparkles,
  Wallet,
  User,
  TrendingUp,
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
    return null;
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

/** Only surfaces connection state when something is wrong; no permanent header. */
function OfflineBanner() {
  const { backendStatus, reconnect } = useFinance();
  if (backendStatus !== "offline") return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-expense px-4 py-1.5 text-xs font-medium text-white">
      <WifiOff className="h-3.5 w-3.5" />
      You're offline. Changes are saved on this device.
      <button onClick={() => void reconnect()} className="underline underline-offset-2">
        Retry
      </button>
    </div>
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

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <OfflineBanner />

        <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Outlet />
        </main>
        <ScrollRestoration />
      </div>

      <MobileNav />
    </div>
  );
}
