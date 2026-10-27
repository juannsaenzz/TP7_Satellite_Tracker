import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Text as SvgText, G, Polygon } from 'react-native-svg';
import { colors } from '../theme/colors';
import { CompassService, OrientationDelta } from '../../core/sensors/CompassService';
import { LookAngle } from '../../domain/models/LookAngle';

interface CompassModalProps {
  visible: boolean;
  onClose: () => void;
  targetLookAngle: LookAngle | null;
  satelliteName?: string;
  noradId?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DIAL_SIZE = Math.min(SCREEN_WIDTH - 48, 300);

export const CompassModal: React.FC<CompassModalProps> = ({
  visible,
  onClose,
  targetLookAngle,
  satelliteName = 'Satellite',
  noradId,
}) => {
  // Device simulated heading and pitch (tilt up from horizontal)
  const [deviceHeading, setDeviceHeading] = useState(0); // 0 = North
  const [devicePitch, setDevicePitch] = useState(25); // 25° tilt
  const [delta, setDelta] = useState<OrientationDelta>({
    relativeHeadingDeg: 0,
    relativePitchDeg: 0,
    isLocked: false,
    targetDistanceAngleDeg: 0,
  });

  const targetAz = targetLookAngle?.azimuth ?? 45;
  const targetEl = targetLookAngle?.elevation ?? 35;

  useEffect(() => {
    const d = CompassService.computeOrientationDelta(targetAz, targetEl, deviceHeading, devicePitch);
    setDelta(d);
  }, [deviceHeading, devicePitch, targetAz, targetEl]);

  function autoAlignToTarget() {
    setDeviceHeading(Math.round(targetAz));
    setDevicePitch(Math.round(Math.max(0, targetEl)));
  }

  const dialCenter = DIAL_SIZE / 2;
  const dialRadius = dialCenter - 22;

  // Rotation of compass needle relative to target
  const needleRotation = (targetAz - deviceHeading + 360) % 360;

  // Guidance status text
  const guidanceText = CompassService.getGuidanceText(delta);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Orientación Asistida</Text>
            <Text style={styles.headerSubtitle}>BRÚJULA Y APUNTADOR CELESTE</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Target Info Banner */}
        <View style={styles.targetBanner}>
          <View>
            <Text style={styles.targetName}>{satelliteName}</Text>
            <Text style={styles.targetMeta}>
              {noradId ? `NORAD: ${noradId}` : ''} • Az: {targetAz.toFixed(1)}° • El: {targetEl.toFixed(1)}°
            </Text>
          </View>
          <View style={[styles.lockStatusPill, delta.isLocked && styles.lockStatusPillActive]}>
            <Text style={[styles.lockStatusText, delta.isLocked && styles.lockStatusTextActive]}>
              {delta.isLocked ? 'OBJETIVO FIJADO' : 'BUSCANDO'}
            </Text>
          </View>
        </View>

        {/* Main Compass Dial (SVG) */}
        <View style={styles.dialContainer}>
          <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
            {/* Outer Compass Rim */}
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={dialRadius}
              fill="#120A24"
              stroke={delta.isLocked ? colors.accentMint : colors.cardBorder}
              strokeWidth={delta.isLocked ? 3 : 2}
            />

            {/* Inner Ring */}
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={dialRadius - 20}
              fill="none"
              stroke={colors.cardElevated}
              strokeWidth="1"
              strokeDasharray="4, 4"
            />

            {/* Center Crosshair */}
            <Line
              x1={dialCenter}
              y1={dialCenter - dialRadius + 10}
              x2={dialCenter}
              y2={dialCenter + dialRadius - 10}
              stroke={colors.cardBorder}
              strokeWidth="1"
            />
            <Line
              x1={dialCenter - dialRadius + 10}
              y1={dialCenter}
              x2={dialCenter + dialRadius - 10}
              y2={dialCenter}
              stroke={colors.cardBorder}
              strokeWidth="1"
            />

            {/* Cardinal Markers on Dial Rim */}
            <SvgText
              x={dialCenter}
              y={dialCenter - dialRadius + 16}
              fill={colors.accentGold}
              fontSize="12"
              fontWeight="900"
              textAnchor="middle">
              N
            </SvgText>
            <SvgText
              x={dialCenter + dialRadius - 14}
              y={dialCenter + 4}
              fill={colors.textPrimary}
              fontSize="11"
              fontWeight="700"
              textAnchor="middle">
              E
            </SvgText>
            <SvgText
              x={dialCenter}
              y={dialCenter + dialRadius - 8}
              fill={colors.textPrimary}
              fontSize="11"
              fontWeight="700"
              textAnchor="middle">
              S
            </SvgText>
            <SvgText
              x={dialCenter - dialRadius + 14}
              y={dialCenter + 4}
              fill={colors.textPrimary}
              fontSize="11"
              fontWeight="700"
              textAnchor="middle">
              O
            </SvgText>

