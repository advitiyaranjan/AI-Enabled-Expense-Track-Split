import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Eye,
  EyeOff,
  Gauge,
  ScanLine,
  Users,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "motion/react";
import { HealthScoreCard } from "../components/HealthScoreCard";
import { QuickAdd } from "../components/QuickAdd";
import { daysUntil, formatDate, getBudgetStatus, getMonthPace, getSafeToSpend, todayISO } from "../lib/analytics";
import { getAccountStats, getMonthlySeries, useChartTheme, useFinance } from "../lib/finance";

export function Dashboard() {
  const [showBalance, setShowBalance] = useState(true);
  const { loading, transactions, profile, insights, budgets, formatMoney } = useFinance();
  const chart = useChartTheme();

  const stats = getAccountStats(transactions);
  const pace = getMonthPace(transactions);
  const recurring = insights.recurring ?? [];
  const safe = getSafeToSpend(transactions, budgets, recurring);
  const chartData = getMonthlySeries(insights, transactions, profile.locale);
  const recentTransactions = transactions.slice(0, 5);
  const today = todayISO();
  const upcoming = recurring
    .filter((charge) => charge.active && daysUntil(charge.next_date, today) >= 0 && daysUntil(charge.next_date, today) <= 14)
    .sort((left, right) => left.next_date.localeCompare(right.next_date));

  const budgetStatuses = budgets
    .filter((budget) => budget.limit > 0)
    .map((budget) => ({ budget, ...getBudgetStatus(transactions, budget) }))
    .filter((entry) => entry.spent > 0);
  const riskyBudget = [...budgetStatuses].sort((left, right) => right.projected / right.budget.limit - left.projected / left.budget.limit)[0];
  const risingCategory = (insights.category_trends ?? []).find((trend) => trend.change_pct !== null && trend.change_pct > 20 && trend.this_month > 0);
  const latestUnusual = insights.unusual_spending[0];
  const paceChange = pace.lastMonthSpent > 0 ? ((pace.projectedSpend - pace.lastMonthSpent) / pace.lastMonthSpent) * 100 : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold lg:text-4xl">Financial overview</h1>
        <p className="mt-1 text-muted-foreground">
          {loading ? "Loading your dashboard..." : "Everything important in one glance."}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-secondary-bright to-secondary p-6 lg:p-8"
        style={{ boxShadow: "0 20px 60px -20px rgba(6, 182, 212, 0.45)" }}
      >
        <div className="absolute inset-0 animate-shimmer opacity-70" />
        <div className="relative z-10 text-white">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Net balance (all tracked activity)</p>
              <h2 className="mt-2 text-4xl font-bold lg:text-5xl">
                {showBalance ? formatMoney(stats.balance) : "••••••"}
              </h2>
            </div>
            <button
              onClick={() => setShowBalance((current) => !current)}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
              className="rounded-full border border-white/20 bg-white/10 p-3 transition-colors hover:bg-white/20"
            >
              {showBalance ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <ArrowDownRight className="h-4 w-4" />
                Earned this month
              </div>
              <div className="text-2xl font-semibold">{showBalance ? formatMoney(pace.earned) : "••••"}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <ArrowUpRight className="h-4 w-4" />
                Spent this month
              </div>
              <div className="text-2xl font-semibold">{showBalance ? formatMoney(pace.spent) : "••••"}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
                <TrendingUp className="h-4 w-4" />
                Month-end projection
              </div>
              <div className="text-2xl font-semibold">{showBalance ? formatMoney(pace.projectedSpend) : "••••"}</div>
              {paceChange !== null ? (
                <p className="mt-1 text-xs text-white/80">
                  {Math.abs(paceChange).toFixed(0)}% {paceChange > 0 ? "above" : "below"} last month
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      <QuickAdd />

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Safe to spend</h2>
          </div>
          {safe.basis === "none" ? (
            <p className="text-sm text-muted-foreground">Log your income or set budgets and we'll work out a daily spending allowance.</p>
          ) : (
            <>
              <p className={`text-4xl font-bold ${safe.available > 0 ? "text-income" : "text-expense"}`}>
                {formatMoney(safe.perDay)}
                <span className="ml-1 text-base font-normal text-muted-foreground">/ day</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {safe.available > 0
                  ? `${formatMoney(safe.available)} left for the next ${safe.daysLeft} day${safe.daysLeft === 1 ? "" : "s"}`
                  : `You're ${formatMoney(Math.abs(safe.available))} over for this month`}
                {safe.basis === "income" ? " based on this month's income" : " based on your total budget"}
                {safe.upcomingBills > 0 ? `, after reserving ${formatMoney(safe.upcomingBills)} for upcoming bills.` : "."}
              </p>
            </>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <HealthScoreCard />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Upcoming bills</h2>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {recurring.length ? "Nothing due in the next 14 days." : "Recurring charges show up here once we've seen them repeat."}
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((charge) => {
                const days = daysUntil(charge.next_date, today);
                return (
                  <div key={charge.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{charge.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {days === 0 ? "Due today" : days === 1 ? "Tomorrow" : `In ${days} days`} · {charge.cadence}
                      </p>
                    </div>
                    <p className="font-semibold">{formatMoney(charge.amount)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 md:grid-cols-3">
        {[
          { to: "/scan", icon: ScanLine, title: "Scan a receipt", text: "Snap a bill and AI fills in the expense.", tone: "text-primary bg-primary/10" },
          { to: "/split", icon: Users, title: "Split expenses", text: "Track shared bills and who owes whom.", tone: "text-income bg-income/10" },
          { to: "/insights", icon: Sparkles, title: "Ask the AI", text: "Forecasts, subscriptions, and what-if savings.", tone: "text-secondary-bright bg-secondary-bright/10" },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </div>
          </Link>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1.75fr_1fr]">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Income vs expense</h2>
              <p className="text-sm text-muted-foreground">Monthly totals from your activity</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>

          {chartData.length === 0 ? (
            <div className="flex h-72 items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
              Add transactions to see your monthly trend.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dashboard-income" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.income} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={chart.income} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashboard-expense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.expense} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={chart.expense} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="month" stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke={chart.axis} fontSize={12} tickLine={false} axisLine={false} width={60} tickFormatter={(value) => new Intl.NumberFormat(profile.locale, { notation: "compact" }).format(value)} />
                  <Tooltip contentStyle={chart.tooltip} formatter={(value: number, name: string) => [formatMoney(value), name === "income" ? "Income" : "Expense"]} />
                  <Area type="monotone" dataKey="income" stroke={chart.income} fill="url(#dashboard-income)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="expense" stroke={chart.expense} fill="url(#dashboard-expense)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">AI summary</h2>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-expense/20 bg-expense/5 p-4">
              <p className="text-sm font-semibold">Budget watch</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {riskyBudget
                  ? riskyBudget.projected > riskyBudget.budget.limit
                    ? `${riskyBudget.budget.name} is on pace for ${formatMoney(riskyBudget.projected)} against a ${formatMoney(riskyBudget.budget.limit)} limit.`
                    : `${riskyBudget.budget.name} is your busiest budget at ${Math.round(riskyBudget.percentage)}% used, still on pace.`
                  : "No spending against your budgets yet this month."}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Trend</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {risingCategory
                  ? `${risingCategory.category} is up ${Math.round(risingCategory.change_pct ?? 0)}% compared with this point in a typical month.`
                  : "Your category spending is in line with your usual months."}
              </p>
            </div>

            <div className="rounded-2xl border border-secondary-bright/20 bg-secondary-bright/5 p-4">
              <p className="text-sm font-semibold">Unusual activity</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestUnusual
                  ? `${latestUnusual.name ?? "A recent expense"} (${formatMoney(latestUnusual.amount)}) stood out${latestUnusual.reason ? `: ${latestUnusual.reason}` : "."}`
                  : "Nothing looks out of the ordinary."}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Recent transactions</h2>
            <p className="text-sm text-muted-foreground">Your newest income and expenses</p>
          </div>
          <Link to="/transactions" className="text-sm text-primary transition-colors hover:text-primary-glow">
            View all
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="rounded-2xl bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No transactions yet. Try the quick-add bar above or <Link to="/transactions" className="text-primary">import a CSV</Link>.
          </p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-4 rounded-2xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-muted/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-2xl">{transaction.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{transaction.name}</p>
                  <p className="text-sm text-muted-foreground">{transaction.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${transaction.type === "income" ? "text-income" : "text-foreground"}`}>
                    {transaction.type === "income" ? "+" : "-"}
                    {formatMoney(Math.abs(transaction.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(transaction.date, profile.locale)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
