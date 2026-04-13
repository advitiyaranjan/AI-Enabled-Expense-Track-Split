import { useState } from "react";
import { Wallet, Plus, Edit2, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BudgetCategory {
  id: number;
  name: string;
  icon: string;
  limit: number;
  spent: number;
  color: string;
}

const initialBudgets: BudgetCategory[] = [
  { id: 1, name: "Food & Dining", icon: "🍽️", limit: 500, spent: 450, color: "#06B6D4" },
  { id: 2, name: "Groceries", icon: "🛒", limit: 400, spent: 380, color: "#10B981" },
  { id: 3, name: "Transport", icon: "🚗", limit: 250, spent: 220, color: "#F97316" },
  { id: 4, name: "Entertainment", icon: "🎬", limit: 200, spent: 160, color: "#3B82F6" },
  { id: 5, name: "Shopping", icon: "🛍️", limit: 300, spent: 340, color: "#8B5CF6" },
  { id: 6, name: "Healthcare", icon: "💊", limit: 150, spent: 85, color: "#EC4899" },
];

export function Budget() {
  const [budgets, setBudgets] = useState<BudgetCategory[]>(initialBudgets);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryLimit, setCategoryLimit] = useState("");

  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const remaining = totalBudget - totalSpent;

  const getStatus = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100;
    if (percentage >= 100) return { status: "over", color: "expense" };
    if (percentage >= 90) return { status: "warning", color: "expense" };
    if (percentage >= 70) return { status: "caution", color: "primary" };
    return { status: "good", color: "income" };
  };

  const handleSaveBudget = () => {
    if (!categoryName || !categoryLimit) return;

    if (editingBudget) {
      setBudgets(
        budgets.map((b) =>
          b.id === editingBudget.id
            ? { ...b, name: categoryName, limit: parseFloat(categoryLimit) }
            : b
        )
      );
    } else {
      const newBudget: BudgetCategory = {
        id: Date.now(),
        name: categoryName,
        icon: "📌",
        limit: parseFloat(categoryLimit),
        spent: 0,
        color: "#06B6D4",
      };
      setBudgets([...budgets, newBudget]);
    }

    setShowAddModal(false);
    setEditingBudget(null);
    setCategoryName("");
    setCategoryLimit("");
  };

  const openEditModal = (budget: BudgetCategory) => {
    setEditingBudget(budget);
    setCategoryName(budget.name);
    setCategoryLimit(budget.limit.toString());
    setShowAddModal(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary-bright flex items-center justify-center">
              <Wallet className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Budget Planner</h1>
              <p className="text-muted-foreground">Manage your spending limits</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingBudget(null);
              setCategoryName("");
              setCategoryLimit("");
              setShowAddModal(true);
            }}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow transition-all shadow-lg shadow-primary/30 font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Category</span>
          </button>
        </motion.div>

        {/* Overview Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-6 lg:p-8"
        >
          <div className="grid sm:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-2">Total Budget</div>
              <div className="text-3xl font-bold">${totalBudget.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Total Spent</div>
              <div className="text-3xl font-bold text-expense">
                ${totalSpent.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-2">Remaining</div>
              <div className="text-3xl font-bold text-income">
                ${remaining.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">
                {Math.round((totalSpent / totalBudget) * 100)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(totalSpent / totalBudget) * 100}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className={`h-full rounded-full ${
                  totalSpent / totalBudget >= 0.9
                    ? "bg-gradient-to-r from-expense to-expense-bright"
                    : "bg-gradient-to-r from-primary to-income"
                }`}
              />
            </div>
          </div>
        </motion.div>

        {/* Budget Categories */}
        <div className="grid gap-4">
          {budgets.map((budget, index) => {
            const percentage = (budget.spent / budget.limit) * 100;
            const { status, color } = getStatus(budget.spent, budget.limit);

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {budget.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{budget.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ${budget.spent.toFixed(2)} of ${budget.limit.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {status === "over" && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-expense/10 text-expense text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Over Budget
                      </div>
                    )}
                    {status === "warning" && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-expense/10 text-expense text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Near Limit
                      </div>
                    )}
                    {status === "good" && percentage > 0 && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-income/10 text-income text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        On Track
                      </div>
                    )}
                    <button
                      onClick={() => openEditModal(budget)}
                      className="w-8 h-8 rounded-lg hover:bg-muted transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{Math.round(percentage)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percentage, 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + index * 0.05 }}
                      className={`h-full rounded-full ${
                        status === "over" || status === "warning"
                          ? "bg-gradient-to-r from-expense to-expense-bright"
                          : status === "caution"
                          ? "bg-gradient-to-r from-primary to-primary-glow"
                          : "bg-gradient-to-r from-income to-income-bright"
                      }`}
                    />
                  </div>
                </div>

                {status === "over" && (
                  <div className="mt-4 p-3 rounded-lg bg-expense/5 border border-expense/20">
                    <p className="text-xs text-expense">
                      You've exceeded your budget by ${(budget.spent - budget.limit).toFixed(2)}
                    </p>
                  </div>
                )}

                {status === "warning" && (
                  <div className="mt-4 p-3 rounded-lg bg-expense/5 border border-expense/20">
                    <p className="text-xs text-muted-foreground">
                      Only ${(budget.limit - budget.spent).toFixed(2)} remaining this month
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* AI Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-primary/10 to-secondary-bright/10 border border-primary/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">AI Budget Suggestions</h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Consider reducing your <strong>Shopping</strong> budget by $50 next month based
                on historical trends
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                You could save <strong>$45/month</strong> by optimizing transport routes
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Your <strong>Healthcare</strong> spending is well below budget. Great job!
              </span>
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-4 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-md bg-card border border-border rounded-2xl p-6 z-50"
            >
              <h2 className="text-2xl font-bold mb-6">
                {editingBudget ? "Edit Budget" : "Add Budget Category"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Food & Dining"
                    className="w-full bg-input-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Monthly Limit
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                      $
                    </span>
                    <input
                      type="number"
                      value={categoryLimit}
                      onChange={(e) => setCategoryLimit(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-input-background border border-border rounded-xl pl-10 pr-4 py-3 text-xl font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingBudget(null);
                      setCategoryName("");
                      setCategoryLimit("");
                    }}
                    className="flex-1 px-6 py-3 rounded-xl border border-border hover:bg-muted transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBudget}
                    disabled={!categoryName || !categoryLimit}
                    className="flex-1 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow transition-all shadow-lg shadow-primary/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingBudget ? "Update" : "Add"} Budget
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
