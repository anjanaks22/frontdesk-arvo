import { NextRequest, NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { agentId, expectedVersion } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId is required to claim a ticket" },
        { status: 400 }
      );
    }

    const updatedTicket = await TicketRepository.claimTicket({
      ticketId: id,
      agentId,
      expectedVersion,
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
      message: `Ticket successfully claimed by agent. Concurrency lock updated.`,
    });
  } catch (error: any) {
    const isConflict = error.message.includes("CONCURRENCY CONFLICT");
    return NextResponse.json(
      { success: false, error: error.message },
      { status: isConflict ? 409 : 400 }
    );
  }
}
