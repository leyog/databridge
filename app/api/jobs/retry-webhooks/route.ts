import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { retryFailedWebhooks } from "@/lib/webhook-retry";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const retried = await retryFailedWebhooks();
  return NextResponse.json({ retried });
}
