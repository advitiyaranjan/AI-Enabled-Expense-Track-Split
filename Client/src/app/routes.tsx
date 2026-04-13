import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Dashboard } from "./pages/Dashboard";
import { ReceiptScanner } from "./pages/ReceiptScanner";
import { Transactions } from "./pages/Transactions";
import { SplitExpenses } from "./pages/SplitExpenses";
import { AIInsights } from "./pages/AIInsights";
import { Budget } from "./pages/Budget";
import { Profile } from "./pages/Profile";

export const router = createBrowserRouter([
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
    ],
  },
]);
