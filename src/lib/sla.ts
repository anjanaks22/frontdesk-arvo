import { Priority, TicketStatus } from "./types";

export const WORK_START_HOUR = 9;
export const WORK_START_MINUTE = 30;
export const WORK_END_HOUR = 18;
export const WORK_END_MINUTE = 30;

// 9 hours = 540 minutes per working day
export const WORK_DAY_MINUTES = 540;

// Standard festival holidays (can be customized or pulled from config)
export const DEFAULT_HOLIDAYS = new Set<string>([
  "2026-01-01", // New Year's Day
  "2026-01-26", // Republic Day
  "2026-05-01", // May Day
  "2026-08-15", // Independence Day
  "2026-10-02", // Gandhi Jayanti
  "2026-10-20", // Dussehra / Festival
  "2026-11-08", // Diwali / Deepavali
  "2026-12-25", // Christmas
]);

/** Format date to YYYY-MM-DD */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Check if given calendar date is a working day (Mon-Fri and not a holiday) */
export function isWorkingDay(d: Date, holidays: Set<string> = DEFAULT_HOLIDAYS): boolean {
  const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  if (holidays.has(toDateString(d))) {
    return false;
  }
  return true;
}

/** Returns 09:30 AM for the given date */
export function getWorkDayStart(d: Date): Date {
  const start = new Date(d);
  start.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
  return start;
}

/** Returns 18:30 (6:30 PM) for the given date */
export function getWorkDayEnd(d: Date): Date {
  const end = new Date(d);
  end.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0);
  return end;
}

/** If a timestamp falls on weekend, holiday, or outside 9:30-18:30, advance to next active business moment */
export function getNextBusinessInstant(d: Date, holidays: Set<string> = DEFAULT_HOLIDAYS): Date {
  let current = new Date(d);

  while (true) {
    if (!isWorkingDay(current, holidays)) {
      // Advance to 09:30 of next calendar day
      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      continue;
    }

    const dayStart = getWorkDayStart(current);
    const dayEnd = getWorkDayEnd(current);

    if (current < dayStart) {
      // Arrived before 9:30 on working day, snaps to 9:30
      return dayStart;
    }

    if (current >= dayEnd) {
      // Arrived at or after 18:30, advance to 09:30 next calendar day
      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      continue;
    }

    // Inside 9:30 to 18:30 on a working day
    return current;
  }
}

/** Add business minutes to a date, skipping weekends, holidays, and outside-hours */
export function addWorkingMinutes(
  startDate: Date,
  minutesToAdd: number,
  holidays: Set<string> = DEFAULT_HOLIDAYS
): Date {
  let current = getNextBusinessInstant(startDate, holidays);
  let remainingMinutes = minutesToAdd;

  while (remainingMinutes > 0) {
    const dayEnd = getWorkDayEnd(current);
    const minutesLeftToday = (dayEnd.getTime() - current.getTime()) / (1000 * 60);

    if (remainingMinutes <= minutesLeftToday) {
      return new Date(current.getTime() + remainingMinutes * 60 * 1000);
    } else {
      remainingMinutes -= minutesLeftToday;
      // Move to 9:30 of next working day
      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      current = getNextBusinessInstant(current, holidays);
    }
  }

  return current;
}

/** Calculate working minutes elapsed between two dates */
export function calculateWorkingMinutesBetween(
  startDate: Date,
  endDate: Date,
  holidays: Set<string> = DEFAULT_HOLIDAYS
): number {
  if (startDate >= endDate) return 0;

  let current = getNextBusinessInstant(startDate, holidays);
  let totalMinutes = 0;

  while (current < endDate) {
    if (!isWorkingDay(current, holidays)) {
      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      current = getNextBusinessInstant(current, holidays);
      continue;
    }

    const dayEnd = getWorkDayEnd(current);
    const windowEnd = endDate < dayEnd ? endDate : dayEnd;

    if (windowEnd > current) {
      totalMinutes += Math.round((windowEnd.getTime() - current.getTime()) / (1000 * 60));
    }

    if (endDate <= dayEnd) {
      break;
    }

    // Advance to next day 09:30
    current.setDate(current.getDate() + 1);
    current = getWorkDayStart(current);
    current = getNextBusinessInstant(current, holidays);
  }

  return totalMinutes;
}

/**
 * Compute initial SLA targets according to Meera's rules:
 * - URGENT:
 *     First reply: 2 working hours (120 minutes)
 *     Resolution: Same working day (18:30)
 * - MEDIUM:
 *     First reply: Half day (4.5 working hours = 270 minutes)
 *     Resolution: 3 working days (27 working hours = 1620 minutes)
 * - LOW:
 *     First reply: 1 working day (9 working hours = 540 minutes)
 *     Resolution: 1 working week (5 working days = 45 working hours = 2700 minutes)
 */
