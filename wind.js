// Capa de flechas de viento sobre el mapa SVG.
//
// Las flechas forman una cuadrícula fija: mientras el viento está activo no se
// crean ni se destruyen, solo se mueven siguiendo el viento, giran hacia su
// dirección, se desvanecen o vuelven a su posición inicial al salir del mapa.

const windLayer = document.getElementById("wind-layer");

// ---------------------------------------------------------------------------
// Parámetros
// ---------------------------------------------------------------------------

// Cuadrícula inicial de flechas (px).
const WIND_GRID_START_X = 60;
const WIND_GRID_START_Y = 55;
const WIND_GRID_STEP_X = 120;
const WIND_GRID_STEP_Y = 110;

// Flecha dibujada apuntando hacia +x (cuerpo y punta); luego se rota.
const WIND_ARROW_PATH = "M -9 0 H 9 M 4 -4 L 9 0 L 4 4";

// Visibilidad.
const WIND_MIN_SPEED = 1.125;        // por debajo de esta velocidad la flecha se oculta
const WIND_CENTER_RADIUS = 38;       // sin flechas cerca de un centro de presión (px)
const WIND_MAX_OPACITY = .75;
const WIND_FADE_IN_PER_SECOND = 1.5; // opacidad ganada por segundo al aparecer

// Se comparan cuadrados para evitar calcular raíces cuadradas en cada frame.
const WIND_MIN_SPEED_SQ = WIND_MIN_SPEED ** 2;
const WIND_CENTER_RADIUS_SQ = WIND_CENTER_RADIUS ** 2;

// Una flecha que se aleja más de este margen del mapa vuelve a su origen (px).
const WIND_OFFSCREEN_MARGIN = 20;

// Límite del paso de tiempo (s): evita saltos si el navegador se ralentiza.
const WIND_MAX_FRAME_SECONDS = .1;

// Capa en altura: el viento se reescala a una velocidad objetivo, con un tope
// para el factor de escala cuando el viento original es muy débil.
const UPPER_WIND_TARGET_SPEED = 45;
const UPPER_WIND_MAX_SCALE = 180;

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const windState = {
  particles: [],   // flechas: { x, y, originX, originY, opacity, velocity, drawnOpacity, element }
  sources: [],     // centros de presión (superficie) o de altura (upper)
  layer: "surface",
  jet: null,
  enabled: false,
  frame: null,     // id de requestAnimationFrame; null si no hay animación en curso
  lastFrame: null  // marca de tiempo del frame anterior
};

// ---------------------------------------------------------------------------
// Física
// ---------------------------------------------------------------------------

// Devuelve el viento [vx, vy] en el punto (x, y).
function windVelocity(x, y, sources, layer, jet = null) {
  if (layer === "surface") return simulatedWind(x, y, sources);

  const [vx, vy] = heightWind(x, y, sources, jet);
  const scale = Math.min(UPPER_WIND_MAX_SCALE, UPPER_WIND_TARGET_SPEED / (Math.hypot(vx, vy) || 1));
  return [vx * scale, vy * scale];
}

// Calcula la nueva posición tras `elapsed` segundos.
// El punto medio mejora la trayectoria frente a avanzar solo con el viento inicial.
// `velocity` es opcional: si ya se conoce el viento en (x, y) se evita recalcularlo.
function advanceWindPosition(x, y, sources, elapsed, layer = "surface", jet = null, velocity = null) {
  const [vx, vy] = velocity ?? windVelocity(x, y, sources, layer, jet);
  const [midX, midY] = windVelocity(x + vx * elapsed / 2, y + vy * elapsed / 2, sources, layer, jet);
  return [x + midX * elapsed, y + midY * elapsed];
}

// ---------------------------------------------------------------------------
// Flechas
// ---------------------------------------------------------------------------

function createWindParticles() {
  for (let y = WIND_GRID_START_Y; y < MAP_HEIGHT; y += WIND_GRID_STEP_Y) {
    for (let x = WIND_GRID_START_X; x < MAP_WIDTH; x += WIND_GRID_STEP_X) {
      const element = svgElement("g", { class: "pressure-wind" });
      element.append(svgElement("path", { d: WIND_ARROW_PATH }));
      windLayer.append(element);

      windState.particles.push({
        x,
        y,
        originX: x,
        originY: y,
        opacity: 0,
        velocity: null,      // último viento calculado en (x, y)
        drawnOpacity: null,  // última opacidad escrita en el DOM
        element
      });
    }
  }
}

