import { getNasdaqYoYData } from "@/lib/nasdaq";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 600;

export async function GET() {
  return Response.json(await getNasdaqYoYData());
}
