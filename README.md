# Frontdesk – Support Operations Platform for Arvo Systems

**Frontdesk** is a modern, full-stack customer support and SLA management system built to replace Arvo Systems' legacy spreadsheet-and-WhatsApp workflow. It provides real-time working-hours SLA tracking, atomic concurrency guards against duplicate ticket handling, strict data isolation for private internal notes, and an immutable audit trail for complete non-repudiation.

---

## 🚀 Live Demo & Key Highlights

- **Live URL**: *(Add your deployed URL here, e.g. Vercel / Render / Fly.io)*
- **Repository**: *(Add your GitHub repository URL here)*
- **Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, PostgreSQL, Prisma 7, Lucide Icons.

---

## 🧠 Business Logic & Extracted Rules

The system implements the exact business requirements extracted from Arvo Systems' first project meeting notes and past incident reports:

### 1. Working-Hours SLA Engine (Mon–Fri, 09:30 – 18:30)
- **Schedule**: Timers only advance during active working hours (**9:30 AM – 6:30 PM**, 9 working hours/day).
- **Weekends & Holidays**: Saturday, Sunday, and configured festival holidays (e.g. Republic Day, Diwali, Christmas) are non-working periods. A ticket arriving Friday at 18:00 has consumed only 30 minutes by Monday 09:30 and will **not** be marked late over the weekend.
- **Priority Tiers & Deadlines**:
  - **URGENT** (*"Customer cannot work at all"*):
    - First reply: **within 2 working hours**.
    - Resolution: **by end of same working day (18:30)**.
  - **MEDIUM**:
    - First reply: **within 4.5 working hours** (half working day).
    - Resolution: **within 3 working days** (27 working hours).
  - **LOW** (*"Small questions or minor requests"*):
    - First reply: **within 1 working day** (9 working hours).
    - Resolution: **within 5 working days** (~1 working week / 45 working hours).

### 2. Pausing the SLA Clock (`WAITING_ON_CUSTOMER`)
- When an agent asks a clarifying question, the ticket status shifts to `WAITING_ON_CUSTOMER`.
- The SLA clock pauses immediately. When the customer replies, the exact business minutes paused are calculated and the SLA reply/resolve deadlines are automatically extended forward so waiting time never counts against Arvo.

### 3. Inactivity Auto-Close & Reopening Windows
- **Auto-Close**: If a customer does not reply for **1 working week (5 working days / 45 working hours)**, the system automatically closes the ticket.
- **Reopen Window**: A resolved ticket can be reopened by the customer within **7 calendar days**. Beyond 7 days, reopening is blocked and the customer must open a new ticket.

### 4. Handling Mid-Flight Priority Changes
- *The First Meeting Question*: *"What happens to the timer if we change a ticket to urgent in the middle?"*
- *Solution*: If upgraded to **URGENT**, remaining SLA deadlines are recalculated from the exact moment of the priority change (2 business hours for first response if not already responded, and end of the current working day for resolution). The recalculation is logged as an immutable audit event explaining the new targets.

---

## 🛡️ Resolution of Past Incidents

| Incident | Root Cause in Legacy System | Frontdesk Architectural Solution |
| :--- | :--- | :--- |
| **INC-0291** (14 Oct)<br>Double Assignment & Conflicting Answers | Two agents clicked "take this ticket" at the same time in the spreadsheet. | **Atomic Ticket Claiming**: Utilizes optimistic concurrency control (`version` check). When an agent claims a ticket, any subsequent or concurrent claim from another agent is rejected with a `409 Concurrency Conflict`. |
| **INC-0304** (22 Oct)<br>Private Note Leaked to Customer | Agent's internal team note was accidentally sent to customer. | **Strict Data & API Isolation**: Database separates `CUSTOMER_REPLY` from `INTERNAL_NOTE` (`isPrivate: true`). Customer-facing APIs and serializers strictly filter out internal notes (`sanitizeMessagesForRole`). UI highlights internal notes in distinct yellow warning cards with lock icons. |
| **INC-0318** (04 Nov)<br>SLA & Response Timestamp Dispute | Customer claimed reply took until next morning; Arvo claimed 40 minutes. No proof. | **Immutable Chronological Audit Trail**: Append-only `ticket_audit_logs` table records every state transition, assignment, message sent, note added, and clock pause with ISO UTC timestamps and actor identification. Updates and deletions are barred. |

---

## 🛠️ Local Development & Setup

### Prerequisites
- Node.js >= 18.17 (Node 20 or 22 recommended)
- npm or pnpm

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-link>
cd pla
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/frontdesk?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```
*(Note: Frontdesk includes an automatic fallback data layer so reviewers can run and test the complete UI and APIs immediately without setting up a local PostgreSQL instance).*

### 3. Generate Prisma Client & Run Database Migrations
```bash
npx prisma generate
npx prisma db push
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Automated Verification Test Suite
You can verify all business rules, SLA rollovers, atomic concurrency, and incident fixes by visiting:
```
http://localhost:3000/api/test-rules
```
This returns a real-time JSON report confirming all 7 core tests pass.

---

## 📝 Short Submission Note (Section 5 & 6)

### Question: *What did you not finish, and why?*

**1. Cron-Based Daemon vs. On-Access Evaluation for Inactivity Auto-Close:**
- *What was skipped:* A dedicated external background worker (such as Redis/BullMQ or a Celery cron process) running 24/7 to auto-close inactive tickets.
- *Why:* To preserve a single-container zero-maintenance deployment footprint suitable for free-tier serverless hosting (e.g. Vercel/Render). Inactivity expiration is evaluated dynamically on ticket retrieval and status transitions. In a multi-service production environment, a scheduled serverless cron (e.g. Vercel Cron or AWS EventBridge) would trigger a `/api/cron/auto-close` worker every hour.

**2. Dynamic Multi-Region Holiday Calendar API Integration:**
- *What was skipped:* Live sync with external government holiday calendar APIs for multi-regional support teams.
- *Why:* Given the 8-hour scope, festival holidays are maintained in a clean, configurable holiday registry (`src/lib/sla.ts`). This satisfied Arvo Systems' immediate requirement without introducing external network latency or API rate limits.

**3. Real-Time WebSockets for Live Ticket Locking:**
- *What was skipped:* WebSocket / SSE pub-sub server for instantaneous live updates across multiple open browser tabs.
- *Why:* True atomic locking was implemented at the database/repository level using optimistic concurrency versioning (rejecting double-claims immediately). Adding WebSocket infrastructure would require sticky sessions or Redis Pub/Sub, which exceeds the scope of an 8-hour sprint.
