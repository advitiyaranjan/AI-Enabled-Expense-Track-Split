import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Check,
  Copy,
  DollarSign,
  Hash,
  Link2,
  LoaderCircle,
  MessageCircle,
  Percent,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getNetBalances, getSplitSummary, SELF_ID, useFinance, type ExpenseGroup, type Friend, type ParsedSplit, type SplitMode } from "../lib/finance";

function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function SplitExpenses() {
  const { groups, friends, profile, createGroup, deleteGroup, toggleSettlement, addFriend, formatMoney, parseSplit, lookupUser, shareGroup, refreshSharedSplits, backendStatus } = useFinance();
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [paidById, setPaidById] = useState(SELF_ID);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [newFriend, setNewFriend] = useState("");
  const [error, setError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [idInput, setIdInput] = useState("");
  const [idBusy, setIdBusy] = useState(false);
  const [share, setShare] = useState<Record<string, { busy?: boolean; error?: string; copied?: string }>>({});

  // Pick up "I've paid" taps from shared links now and whenever the user comes back to the tab
  useEffect(() => {
    void refreshSharedSplits();
    const onFocus = () => void refreshSharedSplits();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // Re-register once the connection is up: refreshSharedSplits is a no-op while still connecting
  }, [backendStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = getSplitSummary(groups);
  const netBalances = getNetBalances(groups);
  const participants = [{ id: SELF_ID, name: "You" }, ...selectedFriends.map((friend) => ({ id: friend.id, name: friend.name }))];
  const total = Number(totalAmount) || 0;
  const enteredSum = participants.reduce((sum, participant) => sum + (Number(customValues[participant.id]) || 0), 0);
  const target = splitMode === "custom" ? total : 100;
  const remaining = target - enteredSum;
  const splitValid = splitMode === "equal" || Math.abs(remaining) < 0.01;

  // While typing, suggest people from earlier splits (by name or FinanceAI ID)
  const query = newFriend.trim().toLowerCase();
  const suggestions = query
    ? friends
        .filter((friend) => !selectedFriends.some((entry) => entry.id === friend.id))
        .filter((friend) => friend.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(query)) || friend.name.toLowerCase().includes(query) || String(friend.publicId ?? "").startsWith(query))
        .slice(0, 5)
    : [];

  function pickSuggestion(friend: Friend) {
    setSelectedFriends((current) => (current.some((entry) => entry.id === friend.id) ? current : [...current, friend]));
    setNewFriend("");
  }

  function toggleFriend(friend: Friend) {
    setSelectedFriends((current) => {
      const exists = current.some((entry) => entry.id === friend.id);
      const next = exists ? current.filter((entry) => entry.id !== friend.id) : [...current, friend];
      if (paidById !== SELF_ID && !next.some((entry) => entry.id === paidById)) {
        setPaidById(SELF_ID);
      }
      return next;
    });
  }

  function handleAddFriend() {
    const friend = addFriend(newFriend);
    if (friend && !selectedFriends.some((entry) => entry.id === friend.id)) {
      setSelectedFriends((current) => [...current, friend]);
    }
    setNewFriend("");
  }

  function fillEvenly() {
    const share = target / participants.length;
    setCustomValues(Object.fromEntries(participants.map((participant) => [participant.id, share.toFixed(2)])));
  }

  async function handleAiFill() {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(true);
    setError("");
    setAiNote("");
    const result = await parseSplit(aiText.trim());
    setAiBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? "Couldn't understand that. Try naming the amount and the people.");
      return;
    }
    applyParsed(result.data);
  }

  function applyParsed(parsed: ParsedSplit) {
    const people: Friend[] = [];
    for (const entry of parsed.participants) {
      const friend = friends.find((candidate) => candidate.name.toLowerCase() === entry.name.toLowerCase()) ?? addFriend(entry.name);
      if (friend && !people.some((person) => person.id === friend.id)) people.push(friend);
    }
    setSelectedFriends(people);
    if (parsed.title) setGroupName(parsed.title);
    if (parsed.total) setTotalAmount(String(parsed.total));
    setSplitMode(parsed.mode);
    const payer = parsed.payer.toLowerCase() === "you" ? null : people.find((person) => person.name.toLowerCase() === parsed.payer.toLowerCase());
    setPaidById(payer?.id ?? SELF_ID);

    const values: Record<string, string> = {};
    if (parsed.mode !== "equal") {
      const pick = (entry: { amount: number | null; percentage: number | null }) => (parsed.mode === "custom" ? entry.amount : entry.percentage);
      const mine = parsed.mode === "custom" ? parsed.your_amount : parsed.your_percentage;
      if (mine !== null && mine !== undefined) values[SELF_ID] = String(mine);
      parsed.participants.forEach((entry, index) => {
        const value = pick(entry);
        if (people[index] && value !== null && value !== undefined) values[people[index].id] = String(value);
      });
    }
    setCustomValues(values);
    const missing = !parsed.total ? " Add the total amount." : people.length === 0 ? " Pick who to split with." : "";
    setAiNote(`Filled by ${parsed.source === "ai" ? "AI" : "smart rules"}. Check the details below.${missing}`);
  }

  async function handleAddById() {
    if (!idInput.trim() || idBusy) return;
    setIdBusy(true);
    setError("");
    const result = await lookupUser(idInput);
    setIdBusy(false);
    if (result.ok && result.data) {
      const friend = result.data;
      setSelectedFriends((current) => (current.some((entry) => entry.id === friend.id) ? current : [...current, friend]));
      setIdInput("");
    } else {
      setError(result.error ?? "Couldn't find that ID");
    }
  }

  async function handleShare(group: ExpenseGroup) {
    setShare((current) => ({ ...current, [group.id]: { busy: true } }));
    const result = await shareGroup(group.id);
    setShare((current) => ({ ...current, [group.id]: result.ok ? {} : { error: result.error } }));
  }

  function payUrl(group: ExpenseGroup, participantId?: string) {
    const base = `${window.location.origin}/pay/${group.shareToken}`;
    return participantId ? `${base}?p=${encodeURIComponent(participantId)}` : base;
  }

  function shareMessage(group: ExpenseGroup) {
    return `${group.name}: ${formatMoney(group.totalAmount)}. I paid, so tap to pay your share by UPI: ${payUrl(group)}`;
  }

  async function nativeShare(group: ExpenseGroup) {
    if (navigator.share) {
      try {
        await navigator.share({ title: group.name, text: shareMessage(group), url: payUrl(group) });
        return;
      } catch {
        return; // user cancelled the share sheet
      }
    }
    copyLink(group);
  }

  function copyLink(group: ExpenseGroup, participantId?: string) {
    void navigator.clipboard?.writeText(payUrl(group, participantId)).then(() => {
      setShare((current) => ({ ...current, [group.id]: { ...current[group.id], copied: participantId ?? "all" } }));
      window.setTimeout(() => setShare((current) => ({ ...current, [group.id]: { ...current[group.id], copied: undefined } })), 1500);
    });
  }

  function resetModal() {
    setAiText("");
    setAiNote("");
    setIdInput("");
    setShowModal(false);
    setGroupName("");
    setTotalAmount("");
    setSelectedFriends([]);
    setSplitMode("equal");
    setPaidById(SELF_ID);
    setCustomValues({});
    setError("");
  }

  function handleCreateGroup() {
    if (!groupName.trim()) return setError("Give the expense a name.");
    if (!(total > 0)) return setError("Enter the total amount.");
    if (selectedFriends.length === 0) return setError("Pick at least one person to split with.");
    if (!splitValid) {
      return setError(
        splitMode === "custom"
          ? `Shares must add up to ${formatMoney(total)} (${formatMoney(Math.abs(remaining))} ${remaining > 0 ? "unassigned" : "too much"}).`
          : `Percentages must add up to 100% (currently ${enteredSum.toFixed(1)}%).`,
      );
    }

    createGroup({
      name: groupName.trim(),
      totalAmount: total,
      mode: splitMode,
      selectedFriends,
      paidById,
      customValues: Object.fromEntries(Object.entries(customValues).map(([key, value]) => [key, Number(value) || 0])),
    });
    resetModal();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Split expenses</h1>
          <p className="mt-1 text-muted-foreground">Track who paid, who still owes, and what has already been settled.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary-glow">
          <Plus className="h-5 w-5" />
          Split a bill
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-gradient-to-br from-income to-income-bright p-6 text-white shadow-lg shadow-income/20">
          <div className="mb-2 flex items-center gap-2 text-sm opacity-90">
            <Users className="h-5 w-5" />
            You'll receive
          </div>
          <p className="text-3xl font-bold">{formatMoney(summary.receive)}</p>
          <p className="mt-2 text-sm opacity-90">Pending settlements owed back to you</p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-expense to-expense-bright p-6 text-white shadow-lg shadow-expense/20">
          <div className="mb-2 flex items-center gap-2 text-sm opacity-90">
            <DollarSign className="h-5 w-5" />
            You owe
          </div>
          <p className="text-3xl font-bold">{formatMoney(summary.owe)}</p>
          <p className="mt-2 text-sm opacity-90">Unsettled shares where somebody else covered the bill</p>
        </div>
      </motion.div>

      {netBalances.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card p-6">
          <h2 className="mb-1 text-xl font-semibold">Settle up</h2>
          <p className="mb-4 text-sm text-muted-foreground">Everything netted out across all your groups, one payment per person.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {netBalances.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 rounded-2xl bg-muted/30 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-lg">{entry.avatar}</div>
                <div className="flex flex-1 items-center gap-2 text-sm">
                  <span className="font-medium">{entry.amount > 0 ? entry.name : "You"}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{entry.amount > 0 ? "You" : entry.name}</span>
                </div>
                <span className={`font-semibold ${entry.amount > 0 ? "text-income" : "text-expense"}`}>{formatMoney(Math.abs(entry.amount))}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ) : null}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <h2 className="text-xl font-semibold">Shared bills</h2>

        {groups.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
            No shared bills yet. Split one to start tracking who owes what.
          </div>
        ) : (
          groups.map((group, index) => {
            const owed = group.participants.filter((participant) => participant.id !== group.paidById);
            const owedTotal = owed.reduce((sum, participant) => sum + participant.amount, 0);
            const settledAmount = owed.filter((participant) => participant.settled).reduce((sum, participant) => sum + participant.amount, 0);
            const progress = owedTotal > 0 ? (settledAmount / owedTotal) * 100 : 100;
            const payer = group.participants.find((participant) => participant.id === group.paidById);

            return (
              <motion.div key={group.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="rounded-3xl border border-border bg-card p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{group.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Paid by {payer?.name ?? "Unknown"} on{" "}
                      {new Date(group.createdAt).toLocaleDateString(profile.locale, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatMoney(group.totalAmount)}</p>
                      <p className="text-sm capitalize text-muted-foreground">{group.mode} split</p>
                    </div>
                    <button
                      onClick={() => window.confirm(`Delete "${group.name}"?`) && deleteGroup(group.id)}
                      className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-expense/10 hover:text-expense"
                      aria-label={`Delete ${group.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {group.paidById === SELF_ID && owedTotal > settledAmount ? (
                  <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    {group.shareToken ? (
                      <>
                        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                          <Link2 className="h-4 w-4 text-primary" /> Payment link: friends tap it to pay you by UPI
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => void nativeShare(group)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-glow">
                            <Share2 className="h-4 w-4" /> Share
                          </button>
                          <a href={whatsappUrl(shareMessage(group))} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary">
                            <MessageCircle className="h-4 w-4" /> WhatsApp
                          </a>
                          <button onClick={() => copyLink(group)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary">
                            {share[group.id]?.copied === "all" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {share[group.id]?.copied === "all" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => void handleShare(group)}
                        disabled={share[group.id]?.busy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-glow disabled:opacity-60"
                      >
                        {share[group.id]?.busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        Create UPI payment link
                      </button>
                    )}
                    {share[group.id]?.error ? (
                      <p className="mt-2 text-sm text-expense">
                        {share[group.id]?.error}{" "}
                        {share[group.id]?.error?.includes("UPI") ? <Link to="/profile" className="font-semibold underline">Add UPI ID</Link> : null}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Settled {formatMoney(settledAmount)} of {formatMoney(owedTotal)}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-income" style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                </div>

                <div className="space-y-3">
                  {group.participants.map((participant) => (
                    <div key={`${group.id}-${participant.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-lg">{participant.avatar}</div>
                        <div>
                          <p className="font-medium">{participant.name}</p>
                          <p className="text-xs text-muted-foreground">{participant.percentage.toFixed(1)}% share</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">{formatMoney(participant.amount)}</p>
                          <p className={`text-xs ${participant.claimed && !participant.settled ? "font-medium text-secondary-bright" : "text-muted-foreground"}`}>
                            {participant.id === group.paidById ? "Paid the bill" : participant.settled ? "Settled" : participant.claimed ? "Says they paid" : "Pending"}
                          </p>
                        </div>
                        {participant.id !== group.paidById && !participant.isYou && !participant.settled && group.shareToken && group.paidById === SELF_ID ? (
                          <a
                            href={whatsappUrl(`Hi ${participant.name.split(" ")[0]}, your share for ${group.name} is ${formatMoney(participant.amount)}. Pay here: ${payUrl(group, participant.id)}`)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Remind ${participant.name} on WhatsApp`}
                            className="rounded-2xl p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        ) : null}
                        {participant.id !== group.paidById ? (
                          <button
                            onClick={() => toggleSettlement(group.id, participant.id)}
                            className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${participant.settled ? "bg-income/15 text-income hover:bg-income/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                          >
                            {participant.settled ? "Mark pending" : participant.claimed ? "Confirm paid" : "Mark settled"}
                          </button>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-income text-white">
                            <Check className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      <AnimatePresence>
        {showModal ? (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60" onClick={resetModal} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="fixed inset-4 z-50 overflow-auto rounded-3xl border border-border bg-card p-6 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:max-h-[90vh] lg:w-full lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2"
              role="dialog"
              aria-modal="true"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Split a bill</h2>
                <button onClick={resetModal} className="rounded-xl p-2 hover:bg-muted" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-6">
                <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-4">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Wand2 className="h-4 w-4 text-primary" /> Describe it and AI fills the form
                  </p>
                  <textarea
                    value={aiText}
                    onChange={(event) => setAiText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleAiFill();
                      }
                    }}
                    rows={2}
                    placeholder='e.g. "Dinner 2400 with Sarah and Mike, I paid" or "Groceries 1200: Sarah 500, Mike 300, me 400"'
                    className="w-full resize-none rounded-xl border border-border bg-input-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{aiNote || "Mention the amount, who's in, who paid, and any custom shares or %."}</p>
                    <button
                      type="button"
                      onClick={() => void handleAiFill()}
                      disabled={!aiText.trim() || aiBusy}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
                    >
                      {aiBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Fill
                    </button>
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">What was it for?</span>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    placeholder="Weekend trip, team dinner, shared groceries..."
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Total amount ({profile.currency})</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                      className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-muted-foreground">Who paid?</span>
                    <select value={paidById} onChange={(event) => setPaidById(event.target.value)} className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary">
                      {participants.map((participant) => (
                        <option key={participant.id} value={participant.id}>{participant.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <span className="mb-2 block text-sm text-muted-foreground">Split mode</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "equal", label: "Equal", icon: Users },
                      { value: "custom", label: "Exact amounts", icon: DollarSign },
                      { value: "percentage", label: "Percentage", icon: Percent },
                    ] as const).map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => {
                          setSplitMode(mode.value);
                          setCustomValues({});
                        }}
                        className={`rounded-2xl border px-4 py-3 transition-all ${splitMode === mode.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-input-background"}`}
                      >
                        <mode.icon className="mx-auto mb-2 h-5 w-5" />
                        <div className="text-sm">{mode.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-sm text-muted-foreground">Split with</span>
                  {selectedFriends.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedFriends.map((friend) => (
                        <span key={friend.id} className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 py-1 pl-1 pr-2 text-sm">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">{friend.avatar}</span>
                          {friend.name}
                          {friend.publicId ? <span className="text-xs text-muted-foreground">#{friend.publicId}</span> : null}
                          <button type="button" onClick={() => toggleFriend(friend)} aria-label={`Remove ${friend.name}`} className="rounded-full p-0.5 hover:bg-muted">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-3 text-sm text-muted-foreground">Add people by name or FinanceAI ID.</p>
                  )}
                  <form
                    className="relative mt-1 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const match = suggestions.find((friend) => friend.name.toLowerCase() === newFriend.trim().toLowerCase());
                      if (match) pickSuggestion(match);
                      else handleAddFriend();
                    }}
                  >
                    <input
                      value={newFriend}
                      onChange={(event) => setNewFriend(event.target.value)}
                      placeholder="Type a name..."
                      autoComplete="off"
                      className="flex-1 rounded-2xl border border-border bg-input-background px-4 py-2 outline-none focus:border-primary"
                      aria-label="Person's name"
                    />
                    <button type="submit" disabled={!newFriend.trim()} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm hover:border-primary disabled:opacity-50">
                      <UserPlus className="h-4 w-4" /> Add
                    </button>
                    {suggestions.length > 0 ? (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl" role="listbox">
                        <p className="px-4 pt-2 text-xs text-muted-foreground">From your previous splits</p>
                        {suggestions.map((friend) => (
                          <button
                            type="button"
                            key={friend.id}
                            onClick={() => pickSuggestion(friend)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted"
                            role="option"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm">{friend.avatar}</span>
                            <span className="flex-1">{friend.name}</span>
                            {friend.publicId ? <span className="text-xs text-muted-foreground">#{friend.publicId}</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </form>
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleAddById();
                    }}
                  >
                    <div className="flex flex-1 items-center gap-2 rounded-2xl border border-border bg-input-background px-4 focus-within:border-primary">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <input
                        value={idInput}
                        onChange={(event) => setIdInput(event.target.value.replace(/\D/g, "").slice(0, 8))}
                        inputMode="numeric"
                        placeholder="Add by FinanceAI ID (8 digits)"
                        className="min-w-0 flex-1 bg-transparent py-2 outline-none"
                        aria-label="FinanceAI ID"
                      />
                    </div>
                    <button type="submit" disabled={idInput.length !== 8 || idBusy} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm hover:border-primary disabled:opacity-50">
                      {idBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add
                    </button>
                  </form>
                </div>

                {splitMode !== "equal" && selectedFriends.length > 0 ? (
                  <div className="space-y-3 rounded-2xl border border-border bg-input-background/60 p-4">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{splitMode === "custom" ? "How much does each person owe?" : "What percentage does each person cover?"}</span>
                      <button onClick={fillEvenly} className="text-xs text-primary hover:underline">Fill evenly</button>
                    </div>
                    {participants.map((participant) => (
                      <label key={participant.id} className="flex items-center justify-between gap-4">
                        <span className="font-medium">{participant.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={customValues[participant.id] ?? ""}
                            onChange={(event) => setCustomValues((current) => ({ ...current, [participant.id]: event.target.value }))}
                            className="w-32 rounded-2xl border border-border bg-card px-4 py-2 outline-none transition-colors focus:border-primary"
                          />
                          <span className="w-6 text-sm text-muted-foreground">{splitMode === "percentage" ? "%" : ""}</span>
                        </div>
                      </label>
                    ))}
                    <p className={`text-sm ${splitValid ? "text-income" : "text-expense"}`}>
                      {splitValid
                        ? "Adds up. Ready to go."
                        : splitMode === "custom"
                          ? `${formatMoney(Math.abs(remaining))} ${remaining > 0 ? "still to assign" : "over the total"}`
                          : `${Math.abs(remaining).toFixed(1)}% ${remaining > 0 ? "still to assign" : "over 100%"}`}
                    </p>
                  </div>
                ) : null}

                {total > 0 && selectedFriends.length > 0 && splitMode === "equal" ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                    Each of the {participants.length} people pays about {formatMoney(total / participants.length)}.
                  </div>
                ) : null}

                {error ? <p className="rounded-2xl border border-expense/20 bg-expense/10 p-3 text-sm text-expense">{error}</p> : null}

                <div className="flex gap-3">
                  <button onClick={resetModal} className="flex-1 rounded-2xl border border-border px-4 py-3 font-medium transition-colors hover:bg-muted">
                    Cancel
                  </button>
                  <button onClick={handleCreateGroup} className="flex-1 rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary-glow">
                    Save split
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
