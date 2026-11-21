import { TicketMessageDto } from "./types";

/**
 * INC-0304 Solution:
 * "Private team notes must never be shown to a customer. Not on a screen.
 * Not in an API response. Not in an export. Not in a list."
 *
 * This sanitizer strips out internal/private notes whenever the consumer is a customer or public endpoint.
 */
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
        return !msg.isPrivate; // Customers NEVER see private notes
      }
      return true; // Agents and Admins see both
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
