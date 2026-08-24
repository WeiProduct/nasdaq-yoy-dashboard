import { NextResponse } from "next/server";
import { getNasdaqYoYData } from "@/lib/nasdaq";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  try {
    const data = await getNasdaqYoYData();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Unable to load NASDAQCOM data", error);

    return NextResponse.json(
      {
        error: "行情数据暂时不可用，请稍后重试。",
      },
      { status: 503 },
    );
  }
}
