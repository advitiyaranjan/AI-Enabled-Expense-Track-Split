import { useState } from "react";
import { Navigate } from "react-router";
import { Globe2, Lock, Mail, MapPin, Phone, TrendingUp, User } from "lucide-react";
import { motion } from "motion/react";
import { COUNTRIES as countries, getCountryConfig, useFinance } from "../lib/finance";

export function AuthPage() {
  const { isAuthenticated, login, register, loading, backendStatus, reconnect } = useFinance();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    location: "",
    country: "United States",
  });

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit() {
    if (submitting || !form.email || !form.password || (mode === "register" && !form.name)) return;
    if (mode === "register" && form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setSubmitting(true);
    setError("");
    const action = mode === "login" ? login : register;
    const result = await action(form);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong");
    }
    setSubmitting(false);
  }

  const countryConfig = getCountryConfig(form.country);

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.22),_transparent_40%)] px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} className="rounded-[2rem] border border-border bg-card/60 p-8 backdrop-blur">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary-bright">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">FinanceAI</h1>
              <p className="text-sm text-muted-foreground">Your AI-powered money copilot</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
              <h2 className="text-lg font-semibold">Just say what you spent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Type "coffee 4.50 at Starbucks yesterday" or snap a receipt. AI fills in the amount, category, and date.
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card/80 p-5">
              <h2 className="text-lg font-semibold">Know what's safe to spend</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A daily allowance, month-end forecasts, a financial health score, and subscription tracking, all from your own data.
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card/80 p-5">
              <h2 className="text-lg font-semibold">Ask anything</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                "Can I afford a 200 purchase this week?" The assistant answers from your real numbers, in {countryConfig.currency}.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} className="rounded-[2rem] border border-border bg-card p-8 shadow-2xl shadow-black/20">
          <div className="mb-6 flex gap-2 rounded-2xl bg-muted/40 p-1">
            {(["login", "register"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value);
                  setError("");
                }}
                className={`flex-1 rounded-2xl px-4 py-3 font-medium transition-all ${
                  mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {value === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {backendStatus === "offline" ? (
            <div className="mb-4 rounded-2xl border border-expense/20 bg-expense/10 p-4 text-sm text-expense">
              Can't reach the server. Start the backend (uvicorn app.main:app) and{" "}
              <button onClick={() => void reconnect()} className="font-semibold underline">retry</button>.
            </div>
          ) : null}

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            {mode === "register" ? (
              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground">Full name</span>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full bg-transparent outline-none" placeholder="Your name" />
                </div>
              </label>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm text-muted-foreground">Email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full bg-transparent outline-none" placeholder="you@example.com" />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-muted-foreground">Password</span>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full bg-transparent outline-none" placeholder="Choose a strong password" />
              </div>
            </label>

            {mode === "register" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full bg-transparent outline-none" placeholder="+1 234..." />
                    </div>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Country</span>
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3">
                      <Globe2 className="h-4 w-4 text-muted-foreground" />
                      <select value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} className="w-full bg-transparent outline-none">
                        {countries.map((country) => (
                          <option key={country} value={country} className="bg-card text-foreground">
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">City / location</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="w-full bg-transparent outline-none" placeholder="City, State" />
                  </div>
                </label>
                <div className="rounded-2xl border border-secondary-bright/20 bg-secondary-bright/10 p-4 text-sm text-muted-foreground">
                  Selected country: <span className="font-semibold text-foreground">{form.country}</span>.
                  Default currency for this account will be <span className="font-semibold text-foreground">{countryConfig.currency}</span>.
                </div>
              </>
            ) : null}

            {error ? <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}

            <button
              type="submit"
              disabled={submitting || !form.email || !form.password || (mode === "register" && !form.name)}
              className="w-full rounded-2xl bg-primary px-5 py-4 font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
