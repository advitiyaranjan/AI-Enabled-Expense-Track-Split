import { useState } from "react";
import { Plus, Users, DollarSign, Percent, User, Check, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Friend {
  id: number;
  name: string;
  avatar: string;
}

interface Split {
  friendId: number;
  amount: number;
}

interface Group {
  id: number;
  name: string;
  members: Friend[];
  totalAmount: number;
  splits: Split[];
  settledAmount: number;
}

const mockFriends: Friend[] = [
  { id: 1, name: "Sarah Chen", avatar: "👩" },
  { id: 2, name: "Mike Johnson", avatar: "👨" },
  { id: 3, name: "Emily Rodriguez", avatar: "👧" },
  { id: 4, name: "David Kim", avatar: "🧑" },
];

const mockGroups: Group[] = [
  {
    id: 1,
    name: "Weekend Trip to Beach",
    members: [mockFriends[0], mockFriends[1], mockFriends[2]],
    totalAmount: 450,
    splits: [
      { friendId: 1, amount: 150 },
      { friendId: 2, amount: 150 },
      { friendId: 3, amount: 150 },
    ],
    settledAmount: 150,
  },
  {
    id: 2,
    name: "Team Dinner",
    members: [mockFriends[1], mockFriends[3]],
    totalAmount: 120,
    splits: [
      { friendId: 2, amount: 60 },
      { friendId: 4, amount: 60 },
    ],
    settledAmount: 60,
  },
];

type SplitMode = "equal" | "custom" | "percentage";

export function SplitExpenses() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groups, setGroups] = useState<Group[]>(mockGroups);

  // Create modal state
  const [groupName, setGroupName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");

  const handleCreateGroup = () => {
    if (!groupName || !totalAmount || selectedFriends.length === 0) return;

    const amount = parseFloat(totalAmount);
    const equalSplit = amount / (selectedFriends.length + 1); // +1 for yourself

    const newGroup: Group = {
      id: Date.now(),
      name: groupName,
      members: selectedFriends,
      totalAmount: amount,
      splits: selectedFriends.map((friend) => ({
        friendId: friend.id,
        amount: equalSplit,
      })),
      settledAmount: 0,
    };

    setGroups([newGroup, ...groups]);
    setShowCreateModal(false);
    setGroupName("");
    setTotalAmount("");
    setSelectedFriends([]);
  };

  const toggleFriend = (friend: Friend) => {
    if (selectedFriends.find((f) => f.id === friend.id)) {
      setSelectedFriends(selectedFriends.filter((f) => f.id !== friend.id));
    } else {
      setSelectedFriends([...selectedFriends, friend]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold">Split Expenses</h1>
            <p className="text-muted-foreground mt-1">Manage shared costs with friends</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow transition-all shadow-lg shadow-primary/30 font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Create Group</span>
          </button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid sm:grid-cols-2 gap-4"
        >
          <div className="bg-gradient-to-br from-income to-income-bright rounded-xl p-6 text-income-foreground shadow-lg shadow-income/20">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Users className="w-5 h-5" />
              <span className="text-sm">You'll Receive</span>
            </div>
            <div className="text-3xl font-bold">$300.00</div>
            <p className="text-sm opacity-90 mt-2">From 2 people</p>
          </div>

          <div className="bg-gradient-to-br from-expense to-expense-bright rounded-xl p-6 text-expense-foreground shadow-lg shadow-expense/20">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <DollarSign className="w-5 h-5" />
              <span className="text-sm">You Owe</span>
            </div>
            <div className="text-3xl font-bold">$60.00</div>
            <p className="text-sm opacity-90 mt-2">To 1 person</p>
          </div>
        </motion.div>

        {/* Groups List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-semibold">Your Groups</h2>

          {groups.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No groups yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  className="bg-card border border-border rounded-xl p-6 hover:border-primary transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {group.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        {group.members.map((member) => (
                          <div
                            key={member.id}
                            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm"
                            title={member.name}
                          >
                            {member.avatar}
                          </div>
                        ))}
                        <span className="text-sm text-muted-foreground ml-2">
                          {group.members.length + 1} people
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">${group.totalAmount.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Settlement Progress</span>
                      <span className="font-medium">
                        {Math.round((group.settledAmount / group.totalAmount) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(group.settledAmount / group.totalAmount) * 100}%`,
                        }}
                        transition={{ duration: 0.8, delay: 0.5 + index * 0.1 }}
                        className="h-full bg-gradient-to-r from-primary to-income rounded-full"
                      />
                    </div>
                  </div>

                  {/* Split Details */}
                  <div className="space-y-2">
                    {group.members.map((member) => {
                      const split = group.splits.find((s) => s.friendId === member.id);
                      const isSettled = split && split.amount <= group.settledAmount;
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              {member.avatar}
                            </div>
                            <span className="font-medium">{member.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">${split?.amount.toFixed(2)}</span>
                            {isSettled && (
                              <div className="w-6 h-6 rounded-full bg-income flex items-center justify-center">
                                <Check className="w-4 h-4 text-income-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-border flex gap-3">
                    <button className="flex-1 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
                      Settle Up
                    </button>
                    <button className="flex-1 px-4 py-2 rounded-lg bg-muted hover:bg-muted/70 transition-colors font-medium">
                      View Details
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-4 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-2xl bg-card border border-border rounded-2xl p-6 z-50 overflow-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Create Split Group</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-10 h-10 rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Group Name */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Group Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Weekend Trip, Team Dinner"
                    className="w-full bg-input-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Total Amount */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Total Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                      $
                    </span>
                    <input
                      type="number"
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-input-background border border-border rounded-xl pl-10 pr-4 py-3 text-xl font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Split Mode */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Split Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSplitMode("equal")}
                      className={`px-4 py-3 rounded-lg border transition-all ${
                        splitMode === "equal"
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                          : "bg-input-background border-border hover:border-primary"
                      }`}
                    >
                      <Users className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-sm">Equal</div>
                    </button>
                    <button
                      onClick={() => setSplitMode("custom")}
                      className={`px-4 py-3 rounded-lg border transition-all ${
                        splitMode === "custom"
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                          : "bg-input-background border-border hover:border-primary"
                      }`}
                    >
                      <DollarSign className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-sm">Custom</div>
                    </button>
                    <button
                      onClick={() => setSplitMode("percentage")}
                      className={`px-4 py-3 rounded-lg border transition-all ${
                        splitMode === "percentage"
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                          : "bg-input-background border-border hover:border-primary"
                      }`}
                    >
                      <Percent className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-sm">Percent</div>
                    </button>
                  </div>
                </div>

                {/* Select Friends */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Add Friends</label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {mockFriends.map((friend) => {
                      const isSelected = selectedFriends.find((f) => f.id === friend.id);
                      return (
                        <button
                          key={friend.id}
                          onClick={() => toggleFriend(friend)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            isSelected
                              ? "bg-primary/10 border-primary"
                              : "bg-input-background border-border hover:border-primary"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">
                            {friend.avatar}
                          </div>
                          <span className="flex-1 text-left font-medium">{friend.name}</span>
                          {isSelected && <Check className="w-5 h-5 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                {selectedFriends.length > 0 && totalAmount && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <div className="text-sm text-muted-foreground mb-2">Split Preview</div>
                    <div className="text-lg font-semibold">
                      ${(parseFloat(totalAmount) / (selectedFriends.length + 1)).toFixed(2)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">per person</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {selectedFriends.length + 1} people total (including you)
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-border hover:bg-muted transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={!groupName || !totalAmount || selectedFriends.length === 0}
                    className="flex-1 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow transition-all shadow-lg shadow-primary/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
