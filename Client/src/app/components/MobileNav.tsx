import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  ScanLine,
  Sparkles,
  Sun,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useFinance } from "../lib/finance";

const tabs = [
  { path: "/", icon: LayoutDashboard, label: "Home" },
  { path: "/transactions", icon: Receipt, label: "Activity" },
  { path: "/scan", icon: ScanLine, label: "Scan", primary: true },
  { path: "/insights", icon: Sparkles, label: "AI" },
];

const moreItems = [
  { path: "/split", icon: Users, label: "Split expenses", hint: "Shared bills & settle up" },
  { path: "/budget", icon: Wallet, label: "Budgets", hint: "Monthly limits & pace" },
  { path: "/profile", icon: User, label: "Profile & settings", hint: "Account, data, preferences" },
];

/** Bottom tab bar for phones and tablets (hidden at lg, where the sidebar takes over). */
export function MobileNav() {
  const { profile, updateProfile, logout } = useFinance();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((item) => location.pathname.startsWith(item.path));

  // Close the sheet whenever the route changes
  useEffect(() => setMoreOpen(false), [location.pathname]);

  return (
    <>
      <AnimatePresence>
        {moreOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-card px-4 pt-3 shadow-2xl lg:hidden"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
              role="dialog"
              aria-modal="true"
              aria-label="More"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{profile.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.publicId ? `ID ${profile.publicId} · ` : ""}
                    {profile.email}
                  </p>
                </div>
                <button onClick={() => setMoreOpen(false)} className="rounded-xl p-2 hover:bg-muted" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1">
                {moreItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors ${isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"}`
                    }
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    </div>
                  </NavLink>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
                <button
                  onClick={() => void updateProfile({ darkMode: !profile.darkMode })}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-medium hover:bg-muted"
                >
                  {profile.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {profile.darkMode ? "Light mode" : "Dark mode"}
                </button>
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* z-30 keeps the bar below page dialogs (z-40/50) so it never covers their buttons */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main navigation"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-1">
          {tabs.map((tab) =>
            tab.primary ? (
              <NavLink key={tab.path} to={tab.path} className="flex flex-col items-center" aria-label={tab.label}>
                {({ isActive }) => (
                  <>
                    <span
                      className={`-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary-bright text-white shadow-lg shadow-primary/30 ring-4 ring-background transition-transform ${
                        isActive ? "scale-105" : ""
                      }`}
                    >
                      <tab.icon className="h-6 w-6" />
                    </span>
                    <span className={`mt-1 text-[11px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === "/"}
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${isActive ? "bg-primary/15" : ""}`}>
                      <tab.icon className="h-5 w-5" />
                    </span>
                    {tab.label}
                  </>
                )}
              </NavLink>
            ),
          )}
          <button
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${moreActive || moreOpen ? "text-primary" : "text-muted-foreground"}`}
          >
            <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${moreActive || moreOpen ? "bg-primary/15" : ""}`}>
              <Menu className="h-5 w-5" />
            </span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}
