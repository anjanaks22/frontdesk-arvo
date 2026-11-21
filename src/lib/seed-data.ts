import { Priority, TicketStatus } from "./types";
import { calculateInitialSla } from "./sla";

export interface SeedAgent {
  id: string;
  name: string;
  email: string;
  role: "AGENT";
  avatarUrl: string;
}

export const ARVO_AGENTS: SeedAgent[] = [
  { id: "agent-1", name: "Meera Nair (Lead)", email: "meera@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Meera" },
  { id: "agent-2", name: "Rahul Sharma", email: "rahul@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul" },
  { id: "agent-3", name: "Ananya Iyer", email: "ananya@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya" },
  { id: "agent-4", name: "David Mathew", email: "david@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=David" },
  { id: "agent-5", name: "Sarah Khan", email: "sarah@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" },
  { id: "agent-6", name: "Vikram Menon", email: "vikram@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram" },
  { id: "agent-7", name: "Priya Varma", email: "priya@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya" },
  { id: "agent-8", name: "Arjun Das", email: "arjun@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun" },
  { id: "agent-9", name: "Sneha Pillai", email: "sneha@arvo.com", role: "AGENT", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha" },
];

export interface SeedTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  customerName: string;
  customerEmail: string;
  assignedToId: string | null;
  version: number;
  createdAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  slaReplyDue: Date;
  slaResolveDue: Date;
  pausedAt: Date | null;
  totalPausedMs: number;
  reopenDeadline: Date | null;
  messages: Array<{
    id: string;
    senderId?: string | null;
    senderName: string;
    senderRole: string;
    isPrivate: boolean;
    body: string;
    createdAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    actorId?: string | null;
    actorName: string;
    actorRole: string;
    action: string;
    oldValue?: string | null;
    newValue?: string | null;
    details?: string | null;
    createdAt: Date;
  }>;
}

