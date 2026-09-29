import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, useFinance } from "../lib/finance";

type GoogleIdApi = {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: "popup" }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptPromise: Promise<void> | null = null;

// Google's own Identity Services script; nothing is bundled into the app
function loadGoogleScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** "Sign in with Google" button. Renders nothing unless the server has a Google Client ID configured. */
export function GoogleSignInButton({ onError }: { onError: (message: string) => void }) {
  const { googleSignIn, profile } = useFinance();
  const container = useRef<HTMLDivElement | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/config`)
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => setClientId(config?.google_client_id ?? null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !container.current) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        const api = window.google?.accounts.id;
        if (cancelled || !api || !container.current) return;
        api.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            setBusy(true);
            const result = await googleSignIn(credential);
            setBusy(false);
            if (!result.ok) onError(result.error ?? "Google sign-in failed");
          },
        });
        api.renderButton(container.current, {
          theme: profile.darkMode ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(container.current.offsetWidth || 320, 400),
        });
      })
      .catch((error: Error) => onError(error.message));
    return () => {
      cancelled = true;
    };
  }, [clientId, profile.darkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clientId) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div ref={container} className={`flex min-h-11 justify-center ${busy ? "pointer-events-none opacity-60" : ""}`} />
    </div>
  );
}
