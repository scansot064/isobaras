const AIR_COLUMNS = 120;
const AIR_ROWS = 70;
const AIR_STEP = .25;
const airCanvas = document.createElement("canvas");
airCanvas.width = AIR_COLUMNS;
airCanvas.height = AIR_ROWS;
const airContext = airCanvas.getContext("2d");
if (!airContext) throw new Error("No se puede iniciar la simulación de masas de aire: canvas no está disponible.");
const airState = {
  date: "",
  enabled: false,
  boundary: 60,
  values: null,
  sources: [],
  sourceKey: "",
  velocityX: null,
  velocityY: null,
  frame: null,
  lastFrame: null
};

function seasonalBoundary(date) {
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const months = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const day = months.slice(0, month - 1).reduce((sum, length) => sum + length, dayOfMonth - 1);
  const daysInYear = leap ? 366 : 365;
  return 58 - 9 * Math.cos(2 * Math.PI * (day - 14) / daysInYear);
}

function seasonalAirTemperature(latitude, boundary) {
  return Math.max(0, Math.min(1, .5 + (boundary - latitude) / 38));
}

function backgroundAirAt(x, y, boundary) {
  // El Atlántico occidental se representa más fresco que otras zonas de la misma latitud.
  const longitude = longitudeAtPoint(x, y);
  const atlanticCooling = 7 * Math.exp(-.5 * ((longitude + 50) / 25) ** 2);
  return seasonalAirTemperature(latitudeAtPoint(x, y), boundary - atlanticCooling);
}

function initialAirField(boundary) {
  const values = new Float32Array(AIR_COLUMNS * AIR_ROWS);
  for (let y = 0; y < AIR_ROWS; y++) {
    for (let x = 0; x < AIR_COLUMNS; x++) {
      values[y * AIR_COLUMNS + x] = backgroundAirAt((x + .5) * MAP_WIDTH / AIR_COLUMNS, (y + .5) * MAP_HEIGHT /
        AIR_ROWS, boundary);
    }
  }
  return values;
}

function sampleAir(values, x, y, boundary) {
  const gx = x * AIR_COLUMNS / MAP_WIDTH - .5;
  const gy = y * AIR_ROWS / MAP_HEIGHT - .5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;

  function valueAt(column, row) {
    if (column < 0 || column >= AIR_COLUMNS || row < 0 || row >= AIR_ROWS) {
      return backgroundAirAt((column + .5) * MAP_WIDTH / AIR_COLUMNS, (row + .5) * MAP_HEIGHT / AIR_ROWS, boundary);
    }
    return values[row * AIR_COLUMNS + column];
  }
  const top = valueAt(x0, y0) * (1 - tx) + valueAt(x0 + 1, y0) * tx;
  const bottom = valueAt(x0, y0 + 1) * (1 - tx) + valueAt(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function airVelocityGrid(sources) {
  const velocityX = new Float32Array(AIR_COLUMNS * AIR_ROWS);
  const velocityY = new Float32Array(AIR_COLUMNS * AIR_ROWS);
  for (let y = 0; y < AIR_ROWS; y++) {
    for (let x = 0; x < AIR_COLUMNS; x++) {
      const [vx, vy] = simulatedWind((x + .5) * MAP_WIDTH / AIR_COLUMNS, (y + .5) * MAP_HEIGHT / AIR_ROWS, sources);
      const index = y * AIR_COLUMNS + x;
      velocityX[index] = vx;
      velocityY[index] = vy;
    }
  }
  return {
    velocityX,
    velocityY
  };
}

function advanceAirField(values, velocityX, velocityY, boundary, elapsed = AIR_STEP) {
  // Advección semilagrangiana: se busca hacia atrás el origen del aire de cada celda.
  const next = new Float32Array(values.length);
  for (let y = 0; y < AIR_ROWS; y++) {
    for (let x = 0; x < AIR_COLUMNS; x++) {
      const index = y * AIR_COLUMNS + x;
      const mapX = (x + .5) * MAP_WIDTH / AIR_COLUMNS;
      const mapY = (y + .5) * MAP_HEIGHT / AIR_ROWS;
      next[index] = sampleAir(values, mapX - velocityX[index] * elapsed, mapY - velocityY[index] * elapsed, boundary);
    }
  }
  return next;
}

function renderAir() {
  const pixels = airContext.createImageData(AIR_COLUMNS, AIR_ROWS);
  const cold = [103, 169, 205];
  const mild = [184, 210, 166];
  const warm = [225, 179, 140];
  for (let i = 0; i < airState.values.length; i++) {
    const value = airState.values[i];
    const from = value < .5 ? cold : mild;
    const to = value < .5 ? mild : warm;
    const ratio = value < .5 ? value * 2 : (value - .5) * 2;
    for (let channel = 0; channel < 3; channel++) pixels.data[i * 4 + channel] = Math.round(from[channel] + (to[
      channel] - from[channel]) * ratio);
    pixels.data[i * 4 + 3] = 255;
  }
  airContext.putImageData(pixels, 0, 0);
  document.getElementById("air-overlay").setAttribute("href", airCanvas.toDataURL("image/png"));
}

function resetAir() {
  airState.values = initialAirField(airState.boundary);
  renderAir();
}

function stopAir() {
  if (airState.frame !== null) cancelAnimationFrame(airState.frame);
  airState.frame = null;
  airState.lastFrame = null;
}

function airTick(timestamp) {
  airState.frame = null;
  if (!airState.enabled || document.hidden || !airState.sources.length) return;
  if (airState.lastFrame === null) airState.lastFrame = timestamp;
  if (timestamp - airState.lastFrame >= 100) {
    const elapsed = Math.min((timestamp - airState.lastFrame) / 1000, .2) * SIMULATION_SPEED;
    airState.values = advanceAirField(airState.values, airState.velocityX, airState.velocityY, airState.boundary,
      elapsed);
    renderAir();
    airState.lastFrame = timestamp;
  }
  airState.frame = requestAnimationFrame(airTick);
}

function startAir() {
  if (airState.enabled && !document.hidden && airState.sources.length && airState.frame === null) airState.frame =
    requestAnimationFrame(airTick);
}

function configureAir(date, enabled) {
  const changed = date !== airState.date;
  airState.date = date;
  airState.enabled = Boolean(date && enabled);
  if (date && (changed || !airState.values)) {
    airState.boundary = seasonalBoundary(date);
    resetAir();
    airState.lastFrame = null;
  }
  document.getElementById("air-overlay").setAttribute("opacity", airState.enabled ? "0.35" : "0");
  if (airState.enabled) startAir();
  else stopAir();
}

function updateAirSources(objects) {
  const sources = pressureSources(objects);
  const key = JSON.stringify(sources);
  if (key === airState.sourceKey) return;
  const hadSources = airState.sources.length > 0;
  airState.sources = sources;
  airState.sourceKey = key;
  if (sources.length) {
    const velocity = airVelocityGrid(sources);
    airState.velocityX = velocity.velocityX;
    airState.velocityY = velocity.velocityY;
    startAir();
  } else {
    stopAir();
    if (hadSources && airState.date) resetAir();
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopAir();
  else startAir();
});
