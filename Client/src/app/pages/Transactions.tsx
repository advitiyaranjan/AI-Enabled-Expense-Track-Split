import { useMemo, useRef, useState } from "react";
import {
  Calendar,
  Download,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QuickAdd } from "../components/QuickAdd";
import { EXPENSE_CATEGORIES, formatDate, parseCSV, suggestCategory, toCSV, todayISO } from "../lib/analytics";
import { categoryIcon, getAccountStats, useFinance, type Transaction, type TransactionType } from "../lib/finance";

const categories = ["All", "Income", ...EXPENSE_CATEGORIES];

type FormState = {
  name: string;
  category: string;
  amount: string;
  date: string;
  time: string;
  type: TransactionType;
};

function emptyForm(): FormState {
  const now = new Date();
  return {
    name: "",
    category: "Food & Dining",
    amount: "",
    date: todayISO(),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`,
    type: "expense",
  };
}

export function Transactions() {
  const { transactions, profile, addTransaction, updateTransaction, deleteTransaction, importTransactions, formatMoney } = useFinance();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState<"all" | TransactionType>("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [formError, setFormError] = useState("");
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const months = useMemo(() => Array.from(new Set(transactions.map((transaction) => transaction.date.slice(0, 7)))).sort().reverse(), [transactions]);

  const filteredTransactions = transactions.filter((transaction) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = transaction.name.toLowerCase().includes(query) || transaction.category.toLowerCase().includes(query);
    const matchesCategory = selectedCategory === "All" || transaction.category === selectedCategory;
    const matchesType = selectedType === "all" || transaction.type === selectedType;
    const matchesMonth = selectedMonth === "all" || transaction.date.startsWith(selectedMonth);
    return matchesSearch && matchesCategory && matchesType && matchesMonth;
  });
  const stats = getAccountStats(filteredTransactions);

  const groupedTransactions = filteredTransactions.reduce<Record<string, Transaction[]>>((groups, transaction) => {
    (groups[transaction.date] ??= []).push(transaction);
    return groups;
  }, {});

  const suggestion = formState.type === "expense" && !editing ? suggestCategory(formState.name, transactions) : null;

  function openCreate() {
    setEditing(null);
    setFormState(emptyForm());
    setCategoryTouched(false);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(transaction: Transaction) {
    setEditing(transaction);
    setFormState({
      name: transaction.name,
      category: transaction.type === "income" ? "Food & Dining" : transaction.category,
      amount: String(Math.abs(transaction.amount)),
      date: transaction.date,
      time: transaction.time ?? "00:00:00",
      type: transaction.type,
    });
    setCategoryTouched(true);
    setFormError("");
    setShowModal(true);
  }

  function updateName(name: string) {
    setFormState((current) => {
      const next = { ...current, name };
      // Auto-apply the suggestion until the user picks a category themselves
      const suggested = current.type === "expense" && !categoryTouched ? suggestCategory(name, transactions) : null;
      if (suggested && EXPENSE_CATEGORIES.includes(suggested.category)) next.category = suggested.category;
      return next;
    });
  }

  async function handleSubmit() {
    const amount = Number(formState.amount);
    if (!formState.name.trim()) return setFormError("Give the transaction a name.");
    if (!Number.isFinite(amount) || amount <= 0) return setFormError("Enter an amount greater than zero.");
    if (!formState.date) return setFormError("Pick a date.");

    const category = formState.type === "income" ? "Income" : formState.category;
    const input = {
      name: formState.name,
      category,
      amount,
      date: formState.date,
      time: formState.time,
      type: formState.type,
      icon: categoryIcon(category, formState.type),
    };
    const result = editing ? await updateTransaction(editing.id, input) : await addTransaction(input);
    if (result.ok) {
      setShowModal(false);
    } else {
      setFormError(result.error ?? "Unable to save");
    }
  }

  async function handleDelete(transaction: Transaction) {
    if (!window.confirm(`Delete "${transaction.name}" (${formatMoney(Math.abs(transaction.amount))})?`)) return;
    const result = await deleteTransaction(transaction.id);
    if (!result.ok) setBanner({ tone: "error", text: result.error ?? "Unable to delete" });
  }

  function handleExport() {
    const blob = new Blob([toCSV(filteredTransactions)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    const text = await file.text();
    const { rows, skipped } = parseCSV(text, transactions);
    if (rows.length === 0) {
      setBanner({ tone: "error", text: "No rows could be read. The CSV needs at least date and amount columns." });
      return;
    }
    const result = await importTransactions(rows);
    setBanner(
      result.ok
        ? { tone: "ok", text: `Imported ${result.data} transactions${skipped ? ` (${skipped} rows skipped)` : ""}. Missing categories were filled in automatically.` }
        : { tone: "error", text: result.error ?? "Import failed" },
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="mt-1 text-muted-foreground">Track, filter, edit, and import activity in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button onClick={handleExport} disabled={filteredTransactions.length === 0} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-primary disabled:opacity-50">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary-glow">
            <Plus className="h-5 w-5" /> Add transaction
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = "";
            }}
          />
        </div>
      </motion.div>

      {banner ? (
        <div className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${banner.tone === "ok" ? "border-income/20 bg-income/10 text-income" : "border-expense/20 bg-expense/10 text-expense"}`}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <QuickAdd compact />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-income" />
            Income {selectedMonth === "all" ? "(all time)" : `(${formatDate(`${selectedMonth}-01`, profile.locale, { month: "long", year: "numeric" })})`}
          </div>
          <div className="text-2xl font-bold text-income">{formatMoney(stats.income)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-expense" />
            Expenses {selectedMonth === "all" ? "(all time)" : `(${formatDate(`${selectedMonth}-01`, profile.locale, { month: "long", year: "numeric" })})`}
          </div>
          <div className="text-2xl font-bold text-expense">{formatMoney(stats.expense)}</div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by merchant or category..."
              className="w-full rounded-2xl border border-border bg-input-background py-3 pl-12 pr-4 outline-none transition-colors focus:border-primary"
            />
          </div>
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none focus:border-primary" aria-label="Month">
            <option value="all">All time</option>
            {months.map((month) => (
              <option key={month} value={month}>{formatDate(`${month}-01`, profile.locale, { month: "long", year: "numeric" })}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "income", "expense"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`rounded-xl border px-4 py-2 transition-all ${selectedType === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}
            >
              {type === "all" ? "All" : type === "income" ? "Income" : "Expense"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Tag className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-xl border px-4 py-2 transition-all ${selectedCategory === category ? "border-secondary-bright bg-secondary-bright text-white" : "border-border bg-card hover:border-secondary-bright"}`}
            >
              {category}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
            {transactions.length === 0 ? "No transactions yet. Add one, use quick add, or import a CSV from your bank." : "No transactions match the current filters."}
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, grouped]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(date, profile.locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>

              <div className="overflow-hidden rounded-3xl border border-border bg-card">
                {grouped.map((transaction) => (
                  <div key={transaction.id} className="group flex items-center gap-4 border-b border-border px-4 py-4 last:border-b-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-2xl">{transaction.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{transaction.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-muted px-2 py-1">{transaction.category}</span>
                        {transaction.time && transaction.time !== "00:00:00" ? <span>{transaction.time.slice(0, 5)}</span> : null}
                      </div>
                    </div>
                    <p className={`text-right text-lg font-semibold ${transaction.type === "income" ? "text-income" : "text-foreground"}`}>
                      {transaction.type === "income" ? "+" : "-"}
                      {formatMoney(Math.abs(transaction.amount))}
                    </p>
                    <div className="flex">
                      <button onClick={() => openEdit(transaction)} aria-label={`Edit ${transaction.name}`} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => void handleDelete(transaction)} aria-label={`Delete ${transaction.name}`} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-expense/10 hover:text-expense">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </motion.div>

      <AnimatePresence>
        {showModal ? (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowModal(false)} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="fixed inset-4 z-50 overflow-auto rounded-3xl border border-border bg-card p-6 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-full lg:max-w-xl lg:-translate-x-1/2 lg:-translate-y-1/2"
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">{editing ? "Edit transaction" : "Add transaction"}</h2>
                <button onClick={() => setShowModal(false)} className="rounded-xl p-2 hover:bg-muted" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
              >
                <div className="flex gap-2">
                  {(["expense", "income"] as const).map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setFormState((current) => ({ ...current, type }))}
                      className={`flex-1 rounded-2xl border px-4 py-3 transition-all ${formState.type === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-input-background"}`}
                    >
                      {type === "expense" ? "Expense" : "Income"}
                    </button>
                  ))}
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <input
                    type="text"
                    autoFocus
                    value={formState.name}
                    onChange={(event) => updateName(event.target.value)}
                    className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    placeholder="e.g. Whole Foods"
                  />
                </label>

                {formState.type === "expense" ? (
                  <label className="grid gap-2">
                    <span className="flex items-center justify-between text-sm text-muted-foreground">
                      Category
                      {suggestion ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <Sparkles className="h-3 w-3" />
                          {suggestion.learned ? "Learned from your history" : "Auto-suggested"}: {suggestion.category}
                        </span>
                      ) : null}
                    </span>
                    <select
                      value={formState.category}
                      onChange={(event) => {
                        setCategoryTouched(true);
                        setFormState((current) => ({ ...current, category: event.target.value }));
                      }}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    >
                      {EXPENSE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Amount ({profile.currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={formState.amount}
                      onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <input
                      type="date"
                      value={formState.date}
                      onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Time</span>
                    <input
                      type="time"
                      value={formState.time.slice(0, 5)}
                      onChange={(event) => setFormState((current) => ({ ...current, time: `${event.target.value || "00:00"}:00` }))}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    />
                  </label>
                </div>

                {formError ? <p className="rounded-2xl border border-expense/20 bg-expense/10 p-3 text-sm text-expense">{formError}</p> : null}

                <div className="mt-2 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-2xl border border-border px-4 py-3 font-medium transition-colors hover:bg-muted">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-glow">
                    {editing ? "Save changes" : "Save"}
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
