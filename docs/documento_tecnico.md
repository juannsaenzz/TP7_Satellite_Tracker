# Documento Técnico: Modelo de Propagación Orbital y Geometría Espacial

**Materia:** Programación Móviles 2026  
**Carrera:** Licenciatura en Sistemas de Información  
**Proyecto:** Satellite Tracker (Predictor Orbital SGP4 / SDP4)  

---

## 1. Introducción y Fundamentos de Astrodinámica

El presente documento detalla la arquitectura matemática, algoritmos de propagación y transformaciones de sistemas de referencia implementados en la aplicación **Satellite Tracker**.

El objetivo central del sistema es calcular de manera **100% local y determinística** la posición tridimensional de satélites artificiales en órbita terrestre baja (LEO) y media (MEO) a partir de conjuntos de elementos de dos líneas (**TLE** — *Two-Line Element Sets*) o mensajes de elementos medios orbitales (**OMM/JSON** — *Orbit Mean-Elements Message*), sin recurrir a streaming continuo ni procesamiento en servidores externos.

---

## 2. Modelo de Propagación Orbital SGP4 / SDP4

### 2.1 Modelo Analítico SGP4
Para satélites en órbita terrestre cercana (período orbital $T < 225$ minutos, típicamente $h < 6000$ km), el motor utiliza el modelo analítico **SGP4** (*Simplified General Perturbations 4*), desarrollado por Ken Cranford (1970) y perfeccionado por Felix Hoots y Ronald Roehrich (1980, Spacetrack Report No. 3), con revisiones de Vallado et al. (AIAA 2006-6753).

A diferencia de los modelos keplerianos de dos cuerpos (que asumen una Tierra esférica y masa puntual en vacío), SGP4 modela perturbaciones físicas reales:
1. **Asfericidad gravitatoria terrestre:** Modela el achatamiento polar y el ensanchamiento ecuatorial mediante armónicos zonales de campo gravitatorio:
   - $J_2$: Efecto dominante de segundo orden (achatamiento ecuatorial, responsable de la precesión nodal y rotación del argumento del perigeo).
   - $J_3, J_4$: Armónicos zonales de orden superior que corrigen asimetrías hemisféricas.
2. **Resistencia atmosférica (*Atmospheric Drag*):** Modela la deceleración en la termosfera/exosfera mediante una densidad atmosférica que decae exponencialmente con la altitud, parametrizada a través del coeficiente balístico $B^*$:
   $$B^* = \frac{1}{2} \frac{C_D A}{m} \rho_0$$
   donde $C_D$ es el coeficiente de arrastre, $A$ es el área transversal efectiva expuesta, $m$ es la masa del satélite y $\rho_0$ es la densidad de referencia.

### 2.2 Modelo SDP4 (Períodos Profundos)
Para satélites con período orbital $T \ge 225$ minutos (típicamente satélites en órbitas GEO, Molniya o MEO de constelaciones GNSS/GPS), el motor conmuta automáticamente a **SDP4** (*Simplified Deep Space Perturbations 4*). SDP4 añade:
- Perturbaciones resonantes de orden 12h y 24h con la rotación de la Tierra.
- Perturbaciones de tercer cuerpo causadas por los campos gravitacionales combinados de la Luna y el Sol.

---

## 3. Cadena de Transformación de Sistemas de Coordenadas

La determinación de si un satélite es visible para un observador sobre la superficie terrestre requiere una secuencia rigurosa de 4 cambios de sistemas de referencia:

```
[TLE / OMM] 
    │
    ▼ (SGP4)
[TEME / ECI: True Equator, Mean Equinox (km)]
    │
    ▼ (Rotación GMST - Tiempo Sidéreo Aparente)
[ECEF: Earth-Centered, Earth-Fixed (km)]
    │
    ├─────────────────────────────┬─────────────────────────────┐
    ▼                             ▼                             ▼
[Geodésico WGS84]            [Topocéntrico SEZ]         [Radar Polar]
(Latitud, Longitud, Altitud) (Azimut, Elevación, Rango) (Azimut, Radio Polar)
```

### 3.1 Espacio Inercial TEME a Terrestre ECEF
SGP4 evalúa el estado del satélite en el sistema inercial **TEME** (*True Equator, Mean Equinox*). Dado que la Tierra rota debajo de la órbita inercial a una velocidad angular $\omega_\oplus \approx 7.292115 \times 10^{-5} \text{ rad/s}$, se calcula el **Tiempo Sidéreo Medio de Greenwich** (**GMST**) en el instante temporal $t$:

$$\theta_{\text{GMST}}(t) = 24.06570982441908 + 1.002737909350795 \cdot D_U$$

