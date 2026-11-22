import { Priority, TicketStatus } from "./types";

export const WORK_START_HOUR = 9;
export const WORK_START_MINUTE = 30;
export const WORK_END_HOUR = 18;
export const WORK_END_MINUTE = 30;


export const WORK_DAY_MINUTES = 540;


export const DEFAULT_HOLIDAYS = new Set<string>([
  "2026-01-01",
  "2026-01-26",
  "2026-05-01",
  "2026-08-15",
  "2026-10-02",
  "2026-10-20",
  "2026-11-08",
  "2026-12-25",
]);


export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


export function isWorkingDay(d: Date, holidays: Set<string> = DEFAULT_HOLIDAYS): boolean {
  const dayOfWeek = d.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  if (holidays.has(toDateString(d))) {
    return false;
  }
  return true;
}


export function getWorkDayStart(d: Date): Date {
  const start = new Date(d);
  start.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);
  return start;
}


export function getWorkDayEnd(d: Date): Date {
  const end = new Date(d);
  end.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0);
  return end;
}

export function getNextBusinessInstant(d: Date, holidays: Set<string> = DEFAULT_HOLIDAYS): Date {
  let current = new Date(d);

  while (true) {
    if (!isWorkingDay(current, holidays)) {

      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      continue;
    }

    const dayStart = getWorkDayStart(current);
    const dayEnd = getWorkDayEnd(current);

    if (current < dayStart) {

      return dayStart;
    }

    if (current >= dayEnd) {

      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      continue;
    }


    return current;
  }
}


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

      current.setDate(current.getDate() + 1);
      current = getWorkDayStart(current);
      current = getNextBusinessInstant(current, holidays);
    }
  }

  return current;
}


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


    current.setDate(current.getDate() + 1);
    current = getWorkDayStart(current);
    current = getNextBusinessInstant(current, holidays);
  }

  return totalMinutes;
}


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
      replyMinutes = 120;
      const sameDayEnd = getWorkDayEnd(effectiveStart);
      return {
        replyDue: addWorkingMinutes(effectiveStart, replyMinutes, holidays),
        resolveDue: sameDayEnd,
      };

    case "MEDIUM":
      replyMinutes = 270;
      resolveMinutes = 3 * WORK_DAY_MINUTES;
      break;

    case "LOW":
      replyMinutes = 1 * WORK_DAY_MINUTES;
      resolveMinutes = 5 * WORK_DAY_MINUTES;
      break;
  }

  return {
    replyDue: addWorkingMinutes(effectiveStart, replyMinutes, holidays),
    resolveDue: addWorkingMinutes(effectiveStart, resolveMinutes, holidays),
  };
}


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

export function isEligibleForAutoClose(
  pausedAt: Date | null,
  now: Date = new Date(),
  holidays: Set<string> = DEFAULT_HOLIDAYS
): boolean {
  if (!pausedAt) return false;
  const waitingWorkingMinutes = calculateWorkingMinutesBetween(pausedAt, now, holidays);

  return waitingWorkingMinutes >= 5 * WORK_DAY_MINUTES;
}


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


  let isReplyLate = false;
  let replyRemainingMinutes = 0;

  if (ticket.firstResponseAt) {
    isReplyLate = ticket.firstResponseAt > ticket.slaReplyDue;
    replyRemainingMinutes = 0;
  } else {
    if (isPaused) {

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
