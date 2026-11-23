function mapDocument() {
  return {
    format: "isobaras",
    version: 3,
    title: titleInput.value,
    date: mapDate(),
    year: selectedYear,
    layer: state.layer,
    jetMode: state.jetMode,
    airEnabled: airToggle.checked,
    precipitationEnabled: precipitationToggle.checked,
    objects: state.objects,
    airValues: airState.values ? Array.from(airState.values) : null
  };
}

function validateMapDocument(data) {
  const invalid = () => {
    throw new Error("El archivo no contiene un mapa válido de Isobaras.");
  };
  const numberIn = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  if (!data || typeof data !== "object" || Array.isArray(data) || data.format !== "isobaras" ||
      ![1, 2, 3].includes(data.version) || typeof data.title !== "string" || typeof data.date !== "string" ||
      !["surface", "upper"].includes(data.layer) || !["automatic", "manual"].includes(data.jetMode) ||
      typeof data.airEnabled !== "boolean" || typeof data.precipitationEnabled !== "boolean" ||
      !Array.isArray(data.objects)) invalid();
  let date = data.date;
  let year = data.year;
  if (data.version === 1) {
    const legacyDate = document.createElement("input");
    legacyDate.type = "date";
    legacyDate.value = date;
    if (legacyDate.value !== date) invalid();
    year = date ? date.slice(0, -6) : "";
    date = date ? date.slice(-5) : "";
  }
  if (typeof year !== "string" || !/^\d{0,6}$/.test(year) ||
      (date && (!/^\d{2}-\d{2}$/.test(date) || (() => {
        const [month, day] = date.split("-").map(Number);
        return month < 1 || month > 12 || day < 1 || day > new Date(2000, month, 0).getDate();
      })()))) invalid();
  if (data.airValues !== null && (!Array.isArray(data.airValues) ||
      data.airValues.length !== AIR_COLUMNS * AIR_ROWS || !data.airValues.every(value => numberIn(value, 0, 1)))) {
    invalid();
  }
  if (data.date && data.airValues === null) invalid();

  const ids = new Set();
  let manualJetId = null;
  const objects = data.objects.map(object => {
    if (!object || typeof object !== "object" || Array.isArray(object) || !Number.isSafeInteger(object.id) ||
        object.id < 1 || object.id >= Number.MAX_SAFE_INTEGER || ids.has(object.id) ||
        !["surface", "upper"].includes(object.layer) ||
        !numberIn(object.x, 0, MAP_WIDTH) || !numberIn(object.y, 0, MAP_HEIGHT)) invalid();
    ids.add(object.id);
    const common = {
      id: object.id,
      type: object.type,
      label: names[object.type],
      layer: object.layer,
      x: object.x,
      y: object.y
    };
    if (object.type === "high" || object.type === "low") {
      if (!["weak", "medium", "strong"].includes(object.strength) || !object.shape ||
          !["east", "west", "north", "south"].every(side => numberIn(object.shape[side], .4, 3)) ||
          (data.version === 3 && (!Number.isInteger(object.intensityBoost) ||
            !numberIn(object.intensityBoost, 0, INTENSITY_MAX) || object.intensityBoost % INTENSITY_STEP !== 0))) invalid();
      return {
        ...common,
        strength: object.strength,
        intensityBoost: data.version === 3 ? object.intensityBoost : 0,
        shape: {
          east: object.shape.east,
          west: object.shape.west,
          north: object.shape.north,
          south: object.shape.south
        },
        rotation: 0
      };
    }
    if (["cold", "warm", "occluded"].includes(object.type)) {
      if (object.layer !== "surface" || !numberIn(object.rotation, -180, 180) ||
          (object.length !== undefined && !numberIn(object.length, FRONT_MIN_LENGTH, FRONT_MAX_LENGTH)) ||
          (object.bend !== undefined && !numberIn(object.bend, -FRONT_MAX_BEND, FRONT_MAX_BEND))) invalid();
      return {
        ...common,
        strength: null,
        shape: { east: 1, west: 1, north: 1, south: 1 },
        rotation: object.rotation,
        length: object.length ?? FRONT_DEFAULT_LENGTH,
        bend: object.bend ?? FRONT_DEFAULT_BEND
      };
    }
    if (!["jet-strong", "jet-weak"].includes(object.type) || object.layer !== "upper" ||
        object.manualJet !== true || manualJetId !== null || !numberIn(object.referenceHeight, -100000, 100000) ||
        !Array.isArray(object.points) || object.points.length < 2 ||
        !object.points.every((point, index) => Array.isArray(point) && point.length === 2 &&
          numberIn(point[0], -MAP_WIDTH, MAP_WIDTH) && numberIn(point[1], -MAP_HEIGHT, MAP_HEIGHT) &&
          (index === 0 || point[0] >= object.points[index - 1][0]))) invalid();
    manualJetId = object.id;
    return {
      ...common,
      manualJet: true,
      referenceHeight: object.referenceHeight,
      points: object.points.map(point => [...point])
    };
  });
  if (data.jetMode === "manual" && manualJetId === null) invalid();
  return { ...data, date, year, objects, manualJetId };
}

