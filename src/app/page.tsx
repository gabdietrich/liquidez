import Link from "next/link";
import { ArrowRight, Calendar, LayoutDashboard, PiggyBank } from "lucide-react";
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
    <div className="flex flex-col gap-12">
      <section className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Liquidez Dashboard
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Visualize janelas de liquidez, vencimentos e rentabilidade real dos
          seus investimentos
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
        <Card className="border-primary/20 bg-card shadow-md transition-shadow hover:shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PiggyBank className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Input Inteligente</CardTitle>
            <CardDescription>
              Envie extrato ou print e extraia os investimentos automaticamente
              com IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/input" className="inline-flex items-center gap-2">
                Ir para Input
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-md transition-shadow hover:shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Dashboard de Investimentos</CardTitle>
            <CardDescription>
              Timeline de liquidez, vencimentos e simulação de resgate com IR
              regressivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/investimentos" className="inline-flex items-center gap-2">
                Ver Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="bg-muted/50 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <CardTitle className="text-base font-medium">
              Timeline de Liquidez
            </CardTitle>
          </div>
          <CardDescription>
            Veja quanto terá disponível mês a mês nos próximos 2 anos. IR
            regressivo: 22,5% até 180d, 20% até 360d, 17,5% até 720d, 15% acima.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
