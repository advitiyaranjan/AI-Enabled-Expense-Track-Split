import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Check, CheckCircle2, Copy, LoaderCircle, QrCode, Smartphone, TrendingUp } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { API_BASE_URL } from "../lib/finance";

interface PublicSplit {
  token: string;
  title: string;
  total: number;
  currency: string;
  payee: { name: string; upi_id: string | null; public_id: number | null };
  participants: Array<{ key: string; name: string; amount: number; settled: boolean; claimed: boolean }>;
  created_at: string | null;
}

// Encode with %20 rather than "+": several UPI apps show "+" literally in names and notes
function upiQuery(params: Record<string, string>) {
  return Object.entries(params)
    // Keep "@" literal in the UPI ID: some older UPI apps don't decode %40
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%40/g, "@")}`)
    .join("&");
}

function detectPlatform() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

// iOS has no system chooser for upi://, so offer the popular apps by their own URL schemes
const IOS_APPS = [
  { name: "Google Pay", scheme: "tez://upi/pay" },
  { name: "PhonePe", scheme: "phonepe://pay" },
  { name: "Paytm", scheme: "paytmmp://pay" },
];

/** Public page opened from a shared split link: pick your name, see your share, pay by UPI. */
export function PaySplit() {
  const { token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const [split, setSplit] = useState<PublicSplit | null>(null);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState(searchParams.get("p") ?? "");
  const [claiming, setClaiming] = useState(false);
  const [copied, setCopied] = useState("");
  const platform = useMemo(detectPlatform, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/splits/public/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.detail ?? "This payment link isn't available.");
        return body as PublicSplit;
      })
      .then((data) => {
        if (!active) return;
        setSplit(data);
        document.title = `Pay ${data.payee.name} · ${data.title}`;
      })
      .catch((err: Error) => active && setError(err.message || "Couldn't load this payment link."));
    return () => {
      active = false;
    };
  }, [token]);

  const money = useMemo(
    () => new Intl.NumberFormat("en-IN", { style: "currency", currency: split?.currency || "INR", maximumFractionDigits: 2 }),
    [split?.currency],
  );
  const person = split?.participants.find((participant) => participant.key === selectedKey) ?? null;
  const canUpi = Boolean(split?.payee.upi_id) && split?.currency === "INR";

  function upiParams() {
    if (!split || !person) return "";
    return upiQuery({
      pa: split.payee.upi_id ?? "",
      pn: split.payee.name,
      am: person.amount.toFixed(2),
      cu: "INR",
      tn: `${split.title} - ${person.name}`.slice(0, 50),
    });
  }

  async function markPaid() {
    if (!person) return;
    setClaiming(true);
    try {
      const response = await fetch(`${API_BASE_URL}/splits/public/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: person.key }),
      });
      if (response.ok) setSplit(await response.json());
    } finally {
      setClaiming(false);
    }
  }

  function copy(label: string, value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    });
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.18),_transparent_45%)] px-4 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary-bright">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold">FinanceAI</span>
        </div>

        {error ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">Link not available</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !split ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-border bg-card p-10 text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin" /> Loading bill...
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">{split.payee.name} paid for</p>
              <h1 className="mt-1 text-2xl font-bold">{split.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Total {money.format(split.total)}</p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="mb-3 text-sm font-medium">Who are you?</p>
              <div className="grid gap-2">
                {split.participants.map((participant) => (
                  <button
                    key={participant.key}
                    onClick={() => setSelectedKey(participant.key)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selectedKey === participant.key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="font-medium">{participant.name}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {participant.settled ? (
                        <span className="inline-flex items-center gap-1 text-income"><CheckCircle2 className="h-4 w-4" /> Settled</span>
                      ) : participant.claimed ? (
                        <span className="text-muted-foreground">Marked paid</span>
                      ) : (
                        <span className="font-semibold">{money.format(participant.amount)}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {person ? (
              <div className="rounded-3xl border border-primary/30 bg-card p-6">
                {person.settled ? (
                  <div className="text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-income" />
                    <p className="mt-2 font-semibold">You're all settled</p>
                    <p className="text-sm text-muted-foreground">{split.payee.name} confirmed your payment.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Your share</p>
                    <p className="text-4xl font-bold">{money.format(person.amount)}</p>

                    {!canUpi ? (
                      <p className="mt-4 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
                        {split.currency !== "INR"
                          ? "UPI payments work for bills in Indian rupees only. Please pay directly."
                          : `${split.payee.name} hasn't added a UPI ID yet. Please pay them directly.`}
                      </p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {platform === "android" ? (
                          <a
                            href={`upi://pay?${upiParams()}`}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-lg font-semibold text-primary-foreground hover:bg-primary-glow"
                          >
                            <Smartphone className="h-5 w-5" /> Pay {money.format(person.amount)} with UPI
                          </a>
                        ) : null}

                        {platform === "ios" ? (
                          <div className="grid gap-2">
                            {IOS_APPS.map((app) => (
                              <a
                                key={app.name}
                                href={`${app.scheme}?${upiParams()}`}
                                className="flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground hover:bg-primary-glow"
                              >
                                Pay with {app.name}
                              </a>
                            ))}
                            <a href={`upi://pay?${upiParams()}`} className="text-center text-sm text-primary underline">
                              Other UPI app
                            </a>
                          </div>
                        ) : null}

                        {platform === "desktop" ? (
                          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4">
                            <QRCodeSVG value={`upi://pay?${upiParams()}`} size={200} level="M" />
                            <p className="flex items-center gap-1 text-sm text-slate-600">
                              <QrCode className="h-4 w-4" /> Scan with any UPI app to pay
                            </p>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between gap-2 rounded-2xl border border-border px-4 py-3 text-sm">
                          <span className="truncate">
                            UPI: <span className="font-mono font-medium">{split.payee.upi_id}</span>
                          </span>
                          <button onClick={() => copy("upi", split.payee.upi_id ?? "")} className="inline-flex shrink-0 items-center gap-1 text-primary">
                            {copied === "upi" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied === "upi" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          If your app won't open or blocks the prefilled amount, copy the UPI ID and pay {money.format(person.amount)} manually.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => void markPaid()}
                      disabled={person.claimed || claiming}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-income/40 px-5 py-3 font-medium text-income hover:bg-income/10 disabled:opacity-70"
                    >
                      {claiming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {person.claimed ? `Marked as paid. ${split.payee.name} will confirm` : "I've paid"}
                    </button>
                  </>
                )}
              </div>
            ) : null}

            <p className="text-center text-xs text-muted-foreground">
              Payments go directly from your UPI app to {split.payee.name}. FinanceAI never handles the money.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
