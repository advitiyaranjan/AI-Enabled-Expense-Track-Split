import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { OtpStep } from "./OtpStep";
import type { OtpChallenge } from "../lib/finance";

/** New password + confirmation, then the emailed code. The password is applied only when the code verifies. */
export function PasswordOtpStep({ challenge, onChallenge, onBack, onComplete, onDone, description, submitLabel }: {
  challenge: OtpChallenge;
  onChallenge: (challenge: OtpChallenge) => void;
  onBack: () => void;
  onComplete: (challengeId: string, code: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  onDone?: () => void;
  description: string;
  submitLabel: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const mismatch = confirm.length > 0 && password !== confirm;

  async function verify(challengeId: string, code: string) {
    if (password.length < 8) return { ok: false, error: "Enter a new password of at least 8 characters first." };
    if (password !== confirm) return { ok: false, error: "The two passwords don't match." };
    return onComplete(challengeId, code, password);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3">
        {[
          { label: "New password", value: password, set: setPassword, auto: "new-password" },
          { label: "Confirm new password", value: confirm, set: setConfirm, auto: "new-password" },
        ].map((field, index) => (
          <label key={field.label} className="grid gap-2">
            <span className="text-sm text-muted-foreground">{field.label}</span>
            <div className={`flex items-center gap-3 rounded-2xl border bg-input-background px-4 py-3 focus-within:border-primary ${index === 1 && mismatch ? "border-expense" : "border-border"}`}>
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                autoComplete={field.auto}
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder={index === 0 ? "At least 8 characters" : ""}
              />
              {index === 0 ? (
                <button type="button" onClick={() => setShow((value) => !value)} aria-label={show ? "Hide passwords" : "Show passwords"} className="text-muted-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </label>
        ))}
        {mismatch ? <p className="text-xs text-expense">Passwords don't match yet.</p> : null}
      </div>
      <OtpStep
        challenge={challenge}
        onChallenge={onChallenge}
        onBack={onBack}
        onVerify={verify}
        onVerified={onDone}
        description={description}
        submitLabel={submitLabel}
      />
    </div>
  );
}
