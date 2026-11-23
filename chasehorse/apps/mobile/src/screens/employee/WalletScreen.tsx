import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { Header } from '../../components/ui/Header';
import { Card, Button, ChipFilter, StatusBadge, EmptyState } from '../../components/ui';
import { mobileApi } from '../../api/restApi';
import { useAuth } from '../../context/AuthContext';
import type { WalletTransaction } from '../../types';

export const WalletScreen: React.FC = () => {
  const { user } = useAuth();
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [account, setAccount] = useState<{ balanceInr: number; pendingInr: number }>({
    balanceInr: 0,
    pendingInr: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'CREDIT' | 'HOLD'>('ALL');

  const fetchWallet = async () => {
    if (!user?.id) return;
    try {
      const [acc, transactions] = await Promise.all([
        mobileApi.getWalletAccount(user.id, user.token),
        mobileApi.getWalletTransactions(user.id, user.token),
      ]);
      if (acc) {
        setAccount({ balanceInr: acc.balanceInr, pendingInr: acc.pendingInr });
      }
      setTxns(transactions || []);
    } catch {
      setTxns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchWallet();
  }, [user?.id, user?.token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  const handleShareCsv = async () => {
    if (txns.length === 0) {
      Alert.alert('Empty Ledger', 'No transactions available to export.');
      return;
    }

    const csvHeader = 'Transaction ID,Type,Amount (INR),Description,Date,Status\n';
    const csvRows = txns
      .map(
        (t) =>
          `"${t.id}","${t.type}","${t.amount}","${t.description.replace(/"/g, '""')}","${t.createdAt}","${t.status || 'COMPLETED'}"`
      )
      .join('\n');

    try {
      await Share.share({
        title: 'ChaseHorse Wallet Ledger Export',
        message: csvHeader + csvRows,
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export ledger.');
    }
  };

  const filteredTxns = txns.filter((t) => {
    if (filter === 'CREDIT') return t.type === 'CREDIT';
    if (filter === 'HOLD') return t.type === 'HOLD';
    return true;
  });

  return (
    <View style={styles.container}>
      <Header
        title="Worker Wallet & Ledger"
        subtitle="Append-Only Reward Accounting & Audit Chain"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryOrange} />
        }
      >
        {/* Balances Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceTopRow}>
            <View>
              <Text style={styles.balanceLabel}>AVAILABLE LEDGER BALANCE</Text>
              <Text style={styles.balanceVal}>₹{account.balanceInr.toLocaleString('en-IN')}</Text>
              <Text style={styles.balanceSub}>Verified by Operations Manager & released to internal account</Text>
            </View>

            <TouchableOpacity style={styles.csvBtn} onPress={handleShareCsv} activeOpacity={0.8}>
              <Text style={styles.csvBtnText}>Export CSV 📄</Text>
            </TouchableOpacity>
          </View>

          {/* Pending Approval Detail */}
          <View style={styles.pendingSection}>
            <View style={styles.pendingHeaderRow}>
              <Text style={styles.pendingTitle}>PENDING APPROVAL REWARDS</Text>
              <Text style={styles.pendingVal}>₹{account.pendingInr.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.approvalChainBox}>
              <Text style={styles.chainLabel}>Next Required Sign-off:</Text>
              <Text style={styles.chainSigner}>
                🛡️ Assigned Operations Manager (State Jurisdiction: {user?.region || 'Not assigned'})
              </Text>
              <Text style={styles.chainNotice}>
                Bounty releases automatically credit once evidence photos meet illumination and geo-fence criteria.
              </Text>
            </View>
          </View>
        </Card>

        {/* Ledger Filter Chips */}
        <View style={styles.ledgerHeaderRow}>
          <Text style={styles.ledgerTitle}>IMMUTABLE TRANSACTION LEDGER</Text>
          <ChipFilter
            options={[
              { id: 'ALL', label: 'All', count: txns.length },
              { id: 'CREDIT', label: 'Credits' },
              { id: 'HOLD', label: 'Holds' },
            ]}
            selectedId={filter}
            onSelect={(id) => setFilter(id as any)}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: spacing.xl }} size="large" color={colors.primaryOrange} />
        ) : filteredTxns.length === 0 ? (
          <EmptyState
            icon="💳"
            title="No Ledger Records"
            description="Completed field tasks and manager bounty credits will be recorded here with an immutable audit chain."
          />
        ) : (
          filteredTxns.map((txn) => {
            const isCredit = txn.type === 'CREDIT' || txn.amount > 0;
            return (
              <Card key={txn.id} style={styles.txnCard}>
                <View style={styles.txnRow}>
                  <View style={[styles.txnIconWrap, isCredit ? styles.iconCredit : styles.iconDebit]}>
                    <Text style={styles.txnIcon}>{isCredit ? '↓' : '↑'}</Text>
                  </View>

                  <View style={{ flex: 1, marginRight: spacing.sm }}>
                    <Text style={styles.txnDesc}>{txn.description}</Text>
                    <Text style={styles.txnDate}>
                      {new Date(txn.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: 'Asia/Kolkata',
                      })}
                    </Text>
                    {txn.taskId && (
                      <Text style={styles.txnTaskId}>Ref Task: {txn.taskId.slice(0, 13)}...</Text>
                    )}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txnAmount, isCredit ? styles.amountCredit : styles.amountDebit]}>
                      {isCredit ? '+' : '−'}₹{Math.abs(txn.amount).toLocaleString('en-IN')}
                    </Text>
                    <StatusBadge status={txn.status || 'COMPLETED'} size="sm" />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge * 2,
  },
  balanceCard: {
    marginBottom: spacing.lg,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceVal: {
    ...typography.hero,
    color: colors.ink,
    fontWeight: '800',
    letterSpacing: -1,
    marginVertical: 2,
  },
  balanceSub: {
    ...typography.caption,
    color: colors.textDarkMuted,
    maxWidth: 240,
    lineHeight: 16,
  },
  csvBtn: {
    backgroundColor: colors.surfaceSunken || '#EBE7DE',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  csvBtnText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '700',
  },
  pendingSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  pendingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pendingTitle: {
    ...typography.caption,
    color: '#B7791F',
    fontWeight: '700',
  },
  pendingVal: {
    ...typography.titleMedium,
    color: '#B7791F',
    fontWeight: '800',
  },
  approvalChainBox: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.xs,
  },
  chainLabel: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontWeight: '700',
    fontSize: 10,
  },
  chainSigner: {
    ...typography.bodySmall,
    color: colors.ink,
    fontWeight: '600',
    marginTop: 2,
  },
  chainNotice: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  ledgerHeaderRow: {
    flexDirection: 'column',
    marginBottom: spacing.sm,
  },
  ledgerTitle: {
    ...typography.titleSmall,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  txnCard: {
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txnIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconCredit: {
    backgroundColor: 'rgba(47, 125, 91, 0.12)',
  },
  iconDebit: {
    backgroundColor: 'rgba(176, 74, 58, 0.12)',
  },
  txnIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  txnDesc: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.ink,
  },
  txnDate: {
    ...typography.caption,
    color: colors.textDarkMuted,
    fontSize: 10,
    marginTop: 1,
  },
  txnTaskId: {
    ...typography.caption,
    color: colors.primaryOrange,
    fontSize: 9,
    marginTop: 2,
  },
  txnAmount: {
    ...typography.titleSmall,
    fontWeight: '800',
    marginBottom: 2,
  },
  amountCredit: {
    color: colors.success,
  },
  amountDebit: {
    color: colors.danger,
  },
});
