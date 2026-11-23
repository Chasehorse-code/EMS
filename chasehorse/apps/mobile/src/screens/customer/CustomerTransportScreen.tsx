import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Header } from '../../components/ui/Header';
import { mobileApi } from '../../api/restApi';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing } from '../../theme';
import type { TruckPlan } from '../../types';

export const CustomerTransportScreen: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<TruckPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TruckPlan | null>(null);
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPlans = async () => {
    try {
      setPlans(await mobileApi.getTruckPlans(user?.token));
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadPlans(); }, [user?.token]);

  const submitBooking = async () => {
    if (!selectedPlan || !originAddress.trim() || !destinationAddress.trim() || !cargoDescription.trim()) {
      Alert.alert('Booking details required', 'Enter pickup, destination, and cargo details before creating a shipment.');
      return;
    }
    setSubmitting(true);
    try {
      const booking = await mobileApi.createShipment({
        originAddress: originAddress.trim(),
        destinationAddress: destinationAddress.trim(),
        cargoDescription: cargoDescription.trim(),
        transportPlanId: selectedPlan.id,
      }, user?.token);
      Alert.alert('Transport booking created', `Booking reference: ${booking.bookingRef || booking.id}`);
      setSelectedPlan(null);
      setOriginAddress('');
      setDestinationAddress('');
      setCargoDescription('');
    } catch (error) {
      Alert.alert('Booking error', error instanceof Error ? error.message : 'Unable to create the shipment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Book logistics transport" subtitle="Live fleet plans and server-created shipments" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadPlans(); }} tintColor={colors.blueAccent} />}>
        {loading ? <ActivityIndicator size="large" color={colors.blueAccent} /> : null}
        {!loading && plans.length === 0 ? <Text style={styles.muted}>No transport plans are currently available for this account.</Text> : null}
        {plans.map((plan) => (
          <TouchableOpacity key={plan.id} style={[styles.plan, selectedPlan?.id === plan.id && styles.planSelected]} onPress={() => setSelectedPlan(plan)}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planMeta}>{plan.capacity} · ₹{plan.baseRateInr} + ₹{plan.perKmRateInr}/km</Text>
            <Text style={styles.planMeta}>{plan.recommendedFor}</Text>
          </TouchableOpacity>
        ))}
        {selectedPlan ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Shipment details · {selectedPlan.name}</Text>
            <TextInput value={originAddress} onChangeText={setOriginAddress} placeholder="Pickup address" placeholderTextColor={colors.textLightMuted} style={styles.input} />
            <TextInput value={destinationAddress} onChangeText={setDestinationAddress} placeholder="Destination address" placeholderTextColor={colors.textLightMuted} style={styles.input} />
            <TextInput value={cargoDescription} onChangeText={setCargoDescription} placeholder="Cargo description" placeholderTextColor={colors.textLightMuted} style={[styles.input, styles.multiline]} multiline />
            <TouchableOpacity style={styles.submit} disabled={submitting} onPress={() => void submitBooking()}>
              <Text style={styles.submitText}>{submitting ? 'Creating booking…' : 'Create transport booking'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navyDeep },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.huge * 2 },
  muted: { color: colors.textLightMuted, textAlign: 'center', marginTop: spacing.xl },
  plan: { backgroundColor: colors.navyDark, borderColor: colors.borderDark, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  planSelected: { borderColor: colors.blueAccent },
  planName: { color: colors.textLight, fontSize: 16, fontWeight: '700' },
  planMeta: { color: colors.textLightMuted, fontSize: 13, marginTop: 4 },
  form: { backgroundColor: colors.navyDark, borderColor: colors.blueAccent, borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  formTitle: { color: colors.textLight, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  input: { borderColor: colors.borderDark, borderRadius: radius.md, borderWidth: 1, color: colors.textLight, marginBottom: spacing.sm, padding: spacing.md },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  submit: { alignItems: 'center', backgroundColor: colors.bluePrimary, borderRadius: radius.md, marginTop: spacing.sm, padding: spacing.md },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
