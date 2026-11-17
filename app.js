const map = document.getElementById("map");
const objectsLayer = document.getElementById("objects");
const dateInput = document.getElementById("date");
const airToggle = document.getElementById("air-toggle");
const precipitationToggle = document.getElementById("precipitation-toggle");
const status = document.getElementById("status");
const instruction = document.getElementById("instruction");
const deleteButton = document.getElementById("delete");
const names = {
  high: "Anticiclón",
  low: "Borrasca",
  cold: "Frente frío",
  warm: "Frente cálido",
  occluded: "Frente ocluido",
  "jet-strong": "Chorro fuerte",
  "jet-weak": "Chorro débil"
};
const state = {
  layer: "surface",
  jetMode: "automatic",
  manualJetId: null,
  tool: null,
  strength: null,
  selected: null,
  objects: [],
  nextId: 1,
  drag: null
};
let pressureFrame = null;
const today = new Date();
dateInput.value =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function updateDate() {
  if (!dateInput.value) {
    status.textContent = "Selecciona una fecha para simular las masas de aire.";
    configureAir("", false);
    document.getElementById("map-date").textContent = "SIN FECHA";
    return;
  }
  configureAir(dateInput.value, airToggle.checked && state.layer === "surface");
  const [year, month, day] = dateInput.value.split("-");
  document.getElementById("map-date").textContent = `${day}.${month}.${year}`;
}

