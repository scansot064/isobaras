const SVG_NS = "http://www.w3.org/2000/svg";
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 700;
const RADIANS = Math.PI / 180;
const ALBERS_N = (Math.sin(35 * RADIANS) + Math.sin(65 * RADIANS)) / 2;
const ALBERS_C = Math.cos(35 * RADIANS) ** 2 + 2 * ALBERS_N * Math.sin(35 * RADIANS);
const ALBERS_RHO0 = Math.sqrt(ALBERS_C - 2 * ALBERS_N * Math.sin(44 * RADIANS)) / ALBERS_N;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function project(lon, lat) {
  const rho = Math.sqrt(ALBERS_C - 2 * ALBERS_N * Math.sin(lat * RADIANS)) / ALBERS_N;
  const theta = ALBERS_N * (lon + 7) * RADIANS;
  return [600 + 800 * rho * Math.sin(theta), 350 - 800 * (ALBERS_RHO0 - rho * Math.cos(theta))];
}

function latitudeAtPoint(x, y) {
  const east = (x - 600) / 800;
  const north = (350 - y) / 800;
  const rhoSquared = east ** 2 + (ALBERS_RHO0 - north) ** 2;
  const sinLatitude = (ALBERS_C - rhoSquared * ALBERS_N ** 2) / (2 * ALBERS_N);
  return Math.asin(Math.max(-1, Math.min(1, sinLatitude))) / RADIANS;
}

function longitudeAtPoint(x, y) {
  const east = (x - 600) / 800;
  const north = (350 - y) / 800;
  return Math.atan2(east, ALBERS_RHO0 - north) / ALBERS_N / RADIANS - 7;
}

function makePath(rings) {
  return rings.map(ring => ring.map(([lon, lat], index) => {
    const [x, y] = project(lon, lat);
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join("") + "Z").join("");
}
// Recortar antes de proyectar evita deformaciones de polígonos lejanos a la zona de estudio.
function clipRing(ring) {
  let points = ring;
  for (const [axis, boundary, keepGreater] of [
      [0, -145, true],
      [0, 100, false],
      [1, -10, true],
      [1, 89, false]
    ]) {
    if (!points.length) break;
    const clipped = [];
    let previous = points[points.length - 1];
    let previousInside = keepGreater ? previous[axis] >= boundary : previous[axis] <= boundary;
    for (const point of points) {
      const inside = keepGreater ? point[axis] >= boundary : point[axis] <= boundary;
      if (inside !== previousInside) {
        const ratio = (boundary - previous[axis]) / (point[axis] - previous[axis]);
        clipped.push([previous[0] + ratio * (point[0] - previous[0]), previous[1] + ratio * (point[1] - previous[1])]);
      }
      if (inside) clipped.push(point);
      previous = point;
      previousInside = inside;
    }
    points = clipped;
  }
  return points;
}

function gridLine(coordinates, label, latitude = false) {
  const points = coordinates.map(([lon, lat]) => project(lon, lat));
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
  const grid = document.getElementById("grid");
  grid.append(svgElement("path", {
    d: path,
    fill: "none",
    class: "grid-line"
  }));
  for (let i = 1; i < points.length; i++) {
    const point = clipLineToMap(points[i - 1], points[i]);
    if (!point) continue;
    if (label && (!latitude || point[0] < 1 || point[0] > MAP_WIDTH - 1)) {
      const text = svgElement("text", {
        x: Math.max(8, Math.min(MAP_WIDTH - 32, point[0] + 5)),
        y: Math.max(15, Math.min(MAP_HEIGHT - 5, point[1] - 5)),
        class: "grid-label"
      });
      text.textContent = label;
      grid.append(text);
    }
    break;
  }
}

function clipLineToMap(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let start = 0;
  let end = 1;
  for (const [p, q] of [
      [-dx, a[0]],
      [dx, MAP_WIDTH - a[0]],
      [-dy, a[1]],
      [dy, MAP_HEIGHT - a[1]]
    ]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) start = Math.max(start, t);
      else end = Math.min(end, t);
      if (start > end) return null;
    }
  }
  return [a[0] + start * dx, a[1] + start * dy];
}

function drawMap() {
  const geography = document.getElementById("geography");
  for (const feature of window.LAND_DATA.features) {
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      const rings = polygon.map(clipRing).filter(ring => ring.length >= 3);
      if (rings.length) geography.append(svgElement("path", {
        d: makePath(rings),
        class: "land",
        "fill-rule": "evenodd"
      }));
    }
  }
  for (let lon = -100; lon <= 60; lon += 10) {
    const coordinates = [];
    for (let lat = 89; lat >= -10; lat--) coordinates.push([lon, lat]);
    const label = lon < -80 || lon > 40 ? "" : lon === 0 ? "0°" : `${Math.abs(lon)}°${lon < 0 ? "O" : "E"}`;
    gridLine(coordinates, label);
  }
  for (let lat = 20; lat <= 80; lat += 10) {
    const coordinates = [];
    for (let lon = -145; lon <= 100; lon += 1) coordinates.push([lon, lat]);
    gridLine(coordinates, `${lat}°N`, true);
  }
  const places = document.getElementById("places");
  for (const [name, lon, lat, className] of [
      ["ATLÁNTICO NORTE", -48, 41, "ocean-label"],
      ["ISLANDIA", -20, 65, "place-label"],
      ["ESPAÑA", -7, 40, "place-label"],
      ["FRANCIA", 0, 47, "place-label"],
      ["REINO UNIDO", -7, 54, "place-label"],
      ["MARRUECOS", -8, 31, "place-label"]
    ]) {
    const [x, y] = project(lon, lat);
    const label = svgElement("text", {
      x,
      y,
      class: className
    });
    label.textContent = name;
    places.append(label);
  }
}
