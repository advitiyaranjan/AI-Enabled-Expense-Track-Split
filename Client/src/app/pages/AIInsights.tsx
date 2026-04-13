import { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Calendar,
  DollarSign,
  Zap,
  MessageSquare,
  Send,
} from "lucide-react";
import { motion } from "motion/react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const spendingTrends = [
  { category: "Food & Dining", current: 450, previous: 520, change: -13 },
  { category: "Groceries", current: 380, previous: 350, change: 9 },
  { category: "Transport", current: 220, previous: 180, change: 22 },
  { category: "Entertainment", current: 160, previous: 200, change: -20 },
  { category: "Shopping", current: 340, previous: 280, change: 21 },
];

const predictions = [
  { month: "May", predicted: 4200, actual: 0 },
  { month: "Jun", predicted: 4350, actual: 0 },
  { month: "Jul", predicted: 4500, actual: 0 },
];

const categoryBreakdown = [
  { name: "Food & Dining", value: 450, color: "#06B6D4" },
  { name: "Groceries", value: 380, color: "#10B981" },
  { name: "Transport", value: 220, color: "#F97316" },
  { name: "Entertainment", value: 160, color: "#3B82F6" },
  { name: "Shopping", value: 340, color: "#8B5CF6" },
  { name: "Other", value: 180, color: "#94A3B8" },
];

const subscriptions = [
  { name: "Netflix", amount: 15.99, nextBilling: "Apr 15, 2026", icon: "🎬" },
  { name: "Spotify Premium", amount: 9.99, nextBilling: "Apr 17, 2026", icon: "🎵" },
  { name: "Gym Membership", amount: 49.99, nextBilling: "Apr 20, 2026", icon: "💪" },
  { name: "Cloud Storage", amount: 2.99, nextBilling: "Apr 25, 2026", icon: "☁️" },
];

const aiMessages = [
  {
    type: "ai",
    message: "Hi! I'm your AI financial assistant. I've analyzed your spending patterns. What would you like to know?",
  },
];

export function AIInsights() {
  const [chatMessages, setChatMessages] = useState(aiMessages);
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    setChatMessages([
      ...chatMessages,
      { type: "user", message: inputMessage },
      {
        type: "ai",
        message: "Based on your spending patterns, you're doing great! Your food expenses decreased by 13% this month. Keep it up!",
      },
    ]);
    setInputMessage("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary-bright flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Insights</h1>
            <p className="text-muted-foreground">Smart predictions & personalized tips</p>
          </div>
        </motion.div>

        {/* AI Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div className="bg-gradient-to-br from-income/20 to-income/5 border border-income/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-income/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-income" />
              </div>
              <h3 className="font-semibold">Doing Great!</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              You're 15% under budget this month. Excellent control!
            </p>
            <div className="text-xs text-income font-medium">↓ $320 saved</div>
          </div>

          <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Smart Saving</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              AI detected you can save $150/mo by optimizing subscriptions
            </p>
            <div className="text-xs text-primary font-medium">View suggestions →</div>
          </div>

          <div className="bg-gradient-to-br from-expense/20 to-expense/5 border border-expense/30 rounded-xl p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-expense/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-expense" />
              </div>
              <h3 className="font-semibold">Budget Alert</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Food & Dining approaching limit: $450/$500
            </p>
            <div className="text-xs text-expense font-medium">90% used</div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Spending Trends */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Spending Trends</h2>
            </div>

            <div className="space-y-4">
              {spendingTrends.map((trend, index) => (
                <motion.div
                  key={trend.category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{trend.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">${trend.current}</span>
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          trend.change < 0
                            ? "bg-income/10 text-income"
                            : "bg-expense/10 text-expense"
                        }`}
                      >
                        {trend.change < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {Math.abs(trend.change)}%
                      </div>
                    </div>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(trend.current / 600) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + index * 0.05 }}
                      className={`h-full rounded-full ${
                        trend.change < 0
                          ? "bg-gradient-to-r from-income to-income-bright"
                          : "bg-gradient-to-r from-expense to-expense-bright"
                      }`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Category Breakdown</h2>
            </div>

            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1F2E",
                      border: "1px solid rgba(148, 163, 184, 0.2)",
                      borderRadius: "8px",
                      color: "#E8EAED",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {categoryBreakdown.map((category) => (
                <div key={category.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-xs text-muted-foreground truncate">
                    {category.name}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Future Predictions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Expense Predictions</h2>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={predictions}>
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
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#06B6D4"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: "#06B6D4", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
              <p className="text-sm">
                <span className="font-semibold text-primary">AI Prediction:</span> Based on your
                patterns, expect to spend around <span className="font-bold">$4,200-$4,500</span> in
                the next 3 months.
              </p>
            </div>
          </motion.div>

          {/* Subscriptions Tracker */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Recurring Subscriptions</h2>
              </div>
              <div className="text-sm text-muted-foreground">
                ${subscriptions.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}/mo
              </div>
            </div>

            <div className="space-y-3">
              {subscriptions.map((sub, index) => (
                <motion.div
                  key={sub.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl">
                    {sub.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{sub.name}</h4>
                    <p className="text-xs text-muted-foreground">Next: {sub.nextBilling}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${sub.amount}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* AI Chat Assistant */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">AI Assistant Chat</h2>
          </div>

          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {chatMessages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.type === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.type === "ai" && (
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary">AI Assistant</span>
                    </div>
                  )}
                  <p className="text-sm">{msg.message}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about your spending patterns..."
              className="flex-1 bg-input-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow transition-all shadow-lg shadow-primary/30"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
