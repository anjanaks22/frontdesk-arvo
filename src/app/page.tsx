"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  MessageSquare,
  User,
  Shield,
  Search,
  RefreshCw,
  Plus,
  Send,
  History,
  Info,
  Calendar,
  AlertCircle,
  HelpCircle,
  X,
  ExternalLink,
} from "lucide-react";
import { Priority, TicketDetailDto, TicketStatus } from "@/lib/types";

interface Agent {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export default function AgentDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetailDto | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "late" | "waiting" | "assigned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);


  const [activeTab, setActiveTab] = useState<"messages" | "audit">("messages");
  const [composerMode, setComposerMode] = useState<"public" | "internal">("public");
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);


  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("MEDIUM");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);


  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.agents.length > 0) {
          setAgents(data.agents);
          setCurrentAgent(data.agents[0]);
        }
      })
      .catch((err) => console.error(err));
  }, []);


  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL("/api/tickets", window.location.origin);
      url.searchParams.set("filter", activeFilter);
      if (activeFilter === "assigned" && currentAgent) {
        url.searchParams.set("agentId", currentAgent.id);
      }
      if (searchQuery.trim()) {
        url.searchParams.set("search", searchQuery.trim());
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets);
        if (!selectedTicketId && data.tickets.length > 0) {
          setSelectedTicketId(data.tickets[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, currentAgent, searchQuery, selectedTicketId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);


  const fetchTicketDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/tickets/${id}`);
      const data = await res.json();
      if (data.success) {
        setTicketDetail(data.ticket);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetail(selectedTicketId);
    }
  }, [selectedTicketId, fetchTicketDetail]);


  const handleClaimTicket = async () => {
    if (!ticketDetail || !currentAgent) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: currentAgent.id,
          expectedVersion: ticketDetail.version,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Failed to claim ticket");
      } else {
        setActionSuccess(`Ticket claimed by ${currentAgent.name}`);
        await fetchTicketDetail(ticketDetail.id);
        fetchTickets();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to claim ticket");
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDetail || !currentAgent || !messageText.trim()) return;

    setIsSending(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentAgent.id,
          senderName: currentAgent.name,
          senderRole: "AGENT",
          isPrivate: composerMode === "internal",
          message: messageText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Failed to post message");
      } else {
        setMessageText("");
        setActionSuccess(
          composerMode === "internal"
            ? "Private internal note saved (never visible to customer)."
            : "Reply sent to customer."
        );
        await fetchTicketDetail(ticketDetail.id);
        fetchTickets();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };


  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticketDetail || !currentAgent) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          actorId: currentAgent.id,
          actorName: currentAgent.name,
          actorRole: "AGENT",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Failed to update status");
      } else {
        setActionSuccess(`Status updated to ${newStatus}`);
        await fetchTicketDetail(ticketDetail.id);
        fetchTickets();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update status");
    }
  };


  const handlePriorityChange = async (priority: Priority) => {
    if (!ticketDetail || !currentAgent) return;
    if (
      !confirm(
        `Are you sure you want to change priority to ${priority}? This will recalculate the remaining SLA deadlines and log an audit event.`
      )
    ) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/tickets/${ticketDetail.id}/priority`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority,
          actorId: currentAgent.id,
          actorName: currentAgent.name,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Failed to update priority");
      } else {
        setActionSuccess(`Priority changed to ${priority}. SLA recalculated.`);
        await fetchTicketDetail(ticketDetail.id);
        fetchTickets();
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to update priority");
    }
  };


  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim() || !newCustomerName.trim() || !newCustomerEmail.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          priority: newPriority,
          customerName: newCustomerName.trim(),
          customerEmail: newCustomerEmail.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsNewTicketOpen(false);
        setNewTitle("");
        setNewDesc("");
        setNewCustomerName("");
        setNewCustomerEmail("");
        fetchTickets();
        setSelectedTicketId(data.ticket.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };


  const lateCount = tickets.filter((t) => t.slaStatus?.isLate).length;
  const waitingCount = tickets.filter((t) => t.status === "WAITING_ON_CUSTOMER").length;
  const urgentCount = tickets.filter((t) => t.priority === "URGENT" && t.status !== "RESOLVED" && t.status !== "CLOSED").length;


  const formatSlaCountdown = (remainingMinutes: number, isLate: boolean, isPaused: boolean) => {
    if (isPaused) {
      return (
        <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-semibold border border-amber-200">
          <Clock className="w-3 h-3" /> Paused on Customer
        </span>
      );
    }
    if (isLate) {
      const absMin = Math.abs(remainingMinutes);
      const hours = Math.floor(absMin / 60);
      const mins = absMin % 60;
      return (
        <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs font-bold border border-red-200">
          <AlertTriangle className="w-3 h-3 text-red-600" /> Late by {hours > 0 ? `${hours}h ` : ""}{mins}m
        </span>
      );
    }
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-semibold border border-emerald-200">
        <Clock className="w-3 h-3 text-emerald-600" /> {hours > 0 ? `${hours}h ` : ""}{mins}m left
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      { }
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg tracking-wider text-white shadow-inner">
            FD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight">Frontdesk</h1>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                Arvo Systems Support
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Calendar className="w-3 h-3 text-blue-400" /> Mon-Fri 09:30 - 18:30 (Working Hours SLA Engine)
            </p>
          </div>
        </div>

        { }
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsNewTicketOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition shadow"
          >
            <Plus className="w-4 h-4" /> New Ticket
          </button>

          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
            <span className="text-xs text-slate-400">Current Agent:</span>
            <select
              value={currentAgent?.id || ""}
              onChange={(e) => {
                const found = agents.find((a) => a.id === e.target.value);
                if (found) setCurrentAgent(found);
              }}
              className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id} className="bg-slate-900 text-white">
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      { }
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-4">
        { }
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Late / Breached</p>
              <h3 className="text-2xl font-black text-red-600 mt-0.5">{lateCount}</h3>
              <p className="text-xs text-slate-400 mt-1">Requires immediate intervention</p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Waiting on Customer</p>
              <h3 className="text-2xl font-black text-amber-600 mt-0.5">{waitingCount}</h3>
              <p className="text-xs text-slate-400 mt-1">SLA timers paused</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Urgent Active</p>
              <h3 className="text-2xl font-black text-blue-600 mt-0.5">{urgentCount}</h3>
              <p className="text-xs text-slate-400 mt-1">Reply &lt; 2h · Fix today</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Tickets</p>
              <h3 className="text-2xl font-black text-slate-800 mt-0.5">{tickets.length}</h3>
              <p className="text-xs text-slate-400 mt-1">9 Support Agents active</p>
            </div>
            <div className="p-3 bg-slate-100 text-slate-700 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
          </div>
        </div>

        { }
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          { }
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[760px] overflow-hidden">
            { }
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs font-medium">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${activeFilter === "all"
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  All Tickets
                </button>
                <button
                  onClick={() => setActiveFilter("late")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1 ${activeFilter === "late"
                      ? "bg-red-600 text-white font-semibold"
                      : "text-red-700 hover:bg-red-100"
                    }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Late ({lateCount})
                </button>
                <button
                  onClick={() => setActiveFilter("waiting")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1 ${activeFilter === "waiting"
                      ? "bg-amber-600 text-white font-semibold"
                      : "text-amber-700 hover:bg-amber-100"
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Waiting ({waitingCount})
                </button>
                <button
                  onClick={() => setActiveFilter("assigned")}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${activeFilter === "assigned"
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-blue-700 hover:bg-blue-100"
                    }`}
                >
                  Assigned to Me
                </button>
              </div>

              { }
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ticket #, customer, title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={fetchTickets}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            { }
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {isLoading && tickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No tickets match this filter.</div>
              ) : (
                tickets.map((t) => {
                  const isSelected = selectedTicketId === t.id;
                  const isLate = t.slaStatus?.isLate;
                  const isPaused = t.status === "WAITING_ON_CUSTOMER";

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`p-3.5 cursor-pointer transition flex flex-col gap-1.5 border-l-4 ${isSelected
                          ? "bg-blue-50/70 border-l-blue-600"
                          : isLate
                            ? "border-l-red-500 hover:bg-slate-50"
                            : "border-l-transparent hover:bg-slate-50"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {t.ticketNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${t.priority === "URGENT"
                                ? "bg-red-100 text-red-800"
                                : t.priority === "MEDIUM"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                          >
                            {t.priority}
                          </span>
                        </div>
                        {formatSlaCountdown(
                          t.firstResponseAt ? t.slaStatus.resolveRemainingMinutes : t.slaStatus.replyRemainingMinutes,
                          isLate,
                          isPaused
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">{t.title}</h4>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="truncate max-w-[160px]">{t.customerName}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${t.status === "WAITING_ON_CUSTOMER"
                                ? "bg-amber-100 text-amber-800"
                                : t.status === "RESOLVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : t.status === "CLOSED"
                                    ? "bg-slate-200 text-slate-700"
                                    : t.status === "IN_PROGRESS"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-purple-100 text-purple-800"
                              }`}
                          >
                            {t.status.replace(/_/g, " ")}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-[10px] text-slate-600">
                            {t.assignedTo ? t.assignedTo.name.split(" ")[0] : "Unassigned"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          { }
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[760px] overflow-hidden">
            {isDetailLoading || !ticketDetail ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading ticket details...
              </div>
            ) : (
              <>
                { }
                <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-200 px-2 py-0.5 rounded">
                          {ticketDetail.ticketNumber}
                        </span>
                        <h2 className="font-bold text-base text-slate-900 leading-tight">
                          {ticketDetail.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Opened by <span className="font-semibold text-slate-700">{ticketDetail.customerName}</span> ({ticketDetail.customerEmail})
                      </p>
                    </div>

                    { }
                    <div>
                      {ticketDetail.assignedToId ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          <span>Assigned to <strong>{ticketDetail.assignedTo?.name}</strong></span>
                        </div>
                      ) : (
                        <button
                          onClick={handleClaimTicket}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Take this Ticket
                        </button>
                      )}
                    </div>
                  </div>

                  { }
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center gap-3">
                      { }
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Urgency:</span>
                        <select
                          value={ticketDetail.priority}
                          onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none"
                        >
                          <option value="URGENT">URGENT (2h / Same day)</option>
                          <option value="MEDIUM">MEDIUM (4.5h / 3 days)</option>
                          <option value="LOW">LOW (1 day / 1 week)</option>
                        </select>
                      </div>

                      { }
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Status:</span>
                        <select
                          value={ticketDetail.status}
                          onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                          className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none"
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="WAITING_ON_CUSTOMER">WAITING ON CUSTOMER (Pause Clock)</option>
                          <option value="RESOLVED">RESOLVED (7d Reopen Window)</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </div>
                    </div>

                    { }
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] bg-white border border-slate-200 px-2 py-1 rounded">
                        <span className="text-slate-400">Reply Due: </span>
                        <span className="font-medium text-slate-700">
                          {new Date(ticketDetail.slaReplyDue).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          {new Date(ticketDetail.slaReplyDue).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] bg-white border border-slate-200 px-2 py-1 rounded">
                        <span className="text-slate-400">Fix Due: </span>
                        <span className="font-medium text-slate-700">
                          {new Date(ticketDetail.slaResolveDue).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          {new Date(ticketDetail.slaResolveDue).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  { }
                  {actionError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center justify-between">
                      <span>{actionError}</span>
                      <button onClick={() => setActionError(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {actionSuccess && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-700 flex items-center justify-between">
                      <span>{actionSuccess}</span>
                      <button onClick={() => setActionSuccess(null)}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                { }
                <div className="border-b border-slate-200 px-4 flex items-center gap-6 text-xs font-semibold bg-white">
                  <button
                    onClick={() => setActiveTab("messages")}
                    className={`py-2.5 flex items-center gap-1.5 border-b-2 transition ${activeTab === "messages"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Conversation ({ticketDetail.messages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("audit")}
                    className={`py-2.5 flex items-center gap-1.5 border-b-2 transition ${activeTab === "audit"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    <History className="w-3.5 h-3.5" /> Audit Trail & Proof (INC-0318)
                  </button>
                </div>

                { }
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50/40">
                  {activeTab === "messages" ? (
                    ticketDetail.messages.map((msg) => {
                      const isCustomer = msg.senderRole === "CUSTOMER";
                      const isPrivateNote = msg.isPrivate;

                      if (isPrivateNote) {

                        return (
                          <div
                            key={msg.id}
                            className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 text-xs text-amber-900 shadow-sm"
                          >
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-amber-200">
                              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                                <Lock className="w-3.5 h-3.5 text-amber-700" />
                                <span>PRIVATE INTERNAL TEAM NOTE</span>
                                <span className="text-[10px] bg-amber-200 px-1.5 py-0.2 rounded text-amber-900 font-semibold">
                                  Strictly Hidden from Customer
                                </span>
                              </div>
                              <span className="text-[10px] text-amber-700">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                            <p className="text-[10px] text-amber-600 mt-1 italic">
                              Logged by {msg.senderName}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[85%] rounded-xl p-3.5 text-xs shadow-sm ${isCustomer
                              ? "bg-white border border-slate-200 self-start text-slate-800"
                              : "bg-blue-600 text-white self-end"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <span className={`font-bold ${isCustomer ? "text-slate-900" : "text-blue-100"}`}>
                              {msg.senderName}
                            </span>
                            <span className={`text-[10px] ${isCustomer ? "text-slate-400" : "text-blue-200"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                        </div>
                      );
                    })
                  ) : (

                    <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 p-2">
                      <div className="p-2 text-xs text-slate-500 bg-slate-50 rounded mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <span>
                          Immutable, tamper-proof activity trail. Every event records who, what, and exact timestamp.
                        </span>
                      </div>
                      {ticketDetail.auditLogs.map((log) => (
                        <div key={log.id} className="py-2.5 px-2 text-xs flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                              {log.action} · <span className="font-medium text-slate-600">{log.actorName}</span>
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {log.details && (
                            <p className="text-slate-600 text-xs mt-0.5">{log.details}</p>
                          )}
                          {(log.oldValue || log.newValue) && (
                            <p className="text-[11px] text-slate-400">
                              {log.oldValue} → <strong className="text-slate-700">{log.newValue}</strong>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                { }
                <div className="p-3 bg-white border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setComposerMode("public")}
                      className={`text-xs font-semibold px-3 py-1 rounded-md transition flex items-center gap-1.5 ${composerMode === "public"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Reply to Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode("internal")}
                      className={`text-xs font-semibold px-3 py-1 rounded-md transition flex items-center gap-1.5 ${composerMode === "internal"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                        }`}
                    >
                      <Lock className="w-3.5 h-3.5" /> Write Team Note (INC-0304 Protected)
                    </button>
                  </div>

                  {composerMode === "internal" && (
                    <div className="mb-2 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>Team note will <strong>NEVER</strong> be visible or transmitted to customer.</span>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <textarea
                      rows={2}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={
                        composerMode === "internal"
                          ? "Type private team note here (visible only to Arvo agents)..."
                          : "Type reply to customer..."
                      }
                      className={`flex-1 text-xs border rounded-lg p-2 focus:outline-none focus:ring-1 resize-none ${composerMode === "internal"
                          ? "border-amber-300 focus:ring-amber-500 bg-amber-50/30"
                          : "border-slate-300 focus:ring-blue-500"
                        }`}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !messageText.trim()}
                      className={`px-4 rounded-lg text-white font-semibold text-xs flex items-center gap-1.5 transition self-end h-9 ${composerMode === "internal"
                          ? "bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
                          : "bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                        }`}
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      { }
      {isNewTicketOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 flex flex-col gap-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900">Create New Support Ticket</h3>
              <button
                onClick={() => setIsNewTicketOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh@client.com"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Urgency / Severity</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as Priority)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none font-medium"
                >
                  <option value="URGENT">URGENT (Cannot work at all: Reply &lt; 2h, Fix same day)</option>
                  <option value="MEDIUM">MEDIUM (Reply &lt; 4.5h, Fix 3 business days)</option>
                  <option value="LOW">LOW (Small questions: Reply &lt; 1 day, Fix 1 week)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unable to process payroll exports"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Problem Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed description of the customer problem..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setIsNewTicketOpen(false)}
                  className="text-xs font-medium text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg disabled:opacity-50 shadow"
                >
                  {isCreating ? "Creating..." : "Open Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
