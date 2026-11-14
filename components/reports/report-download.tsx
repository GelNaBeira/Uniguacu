"use client";
import { useId, useState, useTransition } from "react";
import { generateReport } from "@/app/(app)/reports/actions";
import type { ReportInput } from "@/lib/reports/schema";
import { Button } from "@/components/ui/button";

export function ReportDownload({ request }: { request: Omit<Extract<ReportInput, { scope: "operational" }>, "format"> | { scope: "general" } }) {
  const id = useId();
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <div className="space-y-2" aria-busy={pending}>
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="sr-only">Formato do relatório</label>
      <select id={id} value={format} disabled={pending} onChange={(event) => setFormat(event.target.value as "pdf" | "xlsx")} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="pdf">PDF</option><option value="xlsx">Excel (.xlsx)</option></select>
      <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
        setMessage("");
        try {
          const result = await generateReport({ ...request, format });
          if (!result.success) { setMessage(result.message); return; }
          const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
          const anchor = document.createElement("a");
          anchor.href = url; anchor.download = result.filename;
          document.body.appendChild(anchor); anchor.click(); anchor.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setMessage("Relatório gerado. Download iniciado.");
        } catch { setMessage("Não foi possível baixar o relatório. Verifique sua sessão e tente novamente."); }
      })}>{pending ? "Gerando relatório…" : request.scope === "general" ? "Gerar Relatório Geral" : "Gerar Relatório"}</Button>
    </div>
    {message && <p role="status" className="max-w-md text-sm">{message}</p>}
  </div>;
}