export function generateSeedTickets(): SeedTicket[] {
  const now = new Date();

  // Friday ticket scenario from Meera's quote:
  // Arrived Friday at 6:00 PM (18:00). SLA must NOT breach over the weekend!
  const fridayCreated = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  fridayCreated.setHours(18, 0, 0, 0);
  const fridaySla = calculateInitialSla("URGENT", fridayCreated);

  // INC-0291 Replica: Unassigned urgent ticket testing atomic claim
  const t1Created = new Date(now.getTime() - 45 * 60 * 1000); // 45 min ago
  const t1Sla = calculateInitialSla("URGENT", t1Created);

  // INC-0304 Replica: Ticket with confidential internal note
  const t2Created = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const t2Sla = calculateInitialSla("MEDIUM", t2Created);

  // Ticket in WAITING_ON_CUSTOMER (Paused)
  const t3Created = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const t3Sla = calculateInitialSla("LOW", t3Created);
  const t3Paused = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  // Ticket that is already LATE / BREACHED
  const t4Created = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const t4Sla = calculateInitialSla("URGENT", t4Created);

  return [
    {
      id: "ticket-1",
      ticketNumber: "INC-0320",
      title: "Production database connection pool exhausted",
      description: "Our payment gateway service is unable to connect to the database. All transactions are failing. Cannot work at all.",
      priority: "URGENT",
      status: "OPEN",
      customerName: "Karthik Raja",
      customerEmail: "karthik@fintech.io",
      assignedToId: null, // Open to test race condition / claim
      version: 1,
      createdAt: t1Created,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      slaReplyDue: t1Sla.replyDue,
      slaResolveDue: t1Sla.resolveDue,
      pausedAt: null,
      totalPausedMs: 0,
      reopenDeadline: null,
      messages: [
        {
          id: "m-1",
          senderId: null,
          senderName: "Karthik Raja",
          senderRole: "CUSTOMER",
          isPrivate: false,
          body: "Our payment gateway service is unable to connect to the database. All transactions are failing. Cannot work at all.",
          createdAt: t1Created,
        },
      ],
      auditLogs: [
        {
          id: "a-1",
          actorId: null,
          actorName: "Karthik Raja (Customer)",
          actorRole: "CUSTOMER",
          action: "CREATED",
          details: "Ticket opened with priority URGENT. First reply SLA: 2 business hours.",
          createdAt: t1Created,
        },
      ],
    },
    {
      id: "ticket-2",
      ticketNumber: "INC-0304-FIXED",
      title: "Billing dispute & invoice reconciliation",
      description: "The enterprise plan annual renewal was charged twice on our corporate card.",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      customerName: "Radhika Sen",
      customerEmail: "radhika@enterprise.com",
      assignedToId: "agent-1",
      version: 2,
      createdAt: t2Created,
      firstResponseAt: new Date(t2Created.getTime() + 30 * 60 * 1000),
      resolvedAt: null,
      closedAt: null,
      slaReplyDue: t2Sla.replyDue,
      slaResolveDue: t2Sla.resolveDue,
      pausedAt: null,
      totalPausedMs: 0,
      reopenDeadline: null,
      messages: [
        {
          id: "m-2",
          senderId: null,
          senderName: "Radhika Sen",
          senderRole: "CUSTOMER",
          isPrivate: false,
          body: "The enterprise plan annual renewal was charged twice on our corporate card. Please investigate.",
          createdAt: t2Created,
        },
        {
          id: "m-3",
          senderId: "agent-1",
          senderName: "Meera Nair (Lead)",
          senderRole: "AGENT",
          isPrivate: false,
          body: "Hello Radhika, I am actively reviewing your account ledger with our finance team to issue the duplicate reversal.",
          createdAt: new Date(t2Created.getTime() + 30 * 60 * 1000),
        },
        {
          id: "m-4",
          senderId: "agent-1",
          senderName: "Meera Nair (Lead)",
          senderRole: "AGENT",
          isPrivate: true, // INTERNAL NOTE! Verified never sent to customer
          body: "INTERNAL NOTE (INC-0304 Protection): Stripe transaction ID is txn_883920. Gateway retry logic caused the double debit. Refund pending manager authorization.",
          createdAt: new Date(t2Created.getTime() + 35 * 60 * 1000),
        },
      ],
      auditLogs: [
        {
          id: "a-2",
          actorId: null,
          actorName: "Radhika Sen",
          actorRole: "CUSTOMER",
          action: "CREATED",
          details: "Ticket opened with priority MEDIUM.",
          createdAt: t2Created,
        },
        {
          id: "a-3",
          actorId: "agent-1",
          actorName: "Meera Nair (Lead)",
          actorRole: "AGENT",
          action: "CLAIMED",
          details: "Meera Nair claimed the ticket.",
          createdAt: new Date(t2Created.getTime() + 10 * 60 * 1000),
        },
        {
          id: "a-4",
          actorId: "agent-1",
          actorName: "Meera Nair (Lead)",
          actorRole: "AGENT",
          action: "REPLY_SENT",
          details: "First response sent to customer within SLA.",
          createdAt: new Date(t2Created.getTime() + 30 * 60 * 1000),
        },
        {
          id: "a-5",
          actorId: "agent-1",
          actorName: "Meera Nair (Lead)",
          actorRole: "AGENT",
          action: "NOTE_ADDED",
          details: "Private internal team note logged (Restricted visibility).",
          createdAt: new Date(t2Created.getTime() + 35 * 60 * 1000),
        },
      ],
    },
    {
      id: "ticket-3",
      ticketNumber: "INC-0321",
      title: "How to export monthly compliance reports?",
      description: "We need clarification on whether audit logs can be exported as encrypted CSVs.",
      priority: "LOW",
      status: "WAITING_ON_CUSTOMER",
      customerName: "Vikram Singhania",
      customerEmail: "vikram@auditcorp.com",
      assignedToId: "agent-3",
      version: 2,
      createdAt: t3Created,
      firstResponseAt: new Date(t3Created.getTime() + 45 * 60 * 1000),
      resolvedAt: null,
      closedAt: null,
      slaReplyDue: t3Sla.replyDue,
      slaResolveDue: t3Sla.resolveDue,
      pausedAt: t3Paused,
      totalPausedMs: 0,
      reopenDeadline: null,
      messages: [
        {
          id: "m-5",
          senderId: null,
          senderName: "Vikram Singhania",
          senderRole: "CUSTOMER",
          isPrivate: false,
          body: "We need clarification on whether audit logs can be exported as encrypted CSVs.",
          createdAt: t3Created,
        },
        {
          id: "m-6",
          senderId: "agent-3",
          senderName: "Ananya Iyer",
          senderRole: "AGENT",
          isPrivate: false,
          body: "Could you confirm which specific compliance framework (SOC2 or ISO 27001) formatting you require?",
          createdAt: t3Paused,
        },
      ],
      auditLogs: [
        {
          id: "a-6",
          actorId: "agent-3",
          actorName: "Ananya Iyer",
          actorRole: "AGENT",
          action: "STATUS_CHANGED",
          oldValue: "IN_PROGRESS",
          newValue: "WAITING_ON_CUSTOMER",
          details: "Asked clarifying question to customer. SLA clock paused.",
          createdAt: t3Paused,
        },
      ],
    },
    {
      id: "ticket-4",
      ticketNumber: "INC-0318-FIXED",
      title: "API rate limits suddenly blocking all webhook traffic",
      description: "Customer reported webhooks stopped triggering 48 hours ago. Testing SLA breach detection and immutable timestamp proof.",
      priority: "URGENT",
      status: "OPEN",
      customerName: "Aman Gupta",
      customerEmail: "aman@logistics.in",
      assignedToId: "agent-2",
      version: 1,
      createdAt: t4Created,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      slaReplyDue: t4Sla.replyDue,
      slaResolveDue: t4Sla.resolveDue,
      pausedAt: null,
      totalPausedMs: 0,
      reopenDeadline: null,
      messages: [
        {
          id: "m-7",
          senderName: "Aman Gupta",
          senderRole: "CUSTOMER",
          isPrivate: false,
          body: "Webhooks stopped triggering. Our delivery tracking is down.",
          createdAt: t4Created,
        },
      ],
      auditLogs: [
        {
          id: "a-7",
          actorName: "System",
          actorRole: "SYSTEM",
          action: "CREATED",
          details: "INC-0318 proof of timestamp record established.",
          createdAt: t4Created,
        },
      ],
    },
    {
      id: "ticket-5",
      ticketNumber: "INC-0322",
      title: "Friday Evening Urgent Cutover Assistance",
      description: "Submitted at 6:00 PM on Friday. Must NOT breach over the weekend! SLA timer should only run during Monday-Friday 9:30-18:30.",
      priority: "URGENT",
      status: "OPEN",
      customerName: "Siddharth Roy",
      customerEmail: "siddharth@globalretail.com",
      assignedToId: null,
      version: 1,
      createdAt: fridayCreated,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      slaReplyDue: fridaySla.replyDue,
      slaResolveDue: fridaySla.resolveDue,
      pausedAt: null,
      totalPausedMs: 0,
      reopenDeadline: null,
      messages: [
        {
          id: "m-8",
          senderName: "Siddharth Roy",
          senderRole: "CUSTOMER",
          isPrivate: false,
          body: "Submitted at 6:00 PM on Friday. Please verify weekend pause logic.",
          createdAt: fridayCreated,
        },
      ],
      auditLogs: [
        {
          id: "a-8",
          actorName: "System",
          actorRole: "SYSTEM",
          action: "CREATED",
          details: "Ticket registered at Friday 18:00. Weekend paused automatically.",
          createdAt: fridayCreated,
        },
      ],
    },
  ];
}
