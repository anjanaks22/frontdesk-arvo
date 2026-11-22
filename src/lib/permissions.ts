import { TicketMessageDto } from "./types";


export function sanitizeMessagesForRole(
  messages: Array<{
    id: string;
    ticketId: string;
    senderId?: string | null;
    senderName: string;
    senderRole: string;
    isPrivate: boolean;
    body: string;
    createdAt: Date | string;
  }>,
  requesterRole: "AGENT" | "CUSTOMER" | "ADMIN"
): TicketMessageDto[] {
  return messages
    .filter((msg) => {
      if (requesterRole === "CUSTOMER") {
        return !msg.isPrivate;
      }
      return true;
    })
    .map((msg) => ({
      id: msg.id,
      ticketId: msg.ticketId,
      senderId: msg.senderId ?? null,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      isPrivate: msg.isPrivate,
      body: msg.body,
      createdAt:
        typeof msg.createdAt === "string"
          ? msg.createdAt
          : msg.createdAt.toISOString(),
    }));
}
