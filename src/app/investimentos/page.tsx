"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  DollarSign,
  Plus,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Investimento } from "@/types/database";
import { calcularTimelineLiquidez } from "@/lib/timeline-liquidez";
import { getDiasPermanencia } from "@/lib/ir-regressivo";
import { EditInvestimentoDialog } from "@/components/EditInvestimentoDialog";
import { DeleteInvestimentoDialog } from "@/components/DeleteInvestimentoDialog";
import { ResgateModal } from "@/components/investimentos/ResgateModal";

// Dados mock para desenvolvimento sem Supabase
const MOCK_INVESTIMENTOS: Investimento[] = [
  {
    id: "1",
    nome: "CDB XP 12%",
    valor_aplicado: 50000,
    cnpj_fundo: null,
    data_aplicacao: "2024-01-15",
    data_vencimento: "2025-01-15",
    tipo_liquidez: "No Vencimento",
    categoria: "Longo Prazo",
  },
  {
    id: "2",
    nome: "Tesouro Selic 2027",
    valor_aplicado: 100000,
    cnpj_fundo: null,
    data_aplicacao: "2023-06-20",
    data_vencimento: "2027-06-20",
    tipo_liquidez: "No Vencimento",
    categoria: "Reserva",
  },
  {
    id: "3",
    nome: "LCI Banco Inter",
    valor_aplicado: 25000,
    cnpj_fundo: null,
    data_aplicacao: "2024-03-01",
    data_vencimento: "2024-09-01",
    tipo_liquidez: "D+30",
    categoria: "Flipping",
  },
];

function formatarValor(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export default function InvestimentosPage() {
  const [investimentos, setInvestimentos] =
    useState<Investimento[]>(MOCK_INVESTIMENTOS);
  const [loading, setLoading] = useState(true);

  async function fetchInvestimentos() {
    try {
      const supabase = createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("liq_investimentos")
          .select("*")
          .order("data_vencimento", { ascending: true });
        if (!error && data && data.length > 0) {
          setInvestimentos(data as Investimento[]);
        } else if (!error && (!data || data.length === 0)) {
          setInvestimentos([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvestimentos();
  }, []);

  const timeline = calcularTimelineLiquidez(investimentos);
  const totalAplicado = investimentos.reduce((s, i) => s + i.valor_aplicado, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Liquidez</h1>
          <p className="text-muted-foreground mt-1">
            Timeline de disponibilidade nos próximos 2 anos
          </p>
        </div>
        <Button asChild>
          <Link href="/input">
            <Plus className="h-4 w-4" />
            Adicionar
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Aplicado
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatarValor(totalAplicado)}</p>
            <p className="text-xs text-muted-foreground">
              {investimentos.length} investimentos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Próximos Vencimentos
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {timeline.filter((m) => m.valorLiquido > 0).length}
            </p>
            <p className="text-xs text-muted-foreground">meses com liquidez</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">IR Regressivo</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              22,5% → 20% → 17,5% → 15%
            </p>
            <p className="text-xs text-muted-foreground">
              conforme tempo de permanência
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Timeline de Disponibilidade
          </CardTitle>
          <CardDescription>
            Quanto terá disponível mês a mês (valor líquido após IR)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-4">
                {timeline.map((mes) => (
                  <div
                    key={`${mes.ano}-${mes.mes}`}
                    className={`flex flex-col items-center rounded-lg border p-3 min-w-[100px] ${
                      mes.valorLiquido > 0
                        ? "border-primary/30 bg-primary/5"
                        : "border-muted"
                    }`}
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {mes.label}
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        mes.valorLiquido > 0 ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {formatarValor(mes.valorLiquido)}
                    </span>
                    {mes.investimentos.length > 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {mes.investimentos.length} inv.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Investimentos</CardTitle>
          <CardDescription>
            Ordenados por data de vencimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Liquidez</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Dias (IR)</TableHead>
                  <TableHead className="w-[180px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investimentos.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum investimento.{" "}
                      <Link href="/input" className="text-primary hover:underline">
                        Adicionar
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                investimentos.map((inv) => {
                  const hoje = new Date().toISOString().slice(0, 10);
                  const dias =
                    new Date(inv.data_vencimento) >= new Date(hoje)
                      ? getDiasPermanencia(inv.data_aplicacao, inv.data_vencimento)
                      : "-";
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.nome}</TableCell>
                      <TableCell>{formatarValor(inv.valor_aplicado)}</TableCell>
                      <TableCell>
                        {new Date(inv.data_vencimento + "T12:00:00").toLocaleDateString(
                          "pt-BR"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inv.tipo_liquidez}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.categoria}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dias !== "-" ? `${dias} dias` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ResgateModal
                            investimento={inv}
                            onLiquidado={fetchInvestimentos}
                          />
                          <EditInvestimentoDialog
                            investimento={inv}
                            onSaved={fetchInvestimentos}
                          />
                          <DeleteInvestimentoDialog
                            investimento={inv}
                            onDeleted={fetchInvestimentos}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
