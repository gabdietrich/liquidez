"use client";

import { useEffect, useState } from "react";
import {
  Award,
  Calendar,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AssetTabs } from "@/components/AssetTabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { HistoricoLiquidacao } from "@/types/database";

function formatarValor(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatarData(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function diasEntre(dataInicio: string, dataFim: string): number {
  const a = new Date(dataInicio + "T12:00:00").getTime();
  const b = new Date(dataFim + "T12:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatarDias(dias: number): string {
  if (dias < 30) return `${dias} dias`;
  const meses = Math.floor(dias / 30);
  const resto = dias % 30;
  if (resto === 0) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `${meses}m ${resto}d`;
}

export default function MemorialPage() {
  const [historico, setHistorico] = useState<HistoricoLiquidacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistorico() {
      try {
        const supabase = createClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("liq_historico")
            .select("*")
            .order("data_resgate", { ascending: false });
          if (!error && data) {
            setHistorico(data as HistoricoLiquidacao[]);
          } else {
            setHistorico([]);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    fetchHistorico();
  }, []);

  const totalLucro = historico.reduce(
    (s, h) => s + (h.lucro_liquido ?? h.valor_resgatado_liquido - h.valor_aplicado),
    0
  );

  const tempoMedioDias =
    historico.length > 0
      ? historico.reduce(
          (s, h) => s + diasEntre(h.data_aplicacao, h.data_resgate),
          0
        ) / historico.length
      : 0;

  return (
    <div className="space-y-8">
      <AssetTabs />
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Award className="h-8 w-8 text-primary" />
          Memorial de Conquistas
        </h1>
        <p className="mt-1 text-muted-foreground">
          Histórico de investimentos liquidados e lucros realizados
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : historico.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Award className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Você ainda não possui conquistas no seu memorial
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ao resgatar investimentos, eles aparecerão aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total de Lucro Acumulado
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    totalLucro >= 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {totalLucro >= 0 ? "+ " : ""}
                  {formatarValor(totalLucro)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {historico.length} resgate{historico.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Tempo Médio de Investimento
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatarDias(Math.round(tempoMedioDias))}
                </p>
                <p className="text-xs text-muted-foreground">
                  média entre aplicação e resgate
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {historico.map((h) => {
              const lucro = h.lucro_liquido ?? h.valor_resgatado_liquido - h.valor_aplicado;
              const dias = diasEntre(h.data_aplicacao, h.data_resgate);
              return (
                <Card key={h.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{h.nome}</CardTitle>
                      <Badge variant="secondary">{h.categoria}</Badge>
                    </div>
                    <CardDescription>
                      Resgatado em {formatarData(h.data_resgate)} · {formatarDias(dias)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        <Wallet className="mr-1 inline h-3.5 w-3" />
                        Aplicado: {formatarValor(h.valor_aplicado)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Valor líquido: {formatarValor(h.valor_resgatado_liquido)}
                      </span>
                    </div>
                    <p
                      className={`text-lg font-bold ${
                        lucro >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {lucro >= 0 ? "+ " : ""}
                      {formatarValor(lucro)}
                    </p>

                    {h.resumo_ai && (
                      <blockquote className="mt-2 border-l-2 border-primary/30 bg-muted/30 pl-3 pr-2 py-2 rounded-r-md text-sm text-muted-foreground italic">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 shrink-0 text-primary/70 mt-0.5" />
                          <span>{h.resumo_ai}</span>
                        </div>
                      </blockquote>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
