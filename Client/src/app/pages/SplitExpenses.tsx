import { useState } from "react";
import {
  ArrowRight,
  Check,
  DollarSign,
  Percent,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getNetBalances, getSplitSummary, SELF_ID, useFinance, type Friend, type SplitMode } from "../lib/finance";

export function SplitExpenses() {
  const { groups, friends, profile, createGroup, deleteGroup, toggleSettlement, addFriend, formatMoney } = useFinance();
  const [showModal, setShowModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [paidById, setPaidById] = useState(SELF_ID);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [newFriend, setNewFriend] = useState("");
  const [error, setError] = useState("");

  const summary = getSplitSummary(groups);
  const netBalances = getNetBalances(groups);
  const participants = [{ id: SELF_ID, name: "You" }, ...selectedFriends.map((friend) => ({ id: friend.id, name: friend.name }))];
  const total = Number(totalAmount) || 0;
  const enteredSum = participants.reduce((sum, participant) => sum + (Number(customValues[participant.id]) || 0), 0);
  const target = splitMode === "custom" ? total : 100;
  const remaining = target - enteredSum;
  const splitValid = splitMode === "equal" || Math.abs(remaining) < 0.01;

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

  function resetModal() {
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

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
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
                          <p className="text-xs text-muted-foreground">
                            {participant.id === group.paidById ? "Paid the bill" : participant.settled ? "Settled" : "Pending"}
                          </p>
                        </div>
                        {participant.id !== group.paidById ? (
                          <button
                            onClick={() => toggleSettlement(group.id, participant.id)}
                            className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${participant.settled ? "bg-income/15 text-income hover:bg-income/20" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                          >
                            {participant.settled ? "Mark pending" : "Mark settled"}
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

                <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="grid gap-2 sm:grid-cols-3">
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    {friends.map((friend) => {
                      const selected = selectedFriends.some((entry) => entry.id === friend.id);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => toggleFriend(friend)}
                          className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected ? "border-primary bg-primary/10" : "border-border bg-input-background"}`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-lg">{friend.avatar}</div>
                          <span className="flex-1 font-medium">{friend.name}</span>
                          {selected ? <Check className="h-5 w-5 text-primary" /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleAddFriend();
                    }}
                  >
                    <input
                      value={newFriend}
                      onChange={(event) => setNewFriend(event.target.value)}
                      placeholder="Add someone new..."
                      className="flex-1 rounded-2xl border border-border bg-input-background px-4 py-2 outline-none focus:border-primary"
                    />
                    <button type="submit" disabled={!newFriend.trim()} className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm hover:border-primary disabled:opacity-50">
                      <UserPlus className="h-4 w-4" /> Add
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
