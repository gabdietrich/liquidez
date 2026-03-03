"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles } from "lucide-react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { extrairInvestimentosLLM } from "@/lib/extrator-extrato";
import type { InvestimentoInsert } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { ImageUploader } from "@/components/ImageUploader";

const EXEMPLO_EXTRATO = `CDB XP 12% a.a. - R$ 50.000,00 - Aplicação: 15/01/2024 - Vencimento: 15/01/2025 - CNPJ: 33.221.452/0001-00
Tesouro Selic 2027 - R$ 100.000,00 - 20/06/2023 - 20/06/2027 - Reserva
LCI Banco Inter - R$ 25.000,00 - 01/03/2024 - 01/09/2024 - D+30 - Flipping`;

const MAX_IMAGE_SIZE_MB = 1;

export default function InputInteligentePage() {
  async function preprocessImage(file: File): Promise<File> {
    const isImage = /image\/(png|jpe?g)/i.test(file.type) || /\.(png|jpe?g)$/i.test(file.name);
    if (!isImage) return file;

    // Comprime prints de alta resolução (ex.: iPhone) para no máximo 1MB
    const compressed = await imageCompression(file, {
      maxSizeMB: MAX_IMAGE_SIZE_MB,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    return compressed;
  }

  const [texto, setTexto] = useState("");
  const [extraidos, setExtraidos] = useState<InvestimentoInsert[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();

  async function handleExtrair() {
    if (!texto.trim()) {
      setErro("Cole o texto do extrato para extrair.");
      return;
    }
    setLoading(true);
    setErro(null);
    setAviso(null);
    try {
      const dados = await extrairInvestimentosLLM(texto);
      setExtraidos(dados);
      if (dados.length === 0) {
        setErro(
          "Nenhum investimento encontrado. Tente um formato com: valor (R$), datas (DD/MM/AAAA) e nome."
        );
      }
    } catch (e) {
      setErro("Erro ao extrair dados. Tente novamente.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSalvar() {
    if (extraidos.length === 0) return;
    const supabase = createClient();
    if (!supabase) {
      setErro("Configure as variáveis do Supabase no .env.local");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErro("Faça login para salvar.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const rows = extraidos.map((e) => ({ ...e, user_id: user.id }));
      const { error } = await supabase
        .from("liq_investimentos")
        .insert(rows as unknown as Record<string, unknown>[]);
      if (error) throw new Error(error.message);
      router.push("/investimentos");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(`Erro ao salvar: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function formatarValor(v: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);
  }

  function formatarData(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Input Inteligente</h1>
        <p className="text-muted-foreground mt-1">
          Cole o extrato bancário e extraia os investimentos automaticamente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extrato Bancário
          </CardTitle>
          <CardDescription>
            Cole o texto bruto do extrato. Usa GPT-4o para extrair investimentos
            de texto livre (ou regex se a API não estiver configurada).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Ou envie uma imagem do extrato</p>
            <ImageUploader
              onExtract={(dados) => {
                if (dados == null || !Array.isArray(dados) || dados.length === 0) {
                  toast.error(
                    "Nenhum investimento identificado. Tente um print com mais contraste ou com os nomes dos ativos visíveis"
                  );
                  setExtraidos([]);
                  setErro(null);
                  return;
                }
                setExtraidos(dados);
                setErro(null);
              }}
              onError={(message) => {
                setErro(message);
                if (message) {
                  console.error("[Input] Erro no upload:", message);
                  if (!message.includes("Nenhum investimento identificado")) {
                    toast.error(message);
                  }
                }
              }}
              onAviso={setAviso}
              preprocessImage={preprocessImage}
              disabled={loading}
            />
            {aviso && (
              <p className="text-sm text-muted-foreground">{aviso}</p>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou cole o texto</span>
            </div>
          </div>
          <Textarea
            placeholder="Exemplo:&#10;CDB XP - R$ 50.000,00 - 15/01/2024 - 15/01/2025&#10;Tesouro Selic - R$ 100.000,00 - 20/06/2023 - 20/06/2027"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleExtrair}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Extrair Investimentos
            </Button>
            <Button
              variant="outline"
              onClick={() => setTexto(EXEMPLO_EXTRATO)}
            >
              Usar Exemplo
            </Button>
          </div>
          {erro && (
            <p className="text-sm text-destructive">{erro}</p>
          )}
        </CardContent>
      </Card>

      {extraidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Investimentos Extraídos ({extraidos.length})</CardTitle>
            <CardDescription>
              Revise os dados antes de salvar no banco
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Aplicação</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Liquidez</TableHead>
                    <TableHead>Categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extraidos.map((inv, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{inv.nome}</TableCell>
                      <TableCell>{formatarValor(inv.valor_aplicado)}</TableCell>
                      <TableCell>{formatarData(inv.data_aplicacao)}</TableCell>
                      <TableCell>{formatarData(inv.data_vencimento)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inv.tipo_liquidez}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.categoria}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={handleSalvar}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Salvar no Banco
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
