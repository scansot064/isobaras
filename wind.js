const windLayer = document.getElementById("wind-layer");
const windState = {
  particles: [],
  sources: [],
  layer: "surface",
  jet: null,
  enabled: false,
  frame: null,
  lastFrame: null
};

function windVelocity(x, y, sources, layer, jet = null) {
  if (layer === "surface") return simulatedWind(x, y, sources);
  const [vx, vy] = heightWind(x, y, sources, jet);
  const scale = Math.min(180, 45 / (Math.hypot(vx, vy) || 1));
  return [vx * scale, vy * scale];
}

function advanceWindPosition(x, y, sources, elapsed, layer = "surface", jet = null) {
  // El punto medio mejora la trayectoria frente a avanzar solo con el viento inicial.
  const [vx, vy] = windVelocity(x, y, sources, layer, jet);
  const [midX, midY] = windVelocity(x + vx * elapsed / 2, y + vy * elapsed / 2, sources, layer, jet);
  return [x + midX * elapsed, y + midY * elapsed];
}

function createWindParticles() {
  for (let y = 55; y < MAP_HEIGHT; y += 110) {
    for (let x = 60; x < MAP_WIDTH; x += 120) {
      const element = svgElement("g", {
        class: "pressure-wind"
      });
      element.append(svgElement("path", {
        d: "M -9 0 H 9 M 4 -4 L 9 0 L 4 4"
      }));
      windLayer.append(element);
      windState.particles.push({
        x,
        y,
        originX: x,
        originY: y,
        opacity: 0,
        element
      });
    }
  }
}

function renderWindParticle(particle, elapsed) {
  const [vx, vy] = windVelocity(particle.x, particle.y, windState.sources, windState.layer, windState.jet);
  const nearCenter = windState.sources.some(source => Math.hypot(particle.x - source.x, particle.y - source.y) < 38);
  const visible = Math.hypot(vx, vy) >= 1.125 && !nearCenter;
  particle.opacity = visible ? Math.min(.75, particle.opacity + elapsed * 1.5) : 0;
  particle.element.style.opacity = particle.opacity;
  particle.element.setAttribute("transform",
    `translate(${particle.x} ${particle.y}) rotate(${Math.atan2(vy, vx) * 180 / Math.PI})`);
}

function stopWind() {
  if (windState.frame !== null) cancelAnimationFrame(windState.frame);
  windState.frame = null;
  windState.lastFrame = null;
}

function windTick(timestamp) {
  windState.frame = null;
  if (!windState.enabled || document.hidden) return;
  if (windState.lastFrame === null) windState.lastFrame = timestamp;
  const elapsed = Math.min((timestamp - windState.lastFrame) / 1000, .1) * SIMULATION_SPEED;
  windState.lastFrame = timestamp;
  for (const particle of windState.particles) {
    [particle.x, particle.y] = advanceWindPosition(particle.x, particle.y, windState.sources, elapsed, windState.layer,
      windState.jet);
    if (particle.x < -20 || particle.x > MAP_WIDTH + 20 || particle.y < -20 || particle.y > MAP_HEIGHT + 20) {
      particle.x = particle.originX;
      particle.y = particle.originY;
      particle.opacity = 0;
    }
    renderWindParticle(particle, elapsed);
  }
  windState.frame = requestAnimationFrame(windTick);
}

function startWind() {
  if (windState.enabled && !document.hidden && windState.frame === null) windState.frame = requestAnimationFrame(
    windTick);
}

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
  } else {
    if (!windState.particles.length) createWindParticles();
    for (const particle of windState.particles) renderWindParticle(particle, 0);
    startWind();
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopWind();
  else startWind();
});
