"use client";

import { useState } from "react";
import Nav from "@/components/Nav";

interface ImportReceipt {
  status?: string;
  message?: string;
  error?: string;
  details?: string[];
  card?: string;
  period?: string;
  reconciliation?: { checked: boolean; ok: boolean; details: string[] };
  imported?: number;
  skipped_as_already_present?: number;
  categorized_by_rules?: number;
  categorized_by_ai?: number;
}

interface FileResult {
  filename: string;
  receipt: ImportReceipt;
}

export default function UploadPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<FileResult[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      setBusy(file.name);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/import", {
          method: "POST",
          body: formData,
        });
        const receipt = (await res.json()) as ImportReceipt;
        setResults((prev) => [{ filename: file.name, receipt }, ...prev]);
      } catch (err) {
        setResults((prev) => [
          { filename: file.name, receipt: { error: String(err) } },
          ...prev,
        ]);
      }
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h1 className="mb-1 text-lg font-bold">Upload statements</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Chase PDFs, Amex Excel exports, or Chase activity CSVs. Overlapping
        uploads are safe — already-imported transactions are skipped, never
        doubled.
      </p>

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
        {busy ? `Importing ${busy}…` : "Tap to choose files (.pdf .xlsx .csv)"}
        <input
          type="file"
          multiple
          accept=".pdf,.xlsx,.csv,.CSV"
          className="hidden"
          disabled={busy !== null}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      <div className="mt-6 flex flex-col gap-3">
        {results.map((r, i) => (
          <div
            key={i}
            className={`rounded-xl border p-4 text-sm ${
              r.receipt.error
                ? "border-red-200 bg-red-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <p className="mb-1 font-medium">{r.filename}</p>
            {r.receipt.error ? (
              <>
                <p className="text-red-700">{r.receipt.error}</p>
                {r.receipt.details?.map((d, j) => (
                  <p key={j} className="mt-1 text-xs text-red-600">
                    {d}
                  </p>
                ))}
              </>
            ) : r.receipt.status === "duplicate_file" ? (
              <p className="text-neutral-500">{r.receipt.message}</p>
            ) : (
              <>
                <p className="text-neutral-600">
                  {r.receipt.card} · {r.receipt.period}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-green-700">
                    {r.receipt.imported} imported
                  </span>
                  {", "}
                  <span className="text-neutral-500">
                    {r.receipt.skipped_as_already_present} skipped (already in
                    the app)
                  </span>
                </p>
                <p className="text-xs text-neutral-400">
                  categorized: {r.receipt.categorized_by_rules} from your past
                  approvals, {r.receipt.categorized_by_ai} by AI — all pending
                  your review
                </p>
                {r.receipt.reconciliation?.checked && (
                  <p className="mt-1 text-xs text-green-600">
                    ✓ totals reconcile with the statement
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <Nav />
    </main>
  );
}
