# Decisiones sobre Fuentes de Datos, Límites de APIs y Estrategia de Caché

**Materia:** Programación Móviles 2026  
**Carrera:** Licenciatura en Sistemas de Información  
**Proyecto:** Satellite Tracker (RF-09, RF-14 y Sección 4.2)  

---

## 1. Análisis Comparativo de Proveedores Orbitales

Para la alimentación de datos orbitales y la verificación cruzada de la aplicación, se evaluaron cuatro fuentes públicas disponibles:

| Proveedor | Modelo de Autenticación | Cobertura de Catálogo | Límite de Peticiones | Rol en la Arquitectura |
|---|---|---|---|---|
| **CelesTrak** | Pública (sin API key) | Catálogo GP completo, estaciones, Starlink (SupGP), GNSS, meteorológicos y ciencia. | Sin cuota explícita; exige caché de $12\text{--}24 \text{ h}$ para evitar ban de IP. | **Proveedor Primario:** Descarga de catálogos y TLEs individuales. |
| **Space-Track.org** | Sesión por Cookies (`/ajaxauth/login`) | Catálogo oficial de la Fuerza Espacial de EE. UU. (18th Space Defense Squadron). | Límite estricto: $\le 20 \text{ req/min}$ y $\le 300 \text{ req/hora}$. | **Proveedor Secundario (Fallback):** Respaldo oficial cuando CelesTrak no responde. |
| **N2YO** | API Key gratuita vía query param (`&apiKey=`) | TLEs individuales, pases visuales y de radio, posiciones en tiempo real. | $1000 \text{ transacciones/hora}$ (TLEs y posiciones); $100 \text{/hora}$ (pases). | **Proveedor Terciario y Validación Cruzada:** Telemetría independiente para RF-15. |
| **Where The ISS At?** | Pública REST (sin credenciales) | Exclusivo Estación Espacial Internacional (NORAD 25544). | $\approx 1 \text{ req/s}$. | **Ground Truth de Validación:** Referencia rápida y confiable para la ISS. |

---

## 2. Justificación Técnica: Starlink SupGP vs. TLEs de Radar Tradicionales

Uno de los requerimientos centrales del PRD (Sección 1 y 4.2) es el seguimiento de constelaciones de satélites en órbita muy baja con propulsión activa, fundamentalmente **Starlink** (SpaceX).

### 2.1 El problema de los TLEs de Radar Convencionales
Los conjuntos TLE convencionales provistos por el catálogo general de Space-Track se construyen mediante el ajuste de observaciones de radar ópticas y de radiofrecuencia terrestres (*Space Surveillance Network*). Este enfoque presenta una debilidad crítica para satélites con propulsión activa:
- Los satélites Starlink emplean propulsores de iones electrostáticos (efecto Hall con propelente de kriptón y argón) para:
  1. Ascenso orbital inicial desde la inserción del lanzador.
  2. Mantenimiento constante de la altitud contra la resistencia atmosférica (*station-keeping*).
  3. Maniobras autónomas de desvío y evasión de colisiones (*collision avoidance*).
- Cuando un satélite maniobra de manera continua o semi-continua, un TLE ajustado sobre datos de radar pasados asume una órbita balística inerte. Apenas 12 horas después de una maniobra, el error posicional de un TLE de radar puede oscilar entre **$10 \text{ km}$ y $60 \text{ km}$**, volviéndolo inútil para apuntamiento astronómico o seguimiento de pases visuales.

### 2.2 La Solución: Efemérides Operativas Suplementarias (SupGP)
SpaceX no provee una API pública abierta para consultar posiciones instantáneas individuales de la constelación (sus APIs empresariales exigen contratos corporativos y la *Space Traffic Coordination API* está reservada a operadores espaciales).

Sin embargo, SpaceX transmite diariamente sus efemérides orbitales proyectadas de alta fidelidad (**SP** — *Special Perturbations*), que integran el plan futuro de maniobras de propulsión, al equipo de astrodinámica del Dr. T.S. Kelso en **CelesTrak**.

