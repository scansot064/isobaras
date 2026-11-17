const STRENGTH = {
  weak: {
    spacing: 29,
    center: {
      high: 1020,
      low: 1004
    },
    height: {
      high: 5760,
      low: 5520
    }
  },
  medium: {
    spacing: 22,
    center: {
      high: 1028,
      low: 996
    },
    height: {
      high: 5880,
      low: 5400
    }
  },
  strong: {
    spacing: 15,
    center: {
      high: 1036,
      low: 988
    },
    height: {
      high: 6000,
      low: 5280
    }
  }
};

function addText(parent, text, attrs) {
  const node = svgElement("text", attrs);
  node.textContent = text;
  parent.append(node);
}

function centerBounds(object, ring) {
  const shape = object.shape || {
    east: 1,
    west: 1,
    north: 1,
    south: 1
  };
  const distance = ring * STRENGTH[object.strength].spacing;
  return {
    east: 34 + distance * shape.east,
    west: 34 + distance * shape.west,
    north: 34 * .73 + distance * .73 * shape.north,
    south: 34 * .73 + distance * .73 * shape.south
  };
}

function contourPath({
  east: e,
  west: w,
  north: n,
  south: s
}) {
  const k = .55228475;
  return `M ${e} 0 C ${e} ${-k * n} ${k * e} ${-n} 0 ${-n}
    C ${-k * w} ${-n} ${-w} ${-k * n} ${-w} 0
    C ${-w} ${k * s} ${-k * w} ${s} 0 ${s}
    C ${k * e} ${s} ${e} ${k * s} ${e} 0 Z`;
}

function addHandle(group, name, x, y, label, value, min, max) {
  const handle = svgElement("circle", {
    cx: x,
    cy: y,
    r: 8,
    class: "transform-handle",
    "data-handle": name,
    tabindex: 0,
    role: "slider",
    "aria-label": label,
    "aria-valuemin": min,
    "aria-valuemax": max,
    "aria-valuenow": Math.round(value)
  });
  group.append(handle);
}

function drawCenter(group, object) {
  const high = object.type === "high";
  const color = high ? "#397c85" : "#b76651";
  group.append(svgElement("circle", {
    r: 22,
    fill: "#fffef8",
    stroke: color,
    "stroke-width": 1.5
  }));
  addText(group, high ? "A" : "B", {
    x: 0,
    y: 6,
    "text-anchor": "middle",
    fill: color,
    "font-size": 19,
    "font-weight": 800
  });
  const bounds = centerBounds(object, 3);
  const outline = Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, value + 10]));
  group.append(svgElement("path", {
    d: contourPath(outline),
    class: "selection-ring"
  }));
  if (object.selected) {
    const shape = object.shape || {
      east: 1,
      west: 1,
      north: 1,
      south: 1
    };
    addHandle(group, "west", -bounds.west, 0, "Estirar el lado oeste", shape.west * 100, 40, 300);
    addHandle(group, "east", bounds.east, 0, "Estirar el lado este", shape.east * 100, 40, 300);
    addHandle(group, "north", 0, -bounds.north, "Estirar el lado norte", shape.north * 100, 40, 300);
    addHandle(group, "south", 0, bounds.south, "Estirar el lado sur", shape.south * 100, 40, 300);
  }
}
const FRONT_DEFAULT_LENGTH = 250;
const FRONT_MIN_LENGTH = 50;
const FRONT_MAX_LENGTH = 500;
const FRONT_DEFAULT_BEND = -11.25;
const FRONT_MAX_BEND = 250;

function frontY(x, half, bend) {
  return bend * (1 - (x / half) ** 2);
}

function frontSlope(x, half, bend) {
  return -2 * bend * x / (half * half);
}

