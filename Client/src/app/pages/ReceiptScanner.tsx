import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Camera,
  Check,
  LoaderCircle,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { EXPENSE_CATEGORIES, todayISO } from "../lib/analytics";
import { categoryIcon, useFinance } from "../lib/finance";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SOURCE_LABEL: Record<string, string> = {
  vision: "Read by the AI vision model",
  ocr: "Read with OCR + parsing",
  text: "Parsed from text",
  local: "Offline draft. Please fill in the details",
};

type ScanStage = "idle" | "processing" | "preview";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export function ReceiptScanner() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { scanReceipt, addTransaction, clearReceipt, lastReceipt, formatMoney, profile } = useFinance();
  const [stage, setStage] = useState<ScanStage>(lastReceipt ? "preview" : "idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(lastReceipt);
  const [rawText, setRawText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSelectedFile(file: File) {
    setErrorMessage("");
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage("That image is over 8 MB. Try a smaller photo or a screenshot.");
      return;
    }
    setStage("processing");

    try {
      const imageBase64 = await readFileAsDataUrl(file);
      setPreview(imageBase64);
      const result = await scanReceipt({ filename: file.name, imageBase64, rawText });
      if (result.data) {
        setDraft(result.data);
        setStage("preview");
      } else {
        setStage("idle");
      }
      if (!result.ok && result.error) {
        setErrorMessage(`Scan failed (${result.error}), so an editable draft was created instead.`);
      }
    } catch (error) {
      setStage("idle");
      setErrorMessage(error instanceof Error ? error.message : "Unable to scan this file");
    }
  }

  async function handleManualScan() {
    if (!rawText.trim()) {
      return;
    }

    setStage("processing");
    setErrorMessage("");
    setPreview(null);
    const result = await scanReceipt({ filename: "manual-entry.txt", rawText });
    if (result.data) {
      setDraft(result.data);
      setStage("preview");
    } else {
      setStage("idle");
    }
  }

  async function handleSaveTransaction() {
    if (!draft) {
      return;
    }
    if (!(Number(draft.amount) > 0)) {
      setErrorMessage("Enter the receipt total before saving.");
      return;
    }

    const result = await addTransaction({
      name: draft.merchant || "Scanned receipt",
      category: draft.category || "Other",
      amount: Number(draft.amount || 0),
      date: draft.date || todayISO(),
      time: null,
      type: "expense",
      icon: categoryIcon(draft.category || "Other", "expense"),
    });

    if (result.ok) {
      clearReceipt();
      navigate("/transactions");
    } else {
      setErrorMessage(result.error ?? "Unable to save the scanned transaction");
    }
  }

  const itemsTotal = draft ? draft.items.reduce((sum, item) => sum + item.price, 0) : 0;

  function resetScanner() {
    clearReceipt();
    setDraft(null);
    setPreview(null);
    setRawText("");
    setErrorMessage("");
    setStage("idle");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold">Receipt scanner</h1>
        <p className="mt-1 text-muted-foreground">Upload a receipt image or paste OCR text, then confirm the parsed expense.</p>
      </motion.div>

      {errorMessage ? (
        <div className="rounded-2xl border border-expense/20 bg-expense/5 p-4 text-sm text-expense">
          {errorMessage}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {stage === "idle" ? (
          <motion.div key="idle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void handleSelectedFile(file);
              }}
              className={`group w-full rounded-3xl border-2 border-dashed bg-card p-12 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10 ${dragging ? "border-primary bg-primary/5" : "border-border-bright"}`}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:scale-105">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Upload receipt image</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Click or drop a JPG, PNG, or screenshot of a bill (max 8 MB).</p>
                </div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleSelectedFile(file);
                }
                event.target.value = "";
              }}
            />

            <div className="rounded-3xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-secondary-bright" />
                <h2 className="text-lg font-semibold">Manual text fallback</h2>
              </div>
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="Paste OCR text here if you already copied it from another tool..."
                className="min-h-40 w-full rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
              />
              <button
                onClick={() => void handleManualScan()}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-secondary-bright px-5 py-3 font-medium text-white transition-colors hover:opacity-90"
              >
                <ScanLine className="h-5 w-5" />
                Parse text
              </button>
            </div>
          </motion.div>
        ) : null}

        {stage === "processing" ? (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-3xl border border-border bg-card p-12">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <Sparkles className="h-20 w-20 text-primary animate-pulse" />
                <LoaderCircle className="absolute -right-2 -top-2 h-8 w-8 animate-spin text-primary-glow" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">Analyzing receipt</h2>
                <p className="mt-2 text-muted-foreground">Extracting merchant, amount, date, and item details.</p>
              </div>
            </div>
          </motion.div>
        ) : null}

        {stage === "preview" && draft ? (
          <motion.div key="preview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">
            <div className="rounded-2xl border border-income/20 bg-income/5 p-4">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 text-income" />
                <div>
                  <p className="font-semibold">Receipt parsed</p>
                  <p className="text-sm text-muted-foreground">
                    {draft.source ? `${SOURCE_LABEL[draft.source] ?? ""}. ` : ""}Review the values below before saving.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 rounded-3xl border border-border bg-card p-6">
              {preview ? (
                <img src={preview} alt="Receipt preview" className="max-h-72 w-full rounded-2xl bg-muted object-contain" />
              ) : null}
              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground">Total ({profile.currency})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => setDraft((current) => current ? { ...current, amount: event.target.value } : current)}
                  className="rounded-2xl border border-border bg-input-background px-4 py-3 text-2xl font-bold outline-none transition-colors focus:border-primary"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-muted-foreground">Merchant</span>
                <input
                  type="text"
                  value={draft.merchant}
                  onChange={(event) => setDraft((current) => current ? { ...current, merchant: event.target.value } : current)}
                  className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft((current) => current ? { ...current, date: event.target.value } : current)}
                    className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <select
                    value={EXPENSE_CATEGORIES.includes(draft.category) ? draft.category : "Other"}
                    onChange={(event) => setDraft((current) => current ? { ...current, category: event.target.value } : current)}
                    className="rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">Detected items</span>
                <div className="max-h-56 overflow-y-auto rounded-2xl bg-input-background/70 p-4">
                  {draft.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No individual line items were detected.</p>
                  ) : (
                    <div className="space-y-2">
                      {draft.items.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
                          <span className="text-sm">{item.name}</span>
                          <span className="text-sm font-medium">{formatMoney(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {itemsTotal > 0 && Number(draft.amount) > 0 && Math.abs(itemsTotal - Number(draft.amount)) > 0.01 ? (
                  <p className="text-xs text-muted-foreground">
                    Items add up to {formatMoney(itemsTotal)}; the difference of {formatMoney(Number(draft.amount) - itemsTotal)} is likely tax, tip, or discounts.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <span className="text-sm text-muted-foreground">Raw text</span>
                <textarea
                  value={draft.rawText ?? ""}
                  onChange={(event) => setDraft((current) => current ? { ...current, rawText: event.target.value } : current)}
                  className="min-h-32 rounded-2xl border border-border bg-input-background px-4 py-3 outline-none transition-colors focus:border-primary"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetScanner}
                className="flex-1 rounded-2xl border border-border px-5 py-4 font-medium transition-colors hover:bg-muted"
              >
                <X className="mr-2 inline h-5 w-5" />
                Discard
              </button>
              <button
                onClick={() => void handleSaveTransaction()}
                className="flex-1 rounded-2xl bg-primary px-5 py-4 font-medium text-primary-foreground transition-colors hover:bg-primary-glow"
              >
                <Check className="mr-2 inline h-5 w-5" />
                Save transaction
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
