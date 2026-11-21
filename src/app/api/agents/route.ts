import { NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";

export async function GET() {
  try {
    const agents = await TicketRepository.getAgents();
    return NextResponse.json({ success: true, agents });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch agents" },
      { status: 500 }
    );
  }
}
