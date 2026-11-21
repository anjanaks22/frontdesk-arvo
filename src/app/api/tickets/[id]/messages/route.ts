import { NextRequest, NextResponse } from "next/server";
import { TicketRepository } from "@/lib/repository";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { senderId, senderName, senderRole, isPrivate, message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message body cannot be empty" },
        { status: 400 }
      );
    }

    const updated = await TicketRepository.addMessage({
      ticketId: id,
      senderId: senderId || null,
      senderName: senderName || (senderRole === "CUSTOMER" ? "Customer" : "Agent"),
      senderRole: senderRole || "AGENT",
      isPrivate: Boolean(isPrivate),
      body: message.trim(),
    });

    return NextResponse.json({
      success: true,
      ticket: updated,
      message: isPrivate
        ? "Private internal note saved (restricted visibility)."
        : "Message sent successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
