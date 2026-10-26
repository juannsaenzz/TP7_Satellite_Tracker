import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';
import { PassPrediction } from '../../domain/models/PassPrediction';
import { SkyChartProjection } from '../../core/orbital/SkyChartProjection';

interface SkyChartProps {
  size?: number;
  pass?: PassPrediction | null;
  currentAzimuth?: number;
  currentElevation?: number;
  satelliteName?: string;
}

export const SkyChart: React.FC<SkyChartProps> = ({
  size = 300,
  pass,
  currentAzimuth,
  currentElevation,
  satelliteName = 'Satellite',
}) => {
  const center = size / 2;
  const radius = center - 26; // margin for N/S/E/W labels

  // Concentric circle radii
  const r0 = radius; // 0° elevation (horizon)
  const r30 = radius * (1.0 - 30 / 90); // 30° elevation
  const r60 = radius * (1.0 - 60 / 90); // 60° elevation

  // Trajectory path
  const trajectoryPath = pass && pass.trajectory.length > 0
    ? SkyChartProjection.buildSvgPath(pass.trajectory, center, center, radius)
    : '';

  // Key pass markers
  const aosPoint = pass ? SkyChartProjection.project(pass.aos.azimuth, pass.aos.elevation, center, center, radius) : null;
  const maxElPoint = pass ? SkyChartProjection.project(pass.maxElevation.azimuth, pass.maxElevation.elevation, center, center, radius) : null;
  const losPoint = pass ? SkyChartProjection.project(pass.los.azimuth, pass.los.elevation, center, center, radius) : null;

  // Real-time current position marker (if visible above horizon)
  const currentPosPoint =
    currentAzimuth !== undefined && currentElevation !== undefined && currentElevation >= 0
      ? SkyChartProjection.project(currentAzimuth, currentElevation, center, center, radius)
      : null;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Cosmic trajectory gradient */}
          <LinearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.accentMint} stopOpacity="1" />
            <Stop offset="50%" stopColor={colors.accentGold} stopOpacity="1" />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Sky Chart Background Disc */}
        <Circle cx={center} cy={center} r={radius} fill="#140C29" stroke={colors.cardBorder} strokeWidth="1.5" />

        {/* 30° Elevation Ring */}
        <Circle
          cx={center}
          cy={center}
          r={r30}
          fill="none"
          stroke={colors.cardElevated}
          strokeWidth="1"
          strokeDasharray="4, 4"
        />

        {/* 60° Elevation Ring */}
        <Circle
          cx={center}
          cy={center}
          r={r60}
          fill="none"
          stroke={colors.cardElevated}
          strokeWidth="1"
          strokeDasharray="4, 4"
        />

        {/* Cardinal Grid Axes */}
        {/* N - S axis */}
        <Line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke={colors.cardBorder} strokeWidth="1" />
        {/* W - E axis */}
        <Line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke={colors.cardBorder} strokeWidth="1" />

        {/* Zenith Center (90°) */}
        <Circle cx={center} cy={center} r="3" fill={colors.accentGold} />

        {/* Elevation Ring Labels */}
        <SvgText x={center + 4} y={center - r30 + 10} fill={colors.textDim} fontSize="9" fontWeight="600">
          30°
        </SvgText>
        <SvgText x={center + 4} y={center - r60 + 10} fill={colors.textDim} fontSize="9" fontWeight="600">
          60°
        </SvgText>

        {/* Cardinal Direction Labels */}
        <SvgText x={center} y={center - radius - 10} fill={colors.accentGold} fontSize="12" fontWeight="800" textAnchor="middle">
          N
        </SvgText>
        <SvgText x={center + radius + 12} y={center + 4} fill={colors.textPrimary} fontSize="11" fontWeight="700" textAnchor="middle">
          E
        </SvgText>
        <SvgText x={center} y={center + radius + 18} fill={colors.textPrimary} fontSize="11" fontWeight="700" textAnchor="middle">
          S
        </SvgText>
        <SvgText x={center - radius - 12} y={center + 4} fill={colors.textPrimary} fontSize="11" fontWeight="700" textAnchor="middle">
          O
        </SvgText>

        {/* Pass Trajectory Path */}
        {trajectoryPath.length > 0 && (
          <Path
            d={trajectoryPath}
            fill="none"
            stroke="url(#trajGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* AOS Node (Acquisition) */}
        {aosPoint && (
          <G>
            <Circle cx={aosPoint.x} cy={aosPoint.y} r="5" fill={colors.accentMint} />
            <SvgText x={aosPoint.x} y={aosPoint.y - 8} fill={colors.accentMint} fontSize="9" fontWeight="700" textAnchor="middle">
              AOS
            </SvgText>
          </G>
        )}

        {/* Max Elevation Point */}
        {maxElPoint && pass && (
          <G>
            <Circle cx={maxElPoint.x} cy={maxElPoint.y} r="6" fill={colors.accentGold} stroke="#FFFFFF" strokeWidth="1.5" />
            <SvgText
              x={maxElPoint.x}
              y={maxElPoint.y - 10}
              fill={colors.accentGold}
              fontSize="10"
              fontWeight="900"
              textAnchor="middle">
              {`${pass.maxElevation.elevation.toFixed(1)}°`}
            </SvgText>
          </G>
        )}

        {/* LOS Node (Loss of Signal) */}
        {losPoint && (
          <G>
            <Circle cx={losPoint.x} cy={losPoint.y} r="5" fill="#FF5252" />
            <SvgText x={losPoint.x} y={losPoint.y + 14} fill="#FF5252" fontSize="9" fontWeight="700" textAnchor="middle">
              LOS
            </SvgText>
          </G>
        )}

        {/* Current Satellite Live Marker */}
        {currentPosPoint && (
          <G>
            <Circle cx={currentPosPoint.x} cy={currentPosPoint.y} r="8" fill="rgba(0, 229, 255, 0.3)" />
            <Circle cx={currentPosPoint.x} cy={currentPosPoint.y} r="4" fill="#00E5FF" stroke="#FFFFFF" strokeWidth="1" />
          </G>
        )}
      </Svg>

      {/* Chart Footer Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accentMint }]} />
          <Text style={styles.legendText}>AOS (Salida)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accentGold }]} />
          <Text style={styles.legendText}>Culminación máx.</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF5252' }]} />
          <Text style={styles.legendText}>LOS (Puesta)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
});