function setTool(tool, strength = null) {
  state.tool = tool;
  state.strength = strength;
  document.querySelectorAll("[data-tool]").forEach(button => {
    const active = button.dataset.tool === tool && (button.dataset.strength || null) === strength;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const strengthName = {
    weak: "débil",
    medium: "de intensidad media",
    strong: "fuerte"
  } [strength];
  const description = tool ? `${names[tool]}${strengthName ? ` ${strengthName}` : ""}` : "";
  instruction.textContent = tool ? `Haz clic en el mapa para colocar: ${description}.` :
    "Selecciona una herramienta y haz clic en el mapa para añadirla";
  status.textContent = tool ? `Colocando ${description.toLowerCase()}.` : "Listo para empezar";
}

function render() {
  objectsLayer.replaceChildren();
  for (const object of state.objects.filter(item => item.layer === state.layer && !(item.type.startsWith("jet-") &&
      state.jetMode === "automatic"))) {
    const node = renderObject(object, object.id === state.selected);
    if (object.id === state.selected) node.classList.add("selected");
    objectsLayer.append(node);
  }
  deleteButton.disabled = state.selected === null;
  schedulePressureField();
}

function activeHeightJet() {
  return state.layer === "upper" && state.jetMode === "manual" ?
    state.objects.find(object => object.id === state.manualJetId) : null;
}

function schedulePressureField() {
  // Agrupa los cambios de un fotograma para recalcular una sola vez campos y viento.
  if (pressureFrame !== null) return;
  pressureFrame = requestAnimationFrame(() => {
    pressureFrame = null;
    const jet = activeHeightJet();
    drawPressureField(state.objects, state.layer, jet);
    updateWindSources(state.objects, state.layer, jet);
    drawAutomaticJet(state.objects, state.layer, state.jetMode);
    updateAirSources(state.objects);
  });
}

function selectObject(id) {
  state.selected = id;
  render();
  const object = state.objects.find(item => item.id === id);
  if (object) {
    const hint = object.type === "high" || object.type === "low" ? " Arrastra los tiradores para deformarlo." :
      object.type.startsWith("jet-") ? " Arrastra los puntos arriba o abajo para modificar el chorro y el viento." :
      " Arrastra el punto central para curvarlo, los extremos para ajustarlo o unirlo y el tirador superior para girarlo.";
    status.textContent = `${object.label} seleccionado. Arrástralo o usa las flechas del teclado.${hint}`;
  }
}

function pointOnMap(event) {
  const point = map.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(map.getScreenCTM().inverse());
}

function resizeCenter(object, side, coordinate) {
  const vertical = side === "north" || side === "south";
  const direction = side === "west" || side === "north" ? -1 : 1;
  const aspect = vertical ? .73 : 1;
  const value = (direction * coordinate / aspect - 34) / (3 * STRENGTH[object.strength].spacing);
  object.shape[side] = Math.max(.4, Math.min(3, value));
}

function normalizeAngle(angle) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}
const FRONT_SNAP_DISTANCE = 16;

function isFront(object) {
  return object.type === "cold" || object.type === "warm" || object.type === "occluded";
}

function frontEndpoint(object, side) {
  const angle = (object.rotation || 0) * Math.PI / 180;
  const distance = (object.length ?? FRONT_DEFAULT_LENGTH) / 2 * (side === "start" ? -1 : 1);
  return {
    x: object.x + Math.cos(angle) * distance,
    y: object.y + Math.sin(angle) * distance
  };
}

function frontBendPoint(object) {
  const angle = (object.rotation || 0) * Math.PI / 180;
  const bend = object.bend ?? FRONT_DEFAULT_BEND;
  return {
    x: object.x - Math.sin(angle) * bend,
    y: object.y + Math.cos(angle) * bend
  };
}

function moveFrontBend(object, x, y) {
  const angle = (object.rotation || 0) * Math.PI / 180;
  const bend = -(x - object.x) * Math.sin(angle) + (y - object.y) * Math.cos(angle);
  object.bend = Math.max(-FRONT_MAX_BEND, Math.min(FRONT_MAX_BEND, bend));
}

function nearestFrontEndpoint(object, point, previous = null, anchor = null) {
  let best = null;
  for (const other of state.objects) {
    if (other.id === object.id || other.layer !== object.layer || !isFront(other)) continue;
    for (const side of ["start", "end"]) {
      const target = frontEndpoint(other, side);
      const distance = Math.hypot(target.x - point.x, target.y - point.y);
      if (distance > FRONT_SNAP_DISTANCE || (best && distance >= best.distance)) continue;
      // No volver a encajar con el mismo extremo permite separar frentes con el teclado.
      if (previous && Math.hypot(target.x - previous.x, target.y - previous.y) <= FRONT_SNAP_DISTANCE) continue;
      if (anchor) {
        const length = Math.hypot(target.x - anchor.x, target.y - anchor.y);
        if (length < FRONT_MIN_LENGTH || length > FRONT_MAX_LENGTH) continue;
      }
      best = {
        ...target,
        distance
      };
    }
  }
  return best;
}

function snapFrontPosition(object, previous = null) {
  let best = null;
  for (const side of ["start", "end"]) {
    const endpoint = frontEndpoint(object, side);
    const oldEndpoint = previous && frontEndpoint({
      ...object,
      ...previous
    }, side);
    const target = nearestFrontEndpoint(object, endpoint, oldEndpoint);
    if (!target || (best && target.distance >= best.distance)) continue;
    const x = object.x + target.x - endpoint.x;
    const y = object.y + target.y - endpoint.y;
    if (x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= MAP_HEIGHT) best = {
      x,
      y,
      distance: target.distance
    };
  }
  if (best) {
    object.x = best.x;
    object.y = best.y;
  }
}

function resizeFront(object, side, x, y, snap = false, previous = null) {
  const anchor = frontEndpoint(object, side === "start" ? "end" : "start");
  let point = {
    x: Math.max(0, Math.min(MAP_WIDTH, x)),
    y: Math.max(0, Math.min(MAP_HEIGHT, y))
  };
  if (snap) point = nearestFrontEndpoint(object, point, previous, anchor) || point;
  let dx = side === "end" ? point.x - anchor.x : anchor.x - point.x;
  let dy = side === "end" ? point.y - anchor.y : anchor.y - point.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) {
    const angle = (object.rotation || 0) * Math.PI / 180;
    dx = Math.cos(angle);
    dy = Math.sin(angle);
  }
  const angle = Math.atan2(dy, dx);
  const length = Math.max(FRONT_MIN_LENGTH, Math.min(FRONT_MAX_LENGTH, distance));
  const direction = side === "end" ? 1 : -1;
  object.length = length;
  object.rotation = normalizeAngle(angle * 180 / Math.PI);
  object.x = anchor.x + direction * Math.cos(angle) * length / 2;
  object.y = anchor.y + direction * Math.sin(angle) * length / 2;
}

