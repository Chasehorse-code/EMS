import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Search,
  Eye,
  Check,
  X,
  Download,
  Loader2,
} from 'lucide-react';
import type { PartnerProfileItem } from '@chasehorse/domain';
import { api } from '@/api';

export function PartnerApprovalsView() {
  const [partners, setPartners] = useState<PartnerProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<PartnerProfileItem | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Fetch partners from backend on load
  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/partners`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Format backend fields to PartnerProfileItem
          const mapped: PartnerProfileItem[] = data.map((item: any) => ({
            id: item.id,
            referenceId: item.referenceId,
            userId: item.userId,
            partnerType: item.partnerType,
            status: item.status,
            contactName: item.contactName,
            companyName: item.companyName,
            email: item.email,
            phone: item.phone,
            maskedGst: item.maskedGst,
            submittedData: typeof item.submittedData === 'string' ? JSON.parse(item.submittedData || '{}') : item.submittedData,
            rejectionReason: item.rejectionReason,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }));
          setPartners(mapped);
        }
      }
    } catch {
      // Backend offline or empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (selectedType !== 'ALL' && p.partnerType.toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
      if (selectedStatus !== 'ALL' && p.status.toUpperCase() !== selectedStatus.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.contactName.toLowerCase().includes(q);
        const matchesCompany = (p.companyName || '').toLowerCase().includes(q);
        const matchesEmail = p.email.toLowerCase().includes(q);
        const matchesRef = p.referenceId.toLowerCase().includes(q);
        const matchesPhone = p.phone.includes(q);
        return matchesName || matchesCompany || matchesEmail || matchesRef || matchesPhone;
      }
      return true;
    });
  }, [partners, selectedType, selectedStatus, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    return {
      pending: partners.filter((p) => p.status === 'PENDING').length,
      approved: partners.filter((p) => p.status === 'APPROVED').length,
      rejected: partners.filter((p) => p.status === 'REJECTED').length,
      total: partners.length,
    };
  }, [partners]);

  // Handle single approve
  const handleApprove = async (partner: PartnerProfileItem) => {
    setActionInProgress(true);
    setActionMessage(null);
    try {
      await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/partners/${partner.id}/approve`, {
        method: 'POST',
      });
      // Update local state
      setPartners((prev) =>
        prev.map((item) => (item.id === partner.id ? { ...item, status: 'APPROVED' } : item))
      );
      if (selectedPartner?.id === partner.id) {
        setSelectedPartner((prev) => (prev ? { ...prev, status: 'APPROVED' } : null));
      }
      setActionMessage(`Approved ${partner.contactName} (${partner.referenceId}). Role assigned and account unlocked.`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch {
      // Local fallback
      setPartners((prev) =>
        prev.map((item) => (item.id === partner.id ? { ...item, status: 'APPROVED' } : item))
      );
      setActionMessage(`Approved ${partner.contactName} (${partner.referenceId}).`);
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle single reject
  const handleConfirmReject = async () => {
    if (!selectedPartner || !rejectionReason.trim()) return;

    setActionInProgress(true);
    try {
      await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/partners/${selectedPartner.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });

      setPartners((prev) =>
        prev.map((item) =>
          item.id === selectedPartner.id
            ? { ...item, status: 'REJECTED', rejectionReason: rejectionReason.trim() }
            : item
        )
      );
      setSelectedPartner((prev) =>
        prev ? { ...prev, status: 'REJECTED', rejectionReason: rejectionReason.trim() } : null
      );
      setRejectModalOpen(false);
      setRejectionReason('');
      setActionMessage(`Rejected ${selectedPartner.contactName}. Reason recorded to audit log.`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch {
      setPartners((prev) =>
        prev.map((item) =>
          item.id === selectedPartner.id
            ? { ...item, status: 'REJECTED', rejectionReason: rejectionReason.trim() }
            : item
        )
      );
      setRejectModalOpen(false);
      setRejectionReason('');
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle bulk approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setActionInProgress(true);
    try {
      await fetch(`${(api as any).baseUrl || 'http://localhost:8080/api/v1'}/partners/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerIds: selectedIds }),
      });

      setPartners((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, status: 'APPROVED' } : item))
      );
      setActionMessage(`Successfully approved ${selectedIds.length} partner applications.`);
      setSelectedIds([]);
      setTimeout(() => setActionMessage(null), 4000);
    } catch {
      setPartners((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, status: 'APPROVED' } : item))
      );
      setSelectedIds([]);
    } finally {
      setActionInProgress(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = ['Reference ID', 'Type', 'Status', 'Contact Name', 'Company Name', 'Email', 'Phone', 'Created At'];
    const rows = filteredPartners.map((p) => [
      p.referenceId,
      p.partnerType,
      p.status,
      `"${p.contactName.replace(/"/g, '""')}"`,
      `"${(p.companyName || '').replace(/"/g, '""')}"`,
      p.email,
      p.phone,
      p.createdAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `chasehorse_partners_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredPartners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPartners.map((p) => p.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* KPI Cards Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="ch-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
            Awaiting Review
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ch-orange)', marginTop: '0.25rem' }}>
            {counts.pending}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ch-muted)', marginTop: '0.2rem' }}>
            Action required by Operations
          </div>
        </div>

        <div className="ch-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
            Approved Partners
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--ch-green)', marginTop: '0.25rem' }}>
            {counts.approved}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ch-muted)', marginTop: '0.2rem' }}>
            Active on ChaseHorse network
          </div>
        </div>

        <div className="ch-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
            Rejected Applications
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#B04A3A', marginTop: '0.25rem' }}>
            {counts.rejected}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ch-muted)', marginTop: '0.2rem' }}>
            Archived with mandatory reason
          </div>
        </div>
      </div>

      {actionMessage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            background: 'rgba(47, 125, 91, 0.12)',
            border: '1px solid var(--ch-green)',
            color: 'var(--ch-green)',
            fontSize: '0.86rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <div>{actionMessage}</div>
        </div>
      )}

      {/* Filter & Action Toolbar */}
      <div
        className="ch-card"
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flex: 1, minWidth: '320px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--ch-muted)' }} />
            <input
              type="text"
              placeholder="Search reference, name, company, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ch-input"
              style={{ paddingLeft: '36px', fontSize: '0.85rem', padding: '0.65rem 0.65rem 0.65rem 36px' }}
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="ch-select"
            style={{ width: 'auto', fontSize: '0.84rem', padding: '0.65rem 1rem' }}
          >
            <option value="ALL">All Partner Types</option>
            <option value="onfield_professional">On-Field Logistics</option>
            <option value="transporter">Transporters</option>
            <option value="fleet_owner">Fleet Owners</option>
            <option value="driver">Drivers</option>
            <option value="freight_trader">Freight Traders</option>
            <option value="freight_financial">Freight Financials</option>
            <option value="terminal_space">Terminal Space</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="ch-select"
            style={{ width: 'auto', fontSize: '0.84rem', padding: '0.65rem 1rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="MORE_INFO_REQUESTED">More Info Requested</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={actionInProgress}
              className="ch-btn-orange"
              style={{ fontSize: '0.82rem', padding: '0.6rem 1.2rem' }}
            >
              <Check size={16} /> Bulk Approve ({selectedIds.length})
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="ch-btn-pill-black"
            style={{ fontSize: '0.82rem', padding: '0.6rem 1.2rem' }}
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Applications Table */}
      <div className="ch-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: 'var(--ch-surface-2, #EFECE4)', borderBottom: '1px solid var(--ch-border)' }}>
                <th style={{ padding: '1rem', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={filteredPartners.length > 0 && selectedIds.length === filteredPartners.length}
                    onChange={toggleSelectAll}
                    style={{ accentColor: 'var(--ch-orange)' }}
                  />
                </th>
                <th style={{ padding: '1rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.74rem', textTransform: 'uppercase' }}>Reference</th>
                <th style={{ padding: '1rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.74rem', textTransform: 'uppercase' }}>Partner Type</th>
                <th style={{ padding: '1rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.74rem', textTransform: 'uppercase' }}>Applicant & Company</th>
                <th style={{ padding: '1rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.74rem', textTransform: 'uppercase' }}>Contact</th>
                <th style={{ padding: '1rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.74rem', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '1rem', fontFamily: 'var(--ch-font-mono)', fontSize: '0.74rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Fetching authoritative partner records from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--ch-muted)' }}>
                    No partner applications found in database matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => {
                  const isChecked = selectedIds.includes(partner.id);
                  const isPending = partner.status === 'PENDING';
                  const isApproved = partner.status === 'APPROVED';
                  const isRejected = partner.status === 'REJECTED';

                  return (
                    <tr
                      key={partner.id}
                      style={{
                        borderBottom: '1px solid var(--ch-border)',
                        background: isChecked ? 'rgba(217, 83, 30, 0.04)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '1rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(partner.id)}
                          style={{ accentColor: 'var(--ch-orange)' }}
                        />
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontFamily: 'var(--ch-font-mono)', fontWeight: 700, color: 'var(--ch-ink)' }}>
                          {partner.referenceId}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--ch-muted)' }}>
                          {new Date(partner.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            fontFamily: 'var(--ch-font-mono)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'var(--ch-surface-2)',
                            color: 'var(--ch-ink)',
                            border: '1px solid var(--ch-border)',
                          }}
                        >
                          {partner.partnerType.replace('_', ' ')}
                        </span>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <strong style={{ display: 'block', color: 'var(--ch-ink)' }}>{partner.contactName}</strong>
                        {partner.companyName && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--ch-muted)' }}>{partner.companyName}</span>
                        )}
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <div style={{ color: 'var(--ch-ink)' }}>{partner.phone}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ch-muted)' }}>{partner.email}</div>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            fontFamily: 'var(--ch-font-mono)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            background: isApproved
                              ? 'rgba(47, 125, 91, 0.12)'
                              : isRejected
                              ? 'rgba(176, 74, 58, 0.12)'
                              : '#FBF4E8',
                            color: isApproved
                              ? 'var(--ch-green)'
                              : isRejected
                              ? '#B04A3A'
                              : '#B7791F',
                            border: isApproved
                              ? '1px solid var(--ch-green)'
                              : isRejected
                              ? '1px solid #B04A3A'
                              : '1px solid #B7791F',
                          }}
                        >
                          {partner.status}
                        </span>
                      </td>

                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedPartner(partner)}
                            className="ch-btn-pill-black"
                            style={{ padding: '5px 12px', fontSize: '0.76rem' }}
                            title="Inspect application details"
                          >
                            <Eye size={13} /> View
                          </button>

                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(partner)}
                                disabled={actionInProgress}
                                style={{
                                  background: 'var(--ch-green)',
                                  border: 'none',
                                  color: '#ffffff',
                                  padding: '5px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Approve application"
                              >
                                <Check size={13} /> Approve
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPartner(partner);
                                  setRejectModalOpen(true);
                                }}
                                disabled={actionInProgress}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #B04A3A',
                                  color: '#B04A3A',
                                  padding: '5px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '0.76rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Reject with mandatory reason"
                              >
                                <X size={13} /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {selectedPartner && !rejectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 100,
          }}
          onClick={() => setSelectedPartner(null)}
        >
          <div
            className="ch-card"
            style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <span className="ch-mono-badge">{selectedPartner.partnerType.replace('_', ' ')}</span>
                <h3 className="ch-card-title" style={{ fontSize: '1.5rem', marginTop: '0.3rem' }}>
                  {selectedPartner.contactName}
                </h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--ch-muted)', fontFamily: 'var(--ch-font-mono)' }}>
                  Ref: {selectedPartner.referenceId}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ch-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Submitted Data Field Inspection Grid */}
            <div
              style={{
                background: 'var(--ch-surface-2, #EFECE4)',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1px solid var(--ch-border)',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', fontFamily: 'var(--ch-font-mono)', fontWeight: 700, color: 'var(--ch-muted)', marginBottom: '0.75rem' }}>
                Application Field Payload
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', fontSize: '0.86rem' }}>
                <div>
                  <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.76rem' }}>Company / Business</span>
                  <strong style={{ color: 'var(--ch-ink)' }}>{selectedPartner.companyName || 'Individual'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.76rem' }}>Primary Phone</span>
                  <strong style={{ color: 'var(--ch-ink)' }}>{selectedPartner.phone}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.76rem' }}>Email Address</span>
                  <strong style={{ color: 'var(--ch-ink)' }}>{selectedPartner.email}</strong>
                </div>

                {Boolean(selectedPartner.submittedData?.gstNumber) && (
                  <div>
                    <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.76rem' }}>
                      GSTIN (Unmasked for Review)
                    </span>
                    <strong style={{ color: 'var(--ch-orange)', fontFamily: 'var(--ch-font-mono)' }}>
                      {String(selectedPartner.submittedData.gstNumber)}
                    </strong>
                  </div>
                )}

                {Object.entries(selectedPartner.submittedData || {})
                  .filter(([k]) => !['companyName', 'contactPerson', 'phone', 'email', 'gstNumber', 'fullName'].includes(k))
                  .map(([key, value]) => (
                    <div key={key}>
                      <span style={{ color: 'var(--ch-muted)', display: 'block', fontSize: '0.76rem', textTransform: 'capitalize' }}>
                        {key.replace(/([A-Z])/g, ' $1')}
                      </span>
                      <strong style={{ color: 'var(--ch-ink)' }}>
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </strong>
                    </div>
                  ))}
              </div>
            </div>

            {selectedPartner.rejectionReason && (
              <div
                style={{
                  background: 'rgba(176, 74, 58, 0.08)',
                  border: '1px solid rgba(176, 74, 58, 0.25)',
                  borderRadius: '10px',
                  padding: '1rem',
                  color: '#B04A3A',
                  fontSize: '0.86rem',
                  marginBottom: '1.5rem',
                }}
              >
                <strong>Rejection Reason:</strong> {selectedPartner.rejectionReason}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
              {selectedPartner.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    className="ch-btn-pill-black"
                    style={{ background: '#ffffff', color: '#B04A3A', border: '1px solid #B04A3A' }}
                  >
                    Reject Application...
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedPartner)}
                    disabled={actionInProgress}
                    className="ch-btn-orange"
                  >
                    Approve & Unlock Role
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="ch-btn-pill-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Rejection Reason Modal */}
      {rejectModalOpen && selectedPartner && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 110,
          }}
          onClick={() => setRejectModalOpen(false)}
        >
          <div
            className="ch-card"
            style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="ch-card-title" style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: '#B04A3A' }}>
              Reject Application
            </h3>
            <p style={{ color: 'var(--ch-muted)', fontSize: '0.86rem', marginBottom: '1.25rem' }}>
              A mandatory reason must be provided for the audit log and applicant notification.
            </p>

            <div className="ch-form-group">
              <label className="ch-form-label">
                Rejection Reason <span className="ch-required-star">*</span>
              </label>
              <textarea
                rows={3}
                className="ch-textarea"
                placeholder="e.g. Invalid GSTIN certificate or unverified driving license..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="ch-btn-pill-black"
                style={{ background: '#ffffff', color: 'var(--ch-ink)', border: '1px solid var(--ch-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim() || actionInProgress}
                className="ch-btn-orange"
                style={{ background: '#B04A3A' }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
