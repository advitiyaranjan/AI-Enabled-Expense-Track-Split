import { HeartPulse, Lightbulb } from "lucide-react";
import { getHealthScore } from "../lib/analytics";
import { useFinance } from "../lib/finance";

function scoreColor(score: number) {
  if (score >= 80) return "text-income";
  if (score >= 65) return "text-primary";
  if (score >= 45) return "text-secondary-bright";
  return "text-expense";
}

/** Financial Health Score: 0–100 across savings, budgets, stability and buffer. */
export function HealthScoreCard() {
  const { transactions, budgets } = useFinance();
  const health = getHealthScore(transactions, budgets);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Financial health</h2>
      </div>

      {!health ? (
        <p className="text-sm text-muted-foreground">Add at least 5 transactions to get your health score.</p>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <div className="relative h-28 w-28 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="9" className="text-muted" />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - health.score / 100)}
                  className={`${scoreColor(health.score)} transition-all duration-700`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${scoreColor(health.score)}`}>{health.score}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">of 100</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className={`text-lg font-semibold ${scoreColor(health.score)}`}>{health.grade}</p>
              {health.components.map((component) => (
                <div key={component.label}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{component.label}</span>
                    <span>{Math.round(component.score)}/{component.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" title={component.detail}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(component.score / component.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex gap-2 rounded-2xl bg-muted/40 p-3 text-sm text-muted-foreground">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{health.tip}</span>
          </div>
        </>
      )}
    </div>
  );
}
