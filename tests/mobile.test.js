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
    const frame = doc.defaultView.frameElement;
    const nextFrame = () => new Promise(resolve => app.requestAnimationFrame(() => app.requestAnimationFrame(resolve)));
    function pointer(target, type, x, y) {
      target.dispatchEvent(new app.PointerEvent(type, {
        bubbles: true, button: 0, pointerId: 1, pointerType: "touch", clientX: x, clientY: y
      }));
    }
    function screenPoint(x, y) {
      const point = map.createSVGPoint();
      point.x = x;
      point.y = y;
      return point.matrixTransform(map.getScreenCTM());
    }
    function box() {
      return map.viewBox.baseVal;
    }
    async function imagePixels() {
      const url = app.URL.createObjectURL(await app.renderMapPng());
      try {
        const image = new app.Image();
        image.src = url;
        await image.decode();
        const canvas = doc.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width,
          canvas.height).data };
      } finally {
        app.URL.revokeObjectURL(url);
      }
    }

    check(app.getComputedStyle(doc.querySelector(".sidebar")).display === "none" &&
      app.getComputedStyle(doc.querySelector(".mobile-dock")).display !== "none" &&
      app.getComputedStyle(map).touchAction === "pan-y", "En móvil debe poder desplazarse la página desde el mapa.");
    for (const width of [320, 347, 348, 390]) {
      frame.style.width = `${width}px`;
      await nextFrame();
      check([...doc.querySelectorAll(".mobile-actions button")].every(button => {
        const bounds = button.getBoundingClientRect();
        return app.getComputedStyle(button).display !== "none" && bounds.width >= 44 && bounds.height >= 44;
      }) && doc.documentElement.scrollWidth <= width,
      "Todos los botones móviles deben estar visibles y medir al menos 44 píxeles sin desbordar.");
    }

    const title = doc.querySelector("#inline-title");
    const day = doc.querySelector("#inline-day");
    const month = doc.querySelector("#inline-month");
    const year = doc.querySelector("#inline-year");
    check([title, day, month, year].every(input => {
      const bounds = input.getBoundingClientRect();
      return app.getComputedStyle(input).display !== "none" && bounds.width >= 44 && bounds.height >= 44;
    }), "El título y la fecha deben poder editarse desde el mapa en móvil.");
    title.value = "Mapa móvil";
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    month.value = "02";
    month.dispatchEvent(new app.Event("change", { bubbles: true }));
    day.value = "29";
    day.dispatchEvent(new app.Event("change", { bubbles: true }));
    year.value = "1900";
    year.dispatchEvent(new app.Event("input", { bubbles: true }));
    const saved = structuredClone(app.mapDocument());
    check(saved.title === "Mapa móvil" && saved.date === "02-29" && saved.year === "1900",
      "El título y la fecha editados en móvil deben guardarse en el JSON.");
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
    check(drawn.join("").includes("Mapa móvil") && drawn.join("").includes("29.02") && drawn.join("").includes("1900"),
      "El PNG móvil debe incluir el título, la fecha y el año opcional.");
    title.value = "";
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    app.restoreMap(app.validateMapDocument(saved));
    check(title.value === saved.title && day.value === "29" && month.value === "02" && year.value === saved.year,
      "Cargar un mapa debe actualizar los campos visibles en móvil.");

    doc.querySelector("#desktop-options-button").click();
    check(!doc.querySelector("#desktop-options").hidden &&
      doc.querySelector("#desktop-options-button").getAttribute("aria-expanded") === "true",
      "Capas debe abrirse desde la barra móvil.");
    doc.querySelector("#desktop-air").click();
    doc.querySelector("#desktop-precipitation").click();
    check(!doc.querySelector("#air-toggle").checked && !doc.querySelector("#precipitation-toggle").checked &&
      doc.querySelector("#objects").classList.contains("precipitation-hidden"),
      "Capas debe controlar las masas de aire y la precipitación en móvil.");
    doc.querySelector("#mobile-add").click();
    check(doc.querySelector("#desktop-options").hidden, "Añadir debe cerrar el panel de capas.");
    doc.querySelector('#mobile-tools [data-tool="high"][data-strength="strong"]').click();
    check(state.tool === "high" && state.strength === "strong" && doc.querySelector("#mobile-tools").hidden &&
      app.getComputedStyle(map).touchAction === "none", "Añadir debe activar la herramienta elegida y cerrar el panel.");
    const position = screenPoint(600, 350);
    pointer(map, "pointerdown", position.x, position.y);
    const center = state.objects[0];
    check(center && center.x === 600 && center.y === 350 && state.selected === center.id &&
      doc.querySelector("#mobile-delete").disabled === false, "El centro debe colocarse y quedar seleccionado.");
    const hit = doc.querySelector(".mobile-center-hit");
    const scale = map.getScreenCTM().a;
    check(Math.abs(Number(hit.getAttribute("r")) * scale - 22) < .1 &&
      Math.abs(Number(doc.querySelector(".transform-handle").getAttribute("r")) * scale - 14) < .1,
      "Los centros y tiradores deben tener objetivos táctiles ampliados.");
    await nextFrame();
    app.stopWind();
    const original = await imagePixels();
    doc.querySelector("#zoom-in").click();
    doc.querySelector("#zoom-in").click();
    check(box().width === 300 && box().height === 175 && doc.querySelector("#zoom-in").disabled &&
      Math.abs(box().x + box().width / 2 - center.x) < .01,
      "El zoom debe centrar el elemento seleccionado y respetar sus límites.");
    const enlarged = await imagePixels();
    check(original.width === enlarged.width && original.height === enlarged.height &&
      original.data.every((value, index) => value === enlarged.data[index]),
      "El PNG debe conservar el mapa completo y no incluir los objetivos táctiles al ampliar.");

    map.setPointerCapture = () => {};
    const start = screenPoint(center.x, center.y);
    pointer(doc.querySelector(".mobile-center-hit"), "pointerdown", start.x, start.y);
    pointer(map, "pointermove", start.x + 30, start.y);
    pointer(map, "pointerup", start.x + 30, start.y);
    check(center.x > 600 && center.x < 650, "Arrastrar el centro ampliado debe actualizar sus coordenadas reales.");
    const handle = doc.querySelector('[data-handle="east"]');
    const oldShape = center.shape.east;
    const handlePoint = screenPoint(center.x + app.centerBounds(center, 3).east, center.y);
    pointer(handle, "pointerdown", handlePoint.x, handlePoint.y);
    pointer(map, "pointermove", handlePoint.x + 20, handlePoint.y);
    pointer(map, "pointerup", handlePoint.x + 20, handlePoint.y);
    check(center.shape.east > oldShape, "El tirador táctil debe deformar el centro.");

    const oldX = center.x;
    const oldView = box().x;
    doc.querySelector("#mobile-pan").click();
    const rect = map.getBoundingClientRect();
    pointer(map, "pointerdown", rect.left + rect.width / 2, rect.top + rect.height / 2);
    pointer(map, "pointermove", rect.left + rect.width / 2 - 40, rect.top + rect.height / 2);
    pointer(map, "pointerup", rect.left + rect.width / 2 - 40, rect.top + rect.height / 2);
    check(box().x > oldView && center.x === oldX && doc.querySelector("#mobile-pan").getAttribute("aria-pressed") ===
      "true", "Mover mapa debe desplazar la vista sin mover los elementos.");
    pointer(map, "pointerdown", rect.left + rect.width / 2, rect.top + rect.height / 2);
    pointer(map, "pointermove", rect.left - 10000, rect.top - 10000);
    pointer(map, "pointerup", rect.left - 10000, rect.top - 10000);
    check(box().x === 900 && box().y === 525, "La vista ampliada debe permanecer dentro de los límites del mapa.");
    doc.querySelector("#mobile-pan").click();
    doc.querySelector("#zoom-reset").click();
    check(box().x === 0 && box().y === 0 && box().width === 1200 && doc.querySelector("#mobile-pan").disabled,
      "Restablecer el zoom debe mostrar todo el mapa y desactivar el desplazamiento.");

    doc.querySelector("#mobile-add").click();
    doc.querySelector('#mobile-tools [data-tool="cold"]').click();
    const frontPosition = screenPoint(700, 450);
    pointer(map, "pointerdown", frontPosition.x, frontPosition.y);
    const front = state.objects.find(object => object.type === "cold");
    check(front && state.selected === front.id, "La barra móvil debe permitir añadir frentes.");
    doc.querySelector("#zoom-in").click();
    const bend = doc.querySelector('[data-handle="front-bend"]');
    const bendPoint = screenPoint(app.frontBendPoint(front).x, app.frontBendPoint(front).y);
    pointer(bend, "pointerdown", bendPoint.x, bendPoint.y);
    pointer(map, "pointermove", bendPoint.x, bendPoint.y + 20);
    pointer(map, "pointerup", bendPoint.x, bendPoint.y + 20);
    check(front.bend !== undefined && front.bend !== -11.25, "Debe poder curvarse un frente ampliado.");
    doc.querySelector("#mobile-delete").click();
    check(!state.objects.includes(front) && doc.querySelector("#mobile-delete").disabled,
      "Eliminar debe actuar sobre la selección actual.");
    doc.querySelector("#mobile-add").click();
    doc.querySelector("#desktop-options-button").click();
    check(doc.querySelector("#mobile-tools").hidden, "Capas debe cerrar el panel Añadir.");
    doc.querySelector("#desktop-copy").click();
    check(state.objects.some(object => object.layer === "upper" && object.type === "high"),
      "Capas debe permitir copiar centros desde móvil.");
    doc.querySelector("#mobile-add").click();
    doc.querySelector('#mobile-tools [data-layer="upper"]').click();
    check(doc.querySelector("#mobile-fronts").hidden && state.layer === "upper" &&
      doc.querySelector('.segmented [data-layer="upper"]').getAttribute("aria-pressed") === "true",
      "El cambio de plano móvil debe sincronizarse y ocultar los frentes en altura.");
    doc.querySelector("#desktop-options-button").click();
    check(!doc.querySelector("#desktop-jet-options").hidden && doc.querySelector("#desktop-surface-options").hidden &&
      doc.querySelector("#desktop-copy").textContent === "Copiar a superficie",
      "Capas debe mostrar las opciones de altura y la copia hacia superficie.");
    doc.querySelector('#desktop-jet-options [data-jet-mode="manual"]').click();
    check(state.jetMode === "manual" && app.activeHeightJet(), "El modo manual del chorro debe funcionar en móvil.");
    doc.querySelector('#desktop-jet-options [data-jet-mode="automatic"]').click();
    check(state.jetMode === "automatic", "El modo automático del chorro debe funcionar en móvil.");
    doc.querySelector("#mobile-add").click();
    doc.querySelector('#mobile-tools [data-layer="surface"]').click();
    check(!doc.querySelector("#mobile-fronts").hidden, "Los frentes deben volver al plano de superficie.");

    frame.style.width = "1200px";
    await nextFrame();
    check(app.getComputedStyle(doc.querySelector(".mobile-dock")).display !== "none" && box().width === 1200 &&
      !doc.querySelector(".mobile-center-hit") && app.getComputedStyle(map).touchAction === "none",
      "Al pasar a escritorio deben conservarse las herramientas flotantes y restablecerse la vista.");
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
