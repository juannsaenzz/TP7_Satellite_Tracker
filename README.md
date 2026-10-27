# Satellite Tracker — Predictor Orbital SGP4 / SDP4

<div align="center">
  <h3>Aplicación Móvil Nativa de Rastreo Satelital y Predicción de Pases 100% Offline</h3>
  <p><strong>Licenciatura en Sistemas de Información — Programación Móviles 2026</strong></p>
</div>

---

## Descripción General

**Satellite Tracker** es una aplicación móvil nativa desarrollada con **React Native (TypeScript)** que calcula la posición en tiempo real de satélites artificiales en órbita terrestre baja (LEO) y media (MEO) mediante propagación analítica **SGP4 / SDP4** ejecutada **100% de manera local en el dispositivo**.

La aplicación opera de forma totalmente autónoma y desconectada, consumiendo datos orbitales (**TLE / OMM**) de fuentes públicas internacionales (**CelesTrak, Space-Track, N2YO, Where The ISS At?**) con almacenamiento en caché persistente y conmutación automática ante fallas.

---

## Características Principales

1. **Propagador Orbital Local SGP4/SDP4:**
   - Cálculo analítico continuo de latitud, longitud y altitud geodésica WGS84 a 1 Hz sin streaming de servidores externos.
   - Proyección topocéntrica SEZ (Azimut, Elevación y Distancia en línea de vista) calculada respecto de la posición geográfica del observador.
   - Soporte para formatos estándar de dos líneas (**TLE**) y mensajes modernos **OMM / JSON** del CCSDS para satélites con identificadores NORAD de 6 dígitos.
2. **Mapa Mundial de Control de Misión (SVG Autónomo):**
   - Mapa cilíndrico equirrectangular offline generado a partir de cartografía vectorial *Natural Earth 110m* (286 polígonos continentales, 72 KB, sin depender de Google Maps ni claves de API).
   - Trazado de órbita pasada (punteada violeta) y órbita futura (verde menta continuo) con **resolución e interpolación de discontinuidad en el antimeridiano ($\pm 180^\circ$)**.
   - Proyección del área de cobertura terrestre (*footprint*) con desdoble geométrico esférico y marcador del observador seleccionado.
3. **Cálculo y Visualización de Pases (72 Horas):**
   - Algoritmo de predicción por refinamiento (búsqueda gruesa a 60 s + bisección binaria fina a 1 s de precisión) para detectar instantes de aparición (**AOS**), culminación máxima (**TCA**) y ocultamiento (**LOS**).
   - **Sky Chart Polar (Radar):** Gráfico polar SVG con círculos concéntricos de elevación ($30^\circ$, $60^\circ$, cenit), puntos cardinales y trayectoria proyectada del pase.
4. **Notificaciones Locales de Pases Próximos:**
   - Programación de recordatorios exactos mediante `@notifee/react-native` con antelación configurable antes del AOS.
5. **Orientación Asistida (Modo Brújula):**
   - Modal asistido con brújula magnética que sincroniza el magnetómetro del dispositivo con el azimut y elevación objetivo, indicando con una mira de alineación activa cuando el satélite se encuentra en campo de visión (< 5° de error).
6. **Módulo de Validación Cruzada en Tiempo Real:**
   - Comparación instantánea contra coordenadas independientes de *Where The ISS At? API* y *N2YO*, calculando error euclidiano tridimensional ECEF, error en superficie y delta de altitud con verificación de tolerancia (< 5.0 km).
7. **Diseño Visual de Alto Impacto:**
   - Paleta cósmica oscura de alto contraste (`#0A051B`, `#160B33`, `#8B5CF6`, `#00E5FF`, `#22C55E`, `#FFB845`), tipografía geométrica estilizada, iconografía vectorial SVG y cero emojis en la interfaz.

---

## Arquitectura del Software

El proyecto sigue una arquitectura limpia en capas desacopladas:

