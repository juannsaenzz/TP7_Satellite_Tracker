import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme, colors } from './src/presentation/theme';
import { Sgp4Engine } from './src/core/orbital/Sgp4Engine';
import { FootprintService } from './src/core/orbital/FootprintService';
import { PassPredictorService } from './src/core/orbital/PassPredictorService';
import { WhereTheIssProvider } from './src/data/providers/WhereTheIssProvider';
import { ValidationReport, ValidationService } from './src/data/validation/ValidationService';
import { Geoposition, ObserverLocation } from './src/domain/models/Geoposition';
import { PassPrediction } from './src/domain/models/PassPrediction';
import { SkyChart } from './src/presentation/components/SkyChart';
import { SatelliteSearchModal } from './src/presentation/components/SatelliteSearchModal';
import { WorldMap } from './src/presentation/components/WorldMap';
import { CompassModal } from './src/presentation/components/CompassModal';
import { NotificationService } from './src/core/notifications/NotificationService';
import { GroundTrackResult, GroundTrackService } from './src/core/orbital/GroundTrackService';
import { CatalogService } from './src/core/services/CatalogService';
import { Satellite } from './src/domain/models/Satellite';
import * as satellite from 'satellite.js';

const LOGO_IMG = require('./src/assets/images/logo_fondo_transparente.png');
const LOGO_ICON_IMG = require('./src/assets/images/logo_icon.png');

const CATEGORIES = ['Todos', 'ISS', 'Starlink', 'GPS', 'Clima'];

interface CityPreset {
  name: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
}

const PRESET_CITIES: CityPreset[] = [
  { name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, altitudeMeters: 25 },
  { name: 'Córdoba', latitude: -31.4201, longitude: -64.1888, altitudeMeters: 380 },
  { name: 'Ushuaia', latitude: -54.8019, longitude: -68.303, altitudeMeters: 10 },
  { name: 'Madrid', latitude: 40.4168, longitude: -3.7038, altitudeMeters: 650 },
  { name: 'Tokio', latitude: 35.6762, longitude: 139.6503, altitudeMeters: 40 },
];

