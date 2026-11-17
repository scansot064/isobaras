document.getElementById("app").addEventListener("load", async () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const doc = app.document;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const state = app.eval("state");
    const map = doc.querySelector("#map");
    const fileInput = doc.querySelector("#map-file");
    const originalConfirm = app.confirm;
    const originalClick = app.HTMLAnchorElement.prototype.click;
    const nextFrame = () => new Promise(resolve => app.requestAnimationFrame(() => app.requestAnimationFrame(resolve)));
    function place(tool, x, y) {
      doc.querySelector(tool).click();
      const point = map.createSVGPoint();
      point.x = x;
      point.y = y;
      const screen = point.matrixTransform(map.getScreenCTM());
      map.dispatchEvent(new app.PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: screen.x,
        clientY: screen.y
      }));
      return state.objects.find(object => object.id === state.selected);
    }
    async function load(text) {
      const transfer = new app.DataTransfer();
      transfer.items.add(new app.File([text], "mapa.json", { type: "application/json" }));
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new app.Event("change", { bubbles: true }));
      const deadline = Date.now() + 10000;
      while (fileInput.value && Date.now() < deadline) await nextFrame();
      check(!fileInput.value, "La carga debe terminar y permitir volver a elegir el mismo archivo.");
    }

    doc.querySelector("#map-title-input").value = "Situación de clase";
    doc.querySelector("#map-title-input").dispatchEvent(new app.Event("input"));
    doc.querySelector("#date").value = "2024-02-29";
    doc.querySelector("#date").dispatchEvent(new app.Event("change"));
    doc.querySelector("#air-toggle").click();
    doc.querySelector("#precipitation-toggle").click();
    const surface = place('[data-tool="high"][data-strength="strong"]', 400, 300);
    app.resizeCenter(surface, "east", app.centerBounds(surface, 3).east + 30);
    const front = place('[data-tool="cold"]', 700, 400);
    front.rotation = 35;
    front.length = 180;
    front.bend = -60;
    doc.querySelector('[data-layer="upper"]').click();
    const upper = place('[data-tool="low"][data-strength="medium"]', 600, 300);
    doc.querySelector('[data-jet-mode="manual"]').click();
    const jet = app.activeHeightJet();
    check(jet && jet.manualJet, "La prueba necesita un chorro manual.");
    app.moveJetPoint(jet, 10, jet.points[10][0], jet.points[10][1] + 30);
    await nextFrame();
    app.eval("airState").values[0] = .321;
    app.renderAir();

    let download;
    app.HTMLAnchorElement.prototype.click = function () {
      download = { name: this.download, url: this.href };
    };
    doc.querySelector("#save-map").click();
    app.HTMLAnchorElement.prototype.click = originalClick;
    check(download && download.name === "isobaras.json", "Guardar debe descargar un archivo JSON.");
    const saved = await (await app.fetch(download.url)).text();
    const data = JSON.parse(saved);
    check(data.format === "isobaras" && data.version === 1 && data.objects.length === 4 &&
      data.title === "Situación de clase" && data.date === "2024-02-29" &&
      data.airValues.length === app.eval("AIR_COLUMNS * AIR_ROWS"),
      "El archivo debe contener los dos planos, los metadatos y la distribución del aire.");

    doc.querySelector('[data-layer="surface"]').click();
    state.objects = [];
    doc.querySelector("#map-title-input").value = "Otro mapa";
    app.confirm = () => true;
    await load(saved);
    await nextFrame();
    const restoredSurface = state.objects.find(object => object.id === surface.id);
    const restoredFront = state.objects.find(object => object.id === front.id);
    const restoredUpper = state.objects.find(object => object.id === upper.id);
    const restoredJet = state.objects.find(object => object.id === jet.id);
    check(doc.querySelector("#status").textContent === "Mapa cargado." && state.layer === "upper" &&
      state.jetMode === "manual" && state.manualJetId === jet.id && state.selected === null &&
      doc.querySelector("#map-title").textContent === data.title && doc.querySelector("#date").value === data.date &&
      !doc.querySelector("#air-toggle").checked && !doc.querySelector("#precipitation-toggle").checked &&
      doc.querySelector("#objects").classList.contains("precipitation-hidden"),
      "La carga debe restaurar los ajustes, el plano activo y la interfaz.");
    check(restoredSurface.x === surface.x && restoredSurface.shape.east === surface.shape.east &&
      restoredFront.rotation === 35 && restoredFront.length === 180 && restoredFront.bend === -60 &&
      restoredUpper.strength === "medium" && restoredJet.points[10][1] === jet.points[10][1] &&
      app.activeHeightJet() === restoredJet && app.eval("airState").values[0] === data.airValues[0],
      "La carga debe conservar posiciones, deformaciones, chorro y distribución de aire.");
    const placed = place('[data-tool="high"][data-strength="weak"]', 200, 200);
    check(placed.id > Math.max(...data.objects.map(object => object.id)),
      "Los nuevos elementos deben recibir identificadores únicos después de cargar.");

    const before = JSON.stringify(app.mapDocument());
    app.confirm = () => false;
    await load(saved);
    check(JSON.stringify(app.mapDocument()) === before && doc.querySelector("#status").textContent.includes("cancelada"),
      "Cancelar la carga debe conservar el mapa actual.");
    app.confirm = () => true;
    for (const invalid of ["{", JSON.stringify({ ...data, version: 2 }),
      JSON.stringify({ ...data, objects: [data.objects[0], data.objects[0]] }),
      JSON.stringify({ ...data, objects: data.objects.map(object => object.manualJet ?
        { ...object, referenceHeight: 1e100 } : object) }),
      JSON.stringify({ ...data, airValues: [0] })]) {
      await load(invalid);
      check(JSON.stringify(app.mapDocument()) === before && doc.querySelector("#status").textContent.includes(
        "No se pudo cargar"), "Un archivo inválido no debe modificar el mapa actual.");
    }
    const automatic = { ...data, jetMode: "automatic" };
    await load(JSON.stringify(automatic));
    check(state.jetMode === "automatic" && state.manualJetId === jet.id && !app.activeHeightJet(),
      "El modo automático debe conservar oculto el chorro manual guardado.");
    doc.querySelector('[data-jet-mode="manual"]').click();
    check(app.activeHeightJet().points[10][1] === jet.points[10][1],
      "El chorro manual debe recuperarse al volver a activarlo.");
    await load(JSON.stringify({ ...automatic, date: "", layer: "surface", objects: [] }));
    await nextFrame();
    check(doc.querySelector("#date").value === "" && !app.eval("airState").enabled &&
      app.eval("airState").values[0] === data.airValues[0] && state.objects.length === 0,
      "También debe poder cargarse un mapa sin fecha ni centros, conservando el aire guardado.");
    app.confirm = originalConfirm;
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
