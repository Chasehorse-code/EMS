import { useState, useEffect, useMemo } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  MessageSquare,
  Send,
  RefreshCw,
  Phone,
  Mail,
  X,
  History,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader, Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, EmptyState } from '@/components/ui/States';
import { formatDate } from '@/utils/format';
import type { SupportTicket, TicketUrgency, TicketStatus } from '@/types';

const CATEGORIES = [
  'Field Verification',
  'Bounty & Payout',
  'Geo-fence Exception',
  'Worker Dispatch',
  'Billing & Invoicing',
  'General Inquiry',
];

const URGENCIES: { key: TicketUrgency; label: string; sla: string; tone: 'danger' | 'warning' | 'info' | 'neutral' }[] = [
  { key: 'URGENT', label: 'Urgent', sla: '< 15 mins response', tone: 'danger' },
  { key: 'HIGH', label: 'High', sla: '< 1 hour response', tone: 'warning' },
  { key: 'NORMAL', label: 'Normal', sla: '< 4 hours response', tone: 'info' },
  { key: 'LOW', label: 'Low', sla: '< 24 hours response', tone: 'neutral' },
];

export function CustomerSupportPage() {
  const { user } = useAuth();
  const { notify } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  // Create Ticket Form State
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [urgency, setUrgency] = useState<TicketUrgency>('NORMAL');
  const [relatedTaskId, setRelatedTaskId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply Form State
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const fetchTickets = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.listTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load tickets', err);
      notify(err.message || 'Failed to load support tickets', 'danger');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const selectedTicket = useMemo(() => {
    return tickets.find((t) => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Status filter
      if (statusFilter === 'active' && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')) {
        return false;
      }
      if (statusFilter === 'resolved' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        return false;
      }

      // Urgency filter
      if (urgencyFilter !== 'all' && ticket.urgency !== urgencyFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = ticket.subject.toLowerCase().includes(q);
        const matchesNumber = (ticket.ticketNumber || ticket.id).toLowerCase().includes(q);
        const matchesCat = (ticket.category || '').toLowerCase().includes(q);
        if (!matchesSubject && !matchesNumber && !matchesCat) return false;
      }

      return true;
    });
  }, [tickets, statusFilter, urgencyFilter, searchQuery]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      notify('Please provide both subject and message details', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createTicket({
        subject: subject.trim(),
        category,
        urgency,
        message: message.trim(),
        relatedTaskId: relatedTaskId.trim() || undefined,
      });

      notify(`Support ticket ${created.ticketNumber || '#' + created.id.slice(0, 8)} created successfully`, 'success');
      setSubject('');
      setMessage('');
      setRelatedTaskId('');
      setUrgency('NORMAL');
      setIsCreateModalOpen(false);

      // Refresh and open the new ticket
      await fetchTickets();
      setSelectedTicketId(created.id);
    } catch (err: any) {
      notify(err.message || 'Failed to create support ticket', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !replyMessage.trim()) return;

    setSubmittingReply(true);
    try {
      await api.addTicketComment(selectedTicketId, replyMessage.trim(), false);
      setReplyMessage('');
      notify('Reply sent to operations specialist', 'success');

      // Refresh ticket details
      const updated = await api.getTicket(selectedTicketId);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      notify(err.message || 'Failed to send reply', 'danger');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!selectedTicketId) return;
    try {
      const updated = await api.updateTicketStatus(
        selectedTicketId,
        status,
        status === 'CLOSED' ? 'Closed by customer request' : 'Reopened by customer'
      );
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      notify(`Ticket marked as ${status}`, 'success');
    } catch (err: any) {
      notify(err.message || 'Failed to update status', 'danger');
    }
  };

  const getUrgencyBadge = (u?: string) => {
    switch (u?.toUpperCase()) {
      case 'URGENT':
        return <Badge tone="danger">URGENT (15m SLA)</Badge>;
      case 'HIGH':
        return <Badge tone="warning">HIGH (1h SLA)</Badge>;
      case 'NORMAL':
        return <Badge tone="info">NORMAL (4h SLA)</Badge>;
      default:
        return <Badge tone="neutral">LOW (24h SLA)</Badge>;
    }
  };

  const getStatusBadge = (s?: string) => {
    switch (s?.toUpperCase()) {
      case 'OPEN':
        return <Badge tone="info">OPEN</Badge>;
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        return <Badge tone="warning">IN PROGRESS</Badge>;
      case 'WAITING_ON_CUSTOMER':
        return <Badge tone="info">WAITING YOUR REPLY</Badge>;
      case 'RESOLVED':
        return <Badge tone="success">RESOLVED</Badge>;
      case 'CLOSED':
        return <Badge tone="neutral">CLOSED</Badge>;
      default:
        return <Badge tone="neutral">{s || 'UNKNOWN'}</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1200px' }}>
      <PageHeader
        title="Help & Operations Support"
        description="24x7 Enterprise assistance for field audit operations, worker dispatch exceptions, and task SLA management."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn--secondary btn--md"
              onClick={() => fetchTickets(true)}
              disabled={refreshing}
              title="Refresh tickets"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="btn btn--primary btn--md"
              onClick={() => setIsCreateModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> New Support Ticket
            </button>
          </div>
        }
      />

      {/* Escalation Channels Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-primary, #e8541e)', marginBottom: '8px' }}>
            <LifeBuoy size={20} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>24/7 Operations Desk</h4>
          </div>
          <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
            Dedicated Dispatch SLA
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
            Operations duty managers are on standby for live field execution blockers.
          </p>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', marginBottom: '8px' }}>
            <Mail size={20} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Enterprise Operations Email</h4>
          </div>
          <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
            support@chasehorse.com
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
            Escalation ticketing for audit campaigns, invoicing & master contracts.
          </p>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8', marginBottom: '8px' }}>
            <Phone size={20} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Emergency Field Line</h4>
          </div>
          <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
            +91 80 4000 8900
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
            Toll-free hotline for urgent field security & store-access emergencies.
          </p>
        </Card>
      </div>

      {/* Main Content Layout: Tickets List on Left, Detail Pane on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1.25fr' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Tickets List */}
        <Card>
          {/* Filters Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn btn--sm ${statusFilter === 'all' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All ({tickets.length})
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${statusFilter === 'active' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setStatusFilter('active')}
                >
                  Active ({tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length})
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${statusFilter === 'resolved' ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setStatusFilter('resolved')}
                >
                  Resolved ({tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length})
                </button>
              </div>

              <select
                className="input input--sm"
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '130px' }}
              >
                <option value="all">All Urgencies</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search ticket subject, ID, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: '100%', paddingLeft: '36px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Tickets View */}
          {loading ? (
            <Skeleton lines={6} />
          ) : filteredTickets.length === 0 ? (
            <EmptyState
              title={tickets.length === 0 ? 'No support tickets yet' : 'No matching tickets'}
              description={
                tickets.length === 0
                  ? 'Submit your first ticket if you need assistance with task verification, bounty settlement, or worker dispatch.'
                  : 'Try adjusting your search query or status filter.'
              }
              action={
                tickets.length === 0 ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--md"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus size={16} /> Create Support Ticket
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid var(--color-primary, #e8541e)' : '1px solid var(--color-border, rgba(0,0,0,0.08))',
                      backgroundColor: isSelected ? 'rgba(232, 84, 30, 0.04)' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)', fontWeight: 600 }}>
                        {t.ticketNumber || '#' + t.id.slice(0, 8)}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {getUrgencyBadge(t.urgency)}
                        {getStatusBadge(t.status)}
                      </div>
                    </div>

                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text, #111315)' }}>
                      {t.subject}
                    </h4>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--muted)' }}>
                      <span>{t.category || 'General'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {formatDate(t.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right Column: Ticket Detail Drawer (when selected) */}
        {selectedTicket && (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--muted)' }}>
                      {selectedTicket.ticketNumber || '#' + selectedTicket.id.slice(0, 8)}
                    </span>
                    {getUrgencyBadge(selectedTicket.urgency)}
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
                    {selectedTicket.subject}
                  </h3>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    <span>Category: <strong>{selectedTicket.category || 'General'}</strong></span>
                    {selectedTicket.relatedTaskId && (
                      <span>Related Task: <strong>{selectedTicket.relatedTaskId}</strong></span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED' ? (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleUpdateStatus('CLOSED')}
                    >
                      <CheckCircle2 size={14} /> Close Ticket
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleUpdateStatus('OPEN')}
                    >
                      <RefreshCw size={14} /> Reopen Ticket
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSelectedTicketId(null)}
                    title="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* SLA Target Notice */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.825rem',
                }}
              >
                <Clock size={16} style={{ color: '#0284c7' }} />
                <div>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>Target SLA Response: </span>
                  <span style={{ color: '#0f172a' }}>
                    {selectedTicket.urgency === 'URGENT'
                      ? 'Critical dispatch alert (<15m phone/chat response)'
                      : selectedTicket.urgency === 'HIGH'
                      ? 'Priority operations resolution (<1 hour response)'
                      : 'Standard enterprise turnaround (<4 hours)'}
                  </span>
                </div>
              </div>

              {/* Initial Inquiry / Message */}
              <div style={{ backgroundColor: 'var(--color-surface-sunken, #f8fafc)', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border, rgba(0,0,0,0.06))' }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
                  Initial Inquiry
                </h5>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-text, #111315)', whiteSpace: 'pre-wrap' }}>
                  {selectedTicket.comments?.[0]?.message || 'Ticket registered.'}
                </p>
              </div>

              {/* Comments Thread */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={16} /> Conversation ({selectedTicket.comments?.length || 0})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                  {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)', fontStyle: 'italic', margin: '4px 0' }}>
                      No comments yet. Our operations desk will respond shortly.
                    </p>
                  ) : (
                    selectedTicket.comments.map((c) => {
                      const isCustomer = !c.isInternal && c.authorId === user?.id;
                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '12px',
                            backgroundColor: isCustomer ? 'rgba(232, 84, 30, 0.06)' : '#ffffff',
                            border: isCustomer ? '1px solid rgba(232, 84, 30, 0.2)' : '1px solid var(--color-border, rgba(0,0,0,0.08))',
                            alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                            maxWidth: '90%',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isCustomer ? 'var(--color-primary, #e8541e)' : '#0284c7' }}>
                              {isCustomer ? 'You (Customer)' : 'Operations Desk Specialist'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                              {formatDate(c.createdAt)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--color-text, #111315)', whiteSpace: 'pre-wrap' }}>
                            {c.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'CLOSED' && (
                  <form onSubmit={handleSendReply} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Type your reply to operations specialist..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="input"
                      style={{ flex: 1 }}
                      disabled={submittingReply}
                    />
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={submittingReply || !replyMessage.trim()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Send size={15} /> Send
                    </button>
                  </form>
                )}
              </div>

              {/* Append-Only Event Audit Timeline */}
              {selectedTicket.events && selectedTicket.events.length > 0 && (
                <div style={{ borderTop: '1px solid var(--color-border, rgba(0,0,0,0.08))', paddingTop: '1rem' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={15} /> Append-Only Audit History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {selectedTicket.events.map((ev) => (
                      <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed rgba(0,0,0,0.04)' }}>
                        <span>
                          ● <strong>{ev.eventType}</strong>: {ev.notes || 'Event logged'}
                        </span>
                        <span style={{ color: '#94a3b8' }}>{formatDate(ev.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* New Support Ticket Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text, #111315)' }}>
                  Create Support Ticket
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Log an operational or technical issue directly with the ChaseHorse duty desk.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Worker geo-fence check-in issue at Tenali Hub"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                    Urgency SLA
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as TicketUrgency)}
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {URGENCIES.map((u) => (
                      <option key={u.key} value={u.key}>
                        {u.label} ({u.sla})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                  Related Task ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. tsk-301 or task UUID"
                  value={relatedTaskId}
                  onChange={(e) => setRelatedTaskId(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ink)' }}>
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide all context, steps to reproduce, or instructions for the operations team..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={15} /> {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
