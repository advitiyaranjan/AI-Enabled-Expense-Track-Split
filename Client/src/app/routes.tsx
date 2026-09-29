import { createBrowserRouter, Navigate } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Dashboard } from "./pages/Dashboard";
import { ReceiptScanner } from "./pages/ReceiptScanner";
import { Transactions } from "./pages/Transactions";
import { SplitExpenses } from "./pages/SplitExpenses";
import { AIInsights } from "./pages/AIInsights";
import { Budget } from "./pages/Budget";
import { Profile } from "./pages/Profile";
import { AuthPage } from "./pages/AuthPage";
import { PaySplit } from "./pages/PaySplit";

export const router = createBrowserRouter([
  {
    path: "/auth",
    Component: AuthPage,
  },
  {
    // Public: friends open this from a shared link without an account
    path: "/pay/:token",
    Component: PaySplit,
  },
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "scan", Component: ReceiptScanner },
      { path: "transactions", Component: Transactions },
      { path: "split", Component: SplitExpenses },
      { path: "insights", Component: AIInsights },
      { path: "budget", Component: Budget },
      { path: "profile", Component: Profile },
      // Unknown URLs land on the dashboard (with navigation) instead of a bare 404 page
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