La rotación de coordenadas cartesianas inerciales $(X_{\text{TEME}}, Y_{\text{TEME}}, Z_{\text{TEME}})$ a coordenadas terrestres fijas $(X_{\text{ECEF}}, Y_{\text{ECEF}}, Z_{\text{ECEF}})$ se calcula como:

$$\begin{bmatrix} X_{\text{ECEF}} \\ Y_{\text{ECEF}} \\ Z_{\text{ECEF}} \end{bmatrix} = \begin{bmatrix} \cos(\theta_{\text{GMST}}) & \sin(\theta_{\text{GMST}}) & 0 \\ -\sin(\theta_{\text{GMST}}) & \cos(\theta_{\text{GMST}}) & 0 \\ 0 & 0 & 1 \end{bmatrix} \begin{bmatrix} X_{\text{TEME}} \\ Y_{\text{TEME}} \\ Z_{\text{TEME}} \end{bmatrix}$$

### 3.2 Conversión ECEF a Coordenadas Geodésicas WGS84
El elipsoide de referencia **WGS84** define:
- Semieje mayor ecuatorial: $a = 6378.137 \text{ km}$
- Factor de achatamiento polar: $f = \frac{1}{298.257223563}$
- Excentricidad lineal al cuadrado: $e^2 = 2f - f^2 \approx 0.00669437999014$

A partir del vector de posición ECEF, se obtienen las coordenadas geodésicas:
- **Longitud Geográfica ($\lambda$):**
  $$\lambda = \arctan2(Y_{\text{ECEF}}, X_{\text{ECEF}})$$
- **Latitud Geodésica ($\phi$) y Altitud elipsoidal ($h$):** Calculadas mediante iteración de Bowring convergente en 2 iteraciones con tolerancia milimétrica:
  $$p = \sqrt{X_{\text{ECEF}}^2 + Y_{\text{ECEF}}^2}$$
  $$N(\phi) = \frac{a}{\sqrt{1 - e^2 \sin^2(\phi)}}$$
  $$h = \frac{p}{\cos(\phi)} - N(\phi)$$

### 3.3 Vectores Topocéntricos Observador-Satélite (SEZ)
Para un observador geográfico con coordenadas $(\phi_{\text{obs}}, \lambda_{\text{obs}}, h_{\text{obs}})$, se proyecta el vector relativo $\vec{\rho} = \vec{r}_{\text{sat}} - \vec{r}_{\text{obs}}$ en el marco topocéntrico local **SEZ** (*South, East, Zenith*):

$$\rho_S = \sin(\phi_{\text{obs}}) \cos(\lambda_{\text{obs}}) \Delta X + \sin(\phi_{\text{obs}}) \sin(\lambda_{\text{obs}}) \Delta Y - \cos(\phi_{\text{obs}}) \Delta Z$$
$$\rho_E = -\sin(\lambda_{\text{obs}}) \Delta X + \cos(\lambda_{\text{obs}}) \Delta Y$$
$$\rho_Z = \cos(\phi_{\text{obs}}) \cos(\lambda_{\text{obs}}) \Delta X + \cos(\phi_{\text{obs}}) \sin(\lambda_{\text{obs}}) \Delta Y + \sin(\phi_{\text{obs}}) \Delta Z$$

A partir de las componentes SEZ:
- **Distancia oblicua (*Slant Range*):** $\rho = \sqrt{\rho_S^2 + \rho_E^2 + \rho_Z^2}$
- **Elevación ($\text{El}$):**
  $$\text{El} = \arcsin\left(\frac{\rho_Z}{\rho}\right)$$
- **Azimut ($\text{Az}$):**
  $$\text{Az} = \arctan2(\rho_E, -\rho_S) \pmod{360^\circ}$$

---

## 4. Algoritmos Geométricos y de Visualización

### 4.1 Resolución de Discontinuidad en el Antimeridiano ($\pm 180^\circ$)
En mapas con proyección 2D cilíndrica equirrectangular, la longitud mapea linealmente:
$$x = \lambda + 180^\circ \in [0^\circ, 360^\circ]$$

Al trazar el *ground track* de un satélite que cruza el antimeridiano (p. ej. de $+179.5^\circ$ a $-179.5^\circ$), la diferencia de longitudes consecutivas:
$$|\lambda_i - \lambda_{i-1}| > 180^\circ$$

Si no se procesa, el motor gráfico traza una línea transversal que cruza todo el ancho de la pantalla ($359 \text{ px}$ de longitud).

**Algoritmo implementado en `GroundTrackService.ts`:**
1. Se itera sobre las muestras temporales ($\Delta t = 30 \text{ s}$).
2. Al detectar $|\Delta \lambda| > 180^\circ$, se calcula la intersección exacta con el meridiano $\pm 180^\circ$ mediante interpolación lineal de la latitud:
   $$t_{\text{cruce}} = t_{i-1} + (t_i - t_{i-1}) \frac{\text{sign}(\lambda_{i-1}) \cdot 180^\circ - \lambda_{i-1}}{(\lambda_i + \text{sign}(\lambda_{i-1})\cdot 360^\circ) - \lambda_{i-1}}$$
   $$\phi_{\text{cruce}} = \phi_{i-1} + \frac{\phi_i - \phi_{i-1}}{t_i - t_{i-1}} (t_{\text{cruce}} - t_{i-1})$$