```
src/
├── core/                   # Núcleo de cálculo científico y servicios centrales
│   ├── orbital/            # Motor SGP4, GroundTrackService, FootprintService, PassPredictorService
│   ├── sensors/            # CompassService (sensores magnetómetro/giroscopio)
│   ├── notifications/      # NotificationService (alarmas Notifee)
│   └── services/           # CatalogService (orquestador multi-proveedor)
├── data/                   # Capa de acceso a datos e infraestructura
│   ├── providers/          # CelesTrakProvider, SpaceTrackProvider, N2yoProvider, WhereTheIssProvider
│   ├── cache/              # OrbitalCacheService (persistencia AsyncStorage con TTL 24h)
│   └── validation/         # ValidationService (cálculo de distancias 3D ECEF)
├── domain/                 # Entidades y contratos de dominio
│   ├── models/             # Satellite, Geoposition, LookAngle, PassPrediction
│   └── repositories/       # IDataProvider (interfaz común)
└── presentation/           # Interfaz de usuario (React Native)
    ├── components/         # WorldMap, SkyChart, CompassModal, SatelliteSearchModal
    └── theme/              # Paleta de colores cósmica y tokens de diseño
```

---

## Documentación Técnica y Entregables

El proyecto incluye los 3 informes técnicos exigidos por la Sección 6 del PRD (ubicados en el directorio raíz de entrega `c:\tp_7\` en formato PDF):

- **Documento Técnico de Propagación y Geometría (`Documento técnico - TP7 Satellite_Tracker.pdf`):** Fundamentos de astrodinámica, transformaciones TEME $\rightarrow$ ECEF $\rightarrow$ Geodésico $\rightarrow$ Topocéntrico SEZ, algoritmos de antimeridiano y limitaciones físicas de SGP4.
- **Informe de Validación y Precisión Orbital (`Informe de validación - TP7 Satellite_Tracker.pdf`):** Tabla comparativa empírica de 10 muestras temporales contra *Where The ISS At?*, descomposición de error en superficie y altitud, y curva de degradación según la antigüedad del TLE.
- **Decisiones de Fuentes de Datos y Estrategia de Caché (`Documento de decisiones de datos - TP7 Satellite_Tracker.pdf`):** Comparativa CelesTrak / Space-Track / N2YO / Where The ISS At?, justificación técnica de **Starlink SupGP** derivado de efemérides del operador frente a TLEs de radar balísticos, y diseño de la cascada de conmutación ante caídas.
- **Video Demostración (`Flujo_demo -  TP7 Satellite_Tracker.mp4`):** Recorrido audiovisual del flujo completo de la aplicación (inicialización offline, mapa, vectores topocéntricos, pases, Sky Chart polar, alerta de pase en cortina de notificaciones, brújula celestial y validación matemática en tiempo real).
- **Binario Instalable (`SatelliteTracker.apk`):** APK Release standalone optimizado de 76.7 MB para instalación directa sin servidor de desarrollo.

---

## Pruebas Unitarias

La suite de tests unitarios desarrollada con Jest cubre todos los módulos matemáticos y de infraestructura:

```sh
npm test
```

```
PASS  __tests__/OrbitalEngine.test.ts
PASS  __tests__/SkyChartProjection.test.ts
PASS  __tests__/CompassService.test.ts
PASS  __tests__/NotificationService.test.ts
PASS  __tests__/CatalogService.test.ts
PASS  __tests__/WorldMap.test.ts
PASS  __tests__/DataProviders.test.ts
PASS  __tests__/App.test.tsx

Test Suites: 8 passed, 8 total
Tests:       31 passed, 31 total
```

---

## Instalación y Ejecución

### Prerrequisitos
- Node.js >= 18
- JDK 17
- Android SDK (API 34+)

### 1. Servidor de Desarrollo Metro (Wi-Fi)
```sh
npm start
```

### 2. Ejecutar en Dispositivo Android
```sh
npm run android
```

### 3. Compilación de APK Release Autónomo
```sh
cd android
./gradlew assembleRelease
```
El archivo APK autónomo de producción se genera en `android/app/build/outputs/apk/release/app-release.apk` (o el binario de entrega directa `SatelliteTracker.apk`).
