"use client";

import { useState, useEffect } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Investimento, InvestimentoInsert, TipoLiquidez, Categoria } from "@/types/database";

const TIPOS: TipoLiquidez[] = ["D+0", "D+30", "No Vencimento"];
const CATEGORIAS: Categoria[] = ["Reserva", "Longo Prazo", "Flipping"];

function toInputDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}-${m}-${d}`;
}

interface Props {
  investimento: Investimento;
  onSaved: () => void;
}

export function EditInvestimentoDialog({ investimento, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<InvestimentoInsert>({
    nome: "",
    valor_aplicado: 0,
    cnpj_fundo: null,
    data_aplicacao: "",
    data_vencimento: "",
    tipo_liquidez: "No Vencimento",
    categoria: "Reserva",
  });

  useEffect(() => {
    if (investimento) {
      setForm({
        nome: investimento.nome,
        valor_aplicado: investimento.valor_aplicado,
        cnpj_fundo: investimento.cnpj_fundo ?? null,
        data_aplicacao: investimento.data_aplicacao,
        data_vencimento: investimento.data_vencimento,
        tipo_liquidez: investimento.tipo_liquidez,
        categoria: investimento.categoria,
      });
    }
  }, [investimento, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    if (!supabase) {
      setErro("Supabase não configurado.");
      setLoading(false);
      return;
    }
    try {
      const valorNum = Number(form.valor_aplicado) || 0;
      const { error } = await supabase
        .from("liq_investimentos")
        .update({
          nome: form.nome.trim(),
          valor_aplicado: valorNum,
          cnpj_fundo: form.cnpj_fundo?.trim() || null,
          data_aplicacao: form.data_aplicacao,
          data_vencimento: form.data_vencimento,
          tipo_liquidez: form.tipo_liquidez,
          categoria: form.categoria,
        })
        .eq("id", investimento.id);
      if (error) throw error;
      setOpen(false);
      onSaved();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Editar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar investimento</DialogTitle>
          <DialogDescription>
            Altere os dados e salve para atualizar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-nome">Nome</Label>
            <Input
              id="edit-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-valor">Valor aplicado (R$)</Label>
            <Input
              id="edit-valor"
              type="number"
              step="0.01"
              min="0"
              value={form.valor_aplicado || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, valor_aplicado: parseFloat(e.target.value) || 0 }))
              }
              placeholder="0,00"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-aplicacao">Data aplicação</Label>
              <Input
                id="edit-aplicacao"
                type="date"
                value={toInputDate(form.data_aplicacao)}
                onChange={(e) => setForm((f) => ({ ...f, data_aplicacao: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-vencimento">Data vencimento</Label>
              <Input
                id="edit-vencimento"
                type="date"
                value={toInputDate(form.data_vencimento)}
                onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Liquidez</Label>
              <Select
                value={form.tipo_liquidez}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_liquidez: v as TipoLiquidez }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as Categoria }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
