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
    const donation = doc.querySelector(".donation-link");
    const donationBox = donation.getBoundingClientRect();
    check(donation.href === "https://buymeacoffee.com/scansot064" && donation.target === "_blank" &&
      donation.rel.includes("noopener") && donationBox.right <= app.innerWidth && donationBox.left >= 0 &&
      donation.previousElementSibling.id === "mobile-pan" &&
      doc.elementFromPoint(donationBox.left + donationBox.width / 2, donationBox.top + donationBox.height / 2)
        .closest(".donation-link") === donation,
      "El enlace de donación debe estar a la derecha de Mover mapa y abrir la página correcta.");
    check(doc.title === "Generador interactivo de mapas de isobaras" &&
      doc.querySelector(".brand h1").textContent === doc.title && !doc.querySelector(".header-note"),
      "La cabecera y la pestaña deben mostrar el nombre del generador.");
    const drawerButton = doc.querySelector("#file-drawer-button");
    const drawer = doc.querySelector("#file-drawer-panel");
    drawerButton.click();
    check(!drawer.hidden && drawerButton.getAttribute("aria-expanded") === "true" &&
      ["#save-map", "#load-map", "#export-png"].every(selector => doc.querySelector(selector).getBoundingClientRect()
        .width >= 44) && Math.abs(drawer.getBoundingClientRect().right - app.innerWidth) < 1 &&
      drawer.getBoundingClientRect().height >= app.innerHeight,
      "El panel lateral debe ocupar el borde derecho y mostrar las tres acciones de archivo.");
    doc.dispatchEvent(new app.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check(drawer.hidden && doc.activeElement === drawerButton && drawerButton.getAttribute("aria-expanded") === "false",
      "Escape debe cerrar el panel de archivo y devolver el foco al tirador.");
    drawerButton.click();
    doc.querySelector("#file-drawer-close").click();
    check(drawer.hidden && doc.activeElement === drawerButton, "El botón de cierre debe devolver el foco al archivo.");
    drawerButton.click();
    app.setTool("high", "weak");
    const mapCenter = screenPoint(600, 350);
    pointer(map, "pointerdown", mapCenter.x, mapCenter.y);
    check(drawer.hidden && drawerButton.getAttribute("aria-expanded") === "false" && state.objects.length === 0,
      "Tocar fuera debe cerrar el panel sin añadir accidentalmente un elemento al mapa.");
    app.setTool(null);
    drawerButton.click();
    const clickAnchor = app.HTMLAnchorElement.prototype.click;
    let download;
    app.HTMLAnchorElement.prototype.click = function () {
      download = this.download;
    };
    doc.querySelector("#save-map").click();
    app.HTMLAnchorElement.prototype.click = clickAnchor;
    check(drawer.hidden && download === "isobaras.json", "Guardar debe ejecutar la acción y cerrar el panel.");
    drawerButton.click();
    const clickInput = app.HTMLInputElement.prototype.click;
    let fileOpened = false;
    app.HTMLInputElement.prototype.click = function () {
      if (this === doc.querySelector("#map-file")) fileOpened = true;
      else clickInput.call(this);
    };
    doc.querySelector("#load-map").click();
    app.HTMLInputElement.prototype.click = clickInput;
    check(drawer.hidden && fileOpened, "Cargar debe abrir el selector de archivos y cerrar el panel.");
    drawerButton.click();
    app.HTMLAnchorElement.prototype.click = function () {
      download = this.download;
    };
    doc.querySelector("#export-png").click();
    check(drawer.hidden, "Descargar PNG debe cerrar el panel.");
    const deadline = Date.now() + 10000;
    while (doc.querySelector("#export-png").disabled && Date.now() < deadline) await nextFrame();
    app.HTMLAnchorElement.prototype.click = clickAnchor;
    check(download === "isobaras.png", "La descarga del PNG debe continuar después de cerrar el panel.");
    const infoButton = doc.querySelector("#info-drawer-button");
    const info = doc.querySelector("#info-drawer-panel");
    infoButton.click();
    check(!info.hidden && infoButton.getAttribute("aria-expanded") === "true" &&
      doc.activeElement === doc.querySelector("#info-drawer-close") &&
      Math.abs(info.getBoundingClientRect().right - app.innerWidth) < 1 &&
      info.scrollHeight > info.clientHeight &&
      info.querySelectorAll("h3").length === 5 &&
      [...info.querySelectorAll("a")].length === 5 &&
      [...info.querySelectorAll("a")].every(link => link.hostname === "es.wikipedia.org" &&
        link.target === "_blank" && link.rel.includes("noopener")),
      "La guía debe abrirse en el lateral, poder desplazarse y ofrecer enlaces a Wikipedia.");
    doc.dispatchEvent(new app.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check(info.hidden && doc.activeElement === infoButton && infoButton.getAttribute("aria-expanded") === "false",
      "Escape debe cerrar la guía y devolver el foco a su icono.");
    infoButton.click();
    doc.querySelector("#info-drawer-close").click();
    check(info.hidden && doc.activeElement === infoButton, "El cierre de la guía debe devolver el foco a su icono.");
    infoButton.click();
    drawerButton.click();
    check(info.hidden && infoButton.getAttribute("aria-expanded") === "false" && !drawer.hidden,
      "Abrir archivo debe cerrar la guía.");
    infoButton.click();
    check(drawer.hidden && drawerButton.getAttribute("aria-expanded") === "false" && !info.hidden,
      "Abrir la guía debe cerrar archivo.");
    app.setTool("high", "weak");
    pointer(map, "pointerdown", mapCenter.x, mapCenter.y);
    check(info.hidden && infoButton.getAttribute("aria-expanded") === "false" && state.objects.length === 0,
      "Tocar el mapa debe cerrar la guía sin añadir accidentalmente un elemento.");
    app.setTool(null);
    infoButton.click();
    doc.querySelector("#mobile-add").click();
    check(info.hidden && !doc.querySelector("#mobile-tools").hidden,
      "Abrir Añadir debe cerrar la guía.");
    infoButton.click();
    check(doc.querySelector("#mobile-tools").hidden && !info.hidden,
      "Abrir la guía debe cerrar Añadir.");
    doc.querySelector("#desktop-options-button").click();
    check(info.hidden && !doc.querySelector("#desktop-options").hidden,
      "Abrir Capas debe cerrar la guía.");
    infoButton.click();
    check(doc.querySelector("#desktop-options").hidden && !info.hidden,
      "Abrir la guía debe cerrar Capas.");
    doc.querySelector("#info-drawer-close").click();
    for (const width of [320, 347, 348, 390]) {
      frame.style.width = `${width}px`;
      await nextFrame();
      const fileBounds = drawerButton.getBoundingClientRect();
      const infoBounds = infoButton.getBoundingClientRect();
      const presetBounds = doc.querySelector("#preset-select").getBoundingClientRect();
      const presetFrame = app.getComputedStyle(doc.querySelector(".preset-picker"), "::before");
      const iconFrame = app.getComputedStyle(infoButton, "::before");
      const canvasTitle = doc.querySelector(".canvas-heading h2").getBoundingClientRect();
      const heading = doc.querySelector(".brand h1").getBoundingClientRect();
      const topbar = doc.querySelector(".topbar").getBoundingClientRect();
      const metaButton = doc.querySelector("#mobile-meta-button").getBoundingClientRect();
      const toolbar = doc.querySelector(".map-toolbar").getBoundingClientRect();
      const layerControl = doc.querySelector(".layer-toggle").getBoundingClientRect();
      const footer = doc.querySelector(".map-footer").getBoundingClientRect();
      check([...doc.querySelectorAll(".mobile-actions button, .mobile-actions .donation-link")].every(button => {
        const bounds = button.getBoundingClientRect();
        return app.getComputedStyle(button).display !== "none" && bounds.width >= 44 && bounds.height >= 44;
      }) && Math.abs(donation.getBoundingClientRect().width - doc.querySelector("#zoom-reset").getBoundingClientRect().width) < 1 &&
        heading.top >= topbar.top && heading.bottom <= topbar.bottom && heading.right <= topbar.right &&
        fileBounds.width >= 44 && fileBounds.height >= 44 && fileBounds.bottom <= map.getBoundingClientRect().top &&
        infoBounds.width >= 44 && infoBounds.height >= 44 && infoBounds.right <= fileBounds.left &&
        presetBounds.height >= 44 && presetBounds.left >= 0 && presetBounds.right <= infoBounds.left &&
        presetFrame.height === iconFrame.height && presetFrame.borderTopWidth === iconFrame.borderTopWidth &&
        infoBounds.bottom <= map.getBoundingClientRect().top &&
        (canvasTitle.right <= presetBounds.left || canvasTitle.top >= infoBounds.bottom ||
          canvasTitle.bottom <= presetBounds.top) &&
        metaButton.height >= 44 && toolbar.height <= 60 &&
        Math.abs((layerControl.left + layerControl.right) / 2 - (footer.left + footer.right) / 2) < 1 &&
        doc.querySelector("#layer-toggle").getBoundingClientRect().width >= 44 &&
        doc.documentElement.scrollWidth <= width,
      "Todos los botones móviles deben estar visibles y medir al menos 44 píxeles sin desbordar.");
    }
    app.scrollTo(0, 200);
    await nextFrame();
    check(drawerButton.getBoundingClientRect().bottom <= map.getBoundingClientRect().top,
      "El icono de archivo no debe tapar el mapa al desplazarse por la página.");
    app.scrollTo(0, 0);

    const metaButton = doc.querySelector("#mobile-meta-button");
    const metaPanel = doc.querySelector("#mobile-meta-panel");
    const title = doc.querySelector("#mobile-title-input");
    const day = doc.querySelector("#mobile-day");
    const month = doc.querySelector("#mobile-month");
    const year = doc.querySelector("#mobile-year");
    metaButton.click();
    check(!metaPanel.hidden && metaButton.getAttribute("aria-expanded") === "true" &&
      doc.activeElement === doc.querySelector("#mobile-meta-close"),
      "El resumen debe abrir el panel de fecha y título.");
    check([title, day, month, year].every(input => {
      const bounds = input.getBoundingClientRect();
      return app.getComputedStyle(input).display !== "none" && bounds.width >= 44 && bounds.height >= 44;
    }), "Los campos del panel deben ser cómodos para editar en móvil.");
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
    check(doc.querySelector("#mobile-map-title").textContent === saved.title &&
      doc.querySelector("#mobile-map-date").textContent === "29.02 1900" &&
      doc.querySelector("#inline-title").value === saved.title && doc.querySelector("#inline-day").value === "29",
      "El resumen y los controles de escritorio deben reflejar la edición móvil.");
    doc.dispatchEvent(new app.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check(metaPanel.hidden && doc.activeElement === metaButton && metaButton.getAttribute("aria-expanded") === "false",
      "Escape debe cerrar el panel de fecha y título y devolver el foco.");
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
    metaButton.click();
    title.value = "Títulolargo".repeat(20);
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    doc.querySelector("#mobile-meta-close").click();
    const titleBounds = doc.querySelector("#mobile-map-title");
    check(titleBounds.scrollWidth > titleBounds.clientWidth,
      "El resumen debe abreviar un título largo sin aumentar su altura.");
    const longTitleLines = [];
    app.CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
      if (x === 19 && y >= 41) longTitleLines.push({ text, x, y, width: this.measureText(text).width });
      return fillText.call(this, text, x, y, ...args);
    };
    try {
      await app.renderMapPng();
    } finally {
      app.CanvasRenderingContext2D.prototype.fillText = fillText;
    }
    const cardWidth = doc.querySelector(".map-card").getBoundingClientRect().width;
    check(longTitleLines.length > 1 && longTitleLines.map(line => line.text).join("") === title.value &&
      longTitleLines.every(line => line.x >= 0 && line.x + line.width <= cardWidth - 19),
      "El PNG debe incluir el título largo completo y ajustado dentro de la banda.");
    title.value = "";
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    app.restoreMap(app.validateMapDocument(saved));
    check(title.value === saved.title && day.value === "29" && month.value === "02" && year.value === saved.year,
      "Cargar un mapa debe actualizar los campos visibles en móvil.");
    metaButton.click();
    app.setTool("high", "weak");
    const outsideMap = screenPoint(600, 350);
    pointer(map, "pointerdown", outsideMap.x, outsideMap.y);
    check(metaPanel.hidden && state.objects.length === 0,
      "Tocar el mapa debe cerrar el panel sin añadir accidentalmente un elemento.");
    app.setTool(null);
    metaButton.click();
    drawerButton.click();
    check(metaPanel.hidden && !drawer.hidden, "Abrir archivo debe cerrar el panel de edición.");
    metaButton.click();
    check(drawer.hidden && !metaPanel.hidden, "Abrir el panel de edición debe cerrar archivo.");
    frame.style.width = "800px";
    await nextFrame();
    check(metaPanel.hidden && app.getComputedStyle(metaButton).display === "none" &&
      doc.querySelector("#inline-title").value === saved.title,
      "Al pasar a escritorio debe cerrarse el panel móvil sin perder los cambios.");
    frame.style.width = "390px";
    await nextFrame();

    doc.querySelector("#desktop-options-button").click();
    check(!doc.querySelector("#desktop-options").hidden &&
      doc.querySelector("#desktop-options-button").getAttribute("aria-expanded") === "true" &&
      doc.querySelector("#desktop-options").contains(doc.querySelector("#clear")),
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
      !doc.querySelector("#delete").hidden, "El centro debe colocarse y mostrar su papelera.");
    const stronger = doc.querySelector("#center-strengthen");
    const weaker = doc.querySelector("#center-weaken");
    check(!stronger.hidden && !weaker.hidden && weaker.disabled && stronger.textContent === "+" &&
      weaker.textContent === "−" && stronger.getBoundingClientRect().width >= 44 &&
      stronger.getBoundingClientRect().height >= 44, "El centro debe ofrecer controles táctiles de potencia.");
    for (let i = 0; i < 12; i++) stronger.click();
    check(center.intensityBoost === 48 && stronger.disabled && !weaker.disabled &&
      doc.querySelector("#status").textContent.includes("48 hPa"),
      "La potencia debe aumentar en pasos de 4 hPa hasta 48 hPa.");
    weaker.click();
    check(center.intensityBoost === 44 && !stronger.disabled, "La potencia debe poder reducirse.");
    for (let i = 0; i < 11; i++) weaker.click();
    check(center.intensityBoost === 0 && weaker.disabled, "La potencia no debe bajar de la intensidad original.");
    const deleteButton = doc.querySelector("#delete");
    const strongBounds = stronger.getBoundingClientRect();
    const deleteBounds = deleteButton.getBoundingClientRect();
    check(deleteBounds.width >= 44 && deleteBounds.height >= 44 &&
      app.getComputedStyle(deleteButton).position === "absolute" &&
      parseFloat(app.getComputedStyle(deleteButton, "::before").width) < deleteBounds.width &&
      Math.abs(deleteBounds.left - position.x) < 80 && Math.abs(deleteBounds.top - position.y) < 80,
      "La papelera debe ser pequeña, estar junto al centro y conservar un objetivo táctil amplio.");
    check(strongBounds.right <= position.x && deleteBounds.left >= position.x &&
      Math.abs(strongBounds.top - deleteBounds.top) < 1,
      "El aumento de potencia debe estar en la esquina opuesta a la papelera.");
    for (const [x, y] of [[0, 0], [1200, 0], [0, 700], [1200, 700]]) {
      center.x = x;
      center.y = y;
      app.render();
      const buttons = [deleteButton, stronger, weaker];
      const boxes = buttons.map(button => button.getBoundingClientRect());
      const bounds = map.getBoundingClientRect();
      check(boxes.every(box => box.left >= bounds.left - 1 && box.right <= bounds.right + 1 &&
        box.top >= bounds.top - 1 && box.bottom <= bounds.bottom + 1) &&
        boxes.every((box, i) => boxes.every((other, j) => i === j || box.right <= other.left ||
          box.left >= other.right || box.bottom <= other.top || box.top >= other.bottom)),
        "Los controles deben permanecer dentro del mapa y no solaparse en sus esquinas.");
    }
    center.x = 600;
    center.y = 350;
    app.render();
    center.type = "low";
    app.render();
    check(stronger.textContent === "−" && weaker.textContent === "+",
      "En una borrasca los símbolos deben invertirse.");
    center.type = "high";
    app.render();
    const hit = doc.querySelector(".mobile-center-hit");
    const scale = map.getScreenCTM().a;
    check(Math.abs(Number(hit.getAttribute("r")) * scale - 22) < .1 &&
      Math.abs(Number(doc.querySelector(".transform-handle").getAttribute("r")) * scale - 14) < .1,
      "Los centros y tiradores deben tener objetivos táctiles ampliados.");
    await nextFrame();
    app.stopWind();
    const original = await imagePixels();
    deleteButton.hidden = true;
    stronger.hidden = true;
    weaker.hidden = true;
    const withoutDelete = await imagePixels();
    deleteButton.hidden = false;
    stronger.hidden = false;
    weaker.hidden = false;
    check(original.width === withoutDelete.width && original.height === withoutDelete.height &&
      original.data.every((value, index) => value === withoutDelete.data[index]),
      "Los controles interactivos no deben aparecer en el PNG.");
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
    const movedDelete = deleteButton.getBoundingClientRect();
    const movedStronger = stronger.getBoundingClientRect();
    const movedPoint = screenPoint(center.x, center.y);
    check(center.x > 600 && center.x < 650 && Math.abs(movedDelete.left - movedPoint.x) < 80 &&
      Math.abs(movedDelete.top - movedPoint.y) < 80 && movedStronger.right <= movedPoint.x &&
      Math.abs(movedStronger.top - movedDelete.top) < 1,
      "La papelera y el control de potencia deben seguir al centro al moverlo con zoom.");
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
    deleteButton.click();
    check(!state.objects.includes(front) && deleteButton.hidden,
      "Eliminar debe actuar sobre la selección actual.");
    doc.querySelector("#mobile-add").click();
    doc.querySelector("#desktop-options-button").click();
    check(doc.querySelector("#mobile-tools").hidden, "Capas debe cerrar el panel Añadir.");
    doc.querySelector("#desktop-copy").click();
    check(state.objects.some(object => object.layer === "upper" && object.type === "high"),
      "Capas debe permitir copiar centros desde móvil.");
    doc.querySelector("#layer-toggle").click();
    check(doc.querySelector("#mobile-fronts").hidden && state.layer === "upper" &&
      doc.querySelector("#layer-toggle").checked &&
      doc.querySelector('.segmented [data-layer="upper"]').getAttribute("aria-pressed") === "true",
      "El cambio de plano móvil debe sincronizarse y ocultar los frentes en altura.");
    doc.querySelector("#desktop-options-button").click();
    check(!doc.querySelector("#desktop-jet-options").hidden && doc.querySelector("#desktop-surface-options").hidden &&
      doc.querySelector("#desktop-copy").textContent === "Copiar a superficie",
      "Capas debe mostrar las opciones de altura y la copia hacia superficie.");
    doc.querySelector('#desktop-jet-options [data-jet-mode="manual"]').click();
    check(state.jetMode === "manual" && app.activeHeightJet(), "El modo manual del chorro debe funcionar en móvil.");
    check(!deleteButton.hidden, "La papelera también debe permitir eliminar el chorro manual.");
    doc.querySelector('#desktop-jet-options [data-jet-mode="automatic"]').click();
    check(state.jetMode === "automatic", "El modo automático del chorro debe funcionar en móvil.");
    doc.querySelector("#layer-toggle").click();
    check(!doc.querySelector("#layer-toggle").checked && !doc.querySelector("#mobile-fronts").hidden,
      "Los frentes deben volver al plano de superficie.");
    doc.querySelector("#desktop-options-button").click();
    const confirm = app.confirm;
    app.confirm = () => true;
    doc.querySelector("#clear").click();
    app.confirm = confirm;
    check(!state.objects.some(object => object.layer === "surface") &&
      state.objects.some(object => object.layer === "upper" && object.type === "high"),
      "Limpiar capa debe estar en Capas y conservar el otro plano.");

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