function moveJetPoint(object, index, x, y) {
  if (object.manualJet) {
    const current = object.points[index];
    const targetY = Math.max(0, Math.min(MAP_HEIGHT, object.y + y)) - object.y;
    const delta = targetY - current[1];
    // La influencia disminuye suavemente para evitar quiebros en los puntos vecinos.
    object.points = object.points.map(([pointX, pointY]) => {
      const distance = Math.abs(pointX - current[0]);
      const weight = distance >= 100 ? 0 : (1 + Math.cos(Math.PI * distance / 100)) / 2;
      if (weight === 0) return [pointX, pointY];
      return [pointX, Math.max(-object.y, Math.min(MAP_HEIGHT - object.y, pointY + delta * weight))];
    });
    return;
  }
  object.points[index] = [
    Math.max(0, Math.min(MAP_WIDTH, object.x + x)) - object.x,
    Math.max(0, Math.min(MAP_HEIGHT, object.y + y)) - object.y
  ];
}

function removeSelected() {
  if (state.selected === null) return;
  const removedJet = state.selected === state.manualJetId;
  state.objects = state.objects.filter(object => object.id !== state.selected);
  state.selected = null;
  if (removedJet) {
    state.manualJetId = null;
    setJetMode("automatic");
    status.textContent = "Chorro manual eliminado; se ha activado el modo automático.";
    return;
  }
  render();
  status.textContent = "Elemento eliminado.";
}

