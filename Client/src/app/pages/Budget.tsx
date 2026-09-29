import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { EXPENSE_CATEGORIES, getBudgetStatus, getMonthPace, suggestBudgets } from "../lib/analytics";
import { categoryIcon, useFinance, type BudgetCategory } from "../lib/finance";

const PALETTE = ["#06B6D4", "#10B981", "#F97316", "#3B82F6", "#8B5CF6", "#EC4899", "#EAB308", "#64748B"];

export function Budget() {
  const { budgets, saveBudget, deleteBudget, transactions, formatMoney, profile } = useFinance();
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetCategory | null>(null);
  const [draft, setDraft] = useState({ id: "", name: "", icon: "📌", limit: "", color: PALETTE[0] });
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestBudgets> | null>(null);

  const now = new Date();
  const pace = getMonthPace(transactions, now);
  const monthName = now.toLocaleDateString(profile.locale, { month: "long" });
  const statuses = budgets.map((budget) => ({ budget, ...getBudgetStatus(transactions, budget, now) }));
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const totalSpent = statuses.reduce((sum, status) => sum + status.spent, 0);
  const totalProjected = statuses.reduce((sum, status) => sum + status.projected, 0);
  const monthProgress = (pace.day / pace.daysInMonth) * 100;
  const unbudgeted = transactions
    .filter((transaction) => transaction.type === "expense" && transaction.date.startsWith(pace.key) && !budgets.some((budget) => budget.name === transaction.category))
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  function openCreateModal() {
    setEditingBudget(null);
    const unused = EXPENSE_CATEGORIES.find((category) => !budgets.some((budget) => budget.name === category)) ?? "";
    setDraft({ id: "", name: unused, icon: categoryIcon(unused), limit: "", color: PALETTE[budgets.length % PALETTE.length] });
    setError("");
    setShowModal(true);
  }

  function openEditModal(budget: BudgetCategory) {
    setEditingBudget(budget);
    setDraft({ id: budget.id, name: budget.name, icon: budget.icon, limit: String(budget.limit), color: budget.color });
    setError("");
    setShowModal(true);
  }

  function handleSaveBudget() {
    const limit = Number(draft.limit);
    if (!draft.name.trim()) return setError("Choose a category.");
    if (!Number.isFinite(limit) || limit <= 0) return setError("Enter a monthly limit greater than zero.");
    if (budgets.some((budget) => budget.name.toLowerCase() === draft.name.trim().toLowerCase() && budget.id !== draft.id)) {
      return setError("There's already a budget for this category.");
    }
    saveBudget({
      id: draft.id || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: draft.name.trim(),
      icon: draft.icon || "📌",
      limit,
      color: draft.color,
    });
    setShowModal(false);
  }

  function applySuggestions() {
    if (!suggestions) return;
    for (const suggestion of suggestions) {
      const existing = budgets.find((budget) => budget.name === suggestion.category);
      saveBudget({
        id: existing?.id ?? suggestion.category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: suggestion.category,
        icon: existing?.icon ?? categoryIcon(suggestion.category),
        limit: suggestion.limit,
        color: existing?.color ?? PALETTE[(budgets.length + suggestions.indexOf(suggestion)) % PALETTE.length],
      });
    }
    setSuggestions(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary-bright">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Budget planner</h1>
            <p className="mt-1 text-muted-foreground">{monthName} limits vs. real spending, with month-end projections.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSuggestions(suggestBudgets(transactions))}
            className="inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Sparkles className="h-5 w-5" />
            Suggest from my history
          </button>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary-glow">
            <Plus className="h-5 w-5" />
            Add budget
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {suggestions ? (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-3xl border border-primary/25 bg-primary/5 p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" /> Suggested monthly budgets</h2>
              <button onClick={() => setSuggestions(null)} aria-label="Close suggestions" className="rounded-xl p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough expense history yet. Log a few weeks of spending and try again.</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">Based on your average spend over recent months, plus 10% headroom.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => {
                    const current = budgets.find((budget) => budget.name === suggestion.category);
                    return (
                      <div key={suggestion.category} className="flex items-center justify-between rounded-2xl bg-card p-3 text-sm">
                        <span>{categoryIcon(suggestion.category)} {suggestion.category}</span>
                        <span className="text-right">
                          <span className="font-semibold">{formatMoney(suggestion.limit)}</span>
                          <span className="block text-xs text-muted-foreground">
                            avg {formatMoney(suggestion.average)}{current ? ` · now ${formatMoney(current.limit)}` : " · new"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={applySuggestions} className="mt-4 rounded-2xl bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary-glow">
                  Apply these budgets
                </button>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl border border-border bg-card p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Total budget</p>
            <p className="mt-2 text-3xl font-bold">{formatMoney(totalBudget)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Spent in {monthName}</p>
            <p className="mt-2 text-3xl font-bold text-expense">{formatMoney(totalSpent)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className={`mt-2 text-3xl font-bold ${totalBudget - totalSpent >= 0 ? "text-income" : "text-expense"}`}>{formatMoney(totalBudget - totalSpent)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Projected by month end</p>
            <p className={`mt-2 text-3xl font-bold ${totalProjected > totalBudget ? "text-expense" : ""}`}>{formatMoney(totalProjected)}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall progress (day {pace.day} of {pace.daysInMonth})</span>
            <span>{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${totalBudget > 0 && totalSpent / totalBudget >= 0.9 ? "bg-gradient-to-r from-expense to-expense-bright" : "bg-gradient-to-r from-primary to-income"}`}
              style={{ width: `${Math.min(100, totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0)}%` }}
            />
            <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: `${monthProgress}%` }} title="Where you'd be at an even pace" />
          </div>
          {unbudgeted > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {formatMoney(unbudgeted)} this month went to categories without a budget.
            </p>
          ) : null}
        </div>
      </motion.div>

      {budgets.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
          No budgets yet. Add one, or let us suggest limits from your history.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {statuses.map(({ budget, spent, projected, percentage, over, atRisk }, index) => (
            <motion.div
              key={budget.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-3xl border border-border bg-card p-6"
              style={{ borderLeft: `4px solid ${budget.color}` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-2xl">{budget.icon}</div>
                  <div>
                    <h3 className="text-lg font-semibold">{budget.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(spent)} of {formatMoney(budget.limit)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {over ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-expense/10 px-3 py-1 text-xs font-medium text-expense">
                      <AlertTriangle className="h-3 w-3" /> Over budget
                    </span>
                  ) : atRisk ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-expense/10 px-3 py-1 text-xs font-medium text-expense">
                      <AlertTriangle className="h-3 w-3" /> At risk
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-income/10 px-3 py-1 text-xs font-medium text-income">
                      <CheckCircle className="h-3 w-3" /> On track
                    </span>
                  )}
                  <button onClick={() => openEditModal(budget)} className="rounded-xl p-2 transition-colors hover:bg-muted" aria-label={`Edit ${budget.name}`}>
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => window.confirm(`Delete the ${budget.name} budget?`) && deleteBudget(budget.id)}
                    className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-expense/10 hover:text-expense"
                    aria-label={`Delete ${budget.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{Math.round(percentage)}%</span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: over || atRisk ? "var(--expense)" : budget.color }} />
                  <div className="absolute inset-y-0 w-0.5 bg-foreground/50" style={{ left: `${monthProgress}%` }} />
                </div>
              </div>

              <p className={`mt-4 text-sm ${over || projected > budget.limit ? "text-expense" : "text-muted-foreground"}`}>
                {over
                  ? `Exceeded by ${formatMoney(spent - budget.limit)}.`
                  : spent === 0
                    ? "No spending yet this month."
                    : projected > budget.limit
                      ? `On pace for ${formatMoney(projected)}. Keep it under ${formatMoney(Math.max(0, budget.limit - spent) / Math.max(pace.daysLeft, 1))}/day to stay within budget.`
                      : `On pace for ${formatMoney(projected)}, leaving ${formatMoney(budget.limit - projected)} spare.`}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-secondary-bright/10 p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">How to read this</h3>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>The thin vertical line marks where you'd be if you spent evenly through the month. A bar past the line means that category is running ahead of schedule.</p>
          <p>"At risk" means you're close to the cap or your current daily pace would overshoot it by month end.</p>
          <p>Budgets reset automatically on the 1st of each month.</p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal ? (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="fixed inset-4 z-50 overflow-auto rounded-3xl border border-border bg-card p-6 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-lg lg:-translate-x-1/2 lg:-translate-y-1/2"
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">{editingBudget ? "Edit budget" : "Add budget"}</h2>
                <button onClick={() => setShowModal(false)} className="rounded-xl p-2 hover:bg-muted" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSaveBudget();
                }}
              >
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Category (must match transaction categories)</span>
                  <input
                    type="text"
                    list="budget-categories"
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, icon: editingBudget ? current.icon : categoryIcon(event.target.value) }))}
                    className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                  />
                  <datalist id="budget-categories">
                    {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category} />)}
                  </datalist>
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Icon</span>
                    <input
                      type="text"
                      value={draft.icon}
                      maxLength={4}
                      onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Monthly limit ({profile.currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.limit}
                      onChange={(event) => setDraft((current) => ({ ...current, limit: event.target.value }))}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    />
                  </label>
                </div>

                <div className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Accent color</span>
                  <div className="flex flex-wrap gap-2">
                    {PALETTE.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setDraft((current) => ({ ...current, color }))}
                        aria-label={`Color ${color}`}
                        className={`h-9 w-9 rounded-full border-2 transition-transform ${draft.color === color ? "scale-110 border-foreground" : "border-transparent"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {error ? <p className="rounded-2xl border border-expense/20 bg-expense/10 p-3 text-sm text-expense">{error}</p> : null}

                <div className="mt-2 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-2xl border border-border px-4 py-3 font-medium transition-colors hover:bg-muted">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-glow">
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
