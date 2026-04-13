import { useState } from "react";
import { Search, Filter, TrendingDown, TrendingUp, Calendar, Tag } from "lucide-react";
import { motion } from "motion/react";

interface Transaction {
  id: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  time: string;
  icon: string;
  type: "income" | "expense";
}

const allTransactions: Transaction[] = [
  { id: 1, name: "Salary Deposit", category: "Income", amount: 5500, date: "2026-04-13", time: "9:00 AM", icon: "💰", type: "income" },
  { id: 2, name: "Whole Foods Market", category: "Groceries", amount: -127.50, date: "2026-04-13", time: "2:30 PM", icon: "🛒", type: "expense" },
  { id: 3, name: "Netflix Subscription", category: "Entertainment", amount: -15.99, date: "2026-04-12", time: "11:23 AM", icon: "🎬", type: "expense" },
  { id: 4, name: "Uber Ride", category: "Transport", amount: -24.50, date: "2026-04-12", time: "6:45 PM", icon: "🚗", type: "expense" },
  { id: 5, name: "Coffee Shop", category: "Food & Dining", amount: -8.75, date: "2026-04-11", time: "8:15 AM", icon: "☕", type: "expense" },
  { id: 6, name: "Freelance Project", category: "Income", amount: 850, date: "2026-04-10", time: "3:00 PM", icon: "💼", type: "income" },
  { id: 7, name: "Gym Membership", category: "Healthcare", amount: -49.99, date: "2026-04-10", time: "7:00 AM", icon: "💪", type: "expense" },
  { id: 8, name: "Amazon Order", category: "Shopping", amount: -89.99, date: "2026-04-09", time: "4:20 PM", icon: "📦", type: "expense" },
  { id: 9, name: "Restaurant", category: "Food & Dining", amount: -67.30, date: "2026-04-08", time: "7:30 PM", icon: "🍽️", type: "expense" },
  { id: 10, name: "Gas Station", category: "Transport", amount: -52.00, date: "2026-04-08", time: "9:15 AM", icon: "⛽", type: "expense" },
  { id: 11, name: "Spotify Premium", category: "Entertainment", amount: -9.99, date: "2026-04-07", time: "12:00 PM", icon: "🎵", type: "expense" },
  { id: 12, name: "Target", category: "Shopping", amount: -145.67, date: "2026-04-06", time: "2:45 PM", icon: "🎯", type: "expense" },
  { id: 13, name: "Consulting Fee", category: "Income", amount: 1200, date: "2026-04-05", time: "11:00 AM", icon: "💵", type: "income" },
  { id: 14, name: "Electric Bill", category: "Utilities", amount: -125.50, date: "2026-04-04", time: "10:00 AM", icon: "⚡", type: "expense" },
  { id: 15, name: "Pharmacy", category: "Healthcare", amount: -34.99, date: "2026-04-03", time: "3:30 PM", icon: "💊", type: "expense" },
];

const categories = ["All", "Income", "Groceries", "Food & Dining", "Transport", "Entertainment", "Shopping", "Healthcare", "Utilities"];

export function Transactions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState<"all" | "income" | "expense">("all");

  const filteredTransactions = allTransactions.filter((transaction) => {
    const matchesSearch = transaction.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || transaction.category === selectedCategory;
    const matchesType = selectedType === "all" || transaction.type === selectedType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = transaction.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  };

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">Track all your financial activity</p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-4"
        >
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-income" />
              <span className="text-sm text-muted-foreground">Total Income</span>
            </div>
            <div className="text-2xl font-bold text-income">
              ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-expense" />
              <span className="text-sm text-muted-foreground">Total Expense</span>
            </div>
            <div className="text-2xl font-bold text-expense">
              ${totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-input-background border border-border rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-4 py-2 rounded-lg border transition-all ${
                selectedType === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-card border-border hover:border-primary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedType("income")}
              className={`px-4 py-2 rounded-lg border transition-all ${
                selectedType === "income"
                  ? "bg-income text-income-foreground border-income shadow-lg shadow-income/20"
                  : "bg-card border-border hover:border-income"
              }`}
            >
              Income
            </button>
            <button
              onClick={() => setSelectedType("expense")}
              className={`px-4 py-2 rounded-lg border transition-all ${
                selectedType === "expense"
                  ? "bg-expense text-expense-foreground border-expense shadow-lg shadow-expense/20"
                  : "bg-card border-border hover:border-expense"
              }`}
            >
              Expenses
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg border whitespace-nowrap transition-all ${
                  selectedCategory === category
                    ? "bg-secondary-bright text-white border-secondary-bright shadow-lg shadow-secondary-bright/20"
                    : "bg-card border-border hover:border-secondary-bright"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Transactions List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          {Object.entries(groupedTransactions).length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            Object.entries(groupedTransactions).map(([date, transactions], groupIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + groupIndex * 0.05 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {formatDate(date)}
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {transactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.03 }}
                      className="flex items-center gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {transaction.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{transaction.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {transaction.category}
                          </span>
                          <span className="text-xs text-muted-foreground">{transaction.time}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-lg font-semibold ${
                            transaction.type === "income" ? "text-income" : "text-foreground"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : ""}$
                          {Math.abs(transaction.amount).toFixed(2)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}