CelesTrak procesa estas efemérides y genera conjuntos orbitales suplementarios pseudo-TLE (**SupGP** — *Supplementary General Perturbations*), disponibles públicamente en:
`https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=tle`

**Decisión adoptada:**  
La aplicación consume de forma predeterminada el set **SupGP** para toda la categoría Starlink. Esto garantiza que las posiciones propagadas con SGP4 en el teléfono sigan con máxima exactitud la trayectoria real posmaniobra informada directamente por el operador del satélite.

---

## 3. Estrategia de Caché Local y Límites de Uso (Rate Limiting)

Para cumplir con el requerimiento de funcionamiento **100% desconectado en el momento del pase** y proteger la cuota de las APIs públicas, se diseñó la siguiente política:

### 3.1 Política de Caché en dos Niveles
1. **Nivel 1: Almacenamiento Persistente (`OrbitalCacheService` con AsyncStorage)**
   - **TTL Operativo:** $24 \text{ horas}$ (`DEFAULT_TTL_MS = 86,400,000 ms`).
   - Cada respuesta de catálogo o TLE se almacena junto con su marca de tiempo (`timestamp`), fuente proveedora y clave de categoría.
   - Si la red está disponible pero el dato en caché tiene menos de 24 h, la app sirve inmediatamente desde memoria local (latencia de 0 ms, sin consumo de red).
2. **Nivel 2: Dataset Embebido de Respaldo (*Zero-Connectivity Out-of-the-Box*)**
   - La aplicación incluye en `CatalogService.DEFAULT_SATELLITES` un conjunto estático precargado con satélites clave (ISS, Starlink, Hubble, NOAA-18, GPS NAVSTAR).
   - Si el usuario abre la app por primera vez en un entorno completamente desconectado (o tras vaciar la caché en *Ajustes*), el sistema inicializa instantáneamente sin arrojar errores de red.

### 3.2 Implementación de Limitadores de Tráfico (*Rate Limiters*)
En cumplimiento de la Sección 4.3, cada proveedor cuenta con control de intervalo mínimo entre llamadas concurrentes:
- **`SpaceTrackProvider`:** Forzado a un intervalo mínimo de $3000 \text{ ms}$ entre peticiones consecutivas, asegurando no sobrepasar el techo de $20 \text{ peticiones/minuto}$ de Space-Track.
- **`N2yoProvider`:** Forzado a un intervalo mínimo de $2000 \text{ ms}$ entre consultas, asegurando un consumo controlado de la cuota gratuita de $1000 \text{ transacciones/hora}$.

---

## 4. Cadena de Conmutación ante Fallos (*Failover Orchestration*)

La recuperación ante caídas de servicio o agotamiento de cuota opera en cascada descendente automática dentro de `CatalogService.ts`:

```
[Petición de Satélite / Catálogo]
               │
               ▼
   ¿Existe en Caché local válida (< 24 h)?
         ├── SÍ ──► [Retornar de AsyncStorage (0 ms)]
         └── NO
               │
               ▼
   [Nivel 1: CelesTrak (Primario)]
         ├── ÉXITO ──► Guardar en Caché ──► [Retornar]
         └── FALLO (Timeout / HTTP 5xx)
               │
               ▼
   [Nivel 2: Space-Track (Secundario)]
         ├── ÉXITO (con credenciales) ──► Guardar en Caché ──► [Retornar]
         └── FALLO / Sin credenciales
               │
               ▼
   [Nivel 3: N2YO (Terciario)]
         ├── ÉXITO (con API Key) ──► Guardar en Caché ──► [Retornar]
         └── FALLO / Sin API Key
               │
               ▼
   ¿Existe Caché expirada / Stale (> 24 h)?
         ├── SÍ ──► [Retornar datos expirados con alerta isStale: true]
         └── NO
               │
               ▼
   [Nivel 4: Dataset Embebido Local (Offline Garantizado)]
```

Esta arquitectura asegura que la aplicación **nunca se bloquea**, preservando siempre la capacidad de calcular órbitas y visualizar pases aún ante la caída total de la conectividad o de las APIs de origen.
