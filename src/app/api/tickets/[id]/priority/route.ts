import { NextRequest, NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";
import { Priority } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { priority, actorName, actorId } = body;

    const validPriorities: Priority[] = ["URGENT", "MEDIUM", "LOW"];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { success: false, error: "Invalid priority value" },
        { status: 400 }
      );
    }

    const updated = await TicketRepository.updatePriority({
      ticketId: id,
      newPriority: priority,
      actorName: actorName || "Support Lead",
      actorId: actorId || undefined,
    });

    return NextResponse.json({
      success: true,
      ticket: updated,
      message: `Priority updated to ${priority}. SLA recalculation logged in audit trail.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