export function calculateInitialSla(
  priority: Priority,
  createdAt: Date = new Date(),
  holidays: Set<string> = DEFAULT_HOLIDAYS
): { replyDue: Date; resolveDue: Date } {
  const effectiveStart = getNextBusinessInstant(createdAt, holidays);

  let replyMinutes = 270;
  let resolveMinutes = 1620;

  switch (priority) {
    case "URGENT":
      replyMinutes = 120; // 2 working hours
      // "fix it the same working day": end of that business day (18:30)
      const sameDayEnd = getWorkDayEnd(effectiveStart);
      return {
        replyDue: addWorkingMinutes(effectiveStart, replyMinutes, holidays),
        resolveDue: sameDayEnd,
      };

    case "MEDIUM":
      replyMinutes = 270; // 4.5 hours = half day
      resolveMinutes = 3 * WORK_DAY_MINUTES; // 3 working days
      break;

    case "LOW":
      replyMinutes = 1 * WORK_DAY_MINUTES; // 1 working day
      resolveMinutes = 5 * WORK_DAY_MINUTES; // 1 working week (5 working days)
      break;
  }

  return {
    replyDue: addWorkingMinutes(effectiveStart, replyMinutes, holidays),
    resolveDue: addWorkingMinutes(effectiveStart, resolveMinutes, holidays),
  };
}

/**
 * Handle pause when moving to WAITING_ON_CUSTOMER and resumption on customer reply
 */
export function resumeDeadlinesAfterPause(
  oldReplyDue: Date,
  oldResolveDue: Date,
  pausedAt: Date,
  resumedAt: Date,
  holidays: Set<string> = DEFAULT_HOLIDAYS
): { newReplyDue: Date; newResolveDue: Date; pausedWorkingMinutes: number } {
  const pausedWorkingMinutes = calculateWorkingMinutesBetween(pausedAt, resumedAt, holidays);

  return {
    newReplyDue: addWorkingMinutes(oldReplyDue, pausedWorkingMinutes, holidays),
    newResolveDue: addWorkingMinutes(oldResolveDue, pausedWorkingMinutes, holidays),
    pausedWorkingMinutes,
  };
}

/** Check if ticket in WAITING_ON_CUSTOMER has exceeded 1 working week (~45 working hours) of inactivity */
export function isEligibleForAutoClose(
  pausedAt: Date | null,
  now: Date = new Date(),
  holidays: Set<string> = DEFAULT_HOLIDAYS
): boolean {
  if (!pausedAt) return false;
  const waitingWorkingMinutes = calculateWorkingMinutesBetween(pausedAt, now, holidays);
  // 5 working days = 45 working hours = 2700 minutes
  return waitingWorkingMinutes >= 5 * WORK_DAY_MINUTES;
}

/** Check if ticket can be reopened (Within 7 calendar days after being resolved) */
export function canReopenTicket(resolvedAt: Date | null, now: Date = new Date()): {
  allowed: boolean;
  reason?: string;
} {
  if (!resolvedAt) {
    return { allowed: true };
  }
  const diffMs = now.getTime() - resolvedAt.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  if (diffMs > sevenDaysMs) {
    return {
      allowed: false,
      reason:
        "More than one week has elapsed since this ticket was resolved. A new ticket must be opened.",
    };
  }

  return { allowed: true };
}

/**
 * Real-time SLA Status Evaluation for UI and APIs
 */
export function evaluateTicketSla(ticket: {
  status: TicketStatus;
  priority: Priority;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  slaReplyDue: Date;
  slaResolveDue: Date;
  pausedAt: Date | null;
  now?: Date;
  holidays?: Set<string>;
}) {
  const now = ticket.now ?? new Date();
  const holidays = ticket.holidays ?? DEFAULT_HOLIDAYS;

  const isPaused = ticket.status === "WAITING_ON_CUSTOMER";
  const isDone = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  // Reply SLA Evaluation
  let isReplyLate = false;
  let replyRemainingMinutes = 0;

  if (ticket.firstResponseAt) {
    isReplyLate = ticket.firstResponseAt > ticket.slaReplyDue;
    replyRemainingMinutes = 0;
  } else {
    if (isPaused) {
      // Clock is paused at pausedAt
      const checkPoint = ticket.pausedAt ?? now;
      isReplyLate = checkPoint > ticket.slaReplyDue;
      replyRemainingMinutes = Math.max(
        0,
        calculateWorkingMinutesBetween(checkPoint, ticket.slaReplyDue, holidays)
      );
    } else {
      isReplyLate = now > ticket.slaReplyDue;
      replyRemainingMinutes = isReplyLate
        ? -calculateWorkingMinutesBetween(ticket.slaReplyDue, now, holidays)
        : calculateWorkingMinutesBetween(now, ticket.slaReplyDue, holidays);
    }
  }

  // Resolve SLA Evaluation
  let isResolveLate = false;
  let resolveRemainingMinutes = 0;

  if (ticket.resolvedAt) {
    isResolveLate = ticket.resolvedAt > ticket.slaResolveDue;
    resolveRemainingMinutes = 0;
  } else if (!isDone) {
    if (isPaused) {
      const checkPoint = ticket.pausedAt ?? now;
      isResolveLate = checkPoint > ticket.slaResolveDue;
      resolveRemainingMinutes = Math.max(
        0,
        calculateWorkingMinutesBetween(checkPoint, ticket.slaResolveDue, holidays)
      );
    } else {
      isResolveLate = now > ticket.slaResolveDue;
      resolveRemainingMinutes = isResolveLate
        ? -calculateWorkingMinutesBetween(ticket.slaResolveDue, now, holidays)
        : calculateWorkingMinutesBetween(now, ticket.slaResolveDue, holidays);
    }
  }

  return {
    isReplyLate,
    isResolveLate,
    replyRemainingMinutes,
    resolveRemainingMinutes,
    isPaused,
    isLate: isReplyLate || isResolveLate,
  };
}
