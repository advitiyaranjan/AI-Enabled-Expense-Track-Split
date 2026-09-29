import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, MailCheck, RotateCw } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./ui/input-otp";
import { useFinance, type OtpChallenge } from "../lib/finance";

type VerifyResult = { ok: boolean; error?: string };

function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return left;
}

function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Second step of sign-in/sign-up: enter the 6-digit code emailed to the user. */
export function OtpStep({ challenge, onChallenge, onBack, onVerify, onVerified, description, submitLabel }: {
  challenge: OtpChallenge;
  onChallenge: (challenge: OtpChallenge) => void;
  onBack: () => void;
  /** Defaults to sign-in/sign-up verification */
  onVerify?: (challengeId: string, code: string) => Promise<VerifyResult>;
  onVerified?: () => void;
  description?: string;
  submitLabel?: string;
}) {
  const { verifyOtp, resendOtp } = useFinance();
  const verify = onVerify ?? verifyOtp;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const resendIn = useCountdown(challenge.resendIn);
  const expiresIn = useCountdown(challenge.expiresIn);

  async function submit(value = code) {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setError("");
    const result = await verify(challenge.challengeId, value);
    setVerifying(false);
    if (!result.ok) {
      setError(result.error ?? "That code didn't work");
      setCode("");
    } else {
      onVerified?.();
    }
    // On success the provider stores the session and the auth page redirects to the dashboard
  }

  async function resend() {
    setResending(true);
    setError("");
    setNotice("");
    const result = await resendOtp(challenge.challengeId);
    setResending(false);
    if (result.ok && result.data) {
      onChallenge(result.data);
      setCode("");
      setNotice("A new code is on its way.");
    } else {
      setError(result.error ?? "Unable to resend the code");
    }
  }

  const expired = expiresIn <= 0;

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <MailCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Check your email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-semibold text-foreground">{challenge.email}</span> to{" "}
          {description ?? (challenge.purpose === "register" ? "confirm it's really you and finish creating your account" : "confirm it's you signing in")}.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => {
            const digits = value.replace(/\D/g, "");
            setCode(digits);
            setError("");
            if (digits.length === 6) void submit(digits);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          disabled={verifying || expired}
          containerClassName="justify-center"
          aria-label="Verification code"
        >
          <InputOTPGroup className="gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <InputOTPSlot key={index} index={index} className="h-14 w-12 rounded-xl border text-2xl font-semibold first:rounded-xl last:rounded-xl" />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <p className={`text-center text-xs ${expired ? "text-expense" : "text-muted-foreground"}`}>
          {expired ? "This code has expired. Request a new one below." : `Code expires in ${formatClock(expiresIn)}`}
        </p>

        {error ? <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div> : null}
        {notice && !error ? <div className="rounded-2xl border border-income/20 bg-income/10 p-3 text-sm text-income" role="status">{notice}</div> : null}

        <button
          type="submit"
          disabled={code.length !== 6 || verifying || expired}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          {verifying ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}
          {verifying ? "Verifying..." : submitLabel ?? (challenge.purpose === "register" ? "Verify & create account" : "Verify & sign in")}
        </button>
      </form>

      <div className="text-center text-sm text-muted-foreground">
        Didn't get it? Check spam, or{" "}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resendIn > 0 || resending}
          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          <RotateCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
          {resendIn > 0 ? `resend in ${resendIn}s` : "resend the code"}
        </button>
      </div>
    </div>
  );
}
