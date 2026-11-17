function automaticJet(sources) {
  const starts = [];
  for (let y = 10; y < MAP_HEIGHT; y += 20) starts.push([0, y]);
  for (let x = 10; x < MAP_WIDTH; x += 20) starts.push([x, 1]);
  let best = null;
  // Se comparan trayectorias hacia el este y se favorecen las más largas y rápidas.
  for (const [startX, startY] of starts) {
    let x = startX;
    let y = startY;
    let score = 0;
    const points = [
      [x, y]
    ];
    const speeds = [];
    while (x < MAP_WIDTH) {
      const step = Math.min(20, MAP_WIDTH - x);
      const [vx, vy] = heightWind(x, y, sources);
      if (vx <= .03) break;
      const [midX, midY] = heightWind(x + step / 2, y + step * vy / vx / 2, sources);
      if (midX <= .03 || Math.abs(midY / midX) > 4) break;
      const nextY = y + step * midY / midX;
      if (nextY < 0 || nextY > MAP_HEIGHT) {
        const edge = nextY < 0 ? 0 : MAP_HEIGHT;
        const ratio = (edge - y) / (nextY - y);
        points.push([x + step * ratio, edge]);
        break;
      }
      x += step;
      y = nextY;
      points.push([x, y]);
      speeds.push(midX);
      score += midX ** 2 * step;
    }
    if (x - startX < 300 || (best && score <= best.score)) continue;
    let strongest = 0;
    for (let i = 0; i <= speeds.length - 5; i++) {
      strongest = Math.max(strongest, speeds.slice(i, i + 5).reduce((sum, speed) => sum + speed, 0) / 5);
    }
    best = {
      points,
      score,
      type: strongest >= 2.5 ? "jet-strong" : "jet-weak"
    };
  }
  return best;
}
let automaticJetKey = "";

function drawAutomaticJet(objects, layer, mode) {
  const container = document.getElementById("automatic-jet");
  const sources = layer === "upper" && mode === "automatic" ? heightSources(objects) : [];
  const key = JSON.stringify([layer, mode, sources]);
  if (key === automaticJetKey) return;
  automaticJetKey = key;
  container.replaceChildren();
  if (layer !== "upper" || mode !== "automatic") return;
  const jet = automaticJet(sources);
  document.getElementById("jet-help").textContent = jet ?
    "Trazado orientativo calculado a partir del campo de altura." :
    "No se ha encontrado un trazado automático; ajusta los centros de altura.";
  if (jet) drawJet(container, {
    ...jet,
    selected: false
  });
}