function setJetMode(mode) {
  if (mode === "manual" && state.manualJetId === null) {
    const sources = heightSources(state.objects);
    const jet = automaticJet(sources);
    if (!jet) {
      status.textContent = "No hay un chorro automático que editar; ajusta los centros de altura.";
      return;
    }
    const x = (jet.points[0][0] + jet.points[jet.points.length - 1][0]) / 2;
    const y = jet.points.reduce((sum, point) => sum + point[1], 0) / jet.points.length;
    const object = {
      id: state.nextId++,
      type: jet.type,
      label: names[jet.type],
      layer: "upper",
      x,
      y,
      manualJet: true,
      referenceHeight: baseHeightAt(jet.points[0][0], jet.points[0][1], sources),
      points: jet.points.map(point => [point[0] - x, point[1] - y])
    };
    state.objects.push(object);
    state.manualJetId = object.id;
  }
  if (state.tool) setTool(null);
  state.jetMode = mode;
  state.selected = mode === "manual" ? state.manualJetId : null;
  document.querySelectorAll("[data-jet-mode]").forEach(button => {
    const active = button.dataset.jetMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("jet-help").textContent = mode === "automatic" ?
    "Trazado orientativo calculado a partir del campo de altura." :
    "Arrastra el chorro o sus puntos: el campo y el viento se adaptan.";
  render();
  status.textContent = mode === "manual" ?
    "Chorro seleccionado. Arrástralo o mueve sus puntos arriba o abajo." :
    "Chorro automático activado; se conserva el trazado manual.";
}

function switchLayer(layer) {
  state.layer = layer;
  state.selected = null;
  setTool(null);
  const upper = layer === "upper";
  document.querySelectorAll("[data-layer]").forEach(button => {
    const active = button.dataset.layer === layer;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.getElementById("front-section").hidden = upper;
  document.getElementById("jet-section").hidden = !upper;
  document.querySelector(".air-section").hidden = upper;
  document.getElementById("layer-help").textContent = upper ? "Geopotencial · alturas esquemáticas en metros" :
    "Presión en superficie · isobaras en hPa";
  document.getElementById("layer-kicker").textContent = upper ? "500 HPA" : "SUPERFICIE";
  document.getElementById("map-layer").textContent = upper ? "500 HPA" : "SUPERFICIE";
  document.getElementById("canvas-description").textContent = upper ? "Altura geopotencial y corriente en chorro" :
    "Isobaras, centros de acción y frentes";
  updateDate();
  render();
}

drawMap();
updateDate();
document.querySelectorAll("[data-layer]").forEach(button => button.addEventListener("click", () => switchLayer(button
  .dataset.layer)));
document.querySelectorAll("[data-jet-mode]").forEach(button => button.addEventListener("click", () => setJetMode(button
  .dataset.jetMode)));
document.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
  const strength = button.dataset.strength || null;
  const active = state.tool === button.dataset.tool && state.strength === strength;
  setTool(active ? null : button.dataset.tool, active ? null : strength);
}));
dateInput.addEventListener("change", updateDate);
airToggle.addEventListener("change", updateDate);
precipitationToggle.addEventListener("change", () => objectsLayer.classList.toggle("precipitation-hidden", !
  precipitationToggle.checked));
deleteButton.addEventListener("click", removeSelected);
document.getElementById("clear").addEventListener("click", () => {
  if (!state.objects.some(object => object.layer === state.layer)) {
    status.textContent = "Esta capa ya está vacía.";
    return;
  }
  if (!confirm("¿Eliminar todos los elementos de esta capa? La otra capa no se modificará.")) return;
  state.objects = state.objects.filter(object => object.layer !== state.layer);
  state.selected = null;
  setTool(null);
  if (state.layer === "upper") {
    state.manualJetId = null;
    setJetMode("automatic");
  }
  render();
  status.textContent = "Capa limpiada.";
});
map.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  const target = event.target.closest(".map-object");
  if (target) {
    event.preventDefault();
    const id = Number(target.dataset.id);
    const object = state.objects.find(item => item.id === id);
    const point = pointOnMap(event);
    const handle = event.target.closest("[data-handle]");
    const side = handle && handle.dataset.handle;
    const jetHandle = side && side.startsWith("jet-");
    const frontHandle = side && side.startsWith("front-");
    const bounds = side && side !== "rotate" && !jetHandle && !frontHandle ? centerBounds(object, 3) : null;
    setTool(null);
    selectObject(id);
    // Conservar el desplazamiento del puntero evita que el objeto salte al iniciar el arrastre.
    state.drag = {
      id,
      side,
      dx: point.x - object.x,
      dy: point.y - object.y,
      pointerId: event.pointerId
    };
    if (side === "rotate") {
      state.drag.angleOffset = Math.atan2(point.y - object.y, point.x - object.x) * 180 / Math.PI - object.rotation;
    } else if (jetHandle) {
      const index = Number(side.slice(4));
      state.drag.pointOffset = [point.x - object.x - object.points[index][0], point.y - object.y - object.points[
        index][1]];
    } else if (side === "front-bend") {
      const midpoint = frontBendPoint(object);
      state.drag.pointOffset = [point.x - midpoint.x, point.y - midpoint.y];
    } else if (frontHandle) {
      const endpoint = frontEndpoint(object, side.slice(6));
      state.drag.pointOffset = [point.x - endpoint.x, point.y - endpoint.y];
    } else if (side) {
      const vertical = side === "north" || side === "south";
      const direction = side === "west" || side === "north" ? -1 : 1;
      state.drag.handleOffset = (vertical ? point.y - object.y : point.x - object.x) - direction * bounds[side];
    }
    map.setPointerCapture(event.pointerId);
  } else if (state.tool) {
    const point = pointOnMap(event);
    const type = state.tool;
    const object = {
      id: state.nextId++,
      type,
      label: names[type],
      strength: state.strength,
      layer: state.layer,
      x: point.x,
      y: point.y,
      shape: {
        east: 1,
        west: 1,
        north: 1,
        south: 1
      },
      rotation: 0
    };
    if (type.startsWith("jet-")) object.points = defaultJetPoints(type);
    state.objects.push(object);
    if (isFront(object)) snapFrontPosition(object);
    setTool(null);
    selectObject(object.id);
  } else {
    state.selected = null;
    render();
  }
});
map.addEventListener("pointermove", event => {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  const point = pointOnMap(event);
  const object = state.objects.find(item => item.id === state.drag.id);
  state.drag.moved = true;
  if (state.drag.side) {
    if (state.drag.side === "rotate") {
      object.rotation = normalizeAngle(Math.atan2(point.y - object.y, point.x - object.x) * 180 / Math.PI - state
        .drag.angleOffset);
    } else if (state.drag.side.startsWith("jet-")) {
      moveJetPoint(object, Number(state.drag.side.slice(4)), point.x - object.x - state.drag.pointOffset[0], point
        .y - object.y - state.drag.pointOffset[1]);
    } else if (state.drag.side === "front-bend") {
      moveFrontBend(object, point.x - state.drag.pointOffset[0], point.y - state.drag.pointOffset[1]);
    } else if (state.drag.side.startsWith("front-")) {
      resizeFront(object, state.drag.side.slice(6), point.x - state.drag.pointOffset[0], point.y - state.drag
        .pointOffset[1]);
    } else {
      const vertical = state.drag.side === "north" || state.drag.side === "south";
      const coordinate = vertical ? point.y - object.y : point.x - object.x;
      resizeCenter(object, state.drag.side, coordinate - state.drag.handleOffset);
    }
    render();
    return;
  }
  object.x = Math.max(0, Math.min(MAP_WIDTH, point.x - state.drag.dx));
  object.y = Math.max(0, Math.min(MAP_HEIGHT, point.y - state.drag.dy));
  const node = objectsLayer.querySelector(`[data-id="${object.id}"]`);
  node.setAttribute("transform", `translate(${object.x} ${object.y})`);
  if (object.type === "high" || object.type === "low" || object.manualJet) schedulePressureField();
});

