import { NextRequest, NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";
import { TicketStatus } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, actorName, actorRole, actorId } = body;

    const validStatuses: TicketStatus[] = [
      "OPEN",
      "IN_PROGRESS",
      "WAITING_ON_CUSTOMER",
      "RESOLVED",
      "CLOSED",
    ];

    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status value" },
        { status: 400 }
      );
    }

    const updated = await TicketRepository.updateStatus({
      ticketId: id,
      newStatus: status,
      actorName: actorName || "Support Team",
      actorRole: actorRole || "AGENT",
      actorId: actorId || undefined,
    });

    return NextResponse.json({
      success: true,
      ticket: updated,
      message: `Status updated to ${status}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
