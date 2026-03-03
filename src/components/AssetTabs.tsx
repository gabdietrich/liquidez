"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function AssetTabs() {
  const pathname = usePathname();
  const isHistorico = pathname.startsWith("/memorial");

  return (
    <div className="mb-6 inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
      <Link
        href="/investimentos"
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          !isHistorico
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground/60 hover:text-foreground"
        )}
      >
        <Wallet className="h-4 w-4" />
        Ativos
      </Link>
      <Link
        href="/memorial"
        className={cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
          isHistorico
            ? "bg-background text-foreground shadow-sm"
            : "text-foreground/60 hover:text-foreground"
        )}
      >
        <History className="h-4 w-4" />
        Histórico
      </Link>
    </div>
  );
}
