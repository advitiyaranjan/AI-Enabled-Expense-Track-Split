import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, ArrowDownRight, ScanLine, Users, TrendingUp, Eye, EyeOff, Sparkles } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "motion/react";

const monthlyData = [
  { month: "Jan", income: 4500, expense: 3200 },
  { month: "Feb", income: 4200, expense: 3800 },
  { month: "Mar", income: 5100, expense: 3600 },
  { month: "Apr", income: 4800, expense: 4100 },
  { month: "May", income: 5500, expense: 3900 },
  { month: "Jun", income: 5200, expense: 4300 },
];

const recentTransactions = [
  { id: 1, name: "Whole Foods Market", category: "Groceries", amount: -127.50, date: "Today, 2:30 PM", icon: "🛒" },
  { id: 2, name: "Salary Deposit", category: "Income", amount: 5500, date: "Today, 9:00 AM", icon: "💰" },
  { id: 3, name: "Netflix Subscription", category: "Entertainment", amount: -15.99, date: "Yesterday", icon: "🎬" },
  { id: 4, name: "Uber Ride", category: "Transport", amount: -24.50, date: "Yesterday", icon: "🚗" },
  { id: 5, name: "Coffee Shop", category: "Food & Dining", amount: -8.75, date: "Apr 11", icon: "☕" },
];

const aiInsights = [
  {
    title: "Great spending this week!",
    description: "You're 15% under your weekly budget. Keep it up!",
    type: "positive",
  },
  {
    title: "Recurring charge detected",
    description: "Netflix subscription ($15.99) will renew in 3 days",
    type: "info",
  },
  {
    title: "Budget alert",
    description: "You're approaching your Food & Dining limit ($450/$500)",
    type: "warning",
  },
];

export function Dashboard() {
  const [showBalance, setShowBalance] = useState(true);
  const balance = 12345.67;
  const income = 5500;
  const expense = 4127.74;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold">Good evening, Alex</h1>
            <p className="text-muted-foreground mt-1">Here's your financial overview</p>
          </div>
        </motion.div>

        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl p-6 lg:p-8 bg-gradient-to-br from-primary via-secondary-bright to-secondary"
          style={{
            boxShadow: "0 20px 60px -15px rgba(6, 182, 212, 0.4)",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-primary-foreground/80 text-sm font-medium">Total Balance</span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>

            <div className="text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
              {showBalance ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "••••••"}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownRight className="w-4 h-4 text-income-bright" />
                  <span className="text-primary-foreground/80 text-sm">Income</span>
                </div>
                <div className="text-2xl font-semibold text-primary-foreground">
                  ${income.toLocaleString()}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-expense-bright" />
                  <span className="text-primary-foreground/80 text-sm">Expense</span>
                </div>
                <div className="text-2xl font-semibold text-primary-foreground">
                  ${expense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <Link
            to="/scan"
            className="bg-card border border-border-bright rounded-xl p-4 hover:border-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group"
          >
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <ScanLine className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Scan Receipt</h3>
            <p className="text-sm text-muted-foreground">AI-powered capture</p>
          </Link>

          <Link
            to="/split"
            className="bg-card border border-border-bright rounded-xl p-4 hover:border-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group"
          >
            <div className="w-12 h-12 rounded-lg bg-income/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-income" />
            </div>
            <h3 className="font-semibold mb-1">Split Bill</h3>
            <p className="text-sm text-muted-foreground">Share with friends</p>
          </Link>

          <Link
            to="/insights"
            className="bg-card border border-border-bright rounded-xl p-4 hover:border-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 group col-span-2 lg:col-span-1"
          >
            <div className="w-12 h-12 rounded-lg bg-secondary-bright/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6 text-secondary-bright" />
            </div>
            <h3 className="font-semibold mb-1">AI Insights</h3>
            <p className="text-sm text-muted-foreground">Smart predictions</p>
          </Link>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-2 bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Income vs Expense</h2>
                <p className="text-sm text-muted-foreground mt-1">Last 6 months overview</p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1F2E",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "8px",
                      color: "#E8EAED",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#incomeGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="#F97316"
                    strokeWidth={2}
                    fill="url(#expenseGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* AI Insights */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">AI Insights</h2>
            </div>

            <div className="space-y-4">
              {aiInsights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border ${
                    insight.type === "positive"
                      ? "bg-income/5 border-income/20"
                      : insight.type === "warning"
                      ? "bg-expense/5 border-expense/20"
                      : "bg-primary/5 border-primary/20"
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <h4 className="font-semibold mb-1 text-sm">{insight.title}</h4>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent Transactions</h2>
            <Link to="/transactions" className="text-sm text-primary hover:text-primary-glow transition-colors">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {recentTransactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.6 + index * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                  {transaction.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{transaction.name}</h4>
                  <p className="text-sm text-muted-foreground">{transaction.category}</p>
                </div>
                <div className="text-right">
                  <div
                    className={`font-semibold ${
                      transaction.amount > 0 ? "text-income" : "text-foreground"
                    }`}
                  >
                    {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">{transaction.date}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
