export type Role = "AGENT" | "CUSTOMER" | "ADMIN";

export type Priority = "URGENT" | "MEDIUM" | "LOW";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_ON_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export interface SlaInfo {
  replyDue: Date;
  resolveDue: Date;
  isReplyBreached: boolean;
  isResolveBreached: boolean;
  workingMinutesRemainingForReply: number;
  workingMinutesRemainingForResolve: number;
  isPaused: boolean;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface TicketMessageDto {
  id: string;
  ticketId: string;
  senderId?: string | null;
  senderName: string;
  senderRole: string;
  isPrivate: boolean;
  body: string;
  createdAt: string;
}

export interface TicketAuditLogDto {
  id: string;
  ticketId: string;
  actorId?: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface TicketDetailDto {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  customerName: string;
  customerEmail: string;
  assignedTo?: UserSummary | null;
  assignedToId?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaReplyDue: string;
  slaResolveDue: string;
  slaReplyBreached: boolean;
  slaResolveBreached: boolean;
  pausedAt?: string | null;
  totalPausedMs: number;
  reopenDeadline?: string | null;
  messages: TicketMessageDto[];
  auditLogs: TicketAuditLogDto[];
  slaStatus: {
    replyRemainingMinutes: number;
    resolveRemainingMinutes: number;
    isReplyLate: boolean;
    isResolveLate: boolean;
    isPaused: boolean;
  };
}
