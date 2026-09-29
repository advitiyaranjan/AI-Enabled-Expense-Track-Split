import { RouterProvider } from "react-router";
import { router } from "./routes";
import { FinanceProvider } from "./lib/finance";

export default function App() {
  return (
    <FinanceProvider>
      <RouterProvider router={router} />
    </FinanceProvider>
  );
}
