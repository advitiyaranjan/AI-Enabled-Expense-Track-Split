import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Calendar,
  DollarSign,
  LoaderCircle,
  MessageSquare,
  Repeat,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Area,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { averageMonthlyByCategory, formatDate, futureValue, getMonthPace } from "../lib/analytics";
import { getPredictionSeries, useChartTheme, useFinance, type ChatTurn } from "../lib/finance";

const SUGGESTED_QUESTIONS = [
  "How am I doing this month?",
  "Where can I cut back?",
  "Which subscriptions am I paying for?",
  "Can I afford a 200 purchase this week?",
  "Am I on track with my budgets?",
  "What will I spend next month?",
];

/** Render the small Markdown subset the assistant uses (**bold**, "- " bullets) without injecting HTML. */
function renderChatText(text: string) {
  return text.split("\n").map((line, lineIndex) => {
    const bulleted = line.replace(/^\s*[-*]\s+/, "• ").replace(/^#{1,6}\s+/, "");
    const parts = bulleted.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={lineIndex}>
        {parts.map((part, partIndex) => (partIndex % 2 === 1 ? <strong key={partIndex}>{part}</strong> : part))}
        {"\n"}
      </span>
    );
  });
}

export function AIInsights() {
  const { insights, transactions, profile, formatMoney, askAssistant, aiEnabled, aiModel, backendStatus } = useFinance();
  const chart = useChartTheme();
  const [scope, setScope] = useState<"month" | "all">("month");
  const [chat, setChat] = useState<Array<ChatTurn & { source?: string; notice?: string }>>([
    { role: "assistant", content: "Hi! I can see your transactions, budgets, and recurring bills. Ask me anything about your money." },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  // Keep the newest message in view by scrolling only the chat box, never the page, and not on first load
  useEffect(() => {
    if (chat.length <= 1 && !thinking) return;
    const box = chatBoxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [chat, thinking]);

  const pace = getMonthPace(transactions);
  const recurring = insights.recurring ?? [];
  const activeRecurring = recurring.filter((charge) => charge.active);
  const recurringMonthly = activeRecurring.reduce((sum, charge) => sum + charge.monthly_cost, 0);
  const trends = (insights.category_trends ?? []).filter((trend) => trend.this_month > 0 || trend.usual > 0);
  const biggestRise = trends.filter((trend) => (trend.change_pct ?? 0) > 10).sort((left, right) => (right.this_month - right.usual) - (left.this_month - left.usual))[0];

  const breakdownSource = scope === "month" && insights.category_breakdown_month ? insights.category_breakdown_month : insights.category_breakdown;
  const breakdown = breakdownSource.map((entry, index) => ({
    name: entry.category,
    value: entry.amount,
    color: chart.palette[index % chart.palette.length],
  }));
  const breakdownTotal = breakdown.reduce((sum, entry) => sum + entry.value, 0);

  const forecastData = useMemo(() => {
    const history = insights.monthly_totals.slice(-4).map((entry) => ({
      month: formatDate(`${entry.month}-01`, profile.locale, { month: "short" }),
      actual: entry.total,
      predicted: undefined as number | undefined,
      range: undefined as number[] | undefined,
    }));
    const future = getPredictionSeries(insights, profile.locale).map((entry) => ({ month: entry.month, actual: undefined, predicted: entry.predicted, range: entry.range }));
    // Connect the forecast line to the last actual point
    if (history.length && future.length) history[history.length - 1].predicted = history[history.length - 1].actual;
    return [...history, ...future];
  }, [insights, profile.locale]);
  const nextMonth = insights.predictions[0];

  // What-if simulator
  const averages = useMemo(() => averageMonthlyByCategory(transactions).filter((entry) => entry.category !== "Income").slice(0, 5), [transactions]);
  const [cuts, setCuts] = useState<Record<string, number>>({});
  const monthlySaving = averages.reduce((sum, entry) => sum + entry.monthly * ((cuts[entry.category] ?? 0) / 100), 0);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || thinking) return;
    const history: ChatTurn[] = chat.slice(1).map(({ role, content }) => ({ role, content }));
    setChat((current) => [...current, { role: "user", content: message }]);
    setInputMessage("");
    setThinking(true);
    const response = await askAssistant(message, history);
    setChat((current) => [...current, { role: "assistant", content: response.reply, source: response.source, notice: response.notice }]);
    setThinking(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary-bright">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI insights</h1>
            <p className="mt-1 text-muted-foreground">Forecasts, patterns, and advice generated from your data.</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${aiEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {backendStatus !== "connected" ? "Offline analysis" : aiEnabled ? `AI · ${aiModel ?? "connected"}` : "Smart rules engine (OpenAI unavailable)"}
        </span>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 p-6">
          <div className="mb-3 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Month-end forecast</h3>
          </div>
          <p className="text-2xl font-bold">{formatMoney(pace.projectedSpend)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pace.lastMonthSpent > 0
              ? `vs ${formatMoney(pace.lastMonthSpent)} last month, based on ${formatMoney(pace.spent)} spent over ${pace.day} days.`
              : `Based on ${formatMoney(pace.spent)} spent over ${pace.day} days.`}
          </p>
        </div>

        <div className="rounded-3xl border border-secondary-bright/20 bg-gradient-to-br from-secondary-bright/15 to-secondary-bright/5 p-6">
          <div className="mb-3 flex items-center gap-3">
            <Repeat className="h-5 w-5 text-secondary-bright" />
            <h3 className="font-semibold">Subscriptions & bills</h3>
          </div>
          <p className="text-2xl font-bold">{formatMoney(recurringMonthly)}<span className="text-base font-normal text-muted-foreground">/mo</span></p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeRecurring.length
              ? `${activeRecurring.length} recurring charges, ${formatMoney(recurringMonthly * 12)} a year.`
              : "No repeating charges detected yet."}
          </p>
        </div>

        <div className="rounded-3xl border border-expense/20 bg-gradient-to-br from-expense/15 to-expense/5 p-6 sm:col-span-2 xl:col-span-1">
          <div className="mb-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-expense" />
            <h3 className="font-semibold">Biggest change</h3>
          </div>
          {biggestRise ? (
            <>
              <p className="text-2xl font-bold">{biggestRise.category} +{Math.round(biggestRise.change_pct ?? 0)}%</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatMoney(biggestRise.this_month)} so far vs {formatMoney(biggestRise.usual)} by this point in a typical month.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Spending in every category is in line with your usual months.</p>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Where it goes</h2>
            </div>
            <div className="flex rounded-xl bg-muted p-1 text-xs">
              {(["month", "all"] as const).map((value) => (
                <button key={value} onClick={() => setScope(value)} className={`rounded-lg px-3 py-1 ${scope === value ? "bg-card font-medium shadow" : "text-muted-foreground"}`}>
                  {value === "month" ? "This month" : "All time"}
                </button>
              ))}
            </div>
          </div>
          {breakdown.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No expenses in this period.</div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdown} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>
                      {breakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chart.tooltip} formatter={(value: number) => formatMoney(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {breakdown.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-muted-foreground">{entry.name}</span>
                    <span className="ml-auto font-medium">{Math.round((entry.value / breakdownTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Spending forecast</h2>
          </div>
          {forecastData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Add a few weeks of expenses to unlock forecasts.</div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecastData}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="month" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} width={60} tickFormatter={(value) => new Intl.NumberFormat(profile.locale, { notation: "compact" }).format(value)} />
                  <Tooltip
                    contentStyle={chart.tooltip}
                    formatter={(value: number | number[], name: string) =>
                      Array.isArray(value) ? [`${formatMoney(value[0])} – ${formatMoney(value[1])}`, "Likely range"] : [formatMoney(value), name === "actual" ? "Actual" : "Forecast"]
                    }
                  />
                  <Area dataKey="range" stroke="none" fill={chart.primary} fillOpacity={0.15} />
                  <Line dataKey="actual" type="monotone" stroke={chart.expense} strokeWidth={3} dot={{ r: 4, fill: chart.expense }} connectNulls={false} />
                  <Line dataKey="predicted" type="monotone" stroke={chart.primary} strokeWidth={3} strokeDasharray="6 6" dot={{ r: 4, fill: chart.primary }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {nextMonth ? (
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              Next month's spending should land around <span className="font-semibold text-foreground">{formatMoney(nextMonth.predicted)}</span>
              {nextMonth.low !== undefined && nextMonth.high !== undefined ? ` (likely ${formatMoney(nextMonth.low)} – ${formatMoney(nextMonth.high)})` : ""}, based on your recent trend.
            </div>
          ) : null}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">This month vs usual</h2>
          </div>
          {trends.length === 0 ? (
            <p className="rounded-2xl bg-muted/30 p-5 text-sm text-muted-foreground">Trends appear once you have at least one previous month of data.</p>
          ) : (
            <div className="space-y-3">
              {trends.slice(0, 6).map((trend) => {
                const max = Math.max(trend.this_month, trend.usual, 1);
                const up = trend.change_pct !== null && trend.change_pct > 0;
                return (
                  <div key={trend.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{trend.category}</span>
                      <span className={`inline-flex items-center gap-1 ${trend.change_pct === null ? "text-muted-foreground" : up ? "text-expense" : "text-income"}`}>
                        {trend.change_pct === null ? "new" : (
                          <>
                            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {Math.abs(Math.round(trend.change_pct))}%
                          </>
                        )}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(trend.this_month / max) * 100}%` }} title={`This month: ${formatMoney(trend.this_month)}`} />
                      <div className="h-2 rounded-full bg-muted-foreground/30" style={{ width: `${(trend.usual / max) * 100}%` }} title={`Usual: ${formatMoney(trend.usual)}`} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatMoney(trend.this_month)} now · {formatMoney(trend.usual)} usual</p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Unusual spending</h2>
          </div>
          {insights.unusual_spending.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground">
              Nothing stands out. Every expense is within the normal range for its category.
            </div>
          ) : (
            <div className="space-y-3">
              {insights.unusual_spending.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-expense/20 bg-expense/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{entry.name ?? "Large expense"}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.date ? formatDate(entry.date, profile.locale) : "Recent"}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </div>
                    <p className="font-semibold text-expense">{formatMoney(entry.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Recurring charges</h2>
            </div>
            <span className="text-sm text-muted-foreground">{formatMoney(recurringMonthly)}/mo</span>
          </div>
          {recurring.length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground">
              {backendStatus === "connected"
                ? "No repeating charges yet. We look for the same merchant charged at a regular interval with a stable amount."
                : "Recurring detection runs on the server and will appear when the backend reconnects."}
            </div>
          ) : (
            <div className="space-y-3">
              {recurring.map((charge) => (
                <div key={charge.name} className={`flex items-center gap-3 rounded-2xl bg-muted/30 p-3 ${charge.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{charge.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {charge.cadence} · {charge.active ? `next ~${formatDate(charge.next_date, profile.locale, { month: "short", day: "numeric" })}` : "looks cancelled"} · {formatMoney(charge.annual_cost)}/yr
                    </p>
                    {charge.price_change > 0.009 ? (
                      <p className="mt-1 text-xs font-medium text-expense">Price went up by {formatMoney(charge.price_change)} on the last charge</p>
                    ) : null}
                  </div>
                  <p className="font-semibold">{formatMoney(charge.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-2 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">What-if savings simulator</h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">Drag to see what trimming your top categories would be worth.</p>
          {averages.length === 0 ? (
            <p className="rounded-2xl bg-muted/30 p-5 text-sm text-muted-foreground">Add some expenses to try the simulator.</p>
          ) : (
            <>
              <div className="space-y-4">
                {averages.map((entry) => (
                  <label key={entry.category} className="block">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{entry.category} <span className="text-muted-foreground">({formatMoney(entry.monthly)}/mo)</span></span>
                      <span className="font-medium">-{cuts[entry.category] ?? 0}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={5}
                      value={cuts[entry.category] ?? 0}
                      onChange={(event) => setCuts((current) => ({ ...current, [entry.category]: Number(event.target.value) }))}
                      className="w-full accent-[var(--primary)]"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-primary/5 p-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Per month</p>
                  <p className="font-bold text-income">{formatMoney(monthlySaving)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Per year</p>
                  <p className="font-bold text-income">{formatMoney(monthlySaving * 12)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">5 yrs invested @6%</p>
                  <p className="font-bold text-income">{formatMoney(futureValue(monthlySaving, 5))}</p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Ask the assistant</h2>
        </div>

        <div ref={chatBoxRef} className="mb-4 max-h-[28rem] space-y-4 overflow-y-auto pr-1" aria-live="polite">
          {chat.map((message, index) => (
            <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-3xl p-4 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {message.role === "assistant" ? (
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                    <Sparkles className="h-4 w-4" />
                    FinanceAI
                    {message.source ? <span className="font-normal text-muted-foreground">· {message.source === "ai" ? "AI" : message.source === "rules" ? "rules engine" : "offline"}</span> : null}
                  </div>
                ) : null}
                <p className="whitespace-pre-line text-sm">{message.role === "assistant" ? renderChatText(message.content) : message.content}</p>
                {message.notice ? <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{message.notice}</p> : null}
              </div>
            </div>
          ))}
          {thinking ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-3xl bg-muted p-4 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Thinking...
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              onClick={() => void sendMessage(question)}
              disabled={thinking}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(inputMessage);
          }}
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(event) => setInputMessage(event.target.value)}
            placeholder="Ask about budgets, savings, subscriptions, or whether you can afford something..."
            className="flex-1 rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
            aria-label="Message the assistant"
          />
          <button type="submit" disabled={!inputMessage.trim() || thinking} className="rounded-2xl bg-primary px-5 py-3 text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50" aria-label="Send">
            <Send className="h-5 w-5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
