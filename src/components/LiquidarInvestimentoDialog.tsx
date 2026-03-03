"use client";

import { useState, useEffect } from "react";
import { Loader2, Wallet } from "lucide-react";
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
  calcularIRRegressivo,
  calcularAliquotaIR,
  getDiasPermanencia,
} from "@/lib/ir-regressivo";
import type { Investimento } from "@/types/database";

function formatarValor(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(v);
}

interface Props {
  investimento: Investimento;
  onLiquidado: () => void;
}

export function LiquidarInvestimentoDialog({ investimento, onLiquidado }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valorSugerido = Number(investimento.valor_aplicado);
  const [valorBruto, setValorBruto] = useState(valorSugerido);

  useEffect(() => {
    if (open) {
      setValorBruto(valorSugerido);
      setErro(null);
    }
  }, [open, valorSugerido]);

  const dataAplic = new Date(investimento.data_aplicacao);
  const dataResgate = new Date();
  const { ir, valorLiquido } = calcularIRRegressivo(
    valorBruto,
    Number(investimento.valor_aplicado),
    dataAplic,
    dataResgate
  );
  const dias = getDiasPermanencia(
    investimento.data_aplicacao,
    dataResgate.toISOString().slice(0, 10)
  );
  const aliquota = calcularAliquotaIR(dias) * 100;

  async function handleConfirmar() {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/liquidar-investimento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investimento_id: investimento.id,
          valor_bruto: valorBruto,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Erro ${res.status}`);
      }
      setOpen(false);
      onLiquidado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao liquidar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Wallet className="h-4 w-4" />
          Resgatar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Liquidar investimento</DialogTitle>
          <DialogDescription>
            Confirme o valor bruto de resgate para {investimento.nome}. O IR será
            calculado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="valor-bruto">Valor Bruto de Resgate (R$)</Label>
            <Input
              id="valor-bruto"
              type="number"
              step="0.01"
              min="0"
              value={valorBruto || ""}
              onChange={(e) =>
                setValorBruto(parseFloat(e.target.value) || 0)
              }
              placeholder={formatarValor(valorSugerido)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sugestão: {formatarValor(valorSugerido)} (valor aplicado)
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-medium">Resumo do resgate</p>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>IR ({aliquota}%)</span>
              <span>{formatarValor(ir)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Valor líquido</span>
              <span>{formatarValor(valorLiquido)}</span>
            </div>
          </div>
          {erro && (
            <p className="text-sm text-destructive">{erro}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirmar resgate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
