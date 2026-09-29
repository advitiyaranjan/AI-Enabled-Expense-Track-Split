import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Database,
  Download,
  Globe,
  LogOut,
  MapPin,
  Moon,
  Phone,
  Save,
  Sun,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";
import { ChangeEmailDialog } from "../components/ChangeEmailDialog";
import { HealthScoreCard } from "../components/HealthScoreCard";
import { toCSV, todayISO } from "../lib/analytics";
import { COUNTRIES, getAccountStats, getCountryConfig, useFinance } from "../lib/finance";

export function Profile() {
  const { profile, updateProfile, transactions, budgets, groups, formatMoney, logout } = useFinance();
  const stats = getAccountStats(transactions);
  const accountFields = {
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    country: profile.country,
    upiId: profile.upiId,
  };
  const [draft, setDraft] = useState(accountFields);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  // Re-sync the form only when the saved account data changes, so toggling a preference doesn't wipe unsaved edits
  useEffect(() => {
    setDraft(accountFields);
  }, [profile.displayName, profile.email, profile.phone, profile.location, profile.country, profile.upiId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = (Object.keys(accountFields) as Array<keyof typeof accountFields>).some((key) => draft[key] !== accountFields[key]);

  async function handleSave() {
    if (!draft.displayName.trim()) return setMessage({ tone: "error", text: "Display name can't be empty." });
    if (draft.upiId.trim() && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(draft.upiId.trim())) {
      return setMessage({ tone: "error", text: "That UPI ID doesn't look right. It should look like name@okaxis or 98xxxxxx@ybl." });
    }
    setSaving(true);
    const result = await updateProfile(draft);
    setSaving(false);
    setMessage(result.ok ? { tone: "ok", text: "Profile updated." } : { tone: "error", text: result.error ?? "Unable to update profile." });
  }

  function exportAll() {
    const payload = { exportedAt: new Date().toISOString(), profile, transactions, budgets, groups };
    const files = [
      { name: `financeai-transactions-${todayISO()}.csv`, type: "text/csv", body: toCSV(transactions) },
      { name: `financeai-backup-${todayISO()}.json`, type: "application/json", body: JSON.stringify(payload, null, 2) },
    ];
    for (const file of files) {
      const url = URL.createObjectURL(new Blob([file.body], { type: file.type }));
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  const preferences = [
    {
      icon: profile.darkMode ? Moon : Sun,
      label: "Dark mode",
      value: profile.darkMode,
      onToggle: () => void updateProfile({ darkMode: !profile.darkMode }),
    },
    {
      icon: Bell,
      label: "Transaction alerts",
      value: profile.notifications.transactions,
      onToggle: () => void updateProfile({ notifications: { ...profile.notifications, transactions: !profile.notifications.transactions } }),
    },
    {
      icon: Bell,
      label: "Budget alerts",
      value: profile.notifications.budgetAlerts,
      onToggle: () => void updateProfile({ notifications: { ...profile.notifications, budgetAlerts: !profile.notifications.budgetAlerts } }),
    },
    {
      icon: Bell,
      label: "AI insights",
      value: profile.notifications.aiInsights,
      onToggle: () => void updateProfile({ notifications: { ...profile.notifications, aiInsights: !profile.notifications.aiInsights } }),
    },
    {
      icon: Bell,
      label: "Weekly reports",
      value: profile.notifications.weeklyReports,
      onToggle: () => void updateProfile({ notifications: { ...profile.notifications, weeklyReports: !profile.notifications.weeklyReports } }),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold">Profile & settings</h1>
        <p className="mt-1 text-muted-foreground">Update your identity, location, and preferences.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl bg-gradient-to-br from-primary via-secondary-bright to-secondary p-6 text-white lg:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/30 bg-white/20 text-4xl font-bold">
            {(profile.displayName || "?").trim()[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{profile.displayName}</h2>
            <p className="mt-1 text-white/80">{profile.email}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/90">
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {profile.phone || "No phone added"}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {profile.location || profile.country}
              </span>
              <span className="inline-flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {profile.country} · {profile.currency}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {message ? (
        <div className={`rounded-2xl border p-4 text-sm ${message.tone === "ok" ? "border-income/20 bg-income/10 text-income" : "border-destructive/20 bg-destructive/10 text-destructive"}`} role="status">
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Personal details</h3>
              <button
                type="submit"
                disabled={!dirty || saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Your FinanceAI ID</p>
                  <p className="font-mono text-xl font-bold tracking-widest">{profile.publicId ?? "--------"}</p>
                  <p className="text-xs text-muted-foreground">Friends can add you to a split with this number.</p>
                </div>
                {profile.publicId ? (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(String(profile.publicId)).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                    className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                ) : null}
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground">UPI ID (to receive split payments)</span>
                <input
                  type="text"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={draft.upiId}
                  placeholder="yourname@okaxis"
                  onChange={(event) => setDraft({ ...draft, upiId: event.target.value })}
                  className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">Shown on payment links for bills you paid, so friends can pay you back in one tap.</span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground">Display name</span>
                <input type="text" value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary" />
              </label>

              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">Email</span>
                <div className="flex gap-2">
                  <input type="email" value={profile.email} readOnly aria-label="Email" className="min-w-0 flex-1 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-muted-foreground outline-none" />
                  <button type="button" onClick={() => setChangingEmail(true)} className="rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:border-primary hover:text-primary">
                    Change
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">Changing your email requires your password and a code sent to the new address.</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Location</span>
                  <input type="text" value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary" />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Country</span>
                  <select value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary">
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Currency</span>
                  <input type="text" value={draft.country === profile.country ? profile.currency : getCountryConfig(draft.country).currency} readOnly className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-muted-foreground outline-none" />
                </label>
              </div>
            </div>
          </form>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <HealthScoreCard />
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">{transactions.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">Transactions</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className={`text-2xl font-bold ${stats.saved >= 0 ? "text-income" : "text-expense"}`}>{formatMoney(stats.saved)}</p>
              <p className="mt-1 text-sm text-muted-foreground">Net balance</p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
        <h3 className="mb-1 text-lg font-semibold">Preferences</h3>
        <p className="mb-4 text-sm text-muted-foreground">Saved instantly on this device.</p>
        <div className="space-y-3">
          {preferences.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-2xl bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-medium">{item.label}</span>
              </div>
              <button
                role="switch"
                aria-checked={item.value}
                aria-label={item.label}
                onClick={item.onToggle}
                className={`relative h-7 w-14 rounded-full transition-colors ${item.value ? "bg-primary" : "bg-switch-background"}`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${item.value ? "translate-x-8" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Database className="h-5 w-5 text-primary" /> Your data</h3>
          <p className="mb-4 text-sm text-muted-foreground">Take your data anywhere, or bring in history from your bank.</p>
          <div className="space-y-3">
            <button onClick={exportAll} disabled={transactions.length === 0} className="flex w-full items-center gap-3 rounded-2xl bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-50">
              <Download className="h-5 w-5 text-primary" />
              <span className="font-medium">Export everything (CSV + JSON backup)</span>
            </button>
            <Link to="/transactions" className="flex w-full items-center gap-3 rounded-2xl bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
              <Upload className="h-5 w-5 text-primary" />
              <span className="font-medium">Import a bank CSV on the Transactions page</span>
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6">
          <h3 className="mb-4 text-lg font-semibold text-destructive">Session</h3>
          <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 px-4 py-3 font-medium text-destructive transition-colors hover:bg-destructive/10">
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </motion.div>
      <ChangeEmailDialog
        open={changingEmail}
        onClose={() => setChangingEmail(false)}
        onChanged={(email) => setMessage({ tone: "ok", text: `Email updated to ${email}. A notice was sent to your old address.` })}
      />
    </div>
  );
}