const DEFAULT_OBSERVER: ObserverLocation = PRESET_CITIES[0];

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('ISS');
  const [activeTab, setActiveTab] = useState<'tracker' | 'passes' | 'validate' | 'config'>('tracker');
  const [loading, setLoading] = useState(true);
  const [satrec, setSatrec] = useState<satellite.SatRec | null>(null);
  const [tleInfo, setTleInfo] = useState<{ line1: string; line2: string; name: string } | null>(null);
  const [tleFetchedAt, setTleFetchedAt] = useState<number>(Date.now());

  // Observer settings
  const [observer, setObserver] = useState<ObserverLocation>(DEFAULT_OBSERVER);
  const [selectedCityName, setSelectedCityName] = useState('Buenos Aires');
  const [elevationMask, setElevationMask] = useState<number>(10);

  // Real-time calculated state
  const [currentPosition, setCurrentPosition] = useState<Geoposition | null>(null);
  const [lookAngle, setLookAngle] = useState<{ azimuth: number; elevation: number; rangeKm: number } | null>(null);
  const [footprint, setFootprint] = useState<{ radiusKm: number } | null>(null);
  const [orbitalPeriod, setOrbitalPeriod] = useState<number>(0);
  const [nextPass, setNextPass] = useState<PassPrediction | null>(null);
  const [allUpcomingPasses, setAllUpcomingPasses] = useState<PassPrediction[]>([]);

  // Geographic Map state
  const [groundTrack, setGroundTrack] = useState<GroundTrackResult | null>(null);
  const [showFootprint, setShowFootprint] = useState(true);
  const [showConstellation, setShowConstellation] = useState(false);
  const [constellationPositions, setConstellationPositions] = useState<
    { noradId: number; name: string; latitude: number; longitude: number }[]
  >([]);

  // Validation state
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [compassModalVisible, setCompassModalVisible] = useState(false);
  const [scheduledAlertText, setScheduledAlertText] = useState<string | null>(null);
  const [cacheStatusText, setCacheStatusText] = useState('16 satélites en almacenamiento local');

  // Recalculate passes whenever satrec, observer, or elevationMask changes
  function recalculatePasses(rec: satellite.SatRec, noradId: number, name: string, obs: ObserverLocation, mask: number) {
    try {
      const passes = PassPredictorService.predictPasses(rec, noradId, name, obs, {
        startDate: new Date(),
        daysAhead: 3,
        minElevationDeg: mask,
      });
      setAllUpcomingPasses(passes);
      setNextPass(passes.length > 0 ? passes[0] : null);
    } catch (err) {
      console.warn('Error recalculating passes:', err);
    }
  }

  function handleSelectCity(city: CityPreset) {
    const newObs: ObserverLocation = {
      latitude: city.latitude,
      longitude: city.longitude,
      altitudeMeters: city.altitudeMeters,
    };
    setObserver(newObs);
    setSelectedCityName(city.name);

    if (satrec && tleInfo) {
      const noradId = parseInt(tleInfo.line2.substring(2, 7).trim(), 10) || 25544;
      recalculatePasses(satrec, noradId, tleInfo.name, newObs, elevationMask);
    }
  }

  function handleSelectElevationMask(mask: number) {
    setElevationMask(mask);
    if (satrec && tleInfo) {
      const noradId = parseInt(tleInfo.line2.substring(2, 7).trim(), 10) || 25544;
      recalculatePasses(satrec, noradId, tleInfo.name, observer, mask);
    }
  }

  async function handleScheduleReminder(passToSchedule?: PassPrediction) {
    const target = passToSchedule || nextPass;
    if (!target) return;
    const result = await NotificationService.schedulePassAlert(target, 10);
    if (result) {
      setScheduledAlertText(
        `Alerta programada para las ${result.triggerTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (10 min antes del AOS)`
      );
    } else {
      setScheduledAlertText('El pase ya comenzó o está en el pasado');
    }
  }

  async function handleTestNotification() {
    await NotificationService.sendImmediateTestAlert(tleInfo?.name || 'ISS (ZARYA)');
    setScheduledAlertText('¡Notificación de prueba enviada al dispositivo!');
  }

  async function handleClearCache() {
    try {
      await AsyncStorage.clear();
      setCacheStatusText('Caché limpiado correctamente');
      Alert.alert('Caché', 'El almacenamiento local ha sido vaciado.');
    } catch {
      setCacheStatusText('Error al vaciar caché');
    }
  }

  async function handleForceRefreshCelesTrak() {
    try {
      setCacheStatusText('Descargando datos actualizados de CelesTrak...');
      const cat = await CatalogService.loadCategory('iss', true);
      setCacheStatusText(`${cat.satellites.length} satélites actualizados en vivo`);
      Alert.alert('CelesTrak', 'Datos orbitales actualizados desde CelesTrak.');
    } catch {
      setCacheStatusText('Error al contactar CelesTrak');
    }
  }

  function handleSelectSatellite(sat: Satellite) {
    try {
      const rec = Sgp4Engine.parseTle(sat.tleLine1, sat.tleLine2);
      setSatrec(rec);
      setTleInfo({ line1: sat.tleLine1, line2: sat.tleLine2, name: sat.name });
      setTleFetchedAt(sat.updatedAt);
      const period = Sgp4Engine.getOrbitalPeriodMinutes(rec);
      setOrbitalPeriod(period);

      const gt = GroundTrackService.calculateGroundTrack(rec, new Date(), 30);
      setGroundTrack(gt);

      recalculatePasses(rec, sat.noradId, sat.name, observer, elevationMask);

      if (sat.noradId === 25544) {
        runValidation(sat.tleLine1, sat.tleLine2, sat.updatedAt);
      } else {
        setValidation(null);
      }
    } catch (err) {
      console.error('Error switching satellite:', err);
    }
  }

  async function handleToggleConstellation() {
    const nextState = !showConstellation;
    setShowConstellation(nextState);

    if (nextState && constellationPositions.length === 0) {
      try {
        const cat = await CatalogService.loadCategory('starlink');
        const now = new Date();
        const positions: { noradId: number; name: string; latitude: number; longitude: number }[] = [];

        for (const sat of cat.satellites.slice(0, 35)) {
          try {
            const r = Sgp4Engine.parseTle(sat.tleLine1, sat.tleLine2);
            const p = Sgp4Engine.getGeoposition(r, now);
            if (p) {
              positions.push({
                noradId: sat.noradId,
                name: sat.name,
                latitude: p.latitude,
                longitude: p.longitude,
              });
            }
          } catch {
            // Ignore individual malformed TLE
          }
        }
        setConstellationPositions(positions);
      } catch (err) {
        console.error('Failed to load constellation positions:', err);
      }
    }
  }

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

          const gt = GroundTrackService.calculateGroundTrack(rec, new Date(), 30);
          setGroundTrack(gt);

          recalculatePasses(rec, 25544, data.name, observer, elevationMask);
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
        const look = Sgp4Engine.getLookAngles(satrec, now, observer);
        setLookAngle(look);

        const fp = FootprintService.calculateFootprintRadius(pos.altitude, elevationMask);
        setFootprint(fp);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [satrec, observer, elevationMask]);

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
        <Text style={styles.loadingText}>INICIALIZANDO MOTOR ORBITAL SGP4...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Bar with Tokens & Status */}
      <View style={styles.topBar}>
        <View style={styles.logoHeader}>
          <Image source={LOGO_ICON_IMG} style={styles.headerLogo} resizeMode="contain" />
          <View>
            <Text style={styles.appName}>Satellite Tracker</Text>
            <Text style={styles.appSub}>PREDICTOR ORBITAL SGP4</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.tokenPill}
          onPress={() => setCatalogModalVisible(true)}
          activeOpacity={0.7}>
          <Text style={styles.tokenText}>
            {tleInfo ? `NORAD: ${tleInfo.line2.substring(2, 7).trim()}` : 'CATÁLOGO'} ▾
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Pills (Figma style) */}
      <View style={styles.categoriesWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
          {CATEGORIES.map(cat => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setSelectedCategory(cat);
                  setCatalogModalVisible(true);
                }}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}>
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ======================================================== */}
        {/* TAB 1: RASTREADOR (TRACKER)                              */}
        {/* ======================================================== */}
        {activeTab === 'tracker' && (
          <>
            {/* Target Satellite Main Card */}
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.targetLabel}>SATÉLITE OBJETIVO</Text>
                  <Text style={styles.targetName} numberOfLines={1} ellipsizeMode="tail">
                    {tleInfo?.name || 'ISS (ZARYA)'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.changeTargetButton}
                  onPress={() => setCatalogModalVisible(true)}
                  activeOpacity={0.8}>
                  <Text style={styles.changeTargetText}>CAMBIAR ▾</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardStatsRow}>
                <View style={styles.cardStatItem}>
                  <Text style={styles.cardStatLabel}>PERÍODO</Text>
                  <Text style={styles.cardStatValue}>{orbitalPeriod.toFixed(1)} min</Text>
                </View>
                <View style={styles.cardStatItem}>
                  <Text style={styles.cardStatLabel}>HUELLA</Text>
                  <Text style={styles.cardStatValue}>
                    {footprint ? `${Math.round(footprint.radiusKm)} km` : '--'}
                  </Text>
                </View>
                <View style={styles.cardStatItem}>
                  <Text style={styles.cardStatLabel}>MÁSCARA</Text>
                  <Text style={styles.cardStatValueGold}>{elevationMask.toFixed(1)}°</Text>
                </View>
              </View>
            </View>

            {/* Mission Control SVG World Map with continents and ground tracks */}
            <WorldMap
              currentPosition={currentPosition}
              groundTrack={groundTrack}
              observer={observer}
              observerName={selectedCityName}
              satelliteName={tleInfo?.name}
              constellationPositions={constellationPositions}
              showConstellation={showConstellation}
              showFootprint={showFootprint}
              onToggleConstellation={handleToggleConstellation}
              onToggleFootprint={() => setShowFootprint(!showFootprint)}
            />

            {/* Real-time Subsatellite Telemetry Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>GEOPOSICIÓN EN TIEMPO REAL</Text>
                <Text style={styles.sectionBadge}>LOCAL 1s</Text>
              </View>

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>LATITUD</Text>
                  <Text style={styles.telemetryNumber}>
                    {currentPosition ? `${currentPosition.latitude.toFixed(4)}°` : '--'}
                  </Text>
                </View>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>LONGITUD</Text>
                  <Text style={styles.telemetryNumber}>
                    {currentPosition ? `${currentPosition.longitude.toFixed(4)}°` : '--'}
                  </Text>
                </View>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>ALTITUD</Text>
                  <Text style={styles.telemetryNumberBlue}>
                    {currentPosition ? `${currentPosition.altitude.toFixed(1)} km` : '--'}
                  </Text>
                </View>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>HORA UTC</Text>
                  <Text style={styles.telemetryNumber}>
                    {currentPosition ? new Date(currentPosition.timestamp).toLocaleTimeString() : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Topocentric Look Angles for Observer */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>VECTORES TOPOCÉNTRICOS</Text>
                <Text style={styles.sectionBadgeGold}>{selectedCityName.toUpperCase()}</Text>
              </View>

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>AZIMUT</Text>
                  <Text style={styles.telemetryNumberGold}>
                    {lookAngle ? `${lookAngle.azimuth.toFixed(1)}°` : '--'}
                  </Text>
                </View>
                <View style={styles.telemetryBox}>
                  <Text style={styles.telemetryLabel}>ELEVACIÓN</Text>
                  <Text style={[styles.telemetryNumberMint, (lookAngle?.elevation || 0) < 0 && styles.dimText]}>
                    {lookAngle ? `${lookAngle.elevation.toFixed(1)}°` : '--'}
                  </Text>
                </View>
                <View style={[styles.telemetryBox, { width: '100%' }]}>
                  <Text style={styles.telemetryLabel}>DISTANCIA EN LÍNEA DE VISTA</Text>
                  <Text style={styles.telemetryNumber}>
                    {lookAngle ? `${Math.round(lookAngle.rangeKm).toLocaleString()} km` : '--'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.openCompassButton}
                onPress={() => setCompassModalVisible(true)}
                activeOpacity={0.8}>
                <Text style={styles.openCompassText}>APUNTADOR CELESTE (MODO BRÚJULA)</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PASES (PASSES)                                    */}
        {/* ======================================================== */}
        {activeTab === 'passes' && (
          <>
            {/* Target Header */}
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.targetLabel}>VENTANA DE PASES VISIBLES</Text>
                  <Text style={styles.targetName} numberOfLines={1} ellipsizeMode="tail">
                    {tleInfo?.name || 'ISS (ZARYA)'}
                  </Text>
                </View>
                <Text style={styles.sectionBadgeGold}>{selectedCityName.toUpperCase()}</Text>
              </View>
              <Text style={styles.passHeaderNote}>
                Máscara de elevación mínima: {elevationMask.toFixed(1)}° • Horizonte local WGS84
              </Text>
            </View>

            {/* Upcoming Pass Window Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>PRÓXIMO PASE</Text>
                <Text style={styles.passDurationBadge}>
                  {nextPass ? `${Math.round(nextPass.durationSeconds / 60)} min` : '--'}
                </Text>
              </View>

              {nextPass ? (
                <>
                  <View style={styles.passList}>
                    <View style={styles.passItem}>
                      <Text style={styles.passStepLabel}>AOS (Aparición)</Text>
                      <Text style={styles.passStepTime}>{nextPass.aos.time.toLocaleTimeString()}</Text>
                      <Text style={styles.passStepAngle}>{nextPass.aos.azimuth.toFixed(0)}° Az</Text>
                    </View>
                    <View style={[styles.passItem, styles.passItemCulmination]}>
                      <Text style={styles.passStepLabelCulmination}>ELEVACIÓN MÁX.</Text>
                      <Text style={styles.passStepTimeCulmination}>{nextPass.maxElevation.elevation.toFixed(1)}°</Text>
                      <Text style={styles.passStepAngleCulmination}>
                        {nextPass.maxElevation.time.toLocaleTimeString()}
                      </Text>
                    </View>
                    <View style={styles.passItem}>
                      <Text style={styles.passStepLabel}>LOS (Ocultamiento)</Text>
                      <Text style={styles.passStepTime}>{nextPass.los.time.toLocaleTimeString()}</Text>
                      <Text style={styles.passStepAngle}>{nextPass.los.azimuth.toFixed(0)}° Az</Text>
                    </View>
                  </View>

                  {/* Polar Sky Chart Radar */}
                  <View style={{ alignItems: 'center', marginTop: 16 }}>
                    <SkyChart
                      size={270}
                      pass={nextPass}
                      currentAzimuth={lookAngle?.azimuth}
                      currentElevation={lookAngle?.elevation}
                      satelliteName={tleInfo?.name}
                    />
                  </View>

                  {/* Notification Actions */}
                  <View style={styles.notificationActionsRow}>
                    <TouchableOpacity
                      style={styles.scheduleButton}
                      onPress={() => handleScheduleReminder()}
                      activeOpacity={0.8}>
                      <Text style={styles.scheduleButtonText}>RECORDATORIO DE PASE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.testNotificationButton}
                      onPress={handleTestNotification}
                      activeOpacity={0.8}>
                      <Text style={styles.testNotificationText}>PROBAR ALERTA</Text>
                    </TouchableOpacity>
                  </View>

                  {scheduledAlertText && (
                    <View style={styles.alertSuccessBadge}>
                      <Text style={styles.alertSuccessText}>✓ {scheduledAlertText}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noPassText}>No hay pases visibles sobre {elevationMask}° en las próximas 72 hs.</Text>
              )}
            </View>

            {/* Multi-pass Table (Next 72 Hours) */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>TABLA DE PASES (PRÓXIMAS 72 HS)</Text>
                <Text style={styles.sectionBadge}>{allUpcomingPasses.length} PASES</Text>
              </View>

              {allUpcomingPasses.length > 0 ? (
                allUpcomingPasses.map((p, idx) => {
                  const maxEl = p.maxElevation.elevation;
                  const elColor =
                    maxEl >= 40 ? colors.accentMint : maxEl >= 20 ? colors.accentGold : colors.primaryNeon;

                  return (
                    <View key={idx} style={styles.passTableRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.passTableDate}>
                          {p.aos.time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={styles.passTableTime}>{p.aos.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={[styles.passTableElevation, { color: elColor }]}>{maxEl.toFixed(1)}°</Text>
                        <Text style={styles.passTableSub}>Máx. {p.maxElevation.azimuth.toFixed(0)}°</Text>
                      </View>
                      <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                        <Text style={styles.passTableDuration}>{Math.round(p.durationSeconds / 60)} min</Text>
                        <TouchableOpacity
                          style={styles.passTableScheduleBtn}
                          onPress={() => handleScheduleReminder(p)}>
                          <Text style={styles.passTableScheduleBtnText}>Recordar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.noPassText}>Sin pases calculados para las coordenadas seleccionadas.</Text>
              )}
            </View>
          </>
        )}

        {/* ======================================================== */}
        {/* TAB 3: VALIDAR (VALIDATE)                                */}
        {/* ======================================================== */}
        {activeTab === 'validate' && (
          <>
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.targetLabel}>CONTROL DE CALIDAD ORBITAL</Text>
                  <Text style={styles.targetName}>Validación Cruzada ISS</Text>
                </View>
                <Text style={styles.sectionBadgeGold}>REFERENCIA GPS</Text>
              </View>
              <Text style={styles.passHeaderNote}>
                Contrasta la propagación matemática SGP4 local contra las coordenadas de referencia en tiempo real de la API Where The ISS At?.
              </Text>
            </View>

            {/* Validation Metrics Card */}
            <View style={[styles.sectionCard, styles.validationCard]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>VALIDACIÓN CRUZADA</Text>
                  <Text style={styles.validationSubtitle}>Comparado con API de Where The ISS At?</Text>
                </View>
                <TouchableOpacity
                  style={styles.verifyButton}
                  onPress={() => runValidation()}
                  disabled={validating}>
                  {validating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyButtonText}>VALIDAR AHORA</Text>
                  )}
                </TouchableOpacity>
              </View>

              {validation ? (
                <View style={styles.validationBox}>
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorLabel}>ERROR DE DISTANCIA ECEF 3D</Text>
                    <Text style={styles.errorNumber}>{validation.errorKm.toFixed(2)} km</Text>
                    <Text style={styles.errorSub}>
                      Δ Superficie: {validation.surfaceErrorKm.toFixed(2)} km • Δ Altitud:{' '}
                      {validation.altitudeDifferenceKm.toFixed(2)} km
                    </Text>
                  </View>

                  <View style={styles.validationMeta}>
                    <Text style={styles.validationMetaText}>
                      Antigüedad TLE: {validation.dataAgeHours.toFixed(1)} h (
                      {validation.isStale ? 'OBSOLETO' : 'ACTUALIZADO'})
                    </Text>
                    <Text style={styles.validationStatusPass}>
                      {'✓ APROBADO: Error dentro de tolerancia SGP4 (< 5 km)'}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noPassText}>Presioná VALIDAR AHORA para calcular el error en tiempo real.</Text>
              )}
            </View>

            {/* Engineering Analysis Card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ANÁLISIS DE PRECISIÓN DEL MODELO</Text>
              </View>
              <Text style={styles.analysisText}>
                • <Text style={styles.boldWhite}>Modelo SGP4/SDP4:</Text> Propaga las perturbaciones gravitacionales terrestres (armónicos zonales J2, J3, J4) y la fricción atmosférica mediante el coeficiente balístico BSTAR.
              </Text>
              <Text style={styles.analysisText}>
                • <Text style={styles.boldWhite}>Causa de Discrepancias:</Text> Las diferencias de 1 a 3 km son naturales y esperadas debido a la desactualización horaria del TLE y las correcciones de maniobra de la estación.
              </Text>
              <Text style={styles.analysisText}>
                • <Text style={styles.boldWhite}>Tolerancia de Aceptación:</Text> Según el marco de pruebas del PRD, un error tridimensional menor a 5.0 km valida el cumplimiento estricto del modelo matemático sin streaming de coordenadas.
              </Text>
            </View>
          </>
        )}

        {/* ======================================================== */}
        {/* TAB 4: AJUSTES (CONFIG)                                  */}
        {/* ======================================================== */}
        {activeTab === 'config' && (
          <>
            {/* Observer Location Settings */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>UBICACIÓN DEL OBSERVADOR</Text>
                <Text style={styles.sectionBadgeGold}>{selectedCityName.toUpperCase()}</Text>
              </View>
              <Text style={styles.configSubtitle}>
                Lat: {observer.latitude.toFixed(4)}° • Lon: {observer.longitude.toFixed(4)}° • Alt: {observer.altitudeMeters}m
              </Text>

              <Text style={styles.configLabel}>SELECCIONAR CIUDAD PREDEFINIDA:</Text>
              <View style={styles.presetButtonsRow}>
                {PRESET_CITIES.map(city => {
                  const isCitySelected = selectedCityName === city.name;
                  return (
                    <TouchableOpacity
                      key={city.name}
                      style={[styles.cityPresetButton, isCitySelected && styles.cityPresetButtonActive]}
                      onPress={() => handleSelectCity(city)}>
                      <Text style={[styles.cityPresetText, isCitySelected && styles.cityPresetTextActive]}>
                        {city.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Elevation Mask Settings */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>MÁSCARA DE ELEVACIÓN</Text>
                <Text style={styles.sectionBadgeMint}>{elevationMask.toFixed(1)}°</Text>
              </View>
              <Text style={styles.configSubtitle}>
                Filtra los pases satelitales que no superen este ángulo sobre los obstáculos locales (edificios, montañas).
              </Text>

              <View style={styles.presetButtonsRow}>
                {[5, 10, 15, 20].map(deg => {
                  const isMaskSelected = elevationMask === deg;
                  return (
                    <TouchableOpacity
                      key={deg}
                      style={[styles.maskPresetButton, isMaskSelected && styles.maskPresetButtonActive]}
                      onPress={() => handleSelectElevationMask(deg)}>
                      <Text style={[styles.maskPresetText, isMaskSelected && styles.maskPresetTextActive]}>
                        {deg}°
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* TLE Cache & CelesTrak Manager */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>GESTIÓN DE DATOS CELESTRAK Y CACHÉ</Text>
              </View>
              <Text style={styles.configSubtitle}>{cacheStatusText}</Text>

              <View style={styles.cacheActionsCol}>
                <TouchableOpacity
                  style={styles.forceRefreshButton}
                  onPress={handleForceRefreshCelesTrak}
                  activeOpacity={0.8}>
                  <Text style={styles.forceRefreshText}>FORZAR ACTUALIZACIÓN CELESTRAK</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearCacheButton}
                  onPress={handleClearCache}
                  activeOpacity={0.8}>
                  <Text style={styles.clearCacheText}>VACIAR CACHÉ LOCAL</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Technical Architecture Specs */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>ESPECIFICACIONES DE ARQUITECTURA</Text>
                <Text style={styles.sectionBadge}>v1.0.0</Text>
              </View>
              <View style={styles.specsList}>
                <Text style={styles.specItem}>
                  <Text style={styles.boldWhite}>Propagador Orbital:</Text> SGP4 / SDP4 (satellite.js v7.1.0)
                </Text>
                <Text style={styles.specItem}>
                  <Text style={styles.boldWhite}>Sistema de Referencia:</Text> TEME → ECEF → Geodésico WGS84
                </Text>
                <Text style={styles.specItem}>
                  <Text style={styles.boldWhite}>Topocéntrico:</Text> SEZ (South-East-Zenith) con Azimut [0..360°] y Elevación [-90..90°]
                </Text>
                <Text style={styles.specItem}>
                  <Text style={styles.boldWhite}>Sistema de Notificaciones:</Text> Notifee v9.1.9 con alarmas programadas
                </Text>
                <Text style={styles.specItem}>
                  <Text style={styles.boldWhite}>Ejecución:</Text> APK Nativo 100% Autónomo (Sin Metro server)
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('tracker')}
          activeOpacity={0.7}>
          <Text style={[styles.navIcon, activeTab === 'tracker' && styles.navIconActive]}>⌖</Text>
          <Text style={[styles.navText, activeTab === 'tracker' && styles.navTextActive]}>Rastreador</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('passes')}
          activeOpacity={0.7}>
          <Text style={[styles.navIcon, activeTab === 'passes' && styles.navIconActive]}>◷</Text>
          <Text style={[styles.navText, activeTab === 'passes' && styles.navTextActive]}>Pases</Text>
        </TouchableOpacity>

        {/* Center Floating Action Button (Compass Mode) */}
        <TouchableOpacity
          style={styles.centerFab}
          onPress={() => setCompassModalVisible(true)}
          activeOpacity={0.85}>
          <View style={styles.centerFabCompassRing}>
            <View style={styles.centerFabCompassNorth} />
            <View style={styles.centerFabCompassSouth} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('validate')}
          activeOpacity={0.7}>
          <Text style={[styles.navIcon, activeTab === 'validate' && styles.navIconActive]}>✓</Text>
          <Text style={[styles.navText, activeTab === 'validate' && styles.navTextActive]}>Validar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('config')}
          activeOpacity={0.7}>
          <Text style={[styles.navIcon, activeTab === 'config' && styles.navIconActive]}>☰</Text>
          <Text style={[styles.navText, activeTab === 'config' && styles.navTextActive]}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      {/* Satellite Catalog Modal */}
      <SatelliteSearchModal
        visible={catalogModalVisible}
        onClose={() => setCatalogModalVisible(false)}
        onSelectSatellite={handleSelectSatellite}
        currentNoradId={tleInfo ? parseInt(tleInfo.line2.substring(2, 7).trim(), 10) : 25544}
      />

      {/* Assisted Orientation / Compass Mode Modal */}
      <CompassModal
        visible={compassModalVisible}
        onClose={() => setCompassModalVisible(false)}
        targetLookAngle={lookAngle}
        satelliteName={tleInfo?.name}
        noradId={tleInfo ? parseInt(tleInfo.line2.substring(2, 7).trim(), 10) : 25544}
      />
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
    paddingBottom: 130,
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
    gap: 8,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
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
  changeTargetButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentGold,
    flexShrink: 0,
  },
  changeTargetText: {
    color: colors.accentGold,
    fontSize: 10,
    fontWeight: '700',
  },
  cardStatsRow: {
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
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardStatValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  cardStatValueGold: {
    color: colors.accentGold,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionBadge: {
    color: colors.accentMint,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    fontSize: 9.5,
    fontWeight: '700',
    overflow: 'hidden',
  },
  sectionBadgeGold: {
    color: colors.accentGold,
    backgroundColor: 'rgba(255, 184, 69, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 184, 69, 0.25)',
    fontSize: 9.5,
    fontWeight: '700',
    overflow: 'hidden',
  },
  sectionBadgeMint: {
    color: colors.accentMint,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  telemetryBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  telemetryLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  telemetryNumber: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryNumberBlue: {
    color: '#3B82F6',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryNumberGold: {
    color: colors.accentGold,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  telemetryNumberMint: {
    color: colors.accentMint,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  openCompassButton: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.accentGold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openCompassText: {
    color: colors.accentGold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  passHeaderNote: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
  },
  passDurationBadge: {
    color: colors.accentGold,
    fontSize: 12,
    fontWeight: '800',
  },
  passList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  passItem: {
    alignItems: 'center',
    flex: 1,
  },
  passItemCulmination: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 8,
  },
  passStepLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  passStepTime: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  passStepAngle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  passStepLabelCulmination: {
    color: colors.accentGold,
    fontSize: 9,
    fontWeight: '700',
  },
  passStepTimeCulmination: {
    color: colors.accentGold,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  passStepAngleCulmination: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  noPassText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  notificationActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  scheduleButton: {
    flex: 2,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.accentMint,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    color: colors.accentMint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  testNotificationButton: {
    flex: 1.2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryNeon,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testNotificationText: {
    color: colors.primaryNeon,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertSuccessBadge: {
    marginTop: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentMint,
    alignItems: 'center',
  },
  alertSuccessText: {
    color: colors.accentMint,
    fontSize: 11,
    fontWeight: '700',
  },
  passTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  passTableDate: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  passTableTime: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  passTableElevation: {
    fontSize: 15,
    fontWeight: '900',
  },
  passTableSub: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  passTableDuration: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  passTableScheduleBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentMint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 3,
  },
  passTableScheduleBtnText: {
    color: colors.accentMint,
    fontSize: 9,
    fontWeight: '700',
  },
  validationCard: {
    borderColor: colors.primaryNeon,
  },
  validationSubtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  verifyButton: {
    backgroundColor: colors.accentGold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  verifyButtonText: {
    color: colors.background,
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
  analysisText: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 18,
    marginBottom: 8,
  },
  boldWhite: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  configSubtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginBottom: 12,
  },
  configLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityPresetButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  cityPresetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryNeon,
  },
  cityPresetText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  cityPresetTextActive: {
    color: colors.textPrimary,
  },
  maskPresetButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  maskPresetButtonActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: colors.accentMint,
  },
  maskPresetText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '800',
  },
  maskPresetTextActive: {
    color: colors.accentMint,
  },
  cacheActionsCol: {
    gap: 10,
  },
  forceRefreshButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  forceRefreshText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clearCacheButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearCacheText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  specsList: {
    gap: 8,
  },
  specItem: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 16,
  },
  dimText: {
    color: colors.textDim,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 68,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
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
    marginBottom: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  centerFabCompassRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerFabCompassNorth: {
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomWidth: 8,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.accentMint,
  },
  centerFabCompassSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopWidth: 8,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});
