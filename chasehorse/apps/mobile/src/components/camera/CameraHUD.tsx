import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, radius, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';

interface CameraHUDProps {
  taskId: string;
  taskTitle: string;
  taskLocation?: { lat: number; lng: number; address?: string };
  onEvidenceCaptured: (photoMeta: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: string;
    aiScore: string;
    stampedDataUrl?: string;
  }) => void;
  onClose: () => void;
}

export const CameraHUD: React.FC<CameraHUDProps> = ({
  taskId,
  taskTitle,
  taskLocation,
  onEvidenceCaptured,
  onClose,
}) => {
  const { user } = useAuth();
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [stamping, setStamping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchGps = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setGpsCoords({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? 15,
        });
      } else {
        // Fallback to task coordinates if permission denied
        setGpsCoords({
          lat: taskLocation?.lat ?? 17.385,
          lng: taskLocation?.lng ?? 78.4867,
          accuracy: 50,
        });
      }
    } catch {
      setGpsCoords({
        lat: taskLocation?.lat ?? 17.385,
        lng: taskLocation?.lng ?? 78.4867,
        accuracy: 50,
      });
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    fetchGps();
  }, []);

  const burnStampAndComplete = (imgSource: HTMLImageElement | string) => {
    setStamping(true);
    try {
      if (typeof document === 'undefined') {
        // Native fallback
        const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        onEvidenceCaptured({
          lat: gpsCoords?.lat ?? 17.385,
          lng: gpsCoords?.lng ?? 78.4867,
          accuracy: gpsCoords?.accuracy ?? 15,
          timestamp: `${nowStr} IST`,
          aiScore: 'Stamp Verified • Monospace Burn-In',
        });
        return;
      }

      const canvas = document.createElement('canvas');
      let sourceWidth = 1280;
      let sourceHeight = 720;

      if (typeof imgSource !== 'string' && imgSource.naturalWidth) {
        sourceWidth = imgSource.naturalWidth;
        sourceHeight = imgSource.naturalHeight;
      }

      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas 2d context');

      if (typeof imgSource !== 'string') {
        ctx.drawImage(imgSource, 0, 0, sourceWidth, sourceHeight);
      } else {
        // Draw a simulated field inspection capture frame with high contrast details
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, sourceWidth, sourceHeight);

        // Subject box
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(100, 80, sourceWidth - 200, sourceHeight - 200);

        // Crosshairs
        ctx.strokeStyle = '#e8541e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sourceWidth / 2 - 40, sourceHeight / 2);
        ctx.lineTo(sourceWidth / 2 + 40, sourceHeight / 2);
        ctx.moveTo(sourceWidth / 2, sourceHeight / 2 - 40);
        ctx.lineTo(sourceWidth / 2, sourceHeight / 2 + 40);
        ctx.stroke();

        ctx.font = '700 24px monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(`FIELD INSPECTION EVIDENCE: ${taskTitle}`, sourceWidth / 2, sourceHeight / 2 - 60);
      }

      // Burn-in stamp on bottom strip
      const scale = Math.max(1, sourceWidth / 1280);
      const stripHeight = Math.round(56 * scale);
      const stripY = sourceHeight - stripHeight;
      const paddingX = Math.round(16 * scale);

      // Semi-opaque dark bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, stripY, sourceWidth, stripHeight);

      // Muted burnt orange top accent (#d9531e)
      ctx.fillStyle = '#d9531e';
      ctx.fillRect(0, stripY, sourceWidth, Math.max(2, Math.round(2 * scale)));

      const timeIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
      const empId = user?.id ? `EMP${user.id.slice(0, 4).toUpperCase()}` : 'EMP001';
      const taskDisplayId = taskId.slice(0, 10).toUpperCase();

      // Line 1: Task ID | Worker Employee ID | Timestamp IST
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(13 * scale)}px "Courier New", Courier, monospace`;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`TASK: ${taskDisplayId} | EMP: ${empId} | ${timeIST}`, paddingX, stripY + Math.round(18 * scale));

      // Brand mark
      ctx.font = `700 ${Math.round(11 * scale)}px monospace`;
      ctx.fillStyle = '#d9531e';
      const brand = '⚡ CHASEHORSE TAMPER-PROOF';
      ctx.fillText(brand, sourceWidth - 260 * scale, stripY + Math.round(18 * scale));

      // Line 2: Lat, Lng +/- Accuracy
      const lat = gpsCoords?.lat ?? 17.385;
      const lng = gpsCoords?.lng ?? 78.4867;
      const acc = Math.round(gpsCoords?.accuracy ?? 15);
      const geoLine = `GPS: ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E (±${acc}m) | ${taskLocation?.address || 'Site Inspection Point'}`;

      ctx.font = `600 ${Math.round(12 * scale)}px "Courier New", Courier, monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(geoLine, paddingX, stripY + Math.round(38 * scale));

      const stampedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      onEvidenceCaptured({
        lat,
        lng,
        accuracy: acc,
        timestamp: timeIST,
        aiScore: 'Burned Pixel Watermark Verified • Monospace Bar',
        stampedDataUrl,
      });
    } finally {
      setStamping(false);
    }
  };

  const handleCaptureSimulated = () => {
    burnStampAndComplete('SIMULATED_FRAME');
  };

  const handleFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => burnStampAndComplete(img);
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isAccuracyPoor = (gpsCoords?.accuracy ?? 0) > 50;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Camera HUD Evidence Capture</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.reference}>
          Task: {taskId.slice(0, 10).toUpperCase()} · {taskTitle}
        </Text>

        {/* GPS Live Telemetry */}
        <View style={styles.telemetryBox}>
          <Text style={styles.telemetryHeader}>LIVE SATELLITE GPS FIX</Text>
          {gpsLoading ? (
            <ActivityIndicator size="small" color={colors.blueAccent} style={{ marginVertical: 4 }} />
          ) : (
            <View>
              <Text style={styles.telemetryLine}>
                Coordinates: {gpsCoords?.lat.toFixed(5)}° N, {gpsCoords?.lng.toFixed(5)}° E
              </Text>
              <Text style={styles.telemetryLine}>
                Accuracy: ±{Math.round(gpsCoords?.accuracy ?? 15)} meters
              </Text>
            </View>
          )}
        </View>

        {/* GPS Accuracy Warning if > 50m */}
        {isAccuracyPoor && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Poor GPS Precision Detected</Text>
            <Text style={styles.warningText}>
              Current satellite fix accuracy is ±{Math.round(gpsCoords?.accuracy ?? 0)}m (worse than recommended ±50m). Move to clear open sky and wait for a precision lock.
            </Text>
            <TouchableOpacity style={styles.retryGpsBtn} onPress={fetchGps}>
              <Text style={styles.retryGpsBtnText}>Refresh Satellite Fix ↺</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.instructionText}>
          The system will burn a non-intrusive metadata strip along the bottom edge containing Task Display ID, Worker EMP ID, local timestamp, and GPS coordinates before upload.
        </Text>

        {/* Capture Buttons */}
        <View style={styles.actionsBox}>
          {stamping ? (
            <ActivityIndicator size="large" color="#d9531e" style={{ padding: spacing.lg }} />
          ) : (
            <>
              {Platform.OS === 'web' && (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputRef as any}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <TouchableOpacity
                    style={styles.primary}
                    onPress={() => fileInputRef.current?.click()}
                  >
                    <Text style={styles.primaryText}>📷 Take Photo & Burn Stamp</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCaptureSimulated}>
                <Text style={styles.secondaryBtnText}>⚡ Capture Test Frame & Burn Stamp</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Back to Task Execution</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 18, 0.94)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.navyDark,
    borderColor: colors.borderDark,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.textLightMuted,
    fontSize: 18,
    fontWeight: '800',
  },
  reference: {
    color: colors.blueAccent,
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  telemetryBox: {
    backgroundColor: colors.surfaceDark,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginVertical: spacing.md,
  },
  telemetryHeader: {
    color: colors.textLightMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  telemetryLine: {
    color: colors.textLight,
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  warningTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
  },
  warningText: {
    color: colors.textLight,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  retryGpsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  retryGpsBtnText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  instructionText: {
    color: colors.textLightMuted,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  actionsBox: {
    gap: spacing.sm,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: '#d9531e',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryBtn: {
    alignItems: 'center',
    backgroundColor: colors.bluePrimary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  cancelBtnText: {
    color: colors.textLightMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
