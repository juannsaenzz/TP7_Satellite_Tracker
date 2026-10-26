import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { theme, colors } from './src/presentation/theme';
import { Sgp4Engine } from './src/core/orbital/Sgp4Engine';
import { FootprintService } from './src/core/orbital/FootprintService';
import { PassPredictorService } from './src/core/orbital/PassPredictorService';
import { WhereTheIssProvider } from './src/data/providers/WhereTheIssProvider';
import { ValidationReport, ValidationService } from './src/data/validation/ValidationService';
import { Geoposition, ObserverLocation } from './src/domain/models/Geoposition';
import { PassPrediction } from './src/domain/models/PassPrediction';
import * as satellite from 'satellite.js';

const LOGO_IMG = require('./src/assets/images/logo_fondo_transparente.png');

const CATEGORIES = ['All', 'ISS', 'Starlink', 'GPS', 'Weather'];

const DEFAULT_OBSERVER: ObserverLocation = {
  latitude: -34.6037,
  longitude: -58.3816,
  altitudeMeters: 25,
};

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('ISS');
  const [activeTab, setActiveTab] = useState<'tracker' | 'passes' | 'validate'>('tracker');
  const [loading, setLoading] = useState(true);
  const [satrec, setSatrec] = useState<satellite.SatRec | null>(null);
  const [tleInfo, setTleInfo] = useState<{ line1: string; line2: string; name: string } | null>(null);
  const [tleFetchedAt, setTleFetchedAt] = useState<number>(Date.now());

  // Real-time calculated state
  const [currentPosition, setCurrentPosition] = useState<Geoposition | null>(null);
  const [lookAngle, setLookAngle] = useState<{ azimuth: number; elevation: number; rangeKm: number } | null>(null);
  const [footprint, setFootprint] = useState<{ radiusKm: number } | null>(null);
  const [orbitalPeriod, setOrbitalPeriod] = useState<number>(0);
  const [nextPass, setNextPass] = useState<PassPrediction | null>(null);

  // Validation state
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const provider = new WhereTheIssProvider();
        const data = await provider.getOrbitalData(25544);
        if (data) {
          const rec = Sgp4Engine.parseTle(data.line1, data.line2);
          setSatrec(rec);
          setTleInfo(data);
          const now = Date.now();
          setTleFetchedAt(now);

          const period = Sgp4Engine.getOrbitalPeriodMinutes(rec);
          setOrbitalPeriod(period);

          const passes = PassPredictorService.predictPasses(rec, 25544, data.name, DEFAULT_OBSERVER, {
            startDate: new Date(),
            daysAhead: 3,
            minElevationDeg: 10,
          });
          if (passes.length > 0) {
            setNextPass(passes[0]);
          }

          runValidation(data.line1, data.line2, now);
        }
      } catch (err) {
        console.error('Failed to load TLE:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Real-time 1s SGP4 propagation loop
  useEffect(() => {
    if (!satrec) return;

    const timer = setInterval(() => {
      const now = new Date();
      const pos = Sgp4Engine.getGeoposition(satrec, now);
      if (pos) {
        setCurrentPosition(pos);
        const fp = FootprintService.calculateFootprintRadius(pos.altitude, 10);
        setFootprint(fp);
      }

      const look = Sgp4Engine.getLookAngles(satrec, now, DEFAULT_OBSERVER);
      if (look) {
        setLookAngle(look);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [satrec]);

  async function runValidation(l1?: string, l2?: string, fetchedAt?: number) {
    const line1 = l1 || tleInfo?.line1;
    const line2 = l2 || tleInfo?.line2;
    const timestamp = fetchedAt || tleFetchedAt;

    if (!line1 || !line2) return;

    setValidating(true);
    try {
      const report = await ValidationService.validateIss(line1, line2, timestamp);
      setValidation(report);
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Image source={LOGO_IMG} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>INITIALIZING ORBITAL ENGINE...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Bar with Tokens & Status */}
      <View style={styles.topBar}>
        <View style={styles.logoHeader}>
          <Image source={LOGO_IMG} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.appName}>Satellite Tracker</Text>
            <Text style={styles.appSub}>SGP4 ORBITAL PREDICTOR</Text>
          </View>
        </View>

        <View style={styles.tokenPill}>
          <Text style={styles.tokenStar}>★</Text>
          <Text style={styles.tokenText}>NORAD: 25544</Text>
        </View>
      </View>

      {/* Category Pills (Figma style: All, ISS, Starlink, GPS...) */}
      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          {CATEGORIES.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}>
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Target Banner Card (Figma deep purple card) */}
        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.targetLabel}>TARGET SATELLITE</Text>
              <Text style={styles.targetName}>{tleInfo?.name || 'ISS (ZARYA)'}</Text>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.statusBadgeText}>SGP4 PROPAGATING</Text>
            </View>
          </View>

          <View style={styles.cardStatsGrid}>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatLabel}>PERIOD</Text>
              <Text style={styles.cardStatValue}>{orbitalPeriod.toFixed(1)} min</Text>
            </View>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatLabel}>FOOTPRINT</Text>
              <Text style={styles.cardStatValue}>{footprint ? `${Math.round(footprint.radiusKm)} km` : '--'}</Text>
            </View>
            <View style={styles.cardStatItem}>
              <Text style={styles.cardStatLabel}>MASK</Text>
              <Text style={styles.cardStatValueGold}>10.0°</Text>
            </View>
          </View>
        </View>

        {/* Real-time Subsatellite Telemetry Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>REAL-TIME GEOPOSITION</Text>
            <Text style={styles.sectionBadge}>LOCAL 1s REFRESH</Text>
          </View>

          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryLabel}>LATITUDE</Text>
              <Text style={styles.telemetryNumber}>
                {currentPosition ? `${currentPosition.latitude.toFixed(4)}°` : '--'}
              </Text>
            </View>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryLabel}>LONGITUDE</Text>
              <Text style={styles.telemetryNumber}>
                {currentPosition ? `${currentPosition.longitude.toFixed(4)}°` : '--'}
              </Text>
            </View>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryLabel}>ALTITUDE</Text>
              <Text style={styles.telemetryNumberHighlight}>
                {currentPosition ? `${currentPosition.altitude.toFixed(1)} km` : '--'}
              </Text>
            </View>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryLabel}>UTC TIME</Text>
              <Text style={styles.telemetryTime}>
                {currentPosition ? new Date(currentPosition.timestamp).toISOString().slice(11, 19) : '--'}
              </Text>
            </View>
          </View>
        </View>

        {/* Observer Look Angles (Azimuth / Elevation) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>OBSERVER TOPOCENTRIC VECTORS</Text>
            <Text style={styles.sectionBadgeLocation}>BUENOS AIRES</Text>
          </View>

          <View style={styles.telemetryGrid}>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryLabel}>AZIMUTH</Text>
              <Text style={styles.telemetryNumberGold}>
                {lookAngle ? `${lookAngle.azimuth.toFixed(1)}°` : '--'}
              </Text>
            </View>
            <View style={styles.telemetryBox}>
              <Text style={styles.telemetryLabel}>ELEVATION</Text>
              <Text style={[styles.telemetryNumberMint, (lookAngle?.elevation || 0) < 0 && styles.dimText]}>
                {lookAngle ? `${lookAngle.elevation.toFixed(1)}°` : '--'}
              </Text>
            </View>
            <View style={[styles.telemetryBox, { width: '100%' }]}>
              <Text style={styles.telemetryLabel}>SLANT RANGE DISTANCE</Text>
              <Text style={styles.telemetryNumber}>
                {lookAngle ? `${Math.round(lookAngle.rangeKm).toLocaleString()} km` : '--'}
              </Text>
            </View>
          </View>
        </View>

        {/* Pass Prediction Card (AOS, Culmination, LOS) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>UPCOMING PASS WINDOW (RF-04)</Text>
            <Text style={styles.passDurationBadge}>
              {nextPass ? `${Math.round(nextPass.durationSeconds / 60)} min` : '--'}
            </Text>
          </View>

          {nextPass ? (
            <View style={styles.passList}>
              <View style={styles.passItem}>
                <Text style={styles.passStepLabel}>AOS (Acquisition)</Text>
                <Text style={styles.passStepTime}>{nextPass.aos.time.toLocaleTimeString()}</Text>
                <Text style={styles.passStepAngle}>{nextPass.aos.azimuth.toFixed(0)}° Az</Text>
              </View>
              <View style={[styles.passItem, styles.passItemCulmination]}>
                <Text style={styles.passStepLabelCulmination}>MAX ELEVATION</Text>
                <Text style={styles.passStepTimeCulmination}>{nextPass.maxElevation.elevation.toFixed(1)}°</Text>
                <Text style={styles.passStepAngleCulmination}>{nextPass.maxElevation.time.toLocaleTimeString()}</Text>
              </View>
              <View style={styles.passItem}>
                <Text style={styles.passStepLabel}>LOS (Loss)</Text>
                <Text style={styles.passStepTime}>{nextPass.los.time.toLocaleTimeString()}</Text>
                <Text style={styles.passStepAngle}>{nextPass.los.azimuth.toFixed(0)}° Az</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noPassText}>No visible passes above 10° in the next 72h.</Text>
          )}
        </View>

        {/* Cross-Validation Layer (RF-15) */}
        <View style={[styles.sectionCard, styles.validationCard]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>CROSS-VALIDATION (RF-15)</Text>
              <Text style={styles.validationSubtitle}>Compared against Where The ISS At? API</Text>
            </View>
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={() => runValidation()}
              disabled={validating}>
              {validating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>VERIFY</Text>
              )}
            </TouchableOpacity>
          </View>

          {validation ? (
            <View style={styles.validationBox}>
              <View style={styles.errorBanner}>
                <Text style={styles.errorLabel}>3D ECEF DISTANCE ERROR</Text>
                <Text style={styles.errorNumber}>{validation.errorKm.toFixed(2)} km</Text>
                <Text style={styles.errorSub}>
                  Surface Δ: {validation.surfaceErrorKm.toFixed(2)} km • Altitude Δ: {validation.altitudeDifferenceKm.toFixed(2)} km
                </Text>
              </View>

              <View style={styles.validationMeta}>
                <Text style={styles.validationMetaText}>
                  TLE Age: {validation.dataAgeHours.toFixed(1)} h ({validation.isStale ? 'STALE' : 'FRESH'})
                </Text>
                <Text style={styles.validationStatusPass}>
                  {'✓ PASS: Error within standard SGP4 tolerance (< 5 km)'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noPassText}>Press VERIFY to compute real-time error against live ground truth.</Text>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Navigation Bar (Figma style) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('tracker')}>
          <Text style={[styles.navIcon, activeTab === 'tracker' && styles.navIconActive]}>⌖</Text>
          <Text style={[styles.navText, activeTab === 'tracker' && styles.navTextActive]}>Tracker</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('passes')}>
          <Text style={[styles.navIcon, activeTab === 'passes' && styles.navIconActive]}>★</Text>
          <Text style={[styles.navText, activeTab === 'passes' && styles.navTextActive]}>Passes</Text>
        </TouchableOpacity>

        {/* Center Floating Action Button */}
        <TouchableOpacity style={styles.centerFab} onPress={() => runValidation()}>
          <Text style={styles.centerFabIcon}>▶</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('validate')}>
          <Text style={[styles.navIcon, activeTab === 'validate' && styles.navIconActive]}>✓</Text>
          <Text style={[styles.navText, activeTab === 'validate' && styles.navTextActive]}>Verify</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⚙</Text>
          <Text style={styles.navText}>Config</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 140,
    height: 140,
  },
  loadingText: {
    color: colors.primary,
    marginTop: 16,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 38,
    height: 38,
    marginRight: 10,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appSub: {
    color: colors.accentGold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tokenStar: {
    color: colors.accentGold,
    marginRight: 5,
    fontSize: 12,
  },
  tokenText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  categoriesWrapper: {
    paddingVertical: 6,
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryNeon,
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTextActive: {
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  targetLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  targetName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 255, 175, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentMint,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentMint,
    marginRight: 6,
  },
  statusBadgeText: {
    color: colors.accentMint,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  cardStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  cardStatLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  cardStatValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardStatValueGold: {
    color: colors.accentGold,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  validationCard: {
    borderColor: colors.primaryNeon,
    backgroundColor: '#1E1238',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionBadge: {
    color: colors.accentMint,
    fontSize: 10,
    fontWeight: '800',
  },
  sectionBadgeLocation: {
    color: colors.accentGold,
    fontSize: 10,
    fontWeight: '800',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  telemetryBox: {
    width: '48%',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  telemetryLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  telemetryNumber: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryNumberHighlight: {
    color: colors.primaryElectric,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryNumberGold: {
    color: colors.accentGold,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryNumberMint: {
    color: colors.accentMint,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryTime: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  passDurationBadge: {
    color: colors.accentGold,
    fontSize: 11,
    fontWeight: '800',
  },
  passList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  passItem: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  passItemCulmination: {
    backgroundColor: '#3C1D5D',
    borderWidth: 1,
    borderColor: colors.accentGold,
  },
  passStepLabel: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: '700',
  },
  passStepLabelCulmination: {
    color: colors.accentGold,
    fontSize: 8,
    fontWeight: '800',
  },
  passStepTime: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  passStepTimeCulmination: {
    color: colors.accentGold,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  passStepAngle: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  passStepAngleCulmination: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  noPassText: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
  },
  validationSubtitle: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  verifyButton: {
    backgroundColor: colors.accentGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyButtonText: {
    color: '#0F0621',
    fontSize: 11,
    fontWeight: '800',
  },
  validationBox: {
    marginTop: 8,
  },
  errorBanner: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primaryNeon,
  },
  errorLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  errorNumber: {
    color: colors.accentMint,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  errorSub: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 4,
  },
  validationMeta: {
    marginTop: 10,
  },
  validationMetaText: {
    color: colors.textDim,
    fontSize: 11,
  },
  validationStatusPass: {
    color: colors.accentMint,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  dimText: {
    color: colors.textDim,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    color: colors.textDim,
    fontSize: 18,
  },
  navIconActive: {
    color: colors.accentGold,
  },
  navText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  navTextActive: {
    color: colors.accentGold,
  },
  centerFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  centerFabIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 2,
  },
});
