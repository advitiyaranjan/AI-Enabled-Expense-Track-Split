// Pure, client-side finance analytics. Everything here works offline and has no React dependencies.

export type TxType = "income" | "expense";

export interface TxLike {
  id: number;
  name: string;
  category: string;
  amount: number; // signed: expenses are negative
  date: string; // YYYY-MM-DD, in the user's local calendar
  time?: string | null;
  type: TxType;
}

export interface BudgetLike {
  name: string;
  limit: number;
}

export interface RecurringCharge {
  name: string;
  category: string;
  cadence: "weekly" | "monthly" | "quarterly" | "yearly";
  amount: number;
  average: number;
  monthly_cost: number;
  annual_cost: number;
  occurrences: number;
  last_date: string;
  next_date: string;
  active: boolean;
  price_change: number;
}

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Food & Dining",
  "Transport",
  "Entertainment",
  "Shopping",
  "Healthcare",
  "Utilities",
  "Other",
];

// ---------------------------------------------------------------- dates

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's date in the user's timezone. `new Date().toISOString()` would give the UTC date instead. */
export function todayISO() {
  return toISODate(new Date());
}

/** Parse YYYY-MM-DD as a local date. `new Date("2026-09-30")` is UTC midnight and renders as Sep 29 in the Americas. */
export function parseLocalDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatDate(value: string, locale: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  return parseLocalDate(value).toLocaleDateString(locale, options);
}

