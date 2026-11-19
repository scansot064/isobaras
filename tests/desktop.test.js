document.getElementById("app").addEventListener("load", async () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const doc = app.document;
    const state = app.eval("state");
    const map = doc.querySelector("#map");
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const nextFrame = () => new Promise(resolve => app.requestAnimationFrame(() => app.requestAnimationFrame(resolve)));
    check(app.getComputedStyle(doc.querySelector(".sidebar")).display === "none" &&
      app.getComputedStyle(doc.querySelector(".mobile-dock")).display !== "none",
      "En escritorio el mapa debe sustituir al panel lateral y mostrar herramientas flotantes.");
    check(doc.querySelector("#file-drawer-button").getBoundingClientRect().bottom <= map.getBoundingClientRect().top,
      "El icono de archivo debe permanecer fuera del mapa también en escritorio.");
    check(app.getComputedStyle(doc.querySelector(".inline-title"), "::after").content === '" \u270e"' &&
      app.getComputedStyle(doc.querySelector(".inline-date"), "::after").content === '"\u270e"',
      "Los indicadores de edición deben mostrarse sin caracteres extraños.");
    const title = doc.querySelector("#inline-title");
    title.value = "Mapa de clase";
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    const month = doc.querySelector("#inline-month");
    const day = doc.querySelector("#inline-day");
    month.value = "01";
    month.dispatchEvent(new app.Event("change", { bubbles: true }));
    day.value = "31";
    day.dispatchEvent(new app.Event("change", { bubbles: true }));
    month.value = "02";
    month.dispatchEvent(new app.Event("change", { bubbles: true }));
    check(day.value === "29", "Cambiar de mes debe ajustar los días que no existen en el nuevo mes.");
    const year = doc.querySelector("#inline-year");
    check(doc.querySelector("#map-title").textContent === title.value &&
      doc.querySelector("#map-title-input").value === title.value && doc.querySelector("#map-date").textContent ===
      "29.02" && doc.querySelector("#date-day").value === "29" && doc.querySelector("#date-month").value === "02" &&
      year.value === "",
      "La edición en el mapa debe actualizar el título y la fecha reales.");
    check(!app.cardText(doc.querySelector(".map-card"), doc.querySelector(".map-card").getBoundingClientRect())
      .map(line => line.text).join("").includes("Año"), "El año vacío no debe añadir texto al PNG.");
    const airValues = app.eval("airState").values;
    year.value = "1900";
    year.dispatchEvent(new app.Event("input", { bubbles: true }));
    check(doc.querySelector("#date-year").value === "1900" && day.value === "29" && month.value === "02" &&
      app.eval("airState").values === airValues, "El año opcional no debe cambiar la fecha ni reiniciar el aire.");
    const data = structuredClone(app.mapDocument());
    check(data.title === title.value && data.date === "02-29" && data.year === "1900",
      "Los valores editados directamente deben guardarse en el JSON.");
    const drawn = [];
    const fillText = app.CanvasRenderingContext2D.prototype.fillText;
    app.CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      drawn.push(text);
      return fillText.call(this, text, ...args);
    };
    try {
      await app.renderMapPng();
    } finally {
      app.CanvasRenderingContext2D.prototype.fillText = fillText;
    }
    check(drawn.join("").includes(title.value) && drawn.join("").includes("29.02") && drawn.join("").includes("1900"),
      "El PNG debe incluir el título y la fecha editados.");
    title.value = "";
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    check(!app.cardText(doc.querySelector(".map-card"), doc.querySelector(".map-card").getBoundingClientRect())
      .map(line => line.text).join("").includes("Añadir título"), "El marcador de edición no debe aparecer en el PNG.");

    doc.querySelector("#mobile-add").click();
    doc.querySelector('#mobile-tools [data-tool="high"][data-strength="strong"]').click();
    const point = map.createSVGPoint();
    point.x = 600;
    point.y = 350;
    const screen = point.matrixTransform(map.getScreenCTM());
    map.dispatchEvent(new app.PointerEvent("pointerdown", {
      bubbles: true, button: 0, clientX: screen.x, clientY: screen.y
    }));
    check(state.objects.length === 1 && state.objects[0].type === "high" && !doc.querySelector("#desktop-copy").disabled,
      "Los centros deben poder añadirse y copiarse desde la barra flotante.");
    doc.querySelector("#mobile-add").click();
    doc.querySelector('#mobile-tools [data-tool="cold"]').click();
    map.dispatchEvent(new app.PointerEvent("pointerdown", {
      bubbles: true, button: 0, clientX: screen.x + 80, clientY: screen.y
    }));
    check(state.objects.some(object => object.type === "cold" && object.layer === "surface"),
      "Los frentes deben poder añadirse desde la barra flotante de escritorio.");
    doc.querySelector("#desktop-options-button").click();
    const air = doc.querySelector("#desktop-air");
    air.click();
    check(!doc.querySelector("#air-toggle").checked && !app.eval("airState").enabled,
      "El interruptor flotante debe controlar la simulación de aire.");
    doc.querySelector("#desktop-precipitation").click();
    check(!doc.querySelector("#precipitation-toggle").checked && doc.querySelector("#objects").classList.contains(
      "precipitation-hidden"), "El interruptor flotante debe ocultar la precipitación.");
    doc.querySelector("#desktop-copy").click();
    check(state.objects.filter(object => object.layer === "upper" && object.type === "high").length === 1,
      "Copiar desde el panel flotante debe conservar el centro en el otro plano.");
    doc.querySelector("#mobile-add").click();
    check(doc.querySelector("#desktop-options").hidden, "Los paneles flotantes no deben solaparse.");
    doc.querySelector('#mobile-tools [data-layer="upper"]').click();
    check(state.layer === "upper" && doc.querySelector("#desktop-surface-options").hidden &&
      !doc.querySelector("#desktop-jet-options").hidden && doc.querySelector("#desktop-copy").textContent ===
      "Copiar a superficie", "Cambiar de plano debe actualizar las opciones flotantes.");
    doc.querySelector("#desktop-options-button").click();
    doc.querySelector('#desktop-jet-options [data-jet-mode="manual"]').click();
    check(state.jetMode === "manual" && app.activeHeightJet(), "El modo manual debe estar disponible en escritorio.");
    doc.querySelector('#desktop-jet-options [data-jet-mode="automatic"]').click();
    check(state.jetMode === "automatic", "El modo automático debe poder recuperarse desde el panel flotante.");

    app.restoreMap(app.validateMapDocument(data));
    await nextFrame();
    check(title.value === data.title && day.value === "29" && month.value === "02" && year.value === data.year &&
      air.checked === data.airEnabled &&
      doc.querySelector("#desktop-precipitation").checked === data.precipitationEnabled,
      "Cargar un mapa debe actualizar los campos y los interruptores del escritorio.");
    doc.querySelector("#zoom-in").click();
    doc.querySelector("#mobile-pan").click();
    map.setPointerCapture = () => {};
    const rect = map.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const before = map.viewBox.baseVal.x;
    for (const [type, px] of [["pointerdown", x], ["pointermove", x - 40], ["pointerup", x - 40]]) {
      map.dispatchEvent(new app.PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: px, clientY: y }));
    }
    check(map.viewBox.baseVal.x > before, "Mover mapa también debe desplazar la vista en escritorio.");
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