function endDrag(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  const drag = state.drag;
  state.drag = null;
  if (event.type !== "pointerup" || !drag.moved) return;
  const object = state.objects.find(item => item.id === drag.id);
  if (!isFront(object)) return;
  if (drag.side && drag.side !== "front-bend" && drag.side.startsWith("front-")) {
    const side = drag.side.slice(6);
    const endpoint = frontEndpoint(object, side);
    resizeFront(object, side, endpoint.x, endpoint.y, true);
    render();
  } else if (!drag.side) {
    snapFrontPosition(object);
    objectsLayer.querySelector(`[data-id="${object.id}"]`).setAttribute("transform",
      `translate(${object.x} ${object.y})`);
  }
}
map.addEventListener("pointerup", endDrag);
map.addEventListener("pointercancel", endDrag);
map.addEventListener("lostpointercapture", endDrag);
map.addEventListener("keydown", event => {
  const target = event.target.closest(".map-object");
  const handle = event.target.closest("[data-handle]");
  if (handle && state.selected !== null) {
    const side = handle.dataset.handle;
    const object = state.objects.find(item => item.id === state.selected);
    const movement = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowDown: 1
    } [event.key];
    if (!movement) return;
    event.preventDefault();
    if (side === "rotate") {
      object.rotation = normalizeAngle(object.rotation + movement * 5);
    } else if (side.startsWith("jet-")) {
      const index = Number(side.slice(4));
      const [x, y] = object.points[index];
      const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
      if (object.manualJet && !vertical) return;
      moveJetPoint(object, index, x + (vertical ? 0 : movement * 5), y + (vertical ? movement * 5 : 0));
    } else if (side === "front-bend") {
      const point = frontBendPoint(object);
      const delta = {
        ArrowLeft: [-5, 0],
        ArrowRight: [5, 0],
        ArrowUp: [0, -5],
        ArrowDown: [0, 5]
      } [event.key];
      moveFrontBend(object, point.x + delta[0], point.y + delta[1]);
    } else if (side.startsWith("front-")) {
      const end = side.slice(6);
      const endpoint = frontEndpoint(object, end);
      const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
      resizeFront(object, end, endpoint.x + (vertical ? 0 : movement * 5), endpoint.y + (vertical ? movement * 5 :
        0), true, endpoint);
    } else {
      const vertical = side === "north" || side === "south";
      if (vertical !== (event.key === "ArrowUp" || event.key === "ArrowDown")) return;
      const direction = side === "west" || side === "north" ? -1 : 1;
      resizeCenter(object, side, direction * centerBounds(object, 3)[side] + movement * 5);
    }
    render();
    objectsLayer.querySelector(`[data-id="${object.id}"] [data-handle="${side}"]`).focus();
    return;
  }
  if (target && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    selectObject(Number(target.dataset.id));
    map.focus();
    return;
  }
  if (state.selected === null) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    removeSelected();
    return;
  }
  const movement = {
    ArrowLeft: [-5, 0],
    ArrowRight: [5, 0],
    ArrowUp: [0, -5],
    ArrowDown: [0, 5]
  } [event.key];
  if (!movement) return;
  event.preventDefault();
  const object = state.objects.find(item => item.id === state.selected);
  const previous = {
    x: object.x,
    y: object.y
  };
  object.x = Math.max(0, Math.min(MAP_WIDTH, object.x + movement[0]));
  object.y = Math.max(0, Math.min(MAP_HEIGHT, object.y + movement[1]));
  if (isFront(object)) snapFrontPosition(object, previous);
  objectsLayer.querySelector(`[data-id="${object.id}"]`).setAttribute("transform",
    `translate(${object.x} ${object.y})`);
  if (object.type === "high" || object.type === "low" || object.manualJet) schedulePressureField();
});
