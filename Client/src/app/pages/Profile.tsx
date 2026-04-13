import { useState } from "react";
import {
  User,
  Bell,
  Globe,
  Moon,
  Sun,
  Lock,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { motion } from "motion/react";

export function Profile() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState({
    transactions: true,
    budgetAlerts: true,
    aiInsights: true,
    weeklyReports: false,
  });
  const [currency, setCurrency] = useState("USD");

  const settingsSections = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Personal Information", action: () => {} },
        { icon: Mail, label: "Email & Password", action: () => {} },
        { icon: Phone, label: "Phone Number", action: () => {} },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: darkMode ? Moon : Sun,
          label: "Dark Mode",
          toggle: true,
          value: darkMode,
          onChange: () => setDarkMode(!darkMode),
        },
        { icon: Globe, label: "Language", value: "English", action: () => {} },
        { icon: CreditCard, label: "Currency", value: currency, action: () => {} },
      ],
    },
    {
      title: "Notifications",
      items: [
        {
          icon: Bell,
          label: "Transaction Alerts",
          toggle: true,
          value: notifications.transactions,
          onChange: () =>
            setNotifications({ ...notifications, transactions: !notifications.transactions }),
        },
        {
          icon: Bell,
          label: "Budget Alerts",
          toggle: true,
          value: notifications.budgetAlerts,
          onChange: () =>
            setNotifications({ ...notifications, budgetAlerts: !notifications.budgetAlerts }),
        },
        {
          icon: Bell,
          label: "AI Insights",
          toggle: true,
          value: notifications.aiInsights,
          onChange: () =>
            setNotifications({ ...notifications, aiInsights: !notifications.aiInsights }),
        },
        {
          icon: Bell,
          label: "Weekly Reports",
          toggle: true,
          value: notifications.weeklyReports,
          onChange: () =>
            setNotifications({ ...notifications, weeklyReports: !notifications.weeklyReports }),
        },
      ],
    },
    {
      title: "Security",
      items: [
        { icon: Lock, label: "Change Password", action: () => {} },
        { icon: Lock, label: "Two-Factor Authentication", value: "Enabled", action: () => {} },
        { icon: Lock, label: "Privacy Settings", action: () => {} },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help Center", action: () => {} },
        { icon: Mail, label: "Contact Support", action: () => {} },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">Profile & Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </motion.div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-primary via-secondary-bright to-secondary rounded-2xl p-6 lg:p-8"
          style={{
            boxShadow: "0 20px 60px -15px rgba(6, 182, 212, 0.4)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl border-4 border-white/30">
              👤
            </div>
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl font-bold text-primary-foreground">Alex Thompson</h2>
              <p className="text-primary-foreground/80 mt-1">alex.thompson@email.com</p>
              <div className="flex flex-wrap items-center gap-4 mt-4 justify-center sm:justify-start">
                <div className="flex items-center gap-2 text-primary-foreground/90 text-sm">
                  <Phone className="w-4 h-4" />
                  <span>+1 (555) 123-4567</span>
                </div>
                <div className="flex items-center gap-2 text-primary-foreground/90 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>San Francisco, CA</span>
                </div>
              </div>
            </div>
            <button className="px-6 py-3 rounded-xl bg-white/20 backdrop-blur-sm text-primary-foreground hover:bg-white/30 transition-all border border-white/30 font-medium">
              Edit Profile
            </button>
          </div>
        </motion.div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {settingsSections.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + sectionIndex * 0.05 }}
            >
              <h3 className="text-lg font-semibold mb-3">{section.title}</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {section.items.map((item, itemIndex) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + sectionIndex * 0.05 + itemIndex * 0.02 }}
                    className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer ${
                      itemIndex !== section.items.length - 1 ? "border-b border-border" : ""
                    }`}
                    onClick={item.action}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{item.label}</div>
                        {item.value && !item.toggle && (
                          <div className="text-sm text-muted-foreground">{item.value}</div>
                        )}
                      </div>
                    </div>

                    {item.toggle ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          item.onChange?.();
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          item.value ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <motion.div
                          initial={false}
                          animate={{ x: item.value ? 24 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white"
                        />
                      </button>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Account Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Account Statistics</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold text-primary">247</div>
              <div className="text-sm text-muted-foreground mt-1">Total Transactions</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold text-income">$12,450</div>
              <div className="text-sm text-muted-foreground mt-1">Total Saved</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold text-secondary-bright">89%</div>
              <div className="text-sm text-muted-foreground mt-1">Budget Efficiency</div>
            </div>
          </div>
        </motion.div>

        {/* Data & Privacy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4">Data & Privacy</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between">
              <span className="font-medium">Export Data</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="w-full text-left px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between">
              <span className="font-medium">Privacy Policy</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            <button className="w-full text-left px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-between">
              <span className="font-medium">Terms of Service</span>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-destructive/5 border border-destructive/20 rounded-xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h3>
          <div className="space-y-3">
            <button className="w-full px-4 py-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors font-medium flex items-center justify-center gap-2">
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
            <button className="w-full px-4 py-3 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors font-medium">
              Delete Account
            </button>
          </div>
        </motion.div>

        {/* App Version */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-muted-foreground py-4"
        >
          <p>FinanceAI v2.0.0</p>
          <p className="mt-1">© 2026 All rights reserved</p>
        </motion.div>
      </div>
    </div>
  );
}
