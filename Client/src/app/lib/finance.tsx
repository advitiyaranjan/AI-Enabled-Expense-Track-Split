import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  inferCategory,
  monthKey,
  parseLocalDate,
  shiftMonth,
  spentInCategory,
  todayISO,
  type ParsedCSVRow,
  type RecurringCharge,
} from "./analytics";

export type TransactionType = "income" | "expense";
export type SplitMode = "equal" | "custom" | "percentage";
export type BackendStatus = "checking" | "connected" | "offline";

export interface Transaction {
  id: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  time?: string | null;
  icon?: string;
  type: TransactionType;
}

export interface BudgetCategory {
  id: string;
  name: string;
  icon: string;
  limit: number;
  color: string;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
}

export interface SplitParticipant extends Friend {
  amount: number;
  percentage: number;
  settled: boolean;
  isYou: boolean;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  totalAmount: number;
  createdAt: string;
  mode: SplitMode;
  paidById: string;
  participants: SplitParticipant[];
}

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ReceiptDraft {
  amount: string;
  merchant: string;
  date: string;
  category: string;
  items: ReceiptItem[];
  imageUrl?: string;
  rawText?: string;
  source?: "vision" | "ocr" | "text" | "local";
}

export interface NotificationSettings {
  transactions: boolean;
  budgetAlerts: boolean;
  aiInsights: boolean;
  weeklyReports: boolean;
}

export interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  location: string;
  country: string;
  currency: string;
  locale: string;
  darkMode: boolean;
  notifications: NotificationSettings;
}

export interface CategoryTrend {
  category: string;
  this_month: number;
  usual: number;
  change_pct: number | null;
}

export interface UnusualExpense {
  id: number;
  name: string | null;
  amount: number;
  date: string | null;
  category?: string;
  typical?: number;
  reason?: string;
}

export interface InsightPayload {
  monthly_totals: Array<{ month: string; total: number; income?: number }>;
  category_breakdown: Array<{ category: string; amount: number }>;
  category_breakdown_month?: Array<{ category: string; amount: number }>;
  category_trends?: CategoryTrend[];
  predictions: Array<{ month_offset: number; predicted: number; low?: number; high?: number }>;
  unusual_spending: UnusualExpense[];
  recurring?: RecurringCharge[];
  top_merchants?: Array<{ name: string; amount: number; count: number }>;
}

export interface TransactionInput {
  name: string;
  category: string;
  amount: number;
  date: string;
  time?: string | null;
  icon?: string;
  type: TransactionType;
}