3. El segmento actual se cierra en $(\pm 180^\circ, \phi_{\text{cruce}})$ y se inicia inmediatamente un nuevo segmento en $(\mp 180^\circ, \phi_{\text{cruce}})$.

### 4.2 Geometría del Área de Cobertura Terrestre (*Footprint*)
El área de la superficie terrestre visible simultáneamente desde un satélite a altitud $h$ con un ángulo de elevación mínimo sobre el horizonte local $\epsilon$ (máscara de elevación) se define mediante el radio angular central $\theta$:

$$\cos(\theta + \epsilon) = \frac{R_E}{R_E + h} \cos(\epsilon) \implies \theta = \arccos\left(\frac{R_E}{R_E + h} \cos(\epsilon)\right) - \epsilon$$

- **Radio sobre la superficie terrestre:** $S = R_E \cdot \theta$ (en km).
- **Generación de Polígono Continuo sin distorsión de antimeridiano:**  
  En [FootprintService.ts](file:///c:/tp_7/SatelliteTracker/src/core/orbital/FootprintService.ts), se generan 48 vértices de gran círculo en rumbo $\alpha \in [0, 2\pi]$ manteniendo las longitudes continuas respecto al meridiano central $\lambda_0$. Si el polígono excede los límites $x < 0$ o $x > 360$, se renderiza una instancia gemela desdoblada desplazada en $\pm 360^\circ$, garantizando que la huella envuelva el borde este/oeste sin trazar bandas espurias.

### 4.3 Algoritmo de Predicción de Pases (Grueso $\rightarrow$ Fino)
Para calcular las ventanas de visibilidad de los próximos 3 a 5 días sin saturar el hilo de JavaScript:
1. **Fase Gruesa (*Coarse Grid Scan*):** Muestrea la elevación del satélite a intervalos de $\Delta t = 60 \text{ s}$. Detecta cruces de umbral de elevación ($\text{El} \ge \epsilon_{\text{mask}}$).
2. **Fase Fina de Bisección (*Binary Search Refinement*):** Localizado el intervalo de cruce $[t_a, t_b]$, aplica bisección en 7 iteraciones para converger en el tiempo exacto de **AOS** (*Acquisition of Signal*) y **LOS** (*Loss of Signal*) con resolución de 1 segundo:
   $$\text{Error temporal} = \frac{60 \text{ s}}{2^7} \approx 0.46 \text{ s}$$
3. **Culminación (Punto Máximo / TCA):** Mediante búsqueda de sección dorada (*Golden-section search*) sobre el intervalo $[t_{\text{AOS}}, t_{\text{LOS}}]$, localiza el instante exacto del cenit relativo y la elevación máxima alcanzada.

---

## 5. Supuestos y Limitaciones del Modelo

1. **Desactualización del TLE:**  
   Los elementos orbitales representan un promedio temporal (*mean elements*) que degrada su precisión entre 1 y 3 km por día debido a la variabilidad de la densidad atmosférica termosférica.
2. **Modelo Atmosférico Estático:**  
   SGP4 asume un coeficiente $B^*$ constante y no integra dinámicamente tormentas geomagnéticas (índice $K_p$) ni variaciones en el flujo de radiación solar ultravioleta ($F_{10.7}$).
3. **Maniobras No Modeladas:**  
   Satélites activos con propulsión eléctrica continua (como la constelación Starlink con motores de efecto Hall a kriptón/argón) ajustan su órbita periódicamente. Por este motivo, el sistema prioriza los conjuntos suplementarios **SupGP** de CelesTrak derivados de las efemérides reportadas por SpaceX.
4. **Refracción Troposférica:**  
   Para elevaciones menores a $5^\circ$, la curvatura de los rayos electromagnéticos en la baja atmósfera genera un desfase angular de aproximadamente $0.1^\circ$ a $0.5^\circ$, el cual queda filtrado mediante la máscara de elevación configurable (predeterminada en $10^\circ$).

---

## 6. Conclusiones Técnicas

La arquitectura implementada desacopla por completo la visualización reactiva (React Native / SVG a 60 fps) del motor de propagación vectorial. La precisión lograda por el motor analítico SGP4/SDP4 integrado se sitúa holgadamente por debajo de la cota de tolerancia fijada de $5.0 \text{ km}$, garantizando predicciones de pases y apuntamiento asistido confiables en condiciones 100% desconectadas.