function isNearPressureCenter(x, y, sources) {
  for (const source of sources) {
    const dx = x - source.x;
    const dy = y - source.y;
    if (dx * dx + dy * dy < WIND_CENTER_RADIUS_SQ) return true;
  }
  return false;
}

function isOutsideMap(particle) {
  return particle.x < -WIND_OFFSCREEN_MARGIN
    || particle.x > MAP_WIDTH + WIND_OFFSCREEN_MARGIN
    || particle.y < -WIND_OFFSCREEN_MARGIN
    || particle.y > MAP_HEIGHT + WIND_OFFSCREEN_MARGIN;
}

function resetWindParticle(particle) {
  particle.x = particle.originX;
  particle.y = particle.originY;
  particle.opacity = 0;
}

// Actualiza velocidad, opacidad, posición y rotación de una flecha en el SVG.
function renderWindParticle(particle, elapsed) {
  const velocity = windVelocity(particle.x, particle.y, windState.sources, windState.layer, windState.jet);
  const [vx, vy] = velocity;
  particle.velocity = velocity; // se reutiliza en el siguiente movimiento

  const visible = vx * vx + vy * vy >= WIND_MIN_SPEED_SQ
    && !isNearPressureCenter(particle.x, particle.y, windState.sources);

  particle.opacity = visible
    ? Math.min(WIND_MAX_OPACITY, particle.opacity + elapsed * WIND_FADE_IN_PER_SECOND)
    : 0;

  if (particle.opacity !== particle.drawnOpacity) {
    particle.element.style.opacity = particle.opacity;
    particle.drawnOpacity = particle.opacity;
  }

  const angle = Math.atan2(vy, vx) * 180 / Math.PI;
  particle.element.setAttribute("transform", `translate(${particle.x} ${particle.y}) rotate(${angle})`);
}

// ---------------------------------------------------------------------------
// Animación
// ---------------------------------------------------------------------------

function stopWind() {
  if (windState.frame !== null) cancelAnimationFrame(windState.frame);
  windState.frame = null;
  windState.lastFrame = null;
}

function startWind() {
  const canStart = windState.enabled && !document.hidden && windState.frame === null;
  if (canStart) windState.frame = requestAnimationFrame(windTick);
}

function windTick(timestamp) {
  windState.frame = null;
  if (!windState.enabled || document.hidden) return;

  if (windState.lastFrame === null) windState.lastFrame = timestamp;
  const elapsed = Math.min((timestamp - windState.lastFrame) / 1000, WIND_MAX_FRAME_SECONDS) * SIMULATION_SPEED;
  windState.lastFrame = timestamp;

  for (const particle of windState.particles) {
    // El chorro manual puede cambiar entre el renderizado y este fotograma.
    [particle.x, particle.y] = advanceWindPosition(
      particle.x, particle.y, windState.sources, elapsed, windState.layer, windState.jet,
      windState.jet ? null : particle.velocity
    );
    if (isOutsideMap(particle)) resetWindParticle(particle);
    renderWindParticle(particle, elapsed);
  }

  windState.frame = requestAnimationFrame(windTick);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

// Se llama cuando cambian los objetos del mapa o la capa visible.
function updateWindSources(objects, layer, jet = null) {
  windState.layer = layer;
  windState.jet = layer === "upper" ? jet : null;
  windState.sources = layer === "upper" ? heightSources(objects) : pressureSources(objects);
  windState.enabled = layer === "upper" || windState.sources.length > 0;
  windLayer.style.display = windState.enabled ? "" : "none";

  if (!windState.enabled) {
    stopWind();
    windLayer.replaceChildren();
    windState.particles = [];
    return;
  }

  if (!windState.particles.length) createWindParticles();
  // Con elapsed = 0 se recalcula el viento y la visibilidad sin mover las flechas.
  for (const particle of windState.particles) renderWindParticle(particle, 0);
  startWind();
}

// Pausa la animación con la pestaña oculta y la reanuda al volver.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopWind();
  else startWind();
});