export function monthKey(date: Date | string) {
  return typeof date === "string" ? date.slice(0, 7) : `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function shiftMonth(date: Date, offset: number) {
  // Always anchor to the 1st so Jan 31 + 1 month doesn't overflow into March
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function daysBetween(from: string, to: string) {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);
}

// ---------------------------------------------------------------- aggregation

const abs = Math.abs;
const round2 = (value: number) => Math.round(value * 100) / 100;

export function inMonth(transactions: TxLike[], key: string) {
  return transactions.filter((transaction) => transaction.date.startsWith(key));
}

export function sumBy(transactions: TxLike[], type: TxType) {
  return transactions.filter((transaction) => transaction.type === type).reduce((sum, transaction) => sum + abs(transaction.amount), 0);
}

export function spentInCategory(transactions: TxLike[], category: string, key = monthKey(new Date())) {
  return inMonth(transactions, key)
    .filter((transaction) => transaction.type === "expense" && transaction.category === category)
    .reduce((sum, transaction) => sum + abs(transaction.amount), 0);
}

export interface MonthPace {
  key: string;
  spent: number;
  earned: number;
  day: number;
  daysInMonth: number;
  daysLeft: number;
  projectedSpend: number;
  lastMonthSpent: number;
  lastMonthEarned: number;
}

export function getMonthPace(transactions: TxLike[], now = new Date()): MonthPace {
  const key = monthKey(now);
  const current = inMonth(transactions, key);
  const previous = inMonth(transactions, monthKey(shiftMonth(now, -1)));
  const total = daysInMonth(now);
  const spent = sumBy(current, "expense");
  return {
    key,
    spent,
    earned: sumBy(current, "income"),
    day: now.getDate(),
    daysInMonth: total,
    daysLeft: total - now.getDate() + 1,
    projectedSpend: (spent / Math.max(now.getDate(), 1)) * total,
    lastMonthSpent: sumBy(previous, "expense"),
    lastMonthEarned: sumBy(previous, "income"),
  };
}

/** Budget usage for the current month, plus where the current daily pace lands by month end. */
export function getBudgetStatus(transactions: TxLike[], budget: BudgetLike, now = new Date()) {
  const spent = spentInCategory(transactions, budget.name, monthKey(now));
  const projected = (spent / Math.max(now.getDate(), 1)) * daysInMonth(now);
  const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;
  const expectedByNow = (now.getDate() / daysInMonth(now)) * 100;
  return {
    spent,
    projected,
    percentage,
    remaining: budget.limit - spent,
    over: spent > budget.limit,
    // "Near" means either close to the cap or running well ahead of the calendar
    atRisk: spent <= budget.limit && (percentage >= 85 || (spent > 0 && projected > budget.limit * 1.05 && percentage > expectedByNow + 10)),
  };
}

// ---------------------------------------------------------------- safe to spend

export interface SafeToSpend {
  basis: "income" | "budget" | "none";
  available: number;
  perDay: number;
  upcomingBills: number;
  daysLeft: number;
}

/**
 * How much can be spent per day for the rest of the month without going negative (income basis)
 * or blowing the total budget (budget basis), after reserving bills that are still due this month.
 */
export function getSafeToSpend(transactions: TxLike[], budgets: BudgetLike[], recurring: RecurringCharge[], now = new Date()): SafeToSpend {
  const pace = getMonthPace(transactions, now);
  const monthEnd = `${pace.key}-${pad(pace.daysInMonth)}`;
  const today = toISODate(now);
  const upcomingBills = recurring
    .filter((charge) => charge.active && charge.next_date > today && charge.next_date <= monthEnd)
    .reduce((sum, charge) => sum + charge.amount, 0);

  const income = pace.earned || pace.lastMonthEarned;
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  let basis: SafeToSpend["basis"] = "none";
  let available = 0;
  if (income > 0) {
    basis = "income";
    available = income - pace.spent - upcomingBills;
  } else if (totalBudget > 0) {
    basis = "budget";
    available = totalBudget - pace.spent - upcomingBills;
  }
  return { basis, available, perDay: Math.max(0, available) / Math.max(pace.daysLeft, 1), upcomingBills, daysLeft: pace.daysLeft };
}

// ---------------------------------------------------------------- health score

export interface HealthComponent {
  label: string;
  score: number;
  max: number;
  detail: string;
}

export interface HealthScore {
  score: number;
  grade: "Excellent" | "Good" | "Fair" | "Needs attention";
  components: HealthComponent[];
  tip: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (value: number, from: number, to: number, min: number, max: number) => min + clamp((value - from) / (to - from), 0, 1) * (max - min);

/** A 0–100 score from savings rate, budget discipline, spending stability and cash buffer (25 points each). */
export function getHealthScore(transactions: TxLike[], budgets: BudgetLike[], now = new Date()): HealthScore | null {
  if (transactions.length < 5) return null;

  // Use the last 3 months including the current one for rates, so a new user still gets a signal
  const keys = [0, -1, -2].map((offset) => monthKey(shiftMonth(now, offset)));
  const window = transactions.filter((transaction) => keys.includes(monthKey(transaction.date)));
  const income = sumBy(window, "income");
  const expense = sumBy(window, "expense");
  const savingsRate = income > 0 ? (income - expense) / income : expense > 0 ? -1 : 0;
  const savingsScore = savingsRate <= 0 ? lerp(savingsRate, -0.5, 0, 0, 5) : lerp(savingsRate, 0, 0.2, 5, 25);

  const active = budgets.filter((budget) => budget.limit > 0);
  const statuses = active.map((budget) => getBudgetStatus(transactions, budget, now));
  const onTrack = statuses.filter((status, index) => status.projected <= active[index].limit * 1.05).length;
  const budgetScore = active.length ? (onTrack / active.length) * 25 : 12;

  const history: number[] = [];
  for (let offset = -1; offset >= -6; offset -= 1) {
    const value = sumBy(inMonth(transactions, monthKey(shiftMonth(now, offset))), "expense");
    if (value > 0) history.push(value);
  }
  let stabilityScore = 15;
  let cv = 0;
  if (history.length >= 2) {
    const mean = history.reduce((sum, value) => sum + value, 0) / history.length;
    cv = Math.sqrt(history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / history.length) / mean;
    stabilityScore = lerp(cv, 0.6, 0.1, 5, 25);
  }

  const balance = sumBy(transactions, "income") - sumBy(transactions, "expense");
  const monthlyBurn = history.length ? history.reduce((sum, value) => sum + value, 0) / history.length : Math.max(expense, 1);
  const runway = balance / Math.max(monthlyBurn, 1);
  const bufferScore = lerp(runway, 0, 3, 0, 25);

  const components: HealthComponent[] = [
    { label: "Savings rate", score: savingsScore, max: 25, detail: income > 0 ? `${Math.round(savingsRate * 100)}% of income kept (3 mo)` : "No income logged recently" },
    { label: "Budget discipline", score: budgetScore, max: 25, detail: active.length ? `${onTrack}/${active.length} budgets on pace` : "No budgets set" },
    { label: "Spending stability", score: stabilityScore, max: 25, detail: history.length >= 2 ? `Monthly spend varies ±${Math.round(cv * 100)}%` : "Needs 2+ months of history" },
    { label: "Cash buffer", score: bufferScore, max: 25, detail: `${Math.max(0, runway).toFixed(1)} months of expenses covered` },
  ];
  const score = Math.round(components.reduce((sum, component) => sum + component.score, 0));
  const weakest = [...components].sort((left, right) => left.score / left.max - right.score / right.max)[0];
  const tips: Record<string, string> = {
    "Savings rate": "Automate a transfer to savings on payday. Even 5% moves this score quickly.",
    "Budget discipline": active.length ? "One or more budgets are running hot. Check the Budget page for the category to rein in." : "Set budgets for your top categories so we can track your discipline.",
    "Spending stability": "Big swings month to month usually come from irregular purchases. Plan them as sinking funds.",
    "Cash buffer": "Aim for 3 months of expenses in reserve before taking on new commitments.",
  };
  return {
    score,
    grade: score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 45 ? "Fair" : "Needs attention",
    components,
    tip: tips[weakest.label],
  };
}

// ---------------------------------------------------------------- categorization

export function normalizeMerchant(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\b(inc|llc|ltd|com|www|pvt|co|the)\b/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

const KEYWORDS: Array<[string, RegExp]> = [
  ["Income", /\b(salary|payroll|paycheck|income|freelance|bonus|refund|cashback|dividend|interest|stipend|reimburse)/],
  ["Groceries", /\b(grocer|supermarket|whole foods|trader joe|walmart|costco|aldi|kroger|bigbasket|blinkit|zepto|dmart|vegetable|fruit|tesco)/],
  ["Food & Dining", /\b(restaurant|cafe|coffee|starbucks|pizza|burger|mcdonald|kfc|domino|subway|swiggy|zomato|doordash|uber ?eats|lunch|dinner|breakfast|food|bar|pub)\b/],
  ["Transport", /\b(uber|ola|lyft|rapido|fuel|petrol|diesel|shell|taxi|cab|metro|train|bus|parking|toll|flight|airline)\b/],
  ["Utilities", /\b(electric|water bill|internet|wifi|broadband|power|phone bill|recharge|jio|airtel|verizon|comcast|rent|utility)/],
  ["Entertainment", /\b(netflix|spotify|prime video|hotstar|disney|hbo|youtube|movie|cinema|theat|concert|steam|playstation|xbox|game)/],
  ["Shopping", /\b(amazon|flipkart|myntra|target|ikea|mall|store|clothes|shoes|zara|nike|electronics|best buy)/],
  ["Healthcare", /\b(pharmacy|clinic|hospital|doctor|dentist|medic|health|apollo|cvs|walgreens|gym|fitness|insurance)/],
];

export function inferCategory(text: string) {
  const lowered = text.toLowerCase();
  return KEYWORDS.find(([, pattern]) => pattern.test(lowered))?.[0] ?? "Other";
}

/**
 * Suggest a category for a merchant name, preferring how *this user* categorized it before,
 * then falling back to keywords. `learned` tells the UI whether it came from history.
 */
export function suggestCategory(name: string, transactions: TxLike[]): { category: string; learned: boolean } | null {
  const key = normalizeMerchant(name);
  if (key.length < 3) return null;
  const votes = new Map<string, number>();
  for (const transaction of transactions) {
    const other = normalizeMerchant(transaction.name);
    if (other && (other === key || other.startsWith(`${key} `) || key.startsWith(`${other} `))) {
      votes.set(transaction.category, (votes.get(transaction.category) ?? 0) + 1);
    }
  }
  const best = [...votes.entries()].sort((left, right) => right[1] - left[1])[0];
  if (best) return { category: best[0], learned: true };
  const inferred = inferCategory(name);
  return inferred === "Other" ? null : { category: inferred, learned: false };
}

// ---------------------------------------------------------------- what-if simulator

/** Average monthly spend per category over the last `months` complete months (falls back to the current month). */
export function averageMonthlyByCategory(transactions: TxLike[], months = 3, now = new Date()) {
  const keys = Array.from({ length: months }, (_, index) => monthKey(shiftMonth(now, -(index + 1))));
  const used = keys.filter((key) => inMonth(transactions, key).some((transaction) => transaction.type === "expense"));
  const scope = used.length ? used : [monthKey(now)];
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !scope.includes(monthKey(transaction.date))) continue;
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + abs(transaction.amount));
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, monthly: round2(total / scope.length) }))
    .sort((left, right) => right.monthly - left.monthly);
}

/** Future value of saving `monthly` every month for `years` at `annualRate`, compounded monthly. */
export function futureValue(monthly: number, years: number, annualRate = 0.06) {
  const rate = annualRate / 12;
  const periods = years * 12;
  return rate === 0 ? monthly * periods : monthly * ((1 + rate) ** periods - 1) / rate;
}

/** Suggested monthly limits from recent history: the average plus 10% headroom, rounded to a friendly number. */
export function suggestBudgets(transactions: TxLike[], now = new Date()) {
  return averageMonthlyByCategory(transactions, 3, now)
    .filter((entry) => entry.category !== "Income" && entry.monthly > 0)
    .map((entry) => {
      const raw = entry.monthly * 1.1;
      const step = raw >= 1000 ? 100 : raw >= 100 ? 10 : 5;
      return { category: entry.category, limit: Math.ceil(raw / step) * step, average: entry.monthly };
    });
}

// ---------------------------------------------------------------- CSV

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSV(transactions: TxLike[]) {
  const header = ["date", "time", "name", "category", "type", "amount"];
  const rows = transactions.map((transaction) =>
    [transaction.date, transaction.time ?? "", transaction.name, transaction.category, transaction.type, abs(transaction.amount).toFixed(2)].map(csvEscape).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function splitCSVLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalizeCSVDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const match = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (match) {
    let [, first, second, year] = match;
    if (year.length === 2) year = `20${year}`;
    // Ambiguous d/m vs m/d: if the first part can't be a month, it's the day
    const [day, month] = Number(first) > 12 ? [first, second] : [second, first];
    return `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : toISODate(parsed);
}

