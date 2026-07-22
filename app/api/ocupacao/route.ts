import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  "https://script.google.com/macros/s/AKfycbw52NTjJOf3JFU4pz2giClSFVjejqsfz9gLtur1vCLOmDv0mDgAlSbZBwU-kGy5AVmQ/exec";

const PERIODOS = new Set(["semana", "mes", "ano"]);

export async function GET(request: NextRequest) {
  const periodo = request.nextUrl.searchParams.get("periodo") ?? "ano";
  if (!PERIODOS.has(periodo)) {
    return NextResponse.json({ erro: true, mensagem: "Período inválido." }, { status: 400 });
  }
  const target = new URL(BACKEND_URL);
  target.searchParams.set("action", "getOcupacaoData");
  target.searchParams.set("periodo", periodo);
  target.searchParams.set("_", Date.now().toString());
  try {
    const response = await fetch(target, { cache: "no-store", redirect: "follow" });
    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.ok ? 200 : response.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { erro: true, mensagem: error instanceof Error ? error.message : "Falha ao consultar a ocupação." },
      { status: 502 },
    );
  }
}
