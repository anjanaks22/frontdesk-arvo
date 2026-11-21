import { NextRequest, NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";
import { Priority } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = (searchParams.get("filter") || "all") as "all" | "late" | "waiting" | "assigned";
    const agentId = searchParams.get("agentId") || undefined;
    const search = searchParams.get("search") || undefined;

    const tickets = await TicketRepository.listTickets({
      filter,
      agentId,
      search,
    });

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, priority, customerName, customerEmail } = body;

    if (!title || !description || !customerName || !customerEmail) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const validPriority: Priority = ["URGENT", "MEDIUM", "LOW"].includes(priority)
      ? priority
      : "MEDIUM";

    const ticket = await TicketRepository.createTicket({
      title,
      description,
      priority: validPriority,
      customerName,
      customerEmail,
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create ticket" },
      { status: 500 }
    );
  }
}
