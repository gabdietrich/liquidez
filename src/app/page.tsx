import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  LayoutDashboard,
  PiggyBank,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-md">
        <CardHeader className="space-y-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Liquidez Dashboard
          </div>
          <CardTitle className="text-3xl tracking-tight">
            Gestão de ativos com foco em liquidez real
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            Acompanhe vencimentos, simule resgates com IR regressivo e entenda
            quanto capital estará disponível mês a mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/input" className="inline-flex items-center gap-2">
              Ir para Input
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/investimentos" className="inline-flex items-center gap-2">
              Ver Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PiggyBank className="h-5 w-5" />
            </div>
            <CardTitle>Input Inteligente</CardTitle>
            <CardDescription>
              Extraia investimentos de texto, imagens ou PDF com apoio de IA.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <CardTitle>Dashboard Executivo</CardTitle>
            <CardDescription>
              Visual moderno com timeline, categorias e ações rápidas de resgate.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="lg:col-span-2 bg-muted/40">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            <CardTitle className="text-base">Próximos 24 meses</CardTitle>
          </div>
          <CardDescription>
            Sua janela de disponibilidade mensal já considera a lógica de IR
            regressivo para apoiar decisões de giro e alocação.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
