import { useState } from "react";
import { KeyRound, LoaderCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { PasswordOtpStep } from "./PasswordOtpStep";
import { useFinance, type OtpChallenge } from "../lib/finance";

/** Change password: a code goes to the account email; the new password applies only after it's verified. */
export function ChangePasswordDialog({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const { profile, startPasswordChange, completePasswordChange } = useFinance();
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setChallenge(null);
    setError("");
    onClose();
  }

  async function sendCode() {
    setBusy(true);
    setError("");
    const result = await startPasswordChange();
    setBusy(false);
    if (result.ok && result.data) setChallenge(result.data);
    else setError(result.error ?? "Unable to send the code");
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
            className="fixed inset-4 z-50 overflow-auto rounded-3xl border border-border bg-card p-6 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2"
            role="dialog"
            aria-modal="true"
            aria-label="Change password"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Change password</h2>
              <button onClick={close} className="rounded-xl p-2 hover:bg-muted" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {challenge ? (
              <PasswordOtpStep
                challenge={challenge}
                onChallenge={setChallenge}
                onBack={() => setChallenge(null)}
                onComplete={completePasswordChange}
                onDone={() => {
                  onChanged();
                  close();
                }}
                description="confirm it's you before changing your password"
                submitLabel="Verify & change password"
              />
            ) : (
              <div className="space-y-4">
                <div className="flex gap-3 rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p>
                    We'll send a verification code to <span className="font-medium text-foreground">{profile.email}</span>. Then choose your new
                    password and enter the code. Signed in with Google? This also lets you add a password.
                  </p>
                </div>
                {error ? <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
                <button
                  onClick={() => void sendCode()}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "Sending code..." : "Send verification code"}
                </button>
              </div>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
