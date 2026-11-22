const PRESSURE_BACKGROUND = 1013;
const PRESSURE_INTERVAL = 4;
const HEIGHT_BACKGROUND = 5640;
const HEIGHT_INTERVAL = 60;
const PRESSURE_COLUMNS = 120;
const PRESSURE_ROWS = 70;
const SIMULATION_SPEED = 2.5;
const INTENSITY_STEP = 4;
const INTENSITY_MAX = 48;

function pressureSources(objects) {
  return objects.filter(object => object.layer === "surface" && (object.type === "high" || object.type === "low")).map(
    object => ({
      x: object.x,
      y: object.y,
      amplitude: STRENGTH[object.strength].center[object.type] - PRESSURE_BACKGROUND +
        (object.type === "high" ? 1 : -1) * (object.intensityBoost ?? 0),
      bounds: centerBounds(object, 3)
    }));
}

function heightSources(objects) {
  return objects.filter(object => object.layer === "upper" && (object.type === "high" || object.type === "low")).map(
    object => ({
      x: object.x,
      y: object.y,
      amplitude: STRENGTH[object.strength].height[object.type] - HEIGHT_BACKGROUND,
      bounds: centerBounds(object, 3)
    }));
}

function sourceInfluence(x, y, sources) {
  let value = 0;
  for (const source of sources) {
    const dx = x - source.x;
    const dy = y - source.y;
    const width = (dx < 0 ? source.bounds.west : source.bounds.east) * 1.8;
    const height = (dy < 0 ? source.bounds.north : source.bounds.south) * 1.8;
    value += source.amplitude * Math.exp(-((dx / width) ** 2 + (dy / height) ** 2));
  }
  return value;
}

function pressureAt(x, y, sources) {
  return PRESSURE_BACKGROUND + sourceInfluence(x, y, sources);
}

function baseHeightAt(x, y, sources) {
  const latitude = latitudeAtPoint(x, y);
  return HEIGHT_BACKGROUND + 260 * Math.tanh((50 - latitude) / 12) + sourceInfluence(x, y, sources);
}

function heightAt(x, y, sources, jet = null) {
  const height = baseHeightAt(x, y, sources);
  if (!jet) return height;
  const first = jet.x + jet.points[0][0];
  const last = jet.x + jet.points[jet.points.length - 1][0];
  const outside = Math.max(first - x, x - last, 0);
  const fade = Math.max(0, 1 - outside / 160);
  const weight = fade * fade * (3 - 2 * fade);
  if (weight === 0) return height;
  // La corrección mantiene el chorro en una curva de altura y se desvanece fuera de sus extremos.
  return height + weight * (jet.referenceHeight - baseHeightAt(x, jetYAt(jet, x), sources));
}

function fieldWind(x, y, sources, field) {
  // El viento esquemático es perpendicular al gradiente del campo en el hemisferio norte.
  const dx = (field(x + 2, y, sources) - field(x - 2, y, sources)) / 4;
  const dy = (field(x, y + 2, sources) - field(x, y - 2, sources)) / 4;
  return [dy, -dx];
}

function pressureWind(x, y, sources) {
  return fieldWind(x, y, sources, pressureAt);
}

function heightWind(x, y, sources, jet = null) {
  return fieldWind(x, y, sources, (px, py, activeSources) => heightAt(px, py, activeSources, jet));
}

function simulatedWind(x, y, sources) {
  const [vx, vy] = pressureWind(x, y, sources);
  const scale = Math.min(180, 45 / (Math.hypot(vx, vy) || 1));
  return [vx * scale, vy * scale];
}

function pressureGrid(sources, columns = PRESSURE_COLUMNS, rows = PRESSURE_ROWS, field = pressureAt, interval =
  PRESSURE_INTERVAL) {
  const values = new Float64Array((columns + 1) * (rows + 1));
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= columns; x++) {
      let value = field(x * MAP_WIDTH / columns, y * MAP_HEIGHT / rows, sources);
      // Evita niveles exactos en los vértices, donde la unión de segmentos sería ambigua.
      if (Math.abs(value / interval - Math.round(value / interval)) < 1e-9) value += 1e-7;
      values[y * (columns + 1) + x] = value;
    }
  }
  return {
    values,
    columns,
    rows,
    interval
  };
}

function pressureContours(grid) {
  const {
    values,
    columns,
    rows,
    interval = PRESSURE_INTERVAL
  } = grid;
  const contours = new Map();
  const width = MAP_WIDTH / columns;
  const height = MAP_HEIGHT / rows;

  function triangle(a, b, c) {
    const low = Math.min(a.value, b.value, c.value);
    const high = Math.max(a.value, b.value, c.value);
    for (let level = Math.ceil(low / interval) * interval; level < high; level += interval) {
      const intersections = [];
      for (const [start, end] of [
          [a, b],
          [b, c],
          [c, a]
        ]) {
        if ((start.value < level) === (end.value < level)) continue;
        const ratio = (level - start.value) / (end.value - start.value);
        intersections.push([start.x + ratio * (end.x - start.x), start.y + ratio * (end.y - start.y)]);
      }
      if (intersections.length === 2) {
        if (!contours.has(level)) contours.set(level, []);
        contours.get(level).push(intersections);
      }
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * (columns + 1) + x;
      const a = {
        x: x * width,
        y: y * height,
        value: values[index]
      };
      const b = {
        x: (x + 1) * width,
        y: y * height,
        value: values[index + 1]
      };
      const c = {
        x: (x + 1) * width,
        y: (y + 1) * height,
        value: values[index + columns + 2]
      };
      const d = {
        x: x * width,
        y: (y + 1) * height,
        value: values[index + columns + 1]
      };
      // Una triangulación fija mantiene todas las curvas en un mismo campo interpolado.
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
  return contours;
}

function drawPressureField(objects, layer, jet = null) {
  const container = document.getElementById("pressure-field");
  container.replaceChildren();
  const upper = layer === "upper";
  const sources = upper ? heightSources(objects) : pressureSources(objects);
  if (!upper && sources.length === 0) return;
  const field = upper ? (x, y, activeSources) => heightAt(x, y, activeSources, jet) : pressureAt;
  const contours = pressureContours(pressureGrid(sources, PRESSURE_COLUMNS, PRESSURE_ROWS, field, upper ?
    HEIGHT_INTERVAL : PRESSURE_INTERVAL));
  for (const [level, segments] of contours) {
    const path = segments.map(([a, b]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`).join("");
    container.append(svgElement("path", {
      d: path,
      class: upper ? "pressure-contour height-contour" : "pressure-contour"
    }));
    const labelPoint = segments[Math.floor(segments.length * .37)][0];
    addText(container, String(level), {
      x: labelPoint[0],
      y: labelPoint[1] - 3,
      class: "pressure-label"
    });
  }
}
