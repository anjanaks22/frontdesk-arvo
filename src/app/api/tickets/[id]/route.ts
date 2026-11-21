import { NextRequest, NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";
import { Role } from "@/lib/types";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const role = (searchParams.get("role") || "AGENT") as Role;

    const ticket = await TicketRepository.getTicketById(id, role);
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}
