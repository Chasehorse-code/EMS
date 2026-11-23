import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Card, Button, Input, ChipFilter, StatusBadge, EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { mobileApi } from '../../api/restApi';

export interface SupportTicket {
  id: string;
  ticketNumber?: string;
  subject: string;
  category?: string;
  urgency: string;
  message?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  commentsCount?: number;
}

export const SupportTicketsScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');

  // Create ticket modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('OPERATIONS');
  const [urgency, setUrgency] = useState('NORMAL');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail / reply modal state
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await mobileApi.listTickets(user?.token);
      const mapped: SupportTicket[] = (res || []).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber || t.id.slice(0, 8),
        subject: t.subject,
        status: t.status,
        urgency: t.urgency,
        category: t.category,
        message: t.message,
        createdAt: t.createdAt,
        commentsCount: Array.isArray(t.comments) ? t.comments.length : 0,
      }));
      setTickets(mapped);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user?.token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Incomplete Form', 'Please provide a subject and detailed explanation.');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApi.createTicket(
        {
          subject: subject.trim(),
          category,
          urgency,
          message: message.trim(),
        },
        user?.token,
      );
      Alert.alert('Ticket Filed', 'Your support ticket has been submitted to the operations desk.');
      setCreateModalVisible(false);
      setSubject('');
      setMessage('');
      fetchTickets();
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not file ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!activeTicket || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      await mobileApi.addTicketComment(activeTicket.id, replyMessage.trim(), false, user?.token);
      Alert.alert('Reply Sent', 'Your message has been posted to the ticket timeline.');
      setReplyMessage('');
      setActiveTicket(null);
      fetchTickets();
    } catch (err: any) {
      Alert.alert('Reply Error', err.message || 'Could not send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (selectedFilter === 'OPEN') return t.status.toUpperCase() !== 'RESOLVED' && t.status.toUpperCase() !== 'CLOSED';
    if (selectedFilter === 'RESOLVED') return t.status.toUpperCase() === 'RESOLVED' || t.status.toUpperCase() === 'CLOSED';
    return true;
  });

  return (
    <View style={styles.container}>
      <Header
        title="Support & Field Desk"
        subtitle="Operational Assistance & Issue Escalation"
      />

      <View style={styles.topActionsRow}>
        <ChipFilter
          options={[
            { id: 'ALL', label: 'All Tickets', count: tickets.length },
            { id: 'OPEN', label: 'Active', count: tickets.filter((t) => t.status !== 'RESOLVED').length },
            { id: 'RESOLVED', label: 'Resolved' },
          ]}
          selectedId={selectedFilter}
          onSelect={(id) => setSelectedFilter(id as any)}
        />

        <TouchableOpacity
          style={styles.newTicketBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.newTicketBtnText}>+ New Ticket</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryOrange} />
        }
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} size="large" color={colors.primaryOrange} />
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon="🎫"
            title="No Support Tickets"
            description="You currently have no support requests matching this filter. Tap '+ New Ticket' to submit an issue to operations."
            actionTitle="+ Open Support Ticket"
            onAction={() => setCreateModalVisible(true)}
          />
        ) : (
          filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              style={styles.ticketCard}
              onPress={() => setActiveTicket(ticket)}
            >
              <View style={styles.ticketHeader}>
                <StatusBadge status={ticket.status} size="sm" />
                <Text style={styles.urgencyBadge}>
                  {ticket.urgency.toUpperCase()}
                </Text>
              </View>

              <Text style={styles.ticketSubject}>{ticket.subject}</Text>
              <Text style={styles.ticketMessage} numberOfLines={2}>
                {ticket.message || 'Ticket details are unavailable in this list response.'}
              </Text>

              <View style={styles.ticketFooter}>
                <Text style={styles.ticketCategory}>Category: {ticket.category || 'Not provided'}</Text>
                <Text style={styles.ticketDate}>
                  {ticket.createdAt || ticket.updatedAt
                    ? new Date(ticket.createdAt || ticket.updatedAt!).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Date unavailable'}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Create Ticket Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>File Support Ticket</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <Input
                label="Ticket Subject"
                placeholder="e.g. Geotag discrepancy on site"
                value={subject}
                onChangeText={setSubject}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {['OPERATIONS', 'EVIDENCE', 'WALLET', 'TECHNICAL'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, category === cat && styles.catChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Urgency</Text>
              <View style={styles.categoryRow}>
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((urg) => (
                  <TouchableOpacity
                    key={urg}
                    style={[styles.catChip, urgency === urg && styles.catChipActive]}
                    onPress={() => setUrgency(urg)}
                  >
                    <Text style={[styles.catChipText, urgency === urg && styles.catChipTextActive]}>
                      {urg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Detailed Description"
                placeholder="Describe what occurred, any error codes, or task ID..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                style={{ height: 100, textAlignVertical: 'top' }}
              />

              <Button
                title={submitting ? 'Submitting...' : 'Submit Support Ticket'}
                onPress={handleCreateTicket}
                loading={submitting}
                style={{ marginTop: spacing.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ticket Details & Reply Modal */}
      <Modal
        visible={Boolean(activeTicket)}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveTicket(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {activeTicket?.subject}
              </Text>
              <TouchableOpacity onPress={() => setActiveTicket(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {activeTicket && (
                <>
                  <View style={styles.detailMetaRow}>
                    <StatusBadge status={activeTicket.status} />
                    <Text style={styles.detailUrgency}>Urgency: {activeTicket.urgency}</Text>
                  </View>

                  <View style={styles.detailBox}>
                    <Text style={styles.detailOriginalText}>{activeTicket.message || 'Ticket details are unavailable in this list response.'}</Text>
                  </View>

                  <Text style={styles.replyTitle}>Post Reply / Additional Context</Text>
                  <Input
                    label="Reply Message"
                    placeholder="Type message to support desk..."
                    value={replyMessage}
                    onChangeText={setReplyMessage}
                    multiline
                    numberOfLines={3}
                  />

                  <Button
                    title={sendingReply ? 'Sending...' : 'Send Reply'}
                    onPress={handleSendReply}
                    loading={sendingReply}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.xs,
  },
  newTicketBtn: {
    backgroundColor: colors.primaryOrange,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  newTicketBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge * 2,
  },
  ticketCard: {
    marginBottom: spacing.md,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  urgencyBadge: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  ticketSubject: {
    ...typography.titleSmall,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  ticketMessage: {
    ...typography.bodySmall,
    color: colors.textDarkMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.xs,
  },
  ticketCategory: {
    ...typography.caption,
    color: colors.textDarkMuted,
  },
  ticketDate: {
    ...typography.caption,
    color: colors.textDarkMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(21, 21, 21, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    ...typography.titleMedium,
    color: colors.ink,
    flex: 1,
  },
  closeBtn: {
    fontSize: 20,
    color: colors.textDarkMuted,
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  catChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.cardLight,
  },
  catChipActive: {
    backgroundColor: colors.primaryBlack,
    borderColor: colors.primaryBlack,
  },
  catChipText: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#F3F1EB',
  },
  detailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailUrgency: {
    ...typography.caption,
    color: colors.textDarkMuted,
  },
  detailBox: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  detailOriginalText: {
    ...typography.bodyMedium,
    color: colors.ink,
    lineHeight: 20,
  },
  replyTitle: {
    ...typography.titleSmall,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
});
