import Link from "next/link";
import { ArrowRight, Calendar, PiggyBank, TrendingUp } from "lucide-react";
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
    <div className="space-y-12">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Liquidez Dashboard
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Visualize janelas de liquidez, vencimentos e rentabilidade real dos
          seus investimentos
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <PiggyBank className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Input Inteligente</CardTitle>
            <CardDescription>
              Cole o extrato bancário e extraia os investimentos automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/input">
                Ir para Input
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Calendar className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Timeline de Liquidez</CardTitle>
            <CardDescription>
              Veja quanto terá disponível mês a mês nos próximos 2 anos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/investimentos">
                Ver Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <TrendingUp className="h-10 w-10 text-primary mb-2" />
            <CardTitle>IR Regressivo</CardTitle>
            <CardDescription>
              Cálculo automático: 22,5% até 180d, 20% até 360d, 17,5% até 720d,
              15% acima
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/investimentos">
                Calcular
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
