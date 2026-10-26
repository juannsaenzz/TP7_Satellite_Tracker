import React, { useMemo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, Polygon } from 'react-native-maps';
import { colors } from '../theme/colors';
import { Geoposition, ObserverLocation } from '../../domain/models/Geoposition';
import { GroundTrackResult } from '../../core/orbital/GroundTrackService';
import { FootprintService } from '../../core/orbital/FootprintService';

// Sleek dark cosmic Google Maps theme JSON
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0F0621' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0F0621' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9F9F9F' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#FFB845' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#201149' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070212' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#483573' }] },
];

interface WorldMapProps {
  currentPosition: Geoposition | null;
  groundTrack: GroundTrackResult | null;
  observer: ObserverLocation;
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
  satelliteName = 'Satellite',
  constellationPositions = [],
  showConstellation = false,
  showFootprint = true,
  onToggleConstellation,
  onToggleFootprint,
}) => {
  // Generate footprint polygon coordinates
  const footprintCoords = useMemo(() => {
    if (!currentPosition || !showFootprint) return [];
    return FootprintService.generateFootprintPolygon(
      currentPosition.latitude,
      currentPosition.longitude,
      currentPosition.altitude,
      10, // 10° elevation mask
      48
    );
  }, [currentPosition, showFootprint]);

  const initialRegion = {
    latitude: currentPosition ? currentPosition.latitude : 0,
    longitude: currentPosition ? currentPosition.longitude : 0,
    latitudeDelta: 70,
    longitudeDelta: 70,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={DARK_MAP_STYLE}
        showsCompass={false}
        showsScale={true}>
        {/* Footprint Coverage Area (RF-12) */}
        {footprintCoords.length > 0 && (
          <Polygon
            coordinates={footprintCoords}
            fillColor="rgba(114, 65, 248, 0.22)"
            strokeColor={colors.primary}
            strokeWidth={1.5}
          />
        )}

        {/* Past Ground Track Segments (Split at Antimeridian) (RF-11) */}
        {groundTrack?.pastSegments.map((segment, idx) => (
          <Polyline
            key={`past-${idx}`}
            coordinates={segment}
            strokeColor="rgba(114, 65, 248, 0.65)"
            strokeWidth={2}
            lineDashPattern={[6, 4]}
          />
        ))}

        {/* Future Ground Track Segments (Split at Antimeridian) (RF-11) */}
        {groundTrack?.futureSegments.map((segment, idx) => (
          <Polyline
            key={`future-${idx}`}
            coordinates={segment}
            strokeColor={colors.accentMint}
            strokeWidth={2.5}
          />
        ))}

        {/* Constellation Layer Dots (RF-13) */}
        {showConstellation &&
          constellationPositions.map(sat => (
            <Marker
              key={`const-${sat.noradId}`}
              coordinate={{ latitude: sat.latitude, longitude: sat.longitude }}
              tracksViewChanges={false}>
              <View style={styles.constellationDot} />
            </Marker>
          ))}

        {/* Observer Location Marker */}
        <Marker coordinate={{ latitude: observer.latitude, longitude: observer.longitude }}>
          <View style={styles.observerPinOuter}>
            <View style={styles.observerPinInner} />
          </View>
        </Marker>

        {/* Target Satellite Marker (RF-10) */}
        {currentPosition && (
          <Marker
            coordinate={{ latitude: currentPosition.latitude, longitude: currentPosition.longitude }}
            title={satelliteName}
            description={`Alt: ${currentPosition.altitude.toFixed(1)} km`}>
            <View style={styles.satelliteMarker}>
              <View style={styles.markerPulse} />
              <View style={styles.markerCenter}>
                <View style={styles.satelliteCoreDot} />
              </View>
              <View style={styles.markerLabelContainer}>
                <Text style={styles.markerLabelText} numberOfLines={1}>
                  {satelliteName}
                </Text>
              </View>
            </View>
          </Marker>
        )}
      </MapView>

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
              onPress={onToggleFootprint}>
              <Text style={[styles.toggleText, showFootprint && styles.toggleTextActive]}>
                Huella
              </Text>
            </TouchableOpacity>
          )}

          {onToggleConstellation && (
            <TouchableOpacity
              style={[styles.toggleButton, showConstellation && styles.toggleButtonActive]}
              onPress={onToggleConstellation}>
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
    height: 320,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 14,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  satelliteMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
  markerCenter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  satelliteCoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
  },
  markerLabelContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  markerLabelText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
  observerPinOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 184, 69, 0.35)',
    borderWidth: 1.5,
    borderColor: colors.accentGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  observerPinInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGold,
  },
  constellationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGold,
    borderWidth: 1,
    borderColor: '#FFFFFF',
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
    backgroundColor: 'rgba(15, 6, 33, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
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
    paddingHorizontal: 8,
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