            {/* Rotating Needle pointing towards the satellite */}
            <G transform={`rotate(${needleRotation}, ${dialCenter}, ${dialCenter})`}>
              {/* Satellite Target Arrow */}
              <Polygon
                points={`${dialCenter},${dialCenter - dialRadius + 24} ${dialCenter - 10},${dialCenter - 10} ${dialCenter + 10},${dialCenter - 10}`}
                fill={delta.isLocked ? colors.accentMint : colors.accentGold}
              />
              <Polygon
                points={`${dialCenter},${dialCenter + dialRadius - 24} ${dialCenter - 7},${dialCenter + 10} ${dialCenter + 7},${dialCenter + 10}`}
                fill={colors.cardElevated}
              />
              {/* Target Satellite Icon Dot */}
              <Circle
                cx={dialCenter}
                cy={dialCenter - dialRadius + 30}
                r="6"
                fill={delta.isLocked ? colors.accentMint : colors.primary}
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </G>

            {/* Central Pivot */}
            <Circle
              cx={dialCenter}
              cy={dialCenter}
              r={7}
              fill={delta.isLocked ? colors.accentMint : colors.accentGold}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
          </Svg>
        </View>

        {/* Guidance Prompt Banner */}
        <View style={[styles.guidanceBox, delta.isLocked && styles.guidanceBoxLocked]}>
          <Text style={[styles.guidanceText, delta.isLocked && styles.guidanceTextLocked]}>
            {guidanceText}
          </Text>
        </View>

        {/* Real-time Angle Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>RUMBO DEL DISPOSITIVO</Text>
            <Text style={styles.metricValue}>{Math.round(deviceHeading)}°</Text>
            <Text style={styles.metricSub}>Azimut obj: {Math.round(targetAz)}°</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>INCLINACIÓN (PITCH)</Text>
            <Text style={styles.metricValue}>{Math.round(devicePitch)}°</Text>
            <Text style={styles.metricSub}>Elevación obj: {Math.round(targetEl)}°</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>DESFASE ANGULAR</Text>
            <Text style={[styles.metricValue, delta.isLocked ? styles.textMint : styles.textGold]}>
              {delta.targetDistanceAngleDeg.toFixed(1)}°
            </Text>
            <Text style={styles.metricSub}>{delta.isLocked ? 'En haz' : 'Alinear teléfono'}</Text>
          </View>
        </View>

        {/* Interactive Calibration & Simulation Controls */}
        <View style={styles.controlsSection}>
          <Text style={styles.controlsSectionTitle}>CONTROLES DE ORIENTACIÓN (SIMULAR / CALIBRAR)</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => setDeviceHeading((deviceHeading - 15 + 360) % 360)}>
              <Text style={styles.adjustButtonText}>↶ Girar -15°</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => setDeviceHeading((deviceHeading + 15) % 360)}>
              <Text style={styles.adjustButtonText}>Girar +15° ↷</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => setDevicePitch(Math.max(0, devicePitch - 10))}>
              <Text style={styles.adjustButtonText}>Bajar -10°</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adjustButton}
              onPress={() => setDevicePitch(Math.min(90, devicePitch + 10))}>
              <Text style={styles.adjustButtonText}>Subir +10°</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.autoAlignButton} onPress={autoAlignToTarget}>
            <Text style={styles.autoAlignButtonText}>AUTO-ALINEAR AL SATÉLITE (BLOQUEO DEMO)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.accentGold,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  targetBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  targetName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  targetMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  lockStatusPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  lockStatusPillActive: {
    backgroundColor: 'rgba(125, 255, 175, 0.15)',
    borderColor: colors.accentMint,
  },
  lockStatusText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockStatusTextActive: {
    color: colors.accentMint,
  },
  dialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  guidanceBox: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
  },
  guidanceBoxLocked: {
    backgroundColor: 'rgba(125, 255, 175, 0.12)',
    borderColor: colors.accentMint,
  },
  guidanceText: {
    color: colors.accentGold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  guidanceTextLocked: {
    color: colors.accentMint,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  metricLabel: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  metricSub: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 2,
  },
  textMint: {
    color: colors.accentMint,
  },
  textGold: {
    color: colors.accentGold,
  },
  controlsSection: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  controlsSectionTitle: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  adjustButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  adjustButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  autoAlignButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  autoAlignButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
