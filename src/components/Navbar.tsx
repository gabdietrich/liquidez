"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function Navbar() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const client = createClient();
    if (!client) return;
    client.auth.getUser().then(({ data: { user } }) => setUser(user ?? null));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const client = createClient();
    if (!client) return;
    await client.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="font-semibold text-primary hover:underline"
          >
            Liquidez Dashboard
          </Link>
          {user && (
            <>
              <Link
                href="/input"
                className="text-muted-foreground hover:text-foreground"
              >
                Input Inteligente
              </Link>
              <Link
                href="/investimentos"
                className="text-muted-foreground hover:text-foreground"
              >
                Investimentos
              </Link>
              <Link
                href="/memorial"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Trophy className="h-4 w-4" />
                Memorial
              </Link>
            </>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
