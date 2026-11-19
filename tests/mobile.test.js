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

    check(app.getComputedStyle(doc.querySelector(".mobile-dock")).display !== "none" &&
      app.getComputedStyle(map).touchAction === "pan-y", "En móvil debe poder desplazarse la página desde el mapa.");
    check([...doc.querySelectorAll(".mobile-actions button")].filter(button => app.getComputedStyle(button).display !==
      "none").every(button => button.getBoundingClientRect().width >= 44 &&
      button.getBoundingClientRect().height >= 44), "Los botones móviles deben tener un tamaño táctil de 44 píxeles.");
    doc.querySelector("#air-toggle").click();
    doc.querySelector("#mobile-add").click();
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
    doc.querySelector('#mobile-tools [data-layer="upper"]').click();
    check(doc.querySelector("#mobile-fronts").hidden && state.layer === "upper" &&
      doc.querySelector('.segmented [data-layer="upper"]').getAttribute("aria-pressed") === "true",
      "El cambio de plano móvil debe sincronizarse y ocultar los frentes en altura.");
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
