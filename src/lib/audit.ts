import prisma from "./prisma";

export interface LogAuditParams {
  ticketId: string;
  actorId?: string | null;
  actorName: string;
  actorRole: "AGENT" | "CUSTOMER" | "SYSTEM" | "ADMIN";
  action:
  | "CREATED"
  | "CLAIMED"
  | "UNASSIGNED"
  | "REPLY_SENT"
  | "NOTE_ADDED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "REOPENED"
  | "AUTO_CLOSED";
  oldValue?: string | null;
  newValue?: string | null;
  details?: string | null;
}


export async function logTicketAudit(params: LogAuditParams) {
  try {
    return await prisma.ticketAuditLog.create({
      data: {
        ticketId: params.ticketId,
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: params.action,
        oldValue: params.oldValue,
        newValue: params.newValue,
        details: params.details,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
    throw err;
  }
}
