"use client";
import { useEffect, useId, useState } from "react";
import { lookupLendingOptions } from "@/app/(app)/home/actions";
import type { LendingKind, LendingOption, LookupResult } from "@/lib/lending/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function OptionPicker({ kind, label, value, onChange, disabled }: {
  kind: LendingKind | "collaborator" | "academic"; label: string; value: LendingOption | null;
  onChange: (value: LendingOption | null) => void; disabled: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<LookupResult | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      lookupLendingOptions({ kind, query, page }).then((data) => {
        if (!cancelled) { setResult(data); setLoading(false); }
      }).catch(() => {
        if (!cancelled) { setResult({ success: false, message: "Falha na consulta. Verifique sua sessão e tente novamente." }); setLoading(false); }
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [kind, query, page, version]);
  const rows = result?.success ? result.rows : [];
  const options = value && !rows.some((row) => row.id === value.id) ? [value, ...rows] : rows;
  function changePage(next: number) { setLoading(true); setPage(next); }
  return <div className="space-y-2 rounded-lg border border-border p-4" aria-busy={loading}>
    <label htmlFor={`${id}-search`} className="text-sm font-semibold">Buscar {label.toLowerCase()}</label>
    <Input id={`${id}-search`} value={query} maxLength={100} disabled={disabled} placeholder="Digite parte do nome" onChange={(e) => { setLoading(true); setQuery(e.target.value); setPage(1); }} />
    <label htmlFor={`${id}-select`} className="block text-sm font-semibold">{label} (obrigatório)</label>
    <Select id={`${id}-select`} value={value?.id ?? ""} disabled={disabled || loading || !result?.success} onChange={(e) => onChange(options.find((row) => row.id === e.target.value) ?? null)}>
      <option value="">Selecione…</option>{options.map((row) => <option key={row.id} value={row.id}>{row.name}{row.qtd !== undefined ? ` · ${row.qtd} em estoque` : ""}{row.mileage !== undefined && row.mileage !== null ? ` · ${row.mileage} km` : ""}</option>)}
    </Select>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
      <span>{loading ? "Consultando…" : result?.success ? `${result.count} opções · página ${result.page} de ${result.pages}` : "Consulta indisponível"}</span>
      {result?.success && <div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={disabled || loading || page <= 1} onClick={() => changePage(page - 1)}>Anterior</Button><Button type="button" size="sm" variant="ghost" disabled={disabled || loading || page >= result.pages} onClick={() => changePage(page + 1)}>Próxima</Button></div>}
    </div>
    {result && !result.success && <p role="alert" className="text-sm text-red-800">{result.message}</p>}
    <Button type="button" size="sm" variant="outline" disabled={disabled || loading} onClick={() => { onChange(null); setLoading(true); setVersion(version + 1); }}>Atualizar opções</Button>
    {result?.success && !loading && result.count === 0 && <p className="text-xs text-muted-foreground">Nenhuma opção encontrada. Verifique os cadastros, estoque ou disponibilidade.</p>}
  </div>;
}