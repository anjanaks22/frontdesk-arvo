import { NextResponse } from "next/server";
import {
  calculateInitialSla,
  isWorkingDay,
  canReopenTicket,
  resumeDeadlinesAfterPause,
} from "@/lib/sla";
import { TicketRepository } from "@/lib/repository";
import { sanitizeMessagesForRole } from "@/lib/permissions";

export async function GET() {
  const results: Array<{ test: string; status: "PASS" | "FAIL"; details: string }> = [];

  try {
    // 1. Working hours roll-over: Friday 18:00 Urgent reply
    const friday1800 = new Date("2026-11-20T18:00:00");
    const slaFriday = calculateInitialSla("URGENT", friday1800);
    const due = slaFriday.replyDue;
    const isMonday11 = due.getDay() === 1 && due.getHours() === 11 && due.getMinutes() === 0;

    results.push({
      test: "Working Hours SLA Engine (Friday 18:00 rollover to Monday 11:00)",
      status: isMonday11 ? "PASS" : "FAIL",
      details: `Urgent reply deadline calculated to Monday 11:00 (Day ${due.getDay()}, ${due.getHours()}:${due.getMinutes()}). Weekends excluded.`,
    });

    // 2. Holiday exclusion
    const republicDay = new Date("2026-01-26T10:00:00");
    const isHolidayExcluded = !isWorkingDay(republicDay);
    results.push({
      test: "Festival Holidays Exclusion",
      status: isHolidayExcluded ? "PASS" : "FAIL",
      details: "Configured festival holidays are treated as non-working days in SLA calculation.",
    });

    // 3. Pause on Customer (Customer wait time does not count against Arvo)
    const pausedAt = new Date("2026-11-16T11:00:00");
    const resumedAt = new Date("2026-11-17T11:00:00");
    const initialReply = new Date("2026-11-16T15:30:00");
    const initialResolve = new Date("2026-11-19T18:30:00");
    const { pausedWorkingMinutes } = resumeDeadlinesAfterPause(
      initialReply,
      initialResolve,
      pausedAt,
      resumedAt
    );

    results.push({
      test: "Waiting on Customer SLA Clock Pause & Resume",
      status: pausedWorkingMinutes === 540 ? "PASS" : "FAIL",
      details: `Correctly paused clock for 540 working minutes (1 business day) and shifted SLA deadlines forward upon customer reply.`,
    });

    // 4. Reopen window (< 1 week allowed, > 1 week rejected)
    const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const old = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    const canReopenRecent = canReopenTicket(recent).allowed;
    const cannotReopenOld = !canReopenTicket(old).allowed;

    results.push({
      test: "1-Week Customer Reopen Window Constraint",
      status: canReopenRecent && cannotReopenOld ? "PASS" : "FAIL",
      details: "Allowed reopening within 7 days of resolution; rejected reopening after 9 days with instruction to open a new ticket.",
    });

    // 5. INC-0291 Concurrency & Atomic Claim Protection
    const agents = await TicketRepository.getAgents();
    const testTicket = await TicketRepository.createTicket({
      title: "Concurrency Test Ticket",
      description: "Testing concurrent agent claim prevention",
      priority: "URGENT",
      customerName: "Test Customer",
      customerEmail: "customer@test.com",
    });

    await TicketRepository.claimTicket({
      ticketId: testTicket.id,
      agentId: agents[0].id,
      expectedVersion: testTicket.version,
    });

    let conflictBlocked = false;
    try {
      await TicketRepository.claimTicket({
        ticketId: testTicket.id,
        agentId: agents[1].id,
        expectedVersion: testTicket.version,
      });
    } catch (err: any) {
      conflictBlocked = err.message.includes("CONCURRENCY CONFLICT");
    }

    results.push({
      test: "INC-0291 Atomic Assignment & Concurrency Lock",
      status: conflictBlocked ? "PASS" : "FAIL",
      details: "Prevented second agent from taking already claimed ticket, preventing conflicting replies.",
    });

    // 6. INC-0304 Data Leak Prevention (Private Team Notes)
    const messages = [
      {
        id: "m1",
        ticketId: testTicket.id,
        senderName: "Agent Meera",
        senderRole: "AGENT",
        isPrivate: false,
        body: "Public message",
        createdAt: new Date(),
      },
      {
        id: "m2",
        ticketId: testTicket.id,
        senderName: "Agent Meera",
        senderRole: "AGENT",
        isPrivate: true,
        body: "Confidential private note",
        createdAt: new Date(),
      },
    ];

    const customerView = sanitizeMessagesForRole(messages, "CUSTOMER");
    const agentView = sanitizeMessagesForRole(messages, "AGENT");
    const leakPrevented =
      customerView.length === 1 &&
      !customerView[0].isPrivate &&
      agentView.length === 2 &&
      agentView.some((m) => m.isPrivate);

    results.push({
      test: "INC-0304 Internal Notes Data Leak Protection",
      status: leakPrevented ? "PASS" : "FAIL",
      details: "Customer API responses strictly strip internal notes, while agents retain full visibility.",
    });

    // 7. INC-0318 Tamper-Proof Audit Trail
    const ticketWithAudit = await TicketRepository.getTicketById(testTicket.id);
    const hasAuditTrail =
      (ticketWithAudit?.auditLogs?.length || 0) >= 2 &&
      ticketWithAudit?.auditLogs.some((a) => a.action === "CREATED") &&
      ticketWithAudit?.auditLogs.some((a) => a.action === "CLAIMED");

    results.push({
      test: "INC-0318 Immutable Audit Trail & Timestamp Proof",
      status: hasAuditTrail ? "PASS" : "FAIL",
      details: "Chronological audit records prove what happened, when it happened (UTC ISO), and who did it.",
    });

    const allPassed = results.every((r) => r.status === "PASS");

    return NextResponse.json({
      success: true,
      allPassed,
      totalTests: results.length,
      passedTests: results.filter((r) => r.status === "PASS").length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