function restoreMap(data) {
  state.objects = data.objects;
  state.nextId = data.objects.reduce((next, object) => Math.max(next, object.id + 1), 1);
  state.manualJetId = data.manualJetId;
  state.drag = null;
  titleInput.value = data.title;
  titleInput.dispatchEvent(new Event("input"));
  [selectedMonth, selectedDay] = data.date ? data.date.split("-") : ["", ""];
  selectedYear = data.year;
  airToggle.checked = data.airEnabled;
  precipitationToggle.checked = data.precipitationEnabled;
  precipitationToggle.dispatchEvent(new Event("change"));
  setJetMode(data.jetMode);
  switchLayer(data.layer);
  updateAirSources(state.objects);
  airState.values = data.airValues === null ? null : new Float32Array(data.airValues);
  airState.lastFrame = null;
  if (airState.values) renderAir();
  status.textContent = "Mapa cargado.";
}

const presetSelect = document.getElementById("preset-select");
if (typeof PRESETS === "undefined") {
  console.error("No se pudieron cargar los escenarios predefinidos.");
  presetSelect.disabled = true;
  status.textContent = "No se pudieron cargar los escenarios predefinidos.";
} else {
  PRESETS.forEach((preset, index) => presetSelect.add(new Option(preset.name, String(index))));
  presetSelect.addEventListener("change", () => {
    if (presetSelect.value === "") return;
    const preset = PRESETS[Number(presetSelect.value)];
    presetSelect.value = "";
    try {
      if (!preset) throw new Error("Escenario desconocido.");
      const validated = validateMapDocument(preset.data);
      restoreMap(validated);
      status.textContent = `Escenario cargado: ${preset.name}.`;
    } catch (error) {
      console.error("No se pudo cargar el escenario:", error);
      status.textContent = `No se pudo cargar el escenario: ${error.message}`;
    }
  });
}

document.getElementById("save-map").addEventListener("click", () => {
  try {
    const json = JSON.stringify(mapDocument(), null, 2);
    downloadBlob(new Blob([json], { type: "application/json" }), "isobaras.json");
    status.textContent = "Mapa guardado en JSON.";
  } catch (error) {
    console.error("No se pudo guardar el mapa:", error);
    status.textContent = "No se pudo guardar el mapa en JSON.";
  }
});

const mapFile = document.getElementById("map-file");
document.getElementById("load-map").addEventListener("click", () => mapFile.click());
mapFile.addEventListener("change", async () => {
  const file = mapFile.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error("El archivo no es un JSON válido.");
    }
    const validated = validateMapDocument(data);
    if (!confirm("¿Sustituir el mapa actual en ambos planos por el archivo? Los cambios no guardados se perderán.")) {
      status.textContent = "Carga cancelada; el mapa actual no ha cambiado.";
      return;
    }
    restoreMap(validated);
  } catch (error) {
    console.error("No se pudo cargar el mapa:", error);
    status.textContent = `No se pudo cargar el mapa: ${error.message}`;
  } finally {
    mapFile.value = "";
  }
});
