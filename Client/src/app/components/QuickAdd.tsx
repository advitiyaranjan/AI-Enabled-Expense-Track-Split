import { useState } from "react";
import { Check, LoaderCircle, Sparkles, Wand2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { EXPENSE_CATEGORIES, formatDate } from "../lib/analytics";
import { categoryIcon, useFinance, type QuickAddDraft } from "../lib/finance";

const EXAMPLES = ["coffee 4.50 at Starbucks", "uber 12 yesterday", "salary 3200 on the 1st", "groceries 85 last saturday"];

/** Natural-language transaction entry: type a sentence, confirm the parsed result, save. */
export function QuickAdd({ compact = false }: { compact?: boolean }) {
  const { parseQuickAdd, addTransaction, formatMoney, profile, backendStatus } = useFinance();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleParse() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await parseQuickAdd(text.trim());
    setBusy(false);
    if (result.ok && result.data) {
      setDraft(result.data);
    } else {
      setMessage({ tone: "error", text: result.error ?? "Couldn't understand that" });
    }
  }

  async function handleSave() {
    if (!draft || !draft.amount) return;
    setBusy(true);
    const result = await addTransaction({
      name: draft.name,
      category: draft.type === "income" ? "Income" : draft.category,
      amount: draft.amount,
      date: draft.date,
      time: null,
      type: draft.type,
      icon: categoryIcon(draft.category, draft.type),
    });
    setBusy(false);
    if (result.ok) {
      setMessage({ tone: "ok", text: `Saved ${draft.name}, ${formatMoney(draft.amount)}` });
      setDraft(null);
      setText("");
    } else {
      setMessage({ tone: "error", text: result.error ?? "Unable to save" });
    }
  }

  const offline = backendStatus !== "connected";

  return (
    <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wand2 className="h-4 w-4 text-primary" />
        Quick add
        <span className="font-normal text-muted-foreground">. Just describe it</span>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleParse();
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={offline}
          placeholder={offline ? "Quick add is available when the backend is connected" : `e.g. "${EXAMPLES[0]}"`}
          className="min-w-0 flex-1 rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary disabled:opacity-60"
          aria-label="Describe a transaction"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy || offline}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50"
        >
          {busy && !draft ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="hidden sm:inline">Parse</span>
        </button>
      </form>

      {!compact && !draft && !offline ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => setText(example)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {draft ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-primary" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.amount ?? ""}
                    onChange={(event) => setDraft({ ...draft, amount: event.target.value ? Number(event.target.value) : null })}
                    className="rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Date</span>
                  <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-primary" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <select
                    value={draft.type}
                    onChange={(event) => {
                      const type = event.target.value as QuickAddDraft["type"];
                      setDraft({ ...draft, type, category: type === "income" ? "Income" : draft.category === "Income" ? "Other" : draft.category });
                    }}
                    className="rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-primary"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                {draft.type === "expense" ? (
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Category</span>
                    <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className="rounded-xl border border-border bg-input-background px-3 py-2 outline-none focus:border-primary">
                      {EXPENSE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="self-end text-xs text-muted-foreground sm:col-span-1">
                  {formatDate(draft.date, profile.locale)} · {draft.source === "ai" ? "AI" : "Smart rules"} · {Math.round(draft.confidence * 100)}% sure
                </p>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <button
                  onClick={() => void handleSave()}
                  disabled={!draft.amount || !draft.name.trim() || busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Save
                </button>
                <button onClick={() => setDraft(null)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
              {!draft.amount ? <p className="text-xs text-expense sm:col-span-2">I couldn't find an amount. Please fill it in.</p> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {message ? (
        <p className={`mt-3 text-sm ${message.tone === "ok" ? "text-income" : "text-expense"}`} role="status">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
