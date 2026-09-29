import { useState } from "react";
import { LoaderCircle, Lock, Mail, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { OtpStep } from "./OtpStep";
import { useFinance, type OtpChallenge } from "../lib/finance";

/** Two-step email change: confirm the current password, then verify a code sent to the new address. */
export function ChangeEmailDialog({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: (email: string) => void }) {
  const { profile, startEmailChange, confirmEmailChange } = useFinance();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);

  function close() {
    setNewEmail("");
    setPassword("");
    setError("");
    setChallenge(null);
    onClose();
  }

  async function start() {
    const email = newEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email address.");
    if (email === profile.email.toLowerCase()) return setError("That's already your email address.");
    if (!password) return setError("Enter your current password.");
    setBusy(true);
    setError("");
    const result = await startEmailChange(email, password);
    setBusy(false);
    if (result.ok && result.data) {
      setChallenge(result.data);
      setPassword("");
    } else {
      setError(result.error ?? "Unable to send the code");
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={close} />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            className="fixed inset-4 z-50 overflow-auto rounded-3xl border border-border bg-card p-6 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2"
            role="dialog"
            aria-modal="true"
            aria-label="Change email"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Change email</h2>
              <button onClick={close} className="rounded-xl p-2 hover:bg-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {challenge ? (
              <OtpStep
                challenge={challenge}
                onChallenge={setChallenge}
                onBack={() => setChallenge(null)}
                onVerify={confirmEmailChange}
                onVerified={() => {
                  onChanged(challenge.email);
                  close();
                }}
                description="confirm you own this address. Your email won't change until you enter it"
                submitLabel="Verify & update email"
              />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void start();
                }}
              >
                <p className="text-sm text-muted-foreground">
                  Currently <span className="font-medium text-foreground">{profile.email}</span>. We'll send a code to the new address to confirm it's yours.
                </p>
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">New email</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3 focus-within:border-primary">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <input type="email" autoComplete="email" autoFocus value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="w-full bg-transparent outline-none" placeholder="you@example.com" />
                  </div>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Current password</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-input-background px-4 py-3 focus-within:border-primary">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent outline-none" />
                  </div>
                </label>
                {error ? <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy || !newEmail || !password}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "Sending code..." : "Send verification code"}
                </button>
              </form>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
