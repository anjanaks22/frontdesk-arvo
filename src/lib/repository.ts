import { Priority, TicketDetailDto, TicketStatus } from "./types";
import {
  ARVO_AGENTS,
  generateSeedTickets,
  SeedAgent,
  SeedTicket,
} from "./seed-data";
import {
  calculateInitialSla,
  evaluateTicketSla,
  resumeDeadlinesAfterPause,
  canReopenTicket,
  addWorkingMinutes,
  calculateWorkingMinutesBetween,
} from "./sla";
import { sanitizeMessagesForRole } from "./permissions";


const memoryState = {
  agents: [...ARVO_AGENTS],
  tickets: generateSeedTickets(),
};

export class TicketRepository {

  static async listTickets(params: {
    filter?: "all" | "late" | "waiting" | "assigned";
    agentId?: string;
    search?: string;
  }) {
    const { filter = "all", agentId, search } = params;
    const now = new Date();

    let tickets = [...memoryState.tickets];


    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      tickets = tickets.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q)
      );
    }


    const evaluated = tickets.map((t) => {
      const agent = memoryState.agents.find((a) => a.id === t.assignedToId) || null;
      const sla = evaluateTicketSla({
        status: t.status,
        priority: t.priority,
        firstResponseAt: t.firstResponseAt,
        resolvedAt: t.resolvedAt,
        slaReplyDue: t.slaReplyDue,
        slaResolveDue: t.slaResolveDue,
        pausedAt: t.pausedAt,
        now,
      });

      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        assignedTo: agent,
        assignedToId: t.assignedToId,
        version: t.version,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.createdAt.toISOString(),
        firstResponseAt: t.firstResponseAt?.toISOString() || null,
        resolvedAt: t.resolvedAt?.toISOString() || null,
        closedAt: t.closedAt?.toISOString() || null,
        slaReplyDue: t.slaReplyDue.toISOString(),
        slaResolveDue: t.slaResolveDue.toISOString(),
        slaReplyBreached: sla.isReplyLate,
        slaResolveBreached: sla.isResolveLate,
        pausedAt: t.pausedAt?.toISOString() || null,
        totalPausedMs: t.totalPausedMs,
        reopenDeadline: t.reopenDeadline?.toISOString() || null,
        messagesCount: t.messages.length,
        slaStatus: {
          replyRemainingMinutes: sla.replyRemainingMinutes,
          resolveRemainingMinutes: sla.resolveRemainingMinutes,
          isReplyLate: sla.isReplyLate,
          isResolveLate: sla.isResolveLate,
          isPaused: sla.isPaused,
          isLate: sla.isLate,
        },
      };
    });


    if (filter === "late") {
      return evaluated.filter((t) => t.slaStatus.isLate);
    }
    if (filter === "waiting") {
      return evaluated.filter((t) => t.status === "WAITING_ON_CUSTOMER");
    }
    if (filter === "assigned" && agentId) {
      return evaluated.filter((t) => t.assignedToId === agentId);
    }

    return evaluated;
  }


  static async getTicketById(id: string, role: "AGENT" | "CUSTOMER" | "ADMIN" = "AGENT"): Promise<TicketDetailDto | null> {
    const t = memoryState.tickets.find((item) => item.id === id);
    if (!t) return null;

    const agent = memoryState.agents.find((a) => a.id === t.assignedToId) || null;
    const sla = evaluateTicketSla({
      status: t.status,
      priority: t.priority,
      firstResponseAt: t.firstResponseAt,
      resolvedAt: t.resolvedAt,
      slaReplyDue: t.slaReplyDue,
      slaResolveDue: t.slaResolveDue,
      pausedAt: t.pausedAt,
    });


    const messagesWithTicketId = t.messages.map((m) => ({
      ...m,
      ticketId: t.id,
    }));
    const sanitizedMessages = sanitizeMessagesForRole(messagesWithTicketId, role);

    const auditLogs = t.auditLogs.map((log) => ({
      id: log.id,
      ticketId: t.id,
      actorId: log.actorId || null,
      actorName: log.actorName,
      actorRole: log.actorRole,
      action: log.action,
      oldValue: log.oldValue || null,
      newValue: log.newValue || null,
      details: log.details || null,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      customerName: t.customerName,
      customerEmail: t.customerEmail,
      assignedTo: agent,
      assignedToId: t.assignedToId,
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.createdAt.toISOString(),
      firstResponseAt: t.firstResponseAt?.toISOString() || null,
      resolvedAt: t.resolvedAt?.toISOString() || null,
      closedAt: t.closedAt?.toISOString() || null,
      slaReplyDue: t.slaReplyDue.toISOString(),
      slaResolveDue: t.slaResolveDue.toISOString(),
      slaReplyBreached: sla.isReplyLate,
      slaResolveBreached: sla.isResolveLate,
      pausedAt: t.pausedAt?.toISOString() || null,
      totalPausedMs: t.totalPausedMs,
      reopenDeadline: t.reopenDeadline?.toISOString() || null,
      messages: sanitizedMessages,
      auditLogs,
      slaStatus: {
        replyRemainingMinutes: sla.replyRemainingMinutes,
        resolveRemainingMinutes: sla.resolveRemainingMinutes,
        isReplyLate: sla.isReplyLate,
        isResolveLate: sla.isResolveLate,
        isPaused: sla.isPaused,
      },
    };
  }


  static async claimTicket(params: {
    ticketId: string;
    agentId: string;
    expectedVersion?: number;
  }) {
    const { ticketId, agentId, expectedVersion } = params;
    const ticket = memoryState.tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }


    if (ticket.assignedToId && ticket.assignedToId !== agentId) {
      const existingAgent = memoryState.agents.find((a) => a.id === ticket.assignedToId);
      throw new Error(
        `CONCURRENCY CONFLICT: Ticket was already claimed by ${existingAgent?.name || "another agent"}. Both agents cannot take the same ticket.`
      );
    }

    if (expectedVersion !== undefined && ticket.version !== expectedVersion) {
      throw new Error(
        "CONCURRENCY CONFLICT: This ticket was modified by another agent. Please refresh before claiming."
      );
    }

    const agent = memoryState.agents.find((a) => a.id === agentId);
    if (!agent) throw new Error("Agent not found");

    ticket.assignedToId = agentId;
    ticket.version += 1;
    if (ticket.status === "OPEN") {
      ticket.status = "IN_PROGRESS";
    }

    const now = new Date();
    ticket.auditLogs.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorId: agent.id,
      actorName: agent.name,
      actorRole: "AGENT",
      action: "CLAIMED",
      oldValue: "Unassigned",
      newValue: agent.name,
      details: `Atomic assignment to ${agent.name} (Version ${ticket.version}). Prevents duplicate replies (INC-0291).`,
      createdAt: now,
    });

    return ticket;
  }


  static async addMessage(params: {
    ticketId: string;
    senderId?: string | null;
    senderName: string;
    senderRole: "AGENT" | "CUSTOMER";
    isPrivate: boolean;
    body: string;
  }) {
    const { ticketId, senderId, senderName, senderRole, isPrivate, body } = params;
    const ticket = memoryState.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = new Date();


    const verifiedIsPrivate = senderRole === "CUSTOMER" ? false : Boolean(isPrivate);


    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    ticket.messages.push({
      id: messageId,
      senderId: senderId || null,
      senderName,
      senderRole,
      isPrivate: verifiedIsPrivate,
      body,
      createdAt: now,
    });


    if (senderRole === "AGENT" && !verifiedIsPrivate && !ticket.firstResponseAt) {
      ticket.firstResponseAt = now;
      const isLate = now > ticket.slaReplyDue;
      ticket.auditLogs.push({
        id: `audit-${Date.now()}`,
        actorId: senderId || null,
        actorName: senderName,
        actorRole: "AGENT",
        action: "REPLY_SENT",
        details: isLate
          ? `First customer response sent. BREACHED reply SLA (Reply due: ${ticket.slaReplyDue.toISOString()}).`
          : `First customer response sent within SLA deadline.`,
        createdAt: now,
      });
    } else if (senderRole === "AGENT" && verifiedIsPrivate) {

      ticket.auditLogs.push({
        id: `audit-${Date.now()}`,
        actorId: senderId || null,
        actorName: senderName,
        actorRole: "AGENT",
        action: "NOTE_ADDED",
        details: `Private team note logged. (Strictly restricted from customer view to prevent INC-0304).`,
        createdAt: now,
      });
    }


    if (senderRole === "CUSTOMER" && ticket.status === "WAITING_ON_CUSTOMER" && ticket.pausedAt) {
      const { newReplyDue, newResolveDue, pausedWorkingMinutes } = resumeDeadlinesAfterPause(
        ticket.slaReplyDue,
        ticket.slaResolveDue,
        ticket.pausedAt,
        now
      );

      const pauseDurationMs = now.getTime() - ticket.pausedAt.getTime();
      ticket.totalPausedMs += pauseDurationMs;
      ticket.slaReplyDue = newReplyDue;
      ticket.slaResolveDue = newResolveDue;
      ticket.pausedAt = null;
      ticket.status = "IN_PROGRESS";

      ticket.auditLogs.push({
        id: `audit-${Date.now()}-resumed`,
        actorId: null,
        actorName: senderName,
        actorRole: "CUSTOMER",
        action: "STATUS_CHANGED",
        oldValue: "WAITING_ON_CUSTOMER",
        newValue: "IN_PROGRESS",
        details: `Customer replied. SLA timer resumed. Deadlines extended by ${pausedWorkingMinutes} business minutes (Customer waiting time does not count against Arvo).`,
        createdAt: now,
      });
    }

    ticket.version += 1;
    return ticket;
  }


  static async updateStatus(params: {
    ticketId: string;
    newStatus: TicketStatus;
    actorName: string;
    actorRole: "AGENT" | "CUSTOMER" | "ADMIN" | "SYSTEM";
    actorId?: string;
  }) {
    const { ticketId, newStatus, actorName, actorRole, actorId } = params;
    const ticket = memoryState.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const oldStatus = ticket.status;
    if (oldStatus === newStatus) return ticket;

    const now = new Date();

    if (
      (oldStatus === "RESOLVED" || oldStatus === "CLOSED") &&
      (newStatus === "OPEN" || newStatus === "IN_PROGRESS")
    ) {
      const reopenCheck = canReopenTicket(ticket.resolvedAt, now);
      if (!reopenCheck.allowed) {
        throw new Error(reopenCheck.reason);
      }
      ticket.resolvedAt = null;
      ticket.closedAt = null;
      ticket.reopenDeadline = null;
    }


    if (newStatus === "WAITING_ON_CUSTOMER") {
      ticket.pausedAt = now;
    }


    if (newStatus === "RESOLVED") {
      ticket.resolvedAt = now;

      ticket.reopenDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (ticket.pausedAt) {
        ticket.pausedAt = null;
      }
    }


    if (newStatus === "CLOSED") {
      ticket.closedAt = now;
      if (ticket.pausedAt) ticket.pausedAt = null;
    }

    ticket.status = newStatus;
    ticket.version += 1;

    ticket.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actorId || null,
      actorName,
      actorRole,
      action: "STATUS_CHANGED",
      oldValue: oldStatus,
      newValue: newStatus,
      details:
        newStatus === "WAITING_ON_CUSTOMER"
          ? "Status changed to WAITING_ON_CUSTOMER. SLA timer paused."
          : newStatus === "RESOLVED"
            ? "Ticket marked as resolved. 7-day customer reopening window initiated."
            : `Status changed from ${oldStatus} to ${newStatus}.`,
      createdAt: now,
    });

    return ticket;
  }


  static async updatePriority(params: {
    ticketId: string;
    newPriority: Priority;
    actorName: string;
    actorId?: string;
  }) {
    const { ticketId, newPriority, actorName, actorId } = params;
    const ticket = memoryState.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const oldPriority = ticket.priority;
    if (oldPriority === newPriority) return ticket;

    const now = new Date();

    const newTargets = calculateInitialSla(newPriority, now);
    const oldReplyDue = ticket.slaReplyDue;
    const oldResolveDue = ticket.slaResolveDue;

    ticket.priority = newPriority;
    ticket.slaReplyDue = newTargets.replyDue;
    ticket.slaResolveDue = newTargets.resolveDue;
    ticket.version += 1;

    ticket.auditLogs.push({
      id: `audit-${Date.now()}`,
      actorId: actorId || null,
      actorName,
      actorRole: "AGENT",
      action: "PRIORITY_CHANGED",
      oldValue: oldPriority,
      newValue: newPriority,
      details: `Priority changed from ${oldPriority} to ${newPriority}. SLA deadlines recalculated from change timestamp: Reply due at ${ticket.slaReplyDue.toLocaleTimeString()}, Resolution due at ${ticket.slaResolveDue.toLocaleTimeString()}.`,
      createdAt: now,
    });

    return ticket;
  }


  static async createTicket(params: {
    title: string;
    description: string;
    priority: Priority;
    customerName: string;
    customerEmail: string;
  }) {
    const now = new Date();
    const count = memoryState.tickets.length + 1;
    const ticketNumber = `INC-0${320 + count}`;
    const id = `ticket-${Date.now()}`;

    const sla = calculateInitialSla(params.priority, now);

    const newTicket: SeedTicket = {
      id,
      ticketNumber,
      title: params.title,
      description: params.description,
      priority: params.priority,
      status: "OPEN",
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      assignedToId: null,
      version: 1,
      createdAt: now,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      slaReplyDue: sla.replyDue,
      slaResolveDue: sla.resolveDue,
      pausedAt: null,
      totalPausedMs: 0,
      reopenDeadline: null,
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderName: params.customerName,
          senderRole: "CUSTOMER",
          isPrivate: false,
          body: params.description,
          createdAt: now,
        },
      ],
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          actorName: params.customerName,
          actorRole: "CUSTOMER",
          action: "CREATED",
          details: `Ticket created with ${params.priority} urgency. Reply due by ${sla.replyDue.toLocaleString()}, Resolve due by ${sla.resolveDue.toLocaleString()}.`,
          createdAt: now,
        },
      ],
    };

    memoryState.tickets.unshift(newTicket);
    return newTicket;
  }


  static async getAgents(): Promise<SeedAgent[]> {
    return memoryState.agents;
  }
}
