import { useState } from "react";
import { Camera, Upload, X, Check, Sparkles, ChevronRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";

type ScanStage = "idle" | "scanning" | "processing" | "preview";

interface ExtractedData {
  amount: string;
  merchant: string;
  date: string;
  category: string;
  items: { name: string; price: string }[];
}

const categories = ["Food & Dining", "Groceries", "Transport", "Entertainment", "Shopping", "Healthcare", "Other"];

export function ReceiptScanner() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<ScanStage>("idle");
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);

  const handleScan = () => {
    setStage("scanning");

    // Simulate camera capture
    setTimeout(() => {
      setStage("processing");

      // Simulate AI processing
      setTimeout(() => {
        const mockData: ExtractedData = {
          amount: "127.50",
          merchant: "Whole Foods Market",
          date: "2026-04-13",
          category: "Groceries",
          items: [
            { name: "Organic Bananas", price: "4.50" },
            { name: "Almond Milk", price: "5.99" },
            { name: "Greek Yogurt", price: "8.99" },
            { name: "Fresh Spinach", price: "3.99" },
            { name: "Chicken Breast", price: "24.50" },
            { name: "Brown Rice", price: "6.99" },
            { name: "Mixed Berries", price: "12.99" },
            { name: "Olive Oil", price: "15.99" },
            { name: "Organic Eggs", price: "7.99" },
            { name: "Avocados", price: "8.50" },
            { name: "Tomatoes", price: "5.99" },
            { name: "Sourdough Bread", price: "6.50" },
            { name: "Coffee Beans", price: "14.18" },
          ],
        };
        setExtractedData(mockData);
        setEditedData(mockData);
        setStage("preview");
      }, 2500);
    }, 1000);
  };

  const handleUpload = () => {
    // Trigger file input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      handleScan();
    };
    input.click();
  };

  const handleSave = () => {
    // Save the transaction
    console.log("Saving transaction:", editedData);
    // Show success message and navigate
    setTimeout(() => {
      navigate("/transactions");
    }, 500);
  };

  const handleReset = () => {
    setStage("idle");
    setExtractedData(null);
    setEditedData(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-3xl font-bold">Scan Receipt</h1>
          <p className="text-muted-foreground mt-1">AI-powered expense capture</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {stage === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <button
                onClick={handleScan}
                className="w-full bg-card border-2 border-dashed border-border-bright rounded-2xl p-12 hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 group"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Take a Photo</h3>
                    <p className="text-muted-foreground">Use your camera to scan a receipt</p>
                  </div>
                </div>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-background text-muted-foreground">or</span>
                </div>
              </div>

              <button
                onClick={handleUpload}
                className="w-full bg-card border border-border rounded-2xl p-12 hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 group"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-secondary-bright/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-secondary-bright" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Upload Image</h3>
                    <p className="text-muted-foreground">Select a receipt photo from your device</p>
                  </div>
                </div>
              </button>
            </motion.div>
          )}

          {stage === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-12"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-4 border-primary/20"></div>
                  <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-t-primary animate-spin"></div>
                  <Camera className="absolute inset-0 m-auto w-12 h-12 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">Capturing Receipt...</h3>
                  <p className="text-muted-foreground">Hold steady</p>
                </div>
              </div>
            </motion.div>
          )}

          {stage === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-12"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <Sparkles className="w-24 h-24 text-primary animate-pulse" />
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-glow"></div>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-2">AI Processing...</h3>
                  <p className="text-muted-foreground">Extracting receipt details</p>
                  <div className="mt-6 space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary animate-glow"></div>
                      <span className="text-muted-foreground">Detecting text...</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary animate-glow" style={{ animationDelay: "0.2s" }}></div>
                      <span className="text-muted-foreground">Identifying merchant...</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary animate-glow" style={{ animationDelay: "0.4s" }}></div>
                      <span className="text-muted-foreground">Categorizing items...</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {stage === "preview" && editedData && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-income/10 border border-income/20 rounded-xl p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-income mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Receipt Scanned Successfully!</h4>
                  <p className="text-xs text-muted-foreground">Review and edit the details below before saving</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                {/* Amount */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">$</span>
                    <input
                      type="text"
                      value={editedData.amount}
                      onChange={(e) => setEditedData({ ...editedData, amount: e.target.value })}
                      className="w-full bg-input-background border border-border rounded-xl pl-10 pr-4 py-3 text-2xl font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                {/* Merchant */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Merchant</label>
                  <input
                    type="text"
                    value={editedData.merchant}
                    onChange={(e) => setEditedData({ ...editedData, merchant: e.target.value })}
                    className="w-full bg-input-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Date</label>
                  <input
                    type="date"
                    value={editedData.date}
                    onChange={(e) => setEditedData({ ...editedData, date: e.target.value })}
                    className="w-full bg-input-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setEditedData({ ...editedData, category: cat })}
                        className={`px-4 py-2 rounded-lg border transition-all ${
                          editedData.category === cat
                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                            : "bg-input-background border-border hover:border-primary"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Items Detected</label>
                  <div className="max-h-64 overflow-y-auto space-y-2 bg-input-background/50 rounded-xl p-4">
                    {editedData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm">{item.name}</span>
                        <span className="text-sm font-medium">${item.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="flex-1 px-6 py-4 rounded-xl border border-border hover:bg-muted transition-colors font-medium"
                >
                  <X className="w-5 h-5 inline mr-2" />
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-6 py-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow transition-all shadow-lg shadow-primary/30 font-medium"
                >
                  <Check className="w-5 h-5 inline mr-2" />
                  Save Transaction
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