export interface ParsedCSVRow {
  name: string;
  category: string;
  amount: number;
  date: string;
  time: string | null;
  type: TxType;
}

/**
 * Import a bank/app CSV. Recognizes common header names, handles signed amounts or separate
 * debit/credit columns, and auto-categorizes rows that have no category.
 */
export function parseCSV(text: string, history: TxLike[]): { rows: ParsedCSVRow[]; skipped: number } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], skipped: 0 };
  const header = splitCSVLine(lines[0]).map((cell) => cell.toLowerCase());
  const find = (...names: string[]) => header.findIndex((cell) => names.some((name) => cell === name || cell.includes(name)));
  const col = {
    date: find("date", "posted"),
    time: find("time"),
    name: find("name", "description", "merchant", "payee", "narration", "details", "memo"),
    category: find("category"),
    type: find("type"),
    amount: find("amount", "value"),
    debit: find("debit", "withdrawal"),
    credit: find("credit", "deposit"),
  };
  const rows: ParsedCSVRow[] = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitCSVLine(line);
    const date = col.date >= 0 ? normalizeCSVDate(cells[col.date] ?? "") : null;
    const num = (index: number) => (index >= 0 ? Number((cells[index] ?? "").replace(/[^0-9.-]/g, "")) || 0 : 0);
    let amount = num(col.amount);
    if (!amount && (col.debit >= 0 || col.credit >= 0)) amount = num(col.credit) - num(col.debit);
    const name = (col.name >= 0 ? cells[col.name] : "")?.trim() || "Imported transaction";
    if (!date || !amount) {
      skipped += 1;
      continue;
    }
    const typeCell = (col.type >= 0 ? cells[col.type] : "").toLowerCase();
    const type: TxType = typeCell.includes("income") || typeCell.includes("credit") ? "income" : typeCell.includes("expense") || typeCell.includes("debit") ? "expense" : amount < 0 ? "expense" : "income";
    const givenCategory = col.category >= 0 ? cells[col.category]?.trim() : "";
    const category = type === "income" ? "Income" : givenCategory || suggestCategory(name, history)?.category || inferCategory(name);
    const time = col.time >= 0 && /^\d{1,2}:\d{2}/.test(cells[col.time] ?? "") ? `${cells[col.time].slice(0, 5)}:00` : null;
    rows.push({ name, category, amount: abs(amount), date, time, type });
  }
  return { rows, skipped };
}

export function daysUntil(date: string, from = todayISO()) {
  return daysBetween(from, date);
}