function frontBand(front, half, bend, top, bottom, type) {
  // Cada tramo desplaza su degradado con la curva, sin alterar el desvanecimiento de los extremos.
  const band = svgElement("g", {
    class: "precipitation-band",
    fill: `url(#rain-${type})`,
    mask: "url(#rain-mask)",
    "pointer-events": "none",
    "aria-hidden": "true"
  });
  const count = 24;
  for (let i = 0; i < count; i++) {
    const x0 = -half + 2 * half * i / count;
    const x1 = -half + 2 * half * (i + 1) / count;
    const width = x1 - x0;
    const offset = frontY((x0 + x1) / 2, half, bend);
    const y0 = frontY(x0, half, bend) - offset;
    const y1 = frontY(x1, half, bend) - offset;
    const c0 = y0 + frontSlope(x0, half, bend) * width / 3;
    const c1 = y1 - frontSlope(x1, half, bend) * width / 3;
    const path =
      `M ${x0} ${top + y0} C ${x0 + width / 3} ${top + c0} ${x1 - width / 3} ${top + c1} ${x1} ${top + y1}
      L ${x1} ${bottom + y1} C ${x1 - width / 3} ${bottom + c1} ${x0 + width / 3} ${bottom + c0} ${x0} ${bottom + y0} Z`;
    band.append(svgElement("path", {
      d: path,
      transform: `translate(0 ${offset})`
    }));
  }
  front.append(band);
}

function drawFront(group, object) {
  const front = svgElement("g", {
    transform: `rotate(${object.rotation || 0})`,
    class: "front-shape"
  });
  group.append(front);
  const colors = {
    cold: "#3d83b6",
    warm: "#d36e61",
    occluded: "#9570a5"
  };
  const color = colors[object.type];
  const length = object.length ?? FRONT_DEFAULT_LENGTH;
  const half = length / 2;
  const bend = object.bend ?? FRONT_DEFAULT_BEND;
  const controlY = 4 * bend / 3;
  const path = `M ${-half} 0 C ${-half / 3} ${controlY} ${half / 3} ${controlY} ${half} 0`;
  const bands = {
    cold: [-10, 45],
    warm: [-110, 0],
    occluded: [-55, 55]
  };
  frontBand(front, half, bend, ...bands[object.type], object.type);
  const outline = `M ${-half} -28 C ${-half / 3} ${controlY - 28} ${half / 3} ${controlY - 28} ${half} -28
    L ${half} 27 C ${half / 3} ${controlY + 27} ${-half / 3} ${controlY + 27} ${-half} 27 Z`;
  front.append(svgElement("path", {
    d: outline,
    class: "selection-ring"
  }));
  front.append(svgElement("path", {
    d: path,
    class: "front-line",
    fill: "none",
    stroke: color,
    "stroke-width": 3
  }));
  front.append(svgElement("path", {
    d: path,
    class: "object-hit"
  }));
  const count = Math.max(2, Math.round(length / 36));
  for (let i = 0; i < count; i++) {
    const x = -half + (i + .5) * length / count;
    const y = frontY(x, half, bend);
    const angle = Math.atan(frontSlope(x, half, bend)) * 180 / Math.PI;
    const triangle = object.type === "cold" || (object.type === "occluded" && i % 2 === 0);
    const symbol = triangle ? "M -7 0 L 0 -13 L 7 0 Z" : "M -7 0 A 7 7 0 0 1 7 0 Z";
    front.append(svgElement("path", {
      d: symbol,
      transform: `translate(${x} ${y}) rotate(${angle})`,
      fill: color
    }));
  }
  if (object.selected) {
    front.append(svgElement("line", {
      x1: 0,
      y1: bend - 25,
      x2: 0,
      y2: bend - 50,
      class: "handle-stem"
    }));
    addHandle(front, "rotate", 0, bend - 50, "Girar frente", object.rotation || 0, -180, 180);
    front.append(svgElement("circle", {
      cx: 0,
      cy: bend,
      r: 8,
      class: "transform-handle",
      "data-handle": "front-bend",
      tabindex: 0,
      role: "button",
      "aria-label": "Curvar el frente con las flechas"
    }));
    for (const [side, x, label] of [
        ["start", -half, "Modificar extremo inicial"],
        ["end", half, "Modificar extremo final"]
      ]) {
      front.append(svgElement("circle", {
        cx: x,
        cy: 0,
        r: 8,
        class: "transform-handle",
        "data-handle": `front-${side}`,
        tabindex: 0,
        role: "button",
        "aria-label": `${label} del frente con las flechas`
      }));
    }
  }
}