export interface QuickAddDraft {
  name: string;
  amount: number | null;
  type: TransactionType;
  category: string;
  date: string;
  confidence: number;
  source: "ai" | "rules";
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface UserCredentials {
  name?: string;
  email: string;
  password: string;
  phone?: string;
  location?: string;
  country?: string;
}

type Result<T = undefined> = { ok: boolean; error?: string; data?: T };

interface FinanceContextValue {
  loading: boolean;
  backendStatus: BackendStatus;
  aiEnabled: boolean;
  isAuthenticated: boolean;
  token: string;
  transactions: Transaction[];
  budgets: BudgetCategory[];
  groups: ExpenseGroup[];
  friends: Friend[];
  profile: ProfileData;
  insights: InsightPayload;
  lastReceipt: ReceiptDraft | null;
  addTransaction: (input: TransactionInput) => Promise<Result>;
  updateTransaction: (id: number, input: TransactionInput) => Promise<Result>;
  deleteTransaction: (id: number) => Promise<Result>;
  importTransactions: (rows: ParsedCSVRow[]) => Promise<Result<number>>;
  scanReceipt: (input: { filename: string; imageBase64?: string; rawText?: string }) => Promise<Result<ReceiptDraft>>;
  clearReceipt: () => void;
  saveBudget: (budget: BudgetCategory) => void;
  deleteBudget: (id: string) => void;
  createGroup: (payload: {
    name: string;
    totalAmount: number;
    mode: SplitMode;
    selectedFriends: Friend[];
    paidById: string;
    customValues?: Record<string, number>;
  }) => void;
  deleteGroup: (groupId: string) => void;
  toggleSettlement: (groupId: string, participantId: string) => void;
  addFriend: (name: string) => Friend | null;
  updateProfile: (updates: Partial<ProfileData>) => Promise<Result>;
  askAssistant: (message: string, history: ChatTurn[]) => Promise<{ reply: string; source: "ai" | "rules" | "local" }>;
  parseQuickAdd: (text: string) => Promise<Result<QuickAddDraft>>;
  login: (payload: UserCredentials) => Promise<Result>;
  register: (payload: UserCredentials) => Promise<Result>;
  logout: () => void;
  reconnect: () => Promise<void>;
  refreshRemoteData: () => Promise<void>;
  formatMoney: (amount: number) => string;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const STORAGE_PREFIX = "financeai";
export const SELF_ID = "self";

const COUNTRY_CONFIG: Record<string, { currency: string; locale: string }> = {
  "United States": { currency: "USD", locale: "en-US" },
  India: { currency: "INR", locale: "en-IN" },
  "United Kingdom": { currency: "GBP", locale: "en-GB" },
  Canada: { currency: "CAD", locale: "en-CA" },
  Australia: { currency: "AUD", locale: "en-AU" },
  Germany: { currency: "EUR", locale: "de-DE" },
  France: { currency: "EUR", locale: "fr-FR" },
  Spain: { currency: "EUR", locale: "es-ES" },
  Italy: { currency: "EUR", locale: "it-IT" },
  Japan: { currency: "JPY", locale: "ja-JP" },
  Singapore: { currency: "SGD", locale: "en-SG" },
  "United Arab Emirates": { currency: "AED", locale: "en-AE" },
};

export const COUNTRIES = Object.keys(COUNTRY_CONFIG);

const REGION_TO_COUNTRY: Record<string, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  JP: "Japan",
  SG: "Singapore",
  AE: "United Arab Emirates",
};

const defaultFriends: Friend[] = [
  { id: "sarah", name: "Sarah Chen", avatar: "👩" },
  { id: "mike", name: "Mike Johnson", avatar: "👨" },
  { id: "emily", name: "Emily Rodriguez", avatar: "👧" },
  { id: "david", name: "David Kim", avatar: "🧑" },
];

const defaultBudgets: BudgetCategory[] = [
  { id: "food-dining", name: "Food & Dining", icon: "🍽️", limit: 500, color: "#06B6D4" },
  { id: "groceries", name: "Groceries", icon: "🛒", limit: 400, color: "#10B981" },
  { id: "transport", name: "Transport", icon: "🚗", limit: 250, color: "#F97316" },
  { id: "entertainment", name: "Entertainment", icon: "🎬", limit: 200, color: "#3B82F6" },
  { id: "shopping", name: "Shopping", icon: "🛍️", limit: 300, color: "#8B5CF6" },
  { id: "healthcare", name: "Healthcare", icon: "💊", limit: 150, color: "#EC4899" },
];

const defaultNotifications: NotificationSettings = {
  transactions: true,
  budgetAlerts: true,
  aiInsights: true,
  weeklyReports: false,
};

const emptyInsights: InsightPayload = {
  monthly_totals: [],
  category_breakdown: [],
  predictions: [],
  unusual_spending: [],
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function inferCountryFromBrowser() {
  const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
  const region = locale.split("-")[1]?.toUpperCase();
  return REGION_TO_COUNTRY[region ?? ""] ?? "United States";
}

export function getCountryConfig(country: string) {
  return COUNTRY_CONFIG[country] ?? COUNTRY_CONFIG["United States"];
}

function normalizeProfile(input?: Partial<ProfileData> & { country?: string; currency?: string; email?: string; displayName?: string }) {
  const country = input?.country || inferCountryFromBrowser();
  const config = getCountryConfig(country);
  return {
    displayName: input?.displayName || "New User",
    email: input?.email || "",
    phone: input?.phone || "",
    location: input?.location || "",
    country,
    currency: input?.currency || config.currency,
    locale: config.locale,
    darkMode: input?.darkMode ?? true,
    notifications: {
      ...defaultNotifications,
      ...(input?.notifications ?? {}),
    },
  } satisfies ProfileData;
}

function storageKey(name: string) {
  return `${STORAGE_PREFIX}:${name}`;
}

function readStorage<T>(name: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const value = window.localStorage.getItem(storageKey(name));
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(name: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch {
    // Storage full or blocked: the in-memory state still works for this session
  }
}

function clearStorage(name: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey(name));
  } catch {
    // ignore
  }
}

/**
 * State persisted under a per-user key, so budgets/groups/friends don't leak between accounts
 * that share a browser. Reloads automatically when the owner changes.
 */
function useScopedState<T>(name: string, owner: string, fallback: (who: string) => T) {
  const load = useCallback((who: string) => readStorage<T | null>(`${name}:${who}`, null) ?? fallback(who), [name]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState(() => ({ owner, value: load(owner) }));
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  useEffect(() => {
    if (state.owner !== owner) {
      setState({ owner, value: load(owner) });
    }
  }, [owner, state.owner, load]);

  useEffect(() => {
    if (state.owner === owner && owner) {
      writeStorage(`${name}:${owner}`, state.value);
    }
  }, [name, owner, state]);

  const setValue = useCallback((updater: T | ((current: T) => T)) => {
    setState((current) => {
      const who = ownerRef.current;
      const base = current.owner === who ? current.value : load(who);
      const value = typeof updater === "function" ? (updater as (current: T) => T)(base) : updater;
      return { owner: who, value };
    });
  }, [load]);

  return [state.owner === owner ? state.value : load(owner), setValue] as const;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => {
    const leftStamp = `${left.date}T${left.time ?? "00:00:00"}`;
    const rightStamp = `${right.date}T${right.time ?? "00:00:00"}`;
    return rightStamp.localeCompare(leftStamp) || right.id - left.id;
  });
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function signedAmount(amount: number, type: TransactionType) {
  return type === "expense" ? -Math.abs(amount) : Math.abs(amount);
}

function formatMonth(month: string, locale = "en-US") {
  return parseLocalDate(`${month}-01`).toLocaleDateString(locale, { month: "short" });
}

function monthLabel(monthOffset: number, locale = "en-US") {
  return shiftMonth(new Date(), monthOffset).toLocaleDateString(locale, { month: "short" });
}

export function categoryIcon(category: string, type: TransactionType = "expense") {
  const normalized = category.toLowerCase();
  if (type === "income" || normalized === "income") return "💰";
  if (normalized.includes("grocer")) return "🛒";
  if (normalized.includes("food") || normalized.includes("dining")) return "🍽️";
  if (normalized.includes("transport")) return "🚗";
  if (normalized.includes("entertainment")) return "🎬";
  if (normalized.includes("shopping")) return "🛍️";
  if (normalized.includes("health")) return "💊";
  if (normalized.includes("utilit")) return "⚡";
  return "📌";
}

type RemoteUser = {
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  country?: string | null;
  currency?: string | null;
};

function normalizeRemoteProfile(user: RemoteUser) {
  return normalizeProfile({
    displayName: user.name,
    email: user.email,
    phone: user.phone ?? "",
    location: user.location ?? "",
    country: user.country ?? inferCountryFromBrowser(),
    currency: user.currency ?? undefined,
    darkMode: readStorage("profile_darkMode", true),
    notifications: readStorage("profile_notifications", defaultNotifications),
  });
}

function normalizeRemoteTransaction(transaction: Transaction) {
  return {
    ...transaction,
    name: transaction.name ?? "Untitled",
    time: transaction.time ?? "00:00:00",
    icon: transaction.icon || categoryIcon(transaction.category, transaction.type),
    amount: signedAmount(transaction.amount, transaction.type),
  };
}

/** Offline fallback for the server's /insights endpoint. */
export function computeInsightsFromTransactions(transactions: Transaction[]): InsightPayload {
  if (transactions.length === 0) {
    return emptyInsights;
  }

  const monthlyMap = new Map<string, { total: number; income: number }>();
  const categoryMap = new Map<string, number>();
  const expenses = transactions.filter((transaction) => transaction.type === "expense").map((transaction) => Math.abs(transaction.amount));

  for (const transaction of transactions) {
    const month = transaction.date.slice(0, 7);
    const entry = monthlyMap.get(month) ?? { total: 0, income: 0 };
    if (transaction.type === "expense") {
      entry.total += Math.abs(transaction.amount);
      categoryMap.set(transaction.category, safeNumber(categoryMap.get(transaction.category) ?? 0) + Math.abs(transaction.amount));
    } else {
      entry.income += Math.abs(transaction.amount);
    }
    monthlyMap.set(month, entry);
  }

  const monthly_totals = Array.from(monthlyMap.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(-6)
    .map(([month, values]) => ({ month, total: Number(values.total.toFixed(2)), income: Number(values.income.toFixed(2)) }));

  // Exclude the in-progress month from the average so a half-finished month doesn't drag the forecast down
  const current = monthKey(new Date());
  const complete = monthly_totals.filter((entry) => entry.month < current).slice(-3).map((entry) => entry.total);
  const recentMonths = complete.length ? complete : monthly_totals.slice(-1).map((entry) => entry.total);
  const movingAverage = recentMonths.length ? recentMonths.reduce((sum, amount) => sum + amount, 0) / recentMonths.length : 0;
  const predictions = [1, 2, 3].map((offset) => ({ month_offset: offset, predicted: Number(movingAverage.toFixed(2)) }));
  const category_breakdown = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
    .sort((left, right) => right.amount - left.amount);

  const mean = expenses.length ? expenses.reduce((sum, amount) => sum + amount, 0) / expenses.length : 0;
  const variance = expenses.length ? expenses.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / expenses.length : 0;
  const unusualLimit = mean + Math.sqrt(variance) * 2;

  const unusual_spending = transactions
    .filter((transaction) => transaction.type === "expense" && Math.abs(transaction.amount) > unusualLimit && expenses.length > 3)
    .map((transaction) => ({
      id: transaction.id,
      name: transaction.name,
      amount: Number(Math.abs(transaction.amount).toFixed(2)),
      date: transaction.date,
      category: transaction.category,
      reason: `${(Math.abs(transaction.amount) / Math.max(mean, 1)).toFixed(1)}x your average expense`,
    }));

  return { monthly_totals, category_breakdown, predictions, unusual_spending };
}

/** Offline assistant used only when the backend is unreachable. */
export function buildAssistantReply(input: {
  question: string;
  transactions: Transaction[];
  budgets: BudgetCategory[];
  groups: ExpenseGroup[];
  profile: ProfileData;
}) {
  const formatter = new Intl.NumberFormat(input.profile.locale, {
    style: "currency",
    currency: input.profile.currency,
    maximumFractionDigits: 2,
  });
  const question = input.question.toLowerCase();
  const thisMonth = input.transactions.filter((transaction) => transaction.date.startsWith(monthKey(new Date())));
  const totalIncome = thisMonth.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpense = thisMonth.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const tightestBudget = input.budgets
    .filter((budget) => budget.limit > 0)
    .map((budget) => ({ ...budget, spent: spentInCategory(input.transactions, budget.name) }))
    .sort((left, right) => right.spent / right.limit - left.spent / left.limit)[0];
  const pendingSettlements = getSplitSummary(input.groups).receive;

  if (question.includes("budget")) {
    return tightestBudget && tightestBudget.spent > 0
      ? `Your tightest budget this month is ${tightestBudget.name}: ${formatter.format(tightestBudget.spent)} of ${formatter.format(tightestBudget.limit)} used.`
      : "Your budgets are looking healthy right now. There's no category close to its limit.";
  }
  if (question.includes("save") || question.includes("saving")) {
    const difference = totalIncome - totalExpense;
    return difference >= 0
      ? `You're ahead by ${formatter.format(difference)} this month. Trimming entertainment or shopping would grow that cushion fastest.`
      : `You're behind by ${formatter.format(Math.abs(difference))} this month. Start with the largest recent expenses and tighten discretionary categories first.`;
  }
  if (question.includes("split") || question.includes("owe")) {
    return pendingSettlements > 0
      ? `You still have ${formatter.format(pendingSettlements)} waiting to be settled across shared expenses.`
      : "All of your current group expenses are settled up.";
  }
  return `This month you've earned ${formatter.format(totalIncome)} and spent ${formatter.format(totalExpense)}. (The assistant is in offline mode, so answers are limited until the backend reconnects.)`;
}

async function fetchJson<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed: ${response.status}`;
    try {
      // FastAPI errors look like {"detail": "..."} or {"detail": [{"msg": "..."}]}
      const detail = JSON.parse(text).detail;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail) && detail[0]?.msg) message = String(detail[0].msg).replace(/^Value error, /, "");
    } catch {
      // not JSON; keep the raw text
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError) return "Can't reach the server. Check that the backend is running.";
  return error instanceof Error ? error.message : fallback;
}

function buildReceiptFallback(input: { filename: string; rawText?: string }): ReceiptDraft {
  const merchant = input.filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "New Receipt";
  const category = inferCategory(`${merchant} ${input.rawText ?? ""}`);
  return {
    amount: "",
    merchant,
    date: todayISO(),
    category: category === "Income" ? "Other" : category,
    items: [],
    rawText: input.rawText ?? "",
    source: "local",
  };
}

function computeParticipantShares(payload: {
  totalAmount: number;
  mode: SplitMode;
  selectedFriends: Friend[];
  paidById: string;
  customValues?: Record<string, number>;
}): SplitParticipant[] {
  const everyone: Array<Friend & { isYou: boolean }> = [
    { id: SELF_ID, name: "You", avatar: "🧑", isYou: true },
    ...payload.selectedFriends.map((friend) => ({ ...friend, isYou: false })),
  ];
  const totalCents = Math.round(payload.totalAmount * 100);
  const cents: Record<string, number> = {};

  if (payload.mode === "equal") {
    // Hand leftover cents to the first people so shares always add up to the bill
    const base = Math.floor(totalCents / everyone.length);
    const remainder = totalCents - base * everyone.length;
    everyone.forEach((person, index) => {
      cents[person.id] = base + (index < remainder ? 1 : 0);
    });
  } else if (payload.mode === "custom") {
    for (const person of everyone) cents[person.id] = Math.round(Number(payload.customValues?.[person.id] ?? 0) * 100);
  } else {
    for (const person of everyone) cents[person.id] = Math.round((totalCents * Number(payload.customValues?.[person.id] ?? 0)) / 100);
  }

  return everyone.map((person) => ({
    id: person.id,
    name: person.name,
    avatar: person.avatar,
    amount: (cents[person.id] ?? 0) / 100,
    percentage: totalCents > 0 ? Number((((cents[person.id] ?? 0) / totalCents) * 100).toFixed(2)) : 0,
    settled: person.id === payload.paidById,
    isYou: person.isYou,
  }));
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const initialCountry = inferCountryFromBrowser();
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [token, setToken] = useState(() => readStorage("token", ""));
  const [profile, setProfile] = useState<ProfileData>(() =>
    normalizeProfile(readStorage("profile", {
      displayName: "",
      email: "",
      country: initialCountry,
    })),
  );
  const [transactions, setTransactions] = useState<Transaction[]>(() => sortTransactions(readStorage("transactions", [] as Transaction[])));
  const [insights, setInsights] = useState<InsightPayload>(() => computeInsightsFromTransactions(readStorage("transactions", [] as Transaction[])));
  const [lastReceipt, setLastReceipt] = useState<ReceiptDraft | null>(() => readStorage("lastReceipt", null));

  const owner = profile.email.toLowerCase() || "guest";
  const [budgets, setBudgets] = useScopedState<BudgetCategory[]>("budgets", owner, (who) => {
    // Adopt budgets saved by older builds under the shared key, then retire that key
    const legacy = readStorage<BudgetCategory[] | null>("budgets", null);
    if (legacy && who !== "guest") clearStorage("budgets");
    return legacy ?? defaultBudgets;
  });
  const [groups, setGroups] = useScopedState<ExpenseGroup[]>("groups", owner, () => []);
  const [customFriends, setCustomFriends] = useScopedState<Friend[]>("friends", owner, () => []);
  const friends = useMemo(() => [...defaultFriends, ...customFriends], [customFriends]);

  const isAuthenticated = Boolean(token && profile.email);
  const connected = backendStatus === "connected" && Boolean(token);
  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(profile.locale, {
        style: "currency",
        currency: profile.currency,
        maximumFractionDigits: 2,
      }),
    [profile.currency, profile.locale],
  );

  useEffect(() => {
    writeStorage("token", token);
  }, [token]);

  useEffect(() => {
    writeStorage("profile", profile);
    writeStorage("profile_darkMode", profile.darkMode);
    writeStorage("profile_notifications", profile.notifications);
    document.documentElement.classList.toggle("dark", profile.darkMode);
  }, [profile]);

  useEffect(() => {
    writeStorage("transactions", transactions);
    if (backendStatus !== "connected") {
      setInsights(computeInsightsFromTransactions(transactions));
    }
  }, [transactions, backendStatus]);

  useEffect(() => {
    writeStorage("lastReceipt", lastReceipt);
  }, [lastReceipt]);

  function applyRemoteUser(user: RemoteUser) {
    setProfile((current) => ({
      ...normalizeRemoteProfile(user),
      darkMode: current.darkMode,
      notifications: current.notifications,
    }));
  }

  async function loadRemote(activeToken: string) {
    const [remoteTransactions, remoteInsights, status] = await Promise.all([
      fetchJson<Transaction[]>("/transactions/", undefined, activeToken),
      fetchJson<InsightPayload>(`/insights/?today=${todayISO()}`, undefined, activeToken),
      fetchJson<{ ai_enabled: boolean }>("/ai/status", undefined, activeToken).catch(() => ({ ai_enabled: false })),
    ]);
    setTransactions(sortTransactions(remoteTransactions.map(normalizeRemoteTransaction)));
    setInsights(remoteInsights);
    setAiEnabled(status.ai_enabled);
  }

  async function refreshInsights(activeToken = token) {
    try {
      setInsights(await fetchJson<InsightPayload>(`/insights/?today=${todayISO()}`, undefined, activeToken));
    } catch {
      // Keep the previous insights; they'll refresh on the next successful call
    }
  }

  async function refreshRemoteData() {
    if (!token) {
      return;
    }
    try {
      await loadRemote(token);
    } catch (error) {
      handleAuthError(error);
    }
  }

  /** Sign out when the server rejects the token, instead of silently falling back to stale data. */
  function handleAuthError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      logout();
      return true;
    }
    return false;
  }

  async function bootstrap(activeToken: string) {
    try {
      await fetchJson<{ status: string }>("/health");
    } catch {
      setBackendStatus("offline");
      setInsights(computeInsightsFromTransactions(transactions));
      return;
    }
    setBackendStatus("connected");
    if (!activeToken) return;
    try {
      const user = await fetchJson<RemoteUser>("/auth/me", undefined, activeToken);
      applyRemoteUser(user);
      await loadRemote(activeToken);
    } catch (error) {
      if (!handleAuthError(error)) {
        // Server reachable but a data call failed; keep cached data visible
        setInsights(computeInsightsFromTransactions(transactions));
      }
    }
  }

  useEffect(() => {
    let active = true;
    void bootstrap(token).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While offline, quietly retry every 20s so the app reconnects once the backend is back
  useEffect(() => {
    if (backendStatus !== "offline") return;
    const timer = window.setInterval(() => void bootstrap(token), 20_000);
    return () => window.clearInterval(timer);
  }, [backendStatus, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reconnect() {
    setBackendStatus("checking");
    await bootstrap(token);
  }

  async function authenticate(path: string, body: Record<string, unknown>, fallback: string): Promise<Result> {
    try {
      const response = await fetchJson<{ access_token: string; user: RemoteUser }>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setBackendStatus("connected");
      setToken(response.access_token);
      applyRemoteUser(response.user);
      setTransactions([]);
      setInsights(emptyInsights);
      await loadRemote(response.access_token).catch(() => undefined);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error, fallback) };
    }
  }

  async function login(payload: UserCredentials) {
    return authenticate("/auth/login", { email: payload.email.trim(), password: payload.password }, "Unable to sign in");
  }

  async function register(payload: UserCredentials) {
    const country = payload.country || inferCountryFromBrowser();
    return authenticate("/auth/register", {
      name: payload.name?.trim() || "New User",
      email: payload.email.trim(),
      password: payload.password,
      phone: payload.phone ?? "",
      location: payload.location ?? "",
      country,
      currency: getCountryConfig(country).currency,
    }, "Unable to register");
  }

  function logout() {
    setToken("");
    setTransactions([]);
    setInsights(emptyInsights);
    setLastReceipt(null);
    setProfile((current) =>
      normalizeProfile({
        country: current.country || inferCountryFromBrowser(),
        darkMode: current.darkMode,
        notifications: current.notifications,
      }),
    );
    clearStorage("token");
    clearStorage("transactions");
    clearStorage("lastReceipt");
  }

  function toPayload(input: TransactionInput) {
    return {
      merchant_name: input.name.trim(),
      category: input.category,
      amount: Math.abs(input.amount),
      date: input.date,
      time: input.time ?? null,
      icon: input.icon || categoryIcon(input.category, input.type),
      type: input.type,
    };
  }

  function toLocal(input: TransactionInput, id: number): Transaction {
    return {
      id,
      name: input.name.trim(),
      category: input.category,
      amount: signedAmount(input.amount, input.type),
      date: input.date,
      time: input.time ?? "00:00:00",
      icon: input.icon || categoryIcon(input.category, input.type),
      type: input.type,
    };
  }

  async function addTransaction(input: TransactionInput): Promise<Result> {
    if (!(input.amount > 0)) return { ok: false, error: "Enter an amount greater than zero" };
    if (connected) {
      try {
        const created = await fetchJson<Transaction>("/transactions/", { method: "POST", body: JSON.stringify(toPayload(input)) }, token);
        setTransactions((current) => sortTransactions([normalizeRemoteTransaction(created), ...current]));
        void refreshInsights();
        return { ok: true };
      } catch (error) {
        if (handleAuthError(error)) return { ok: false, error: "Your session expired. Please sign in again." };
        return { ok: false, error: errorMessage(error, "Unable to save transaction") };
      }
    }

    setTransactions((current) => sortTransactions([toLocal(input, Date.now()), ...current]));
    return { ok: true };
  }

  async function updateTransaction(id: number, input: TransactionInput): Promise<Result> {
    if (!(input.amount > 0)) return { ok: false, error: "Enter an amount greater than zero" };
    if (connected) {
      try {
        const updated = await fetchJson<Transaction>(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(toPayload(input)) }, token);
        setTransactions((current) => sortTransactions(current.map((entry) => (entry.id === id ? normalizeRemoteTransaction(updated) : entry))));
        void refreshInsights();
        return { ok: true };
      } catch (error) {
        if (handleAuthError(error)) return { ok: false, error: "Your session expired. Please sign in again." };
        return { ok: false, error: errorMessage(error, "Unable to update transaction") };
      }
    }
    setTransactions((current) => sortTransactions(current.map((entry) => (entry.id === id ? toLocal(input, id) : entry))));
    return { ok: true };
  }

  async function deleteTransaction(id: number): Promise<Result> {
    if (connected) {
      try {
        await fetchJson(`/transactions/${id}`, { method: "DELETE" }, token);
      } catch (error) {
        // Don't remove it locally if the server still has it, or it would reappear on the next refresh
        if (!(error instanceof ApiError && error.status === 404)) {
          if (handleAuthError(error)) return { ok: false, error: "Your session expired. Please sign in again." };
          return { ok: false, error: errorMessage(error, "Unable to delete transaction") };
        }
      }
    }
    setTransactions((current) => current.filter((transaction) => transaction.id !== id));
    if (connected) void refreshInsights();
    return { ok: true };
  }

  async function importTransactions(rows: ParsedCSVRow[]): Promise<Result<number>> {
    if (rows.length === 0) return { ok: false, error: "No valid rows to import" };
    const inputs: TransactionInput[] = rows.map((row) => ({ ...row, icon: categoryIcon(row.category, row.type) }));
    if (connected) {
      try {
        const response = await fetchJson<{ created: number; transactions: Transaction[] }>(
          "/transactions/bulk",
          { method: "POST", body: JSON.stringify({ transactions: inputs.map(toPayload) }) },
          token,
        );
        setTransactions((current) => sortTransactions([...response.transactions.map(normalizeRemoteTransaction), ...current]));
        void refreshInsights();
        return { ok: true, data: response.created };
      } catch (error) {
        if (handleAuthError(error)) return { ok: false, error: "Your session expired. Please sign in again." };
        return { ok: false, error: errorMessage(error, "Import failed") };
      }
    }
    const base = Date.now();
    setTransactions((current) => sortTransactions([...inputs.map((input, index) => toLocal(input, base + index)), ...current]));
    return { ok: true, data: inputs.length };
  }

  async function scanReceipt(input: { filename: string; imageBase64?: string; rawText?: string }): Promise<Result<ReceiptDraft>> {
    if (connected) {
      try {
        const response = await fetchJson<{
          image_url: string;
          raw_text: string;
          source?: ReceiptDraft["source"];
          parsed: {
            amount?: number | null;
            merchant?: string | null;
            date?: string | null;
            category?: string | null;
            items?: Array<{ name: string; price: number }>;
          } | null;
        }>("/receipts/scan", {
          method: "POST",
          body: JSON.stringify({
            filename: input.filename,
            image_base64: input.imageBase64,
            raw_text: input.rawText,
          }),
        }, token);
        const parsed = response.parsed ?? {};
        const category = parsed.category ?? inferCategory(response.raw_text || input.filename);
        const receipt: ReceiptDraft = {
          amount: parsed.amount ? String(parsed.amount) : "",
          merchant: parsed.merchant ?? input.filename.replace(/\.[^.]+$/, ""),
          date: parsed.date ?? todayISO(),
          category: category === "Income" ? "Other" : category,
          items: (parsed.items ?? []).map((item) => ({ name: item.name, price: Number(item.price) })),
          imageUrl: response.image_url,
          rawText: response.raw_text,
          source: response.source,
        };
        setLastReceipt(receipt);
        return { ok: true, data: receipt };
      } catch (error) {
        handleAuthError(error);
        const fallback = buildReceiptFallback(input);
        setLastReceipt(fallback);
        return { ok: false, error: errorMessage(error, "Unable to scan receipt"), data: fallback };
      }
    }

    const fallback = buildReceiptFallback(input);
    setLastReceipt(fallback);
    return { ok: true, data: fallback };
  }

  function clearReceipt() {
    setLastReceipt(null);
  }

  function saveBudget(budget: BudgetCategory) {
    setBudgets((current) => {
      const existing = current.find((entry) => entry.id === budget.id);
      return existing ? current.map((entry) => (entry.id === budget.id ? budget : entry)) : [...current, budget];
    });
  }

  function deleteBudget(id: string) {
    setBudgets((current) => current.filter((entry) => entry.id !== id));
  }

  function createGroup(payload: {
    name: string;
    totalAmount: number;
    mode: SplitMode;
    selectedFriends: Friend[];
    paidById: string;
    customValues?: Record<string, number>;
  }) {
    const group: ExpenseGroup = {
      id: makeId(),
      name: payload.name,
      totalAmount: payload.totalAmount,
      createdAt: new Date().toISOString(),
      mode: payload.mode,
      paidById: payload.paidById,
      participants: computeParticipantShares(payload),
    };
    setGroups((current) => [group, ...current]);
  }

  function deleteGroup(groupId: string) {
    setGroups((current) => current.filter((group) => group.id !== groupId));
  }

  function toggleSettlement(groupId: string, participantId: string) {
    setGroups((current) =>
      current.map((group) =>
        group.id !== groupId
          ? group
          : {
              ...group,
              participants: group.participants.map((participant) =>
                participant.id === participantId ? { ...participant, settled: !participant.settled } : participant,
              ),
            },
      ),
    );
  }

  function addFriend(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = friends.find((friend) => friend.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const friend: Friend = { id: `friend-${makeId()}`, name: trimmed, avatar: trimmed[0].toUpperCase() };
    setCustomFriends((current) => [...current, friend]);
    return friend;
  }

  async function updateProfile(updates: Partial<ProfileData>): Promise<Result> {
    const nextCountry = updates.country ?? profile.country;
    const derived = getCountryConfig(nextCountry);
    const nextProfile = {
      ...profile,
      ...updates,
      country: nextCountry,
      currency: updates.country && updates.country !== profile.country ? derived.currency : (updates.currency ?? profile.currency),
      locale: derived.locale,
      notifications: {
        ...profile.notifications,
        ...(updates.notifications ?? {}),
      },
    };

    setProfile(nextProfile);

    // Theme and notification toggles are device preferences; only account fields go to the server
    const accountFields = ["displayName", "email", "phone", "location", "country", "currency"] as const;
    const accountChanged = accountFields.some((field) => field in updates && nextProfile[field] !== profile[field]);
    if (connected && accountChanged) {
      try {
        const remote = await fetchJson<RemoteUser>("/auth/me", {
          method: "PUT",
          body: JSON.stringify({
            name: nextProfile.displayName,
            email: nextProfile.email,
            phone: nextProfile.phone,
            location: nextProfile.location,
            country: nextProfile.country,
            currency: nextProfile.currency,
          }),
        }, token);
        applyRemoteUser(remote);
        return { ok: true };
      } catch (error) {
        setProfile(profile);
        if (handleAuthError(error)) return { ok: false, error: "Your session expired. Please sign in again." };
        return { ok: false, error: errorMessage(error, "Unable to update profile") };
      }
    }
    return { ok: true };
  }

  async function askAssistant(message: string, history: ChatTurn[]) {
    if (connected) {
      try {
        const response = await fetchJson<{ reply: string; source: "ai" | "rules" }>(
          `/ai/chat?today=${todayISO()}`,
          {
            method: "POST",
            body: JSON.stringify({
              message,
              history: history.slice(-10),
              budgets: budgets.map((budget) => ({ name: budget.name, limit: budget.limit })),
            }),
          },
          token,
        );
        return response;
      } catch (error) {
        handleAuthError(error);
      }
    }
    return { reply: buildAssistantReply({ question: message, transactions, budgets, groups, profile }), source: "local" as const };
  }

  async function parseQuickAdd(text: string): Promise<Result<QuickAddDraft>> {
    if (!connected) return { ok: false, error: "Quick add needs the backend. Use the form while offline." };
    try {
      const data = await fetchJson<QuickAddDraft>("/ai/parse-transaction", { method: "POST", body: JSON.stringify({ text, today: todayISO() }) }, token);
      return { ok: true, data };
    } catch (error) {
      handleAuthError(error);
      return { ok: false, error: errorMessage(error, "Couldn't understand that") };
    }
  }

  function formatMoney(amount: number) {
    return moneyFormatter.format(amount);
  }

  return (
    <FinanceContext.Provider
      value={{
        loading,
        backendStatus,
        aiEnabled,
        isAuthenticated,
        token,
        transactions,
        budgets,
        groups,
        friends,
        profile,
        insights,
        lastReceipt,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        importTransactions,
        scanReceipt,
        clearReceipt,
        saveBudget,
        deleteBudget,
        createGroup,
        deleteGroup,
        toggleSettlement,
        addFriend,
        updateProfile,
        askAssistant,
        parseQuickAdd,
        login,
        register,
        logout,
        reconnect,
        refreshRemoteData,
        formatMoney,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within a FinanceProvider");
  }
  return context;
}

/** Concrete chart colors for the active theme (SVG attributes can't read CSS variables reliably). */
export function useChartTheme() {
  const { profile } = useFinance();
  return useMemo(() => {
    const dark = profile.darkMode;
    return {
      axis: dark ? "#94A3B8" : "#64748B",
      grid: dark ? "rgba(148, 163, 184, 0.1)" : "rgba(15, 23, 42, 0.08)",
      income: dark ? "#10B981" : "#059669",
      expense: dark ? "#F97316" : "#EA580C",
      primary: dark ? "#06B6D4" : "#0891B2",
      palette: dark
        ? ["#06B6D4", "#10B981", "#F97316", "#3B82F6", "#8B5CF6", "#EC4899", "#EAB308", "#94A3B8"]
        : ["#0891B2", "#059669", "#EA580C", "#2563EB", "#7C3AED", "#DB2777", "#CA8A04", "#64748B"],
      tooltip: {
        backgroundColor: dark ? "#131823" : "#FFFFFF",
        border: `1px solid ${dark ? "rgba(148, 163, 184, 0.15)" : "rgba(15, 23, 42, 0.1)"}`,
        borderRadius: "12px",
        color: dark ? "#E8EAED" : "#0F172A",
      },
    };
  }, [profile.darkMode]);
}

/** Current-month spend for a budget category. */
export function getSpentForBudget(transactions: Transaction[], budgetName: string) {
  return spentInCategory(transactions, budgetName);
}

export function getSplitSummary(groups: ExpenseGroup[]) {
  let receive = 0;
  let owe = 0;
  for (const group of groups) {
    for (const participant of group.participants) {
      if (participant.settled || participant.id === group.paidById) continue;
      if (group.paidById === SELF_ID && !participant.isYou) receive += participant.amount;
      if (participant.isYou && group.paidById !== SELF_ID) owe += participant.amount;
    }
  }
  return { receive, owe };
}

/**
 * Net position with each person across all unsettled groups.
 * Positive = they owe you; negative = you owe them.
 */
export function getNetBalances(groups: ExpenseGroup[]) {
  const balances = new Map<string, { id: string; name: string; avatar: string; amount: number }>();
  const bump = (person: Friend, delta: number) => {
    const entry = balances.get(person.id) ?? { id: person.id, name: person.name, avatar: person.avatar, amount: 0 };
    entry.amount += delta;
    balances.set(person.id, entry);
  };
  for (const group of groups) {
    const payer = group.participants.find((participant) => participant.id === group.paidById);
    if (!payer) continue;
    for (const participant of group.participants) {
      if (participant.settled || participant.id === group.paidById) continue;
      if (group.paidById === SELF_ID) bump(participant, participant.amount);
      else if (participant.isYou) bump(payer, -participant.amount);
    }
  }
  return [...balances.values()].filter((entry) => Math.abs(entry.amount) >= 0.01).sort((left, right) => right.amount - left.amount);
}

export function getAccountStats(transactions: Transaction[]) {
  const income = transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const saved = income - expense;
  return { income, expense, saved, balance: saved };
}

export function getMonthlySeries(insights: InsightPayload, transactions: Transaction[], locale = "en-US") {
  if (insights.monthly_totals.length > 0) {
    return insights.monthly_totals.slice(-6).map((entry) => ({
      month: formatMonth(entry.month, locale),
      expense: entry.total,
      income: entry.income ?? transactions
        .filter((transaction) => transaction.type === "income" && transaction.date.startsWith(entry.month))
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }));
  }
  return [];
}

export function getPredictionSeries(insights: InsightPayload, locale = "en-US") {
  return insights.predictions.map((entry) => ({
    month: monthLabel(entry.month_offset, locale),
    predicted: entry.predicted,
    range: entry.low !== undefined && entry.high !== undefined ? [entry.low, entry.high] : undefined,
  }));
}
