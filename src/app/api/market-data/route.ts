import { NextResponse } from "next/server";
import { fetchTaxasMercado } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const taxas = await fetchTaxasMercado();
    return NextResponse.json(taxas);
  } catch (e) {
    console.error("Erro ao buscar taxas de mercado:", e);
    return NextResponse.json(
      {
        cdiDiarioPercentual: null,
        cdiAnualizadoAproximado: null,
        ipcaMensalPercentual: null,
        selicMetaPercentual: null,
      },
      { status: 200 }
    );
  }
}