function defaultJetPoints(type) {
  return type === "jet-weak" ?
    [
      [-170, -20],
      [-105, -48],
      [-40, 35],
      [25, 20],
      [95, -30],
      [170, 0]
    ] :
    [
      [-170, 0],
      [-60, 0],
      [60, 0],
      [170, 0]
    ];
}

function jetSegment(points, index) {
  // Los controles cúbicos comparten la pendiente entre tramos; x permanece lineal.
  const previous = points[Math.max(0, index - 1)];
  const start = points[index];
  const end = points[index + 1];
  const next = points[Math.min(points.length - 1, index + 2)];
  const width = end[0] - start[0];
  return [
    [start[0] + width / 3, start[1] + (end[1] - previous[1]) / 6],
    [end[0] - width / 3, end[1] - (next[1] - start[1]) / 6]
  ];
}

function jetPath(points) {
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [first, second] = jetSegment(points, i);
    const end = points[i + 1];
    path += ` C ${first[0]} ${first[1]} ${second[0]} ${second[1]} ${end[0]} ${end[1]}`;
  }
  return path;
}

function jetYAt(object, x) {
  const points = object.points;
  const localX = x - object.x;
  if (localX <= points[0][0]) return object.y + points[0][1];
  if (localX >= points[points.length - 1][0]) return object.y + points[points.length - 1][1];
  let index = 0;
  while (localX > points[index + 1][0]) index++;
  const start = points[index];
  const end = points[index + 1];
  const [first, second] = jetSegment(points, index);
  const t = (localX - start[0]) / (end[0] - start[0]);
  return object.y + (1 - t) ** 3 * start[1] + 3 * (1 - t) ** 2 * t * first[1] +
    3 * (1 - t) * t ** 2 * second[1] + t ** 3 * end[1];
}

function drawJet(group, object) {
  const weak = object.type === "jet-weak";
  const points = object.points;
  const path = jetPath(points);
  const end = points[points.length - 1];
  const previous = [...points].reverse().find(point => point[0] !== end[0] || point[1] !== end[1]) || end;
  const angle = Math.atan2(end[1] - previous[1], end[0] - previous[0]) * 180 / Math.PI;
  group.append(svgElement("path", {
    d: path,
    class: "selection-ring jet-selection"
  }));
  group.append(svgElement("path", {
    d: path,
    fill: "none",
    stroke: "#d2934d",
    "stroke-width": weak ? 5 : 9,
    "stroke-linecap": "round",
    opacity: ".85"
  }));
  group.append(svgElement("path", {
    d: path,
    class: "object-hit"
  }));
  group.append(svgElement("path", {
    d: weak ? "M -15 -11 L 4 0 L -13 12" : "M -17 -14 L 6 0 L -17 14",
    transform: `translate(${end[0]} ${end[1]}) rotate(${angle})`,
    class: "jet-arrow",
    fill: "none",
    stroke: "#d2934d",
    "stroke-width": weak ? 5 : 7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  }));
  if (object.selected) {
    points.forEach(([x, y], index) => {
      if (object.manualJet && index % 4 !== 0 && index !== points.length - 1) return;
      group.append(svgElement("circle", {
        cx: x,
        cy: y,
        r: 8,
        class: "transform-handle",
        "data-handle": `jet-${index}`,
        tabindex: 0,
        role: "button",
        "aria-label": object.manualJet ?
          `Mover punto ${index + 1} del chorro arriba o abajo` :
          `Modificar punto ${index + 1} del chorro con las flechas`
      }));
    });
  }
}

function renderObject(object, selected) {
  const group = svgElement("g", {
    class: "map-object",
    transform: `translate(${object.x} ${object.y})`,
    "data-id": object.id,
    tabindex: 0,
    role: "button",
    "aria-label": object.label
  });
  const displayObject = {
    ...object,
    selected
  };
  if (object.type === "high" || object.type === "low") drawCenter(group, displayObject);
  else if (object.type.startsWith("jet-")) drawJet(group, displayObject);
  else drawFront(group, displayObject);
  return group;
}
