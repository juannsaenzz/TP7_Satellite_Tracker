import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
  Text as SvgText,
  Polygon as SvgPolygon,
  Polyline as SvgPolyline,
  G,
} from 'react-native-svg';
import { colors } from '../theme/colors';
import { Geoposition, ObserverLocation } from '../../domain/models/Geoposition';
import { GroundTrackResult } from '../../core/orbital/GroundTrackService';
import { FootprintService } from '../../core/orbital/FootprintService';
import { WORLD_CONTINENTS_SVG_PATH } from './WorldCoastlines';

interface WorldMapProps {
  currentPosition: Geoposition | null;
  groundTrack: GroundTrackResult | null;
  observer: ObserverLocation;
  observerName?: string;
  satelliteName?: string;
  constellationPositions?: { noradId: number; name: string; latitude: number; longitude: number }[];
  showConstellation?: boolean;
  showFootprint?: boolean;
  onToggleConstellation?: () => void;
  onToggleFootprint?: () => void;
}

export const WorldMap: React.FC<WorldMapProps> = ({
  currentPosition,
  groundTrack,
  observer,
  observerName,
  satelliteName = 'Satellite',
  constellationPositions = [],
  showConstellation = false,
  showFootprint = true,
  onToggleConstellation,
  onToggleFootprint,
}) => {
  // Generate footprint polygon coordinates
  const footprintPoints = useMemo(() => {
    if (!currentPosition || !showFootprint) return '';
    const coords = FootprintService.generateFootprintPolygon(
      currentPosition.latitude,
      currentPosition.longitude,
      currentPosition.altitude,
      10,
      36
    );
    return coords
      .map(p => `${(p.longitude + 180).toFixed(1)},${(90 - p.latitude).toFixed(1)}`)
      .join(' ');
  }, [currentPosition, showFootprint]);

  // Project observer
  const obsX = Math.max(0, Math.min(360, observer.longitude + 180));
  const obsY = Math.max(0, Math.min(180, 90 - observer.latitude));

  // Project satellite
  const satX = currentPosition
    ? Math.max(0, Math.min(360, currentPosition.longitude + 180))
    : 180;
  const satY = currentPosition
    ? Math.max(0, Math.min(180, 90 - currentPosition.latitude))
    : 90;

  return (
    <View style={styles.container}>
      <Svg viewBox="0 0 360 180" style={styles.svgMap}>
        {/* Ocean Background */}
        <Rect x="0" y="0" width="360" height="180" fill="#0C071F" />

        {/* Coordinate Grid: Latitude & Longitude */}
        <G stroke="#221245" strokeWidth="0.6" strokeDasharray="3,3">
          {/* Equator & Prime Meridian */}
          <Line x1="0" y1="90" x2="360" y2="90" stroke="#36206B" strokeWidth="0.8" />
          <Line x1="180" y1="0" x2="180" y2="180" stroke="#36206B" strokeWidth="0.8" />
          {/* Tropics */}
          <Line x1="0" y1="66.5" x2="360" y2="66.5" />
          <Line x1="0" y1="113.5" x2="360" y2="113.5" />
          {/* Meridians */}
          <Line x1="90" y1="0" x2="90" y2="180" />
          <Line x1="270" y1="0" x2="270" y2="180" />
        </G>

        {/* Continents and Landmasses */}
        <Path
          d={WORLD_CONTINENTS_SVG_PATH}
          fill="#1C1138"
          stroke="#39246B"
          strokeWidth="0.6"
        />

        {/* Footprint Coverage Area */}
        {showFootprint && footprintPoints !== '' && (
          <SvgPolygon
            points={footprintPoints}
            fill="rgba(114, 65, 248, 0.22)"
            stroke="#8B5CF6"
            strokeWidth="0.8"
          />
        )}

        {/* Past Ground Track Segments */}
        {groundTrack?.pastSegments.map((segment, idx) => {
          const pts = segment
            .map(p => `${(p.longitude + 180).toFixed(1)},${(90 - p.latitude).toFixed(1)}`)
            .join(' ');
          return (
            <SvgPolyline
              key={`past-${idx}`}
              points={pts}
              stroke="rgba(114, 65, 248, 0.75)"
              strokeWidth="1.6"
              strokeDasharray="4,3"
            />
          );
        })}

        {/* Future Ground Track Segments */}
        {groundTrack?.futureSegments.map((segment, idx) => {
          const pts = segment
            .map(p => `${(p.longitude + 180).toFixed(1)},${(90 - p.latitude).toFixed(1)}`)
            .join(' ');
          return (
            <SvgPolyline
              key={`future-${idx}`}
              points={pts}
              stroke={colors.accentMint}
              strokeWidth="2.2"
            />
          );
        })}

        {/* Constellation Layer Dots */}
        {showConstellation &&
          constellationPositions.map(sat => (
            <Circle
              key={`const-${sat.noradId}`}
              cx={Math.max(0, Math.min(360, sat.longitude + 180))}
              cy={Math.max(0, Math.min(180, 90 - sat.latitude))}
              r="1.8"
              fill={colors.accentGold}
            />
          ))}

        {/* Observer Location Pin */}
        <G>
          <Circle
            cx={obsX}
            cy={obsY}
            r="4.5"
            fill="rgba(255, 184, 69, 0.3)"
            stroke={colors.accentGold}
            strokeWidth="0.8"
          />
          <Circle cx={obsX} cy={obsY} r="1.8" fill={colors.accentGold} />
          <SvgText
            x={obsX > 280 ? obsX - 5 : obsX + 4}
            y={obsY > 165 ? obsY - 4 : obsY + 2}
            textAnchor={obsX > 280 ? 'end' : 'start'}
            fill={colors.accentGold}
            fontSize="5.5"
            fontWeight="bold">
            {observerName || 'Observador'}
          </SvgText>
        </G>

        {/* Target Satellite Marker with Pulse & Label */}
        {currentPosition && (
          <G>
            {/* Pulse outer ring */}
            <Circle
              cx={satX}
              cy={satY}
              r="6.5"
              fill="rgba(0, 229, 255, 0.25)"
              stroke="#00E5FF"
              strokeWidth="0.8"
            />
            {/* Satellite core */}
            <Circle cx={satX} cy={satY} r="2.8" fill="#00E5FF" />
            {/* Satellite label tag */}
            <Rect
              x={satX - 16}
              y={satY - 13}
              width="32"
              height="8"
              rx="2.5"
              fill="rgba(15, 6, 33, 0.9)"
              stroke="#00E5FF"
              strokeWidth="0.5"
            />
            <SvgText
              x={satX}
              y={satY - 7.5}
              fill="#FFFFFF"
              fontSize="4.8"
              fontWeight="bold"
              textAnchor="middle">
              {satelliteName.substring(0, 10).toUpperCase()}
            </SvgText>
          </G>
        )}
      </Svg>

      {/* Map Control Floating Badges */}
      <View style={styles.controlsOverlay}>
        <View style={styles.trackLegend}>
          <View style={styles.legendRow}>
            <View style={[styles.legendBar, { backgroundColor: colors.accentMint }]} />
            <Text style={styles.legendText}>Órbita futura</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendBar, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>Órbita pasada</Text>
          </View>
        </View>

        <View style={styles.buttonsRow}>
          {onToggleFootprint && (
            <TouchableOpacity
              style={[styles.toggleButton, showFootprint && styles.toggleButtonActive]}
              onPress={onToggleFootprint}
              activeOpacity={0.7}>
              <Text style={[styles.toggleText, showFootprint && styles.toggleTextActive]}>
                Huella
              </Text>
            </TouchableOpacity>
          )}

          {onToggleConstellation && (
            <TouchableOpacity
              style={[styles.toggleButton, showConstellation && styles.toggleButtonActive]}
              onPress={onToggleConstellation}
              activeOpacity={0.7}>
              <Text style={[styles.toggleText, showConstellation && styles.toggleTextActive]}>
                Constelación
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 240,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0C071F',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 14,
    position: 'relative',
  },
  svgMap: {
    width: '100%',
    height: '100%',
  },
  controlsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    pointerEvents: 'box-none',
  },
  trackLegend: {
    backgroundColor: 'rgba(15, 6, 33, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  legendBar: {
    width: 14,
    height: 3,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  buttonsRow: {
    flexDirection: 'row',
  },
  toggleButton: {
    backgroundColor: 'rgba(32, 17, 73, 0.85)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginLeft: 6,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryNeon,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: colors.textPrimary,
  },
});
