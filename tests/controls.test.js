document.getElementById("app").addEventListener("load", async () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const doc = app.document;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const buttons = [...doc.querySelectorAll(".center-tool")];
    check(buttons.length === 6, "Debe haber seis botones de centros de acción.");
    doc.querySelector('[data-layer="upper"]').click();
    const map = doc.querySelector("#map");
    for (const button of buttons) {
      button.click();
      check(button.getAttribute("aria-pressed") === "true", "El botón elegido debe quedar seleccionado.");
      check(doc.querySelectorAll(".center-tool[aria-pressed=true]").length === 1,
        "Solo una combinación puede estar seleccionada.");
      const rect = map.getBoundingClientRect();
      map.dispatchEvent(new app.PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }));
      const center = doc.querySelector(".map-object");
      check(center && center.getAttribute("aria-label") === (button.dataset.tool === "high" ? "Anticiclón" :
        "Borrasca"), `La combinación ${button.getAttribute("aria-label")} debe crear el centro elegido.`);
      check(button.getAttribute("aria-pressed") === "false",
        "La herramienta debe deseleccionarse después de colocar el centro.");
      doc.querySelector("#delete").click();
    }
    buttons[0].click();
    buttons[1].click();
    check(buttons[0].getAttribute("aria-pressed") === "false" && buttons[1].getAttribute("aria-pressed") ===
      "true", "Cambiar la intensidad debe seleccionar el nuevo botón.");
    buttons[1].click();
    check(buttons[1].getAttribute("aria-pressed") === "false", "Pulsar de nuevo debe cancelar la selección.");
    buttons[0].click();
    doc.querySelector('[data-layer="surface"]').click();
    check(buttons[0].getAttribute("aria-pressed") === "false", "Cambiar de capa debe cancelar la herramienta.");
    check(!doc.querySelector("#map-wrap").contains(doc.querySelector("#instruction")),
      "La indicación debe estar fuera del mapa.");

    const sizes = {};
    for (const type of ["warm", "cold", "occluded"]) {
      doc.querySelector(`[data-tool="${type}"]`).click();
      const rect = map.getBoundingClientRect();
      map.dispatchEvent(new app.PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }));
      const front = doc.querySelector(".map-object.selected");
      const band = front.querySelector(".precipitation-band");
      const line = front.querySelector(".front-line").getBBox();
      const box = band.getBBox();
      check(band.getAttribute("fill") === `url(#rain-${type})` && band.getAttribute("pointer-events") === "none",
        "Cada frente debe tener una banda que no interfiera con la edición.");
      sizes[type] = box.height;
      if (type === "warm") check(box.y < line.y - 100 && box.y + box.height <= line.y + line.height + 1,
        "La banda cálida debe extenderse por delante del frente.");
      if (type === "cold") check(box.y + box.height > line.y + line.height + 40,
        "La banda fría debe alcanzar la parte posterior del frente.");
      if (type === "occluded") check(box.y < line.y - 50 && box.y + box.height > line.y + line.height + 50,
        "La banda ocluida debe extenderse a ambos lados.");
      const oldPath = front.querySelector(".front-line").getAttribute("d");
      const oldBand = band.lastElementChild.getAttribute("transform");
      const symbol = front.querySelector(".front-line + .object-hit + path").getAttribute("transform");
      for (let i = 0; i < 12; i++) doc.querySelector('.map-object.selected [data-handle="front-bend"]')
        .dispatchEvent(new app.KeyboardEvent("keydown", {
          bubbles: true,
          key: "ArrowDown"
        }));
      const bent = doc.querySelector(".map-object.selected");
      check(bent.querySelector(".front-line").getAttribute("d") !== oldPath && bent.querySelector(
          ".precipitation-band").lastElementChild.getAttribute("transform") !== oldBand &&
        bent.querySelector(".front-line + .object-hit + path").getAttribute("transform") !== symbol,
        `La línea, la banda y los símbolos del frente ${type} deben curvarse juntos.`);
    }
    check(sizes.warm > sizes.cold && sizes.occluded > sizes.cold, "La banda fría debe ser más estrecha.");

    let selected = doc.querySelector(".map-object.selected");
    const beforeMove = selected.getAttribute("transform");
    map.dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowRight"
    }));
    check(selected.getAttribute("transform") !== beforeMove, "La banda debe moverse con el frente.");
    selected.querySelector('[data-handle="rotate"]').dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowRight"
    }));
    selected = doc.querySelector(".map-object.selected");
    check(selected.querySelector(".front-shape").getAttribute("transform") === "rotate(5)" && selected
      .querySelector(".front-shape .precipitation-band"), "La banda debe girar con el frente.");

    const rainToggle = doc.querySelector("#precipitation-toggle");
    rainToggle.click();
    check([...doc.querySelectorAll(".precipitation-band")].every(band => app.getComputedStyle(band).display ===
      "none"), "El interruptor debe ocultar todas las bandas.");
    doc.querySelector('[data-layer="upper"]').click();
    check(doc.querySelector("#front-section").hidden && !doc.querySelector(".precipitation-band"),
      "Las bandas no deben aparecer en altura.");
    doc.querySelector('[data-layer="surface"]').click();
    check(!rainToggle.checked && [...doc.querySelectorAll(".precipitation-band")].every(band => app
      .getComputedStyle(band).display === "none"), "La preferencia debe conservarse al cambiar de capa.");
    rainToggle.click();
    check([...doc.querySelectorAll(".precipitation-band")].every(band => app.getComputedStyle(band).display !==
      "none"), "El interruptor debe volver a mostrar las bandas.");

    function placeFront(type, x, y) {
      doc.querySelector(`[data-tool="${type}"]`).click();
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
      return doc.querySelector(".map-object.selected");
    }

    function lineEnd(front, end) {
      const line = front.querySelector(".front-line");
      return line.getPointAtLength(end ? line.getTotalLength() : 0).matrixTransform(line.getCTM())
        .matrixTransform(map.getCTM().inverse());
    }
    const firstId = placeFront("cold", 200, 100).dataset.id;
    let second = placeFront("warm", 460, 110);
    const first = doc.querySelector(`[data-id="${firstId}"]`);
    const firstEnd = lineEnd(first, true);
    let secondStart = lineEnd(second, false);
    check(Math.hypot(firstEnd.x - secondStart.x, firstEnd.y - secondStart.y) < .01,
      "Los extremos próximos deben encajar al colocar un frente.");
    map.setPointerCapture = () => {};
    const bendHandle = second.querySelector('[data-handle="front-bend"]');
    const bendPoint = map.createSVGPoint();
    bendPoint.x = Number(bendHandle.getAttribute("cx"));
    bendPoint.y = Number(bendHandle.getAttribute("cy"));
    const bendPosition = bendPoint.matrixTransform(bendHandle.getCTM()).matrixTransform(map.getCTM().inverse());
    const beforeBend = second.querySelector(".front-line").getAttribute("d");
    const secondEnd = lineEnd(second, true);
    pointerAt(bendHandle, "pointerdown", bendPosition.x, bendPosition.y);
    pointerAt(map, "pointermove", bendPosition.x, bendPosition.y + 60);
    pointerAt(map, "pointerup", bendPosition.x, bendPosition.y + 60);
    second = doc.querySelector(".map-object.selected");
    secondStart = lineEnd(second, false);
    const bentEnd = lineEnd(second, true);
    check(second.querySelector(".front-line").getAttribute("d") !== beforeBend &&
      Math.hypot(firstEnd.x - secondStart.x, firstEnd.y - secondStart.y) < .01 &&
      Math.hypot(secondEnd.x - bentEnd.x, secondEnd.y - bentEnd.y) < .01,
      "Arrastrar el punto central debe curvar el frente sin separar sus extremos.");
    const originalWidth = second.querySelector(".precipitation-band").getBBox().width;
    second.querySelector('[data-handle="front-end"]').dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowLeft"
    }));
    second = doc.querySelector(".map-object.selected");
    secondStart = lineEnd(second, false);
    check(Math.hypot(firstEnd.x - secondStart.x, firstEnd.y - secondStart.y) < .01,
      "Al acortar un frente debe permanecer fijo el extremo opuesto.");
    check(second.querySelector(".precipitation-band").getBBox().width < originalWidth,
      "La banda debe acortarse junto al frente.");
    for (let i = 0; i < 4; i++) map.dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowRight"
    }));
    secondStart = lineEnd(second, false);
    check(secondStart.x - firstEnd.x > 19, "Los frentes unidos deben poder separarse con el teclado.");
    map.dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowLeft"
    }));
    secondStart = lineEnd(second, false);
    check(Math.hypot(firstEnd.x - secondStart.x, firstEnd.y - secondStart.y) < .01,
      "Al acercar los extremos con el teclado deben volver a encajar.");

    let third = placeFront("occluded", 650, 100);
    const thirdEnd = lineEnd(third, true);
    const thirdStart = lineEnd(third, false);

    function pointerAt(target, type, x, y) {
      const point = map.createSVGPoint();
      point.x = x;
      point.y = y;
      const screen = point.matrixTransform(map.getScreenCTM());
      target.dispatchEvent(new app.PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: screen.x,
        clientY: screen.y
      }));
    }
    map.setPointerCapture = () => {};
    pointerAt(third.querySelector('[data-handle="front-start"]'), "pointerdown", thirdStart.x, thirdStart.y);
    pointerAt(map, "pointermove", firstEnd.x + 5, firstEnd.y + 5);
    pointerAt(map, "pointerup", firstEnd.x + 5, firstEnd.y + 5);
    third = doc.querySelector(".map-object.selected");
    const joined = lineEnd(third, false);
    const anchored = lineEnd(third, true);
    check(Math.hypot(firstEnd.x - joined.x, firstEnd.y - joined.y) < .01,
      "Al soltar un extremo cerca de otro debe encajar exactamente.");
    check(Math.hypot(thirdEnd.x - anchored.x, thirdEnd.y - anchored.y) < .01,
      "El arrastre de un extremo debe mantener el otro fijo.");
    const midpoint = {
      x: (joined.x + anchored.x) / 2,
      y: (joined.y + anchored.y) / 2
    };
    pointerAt(third.querySelector(".object-hit"), "pointerdown", midpoint.x, midpoint.y);
    pointerAt(map, "pointermove", midpoint.x + 100, midpoint.y);
    pointerAt(map, "pointerup", midpoint.x + 100, midpoint.y);
    third = doc.querySelector(".map-object.selected");
    check(lineEnd(third, false).x - firstEnd.x > 99, "Arrastrar un frente unido debe permitir separarlo.");
    pointerAt(third.querySelector(".object-hit"), "pointerdown", midpoint.x + 100, midpoint.y);
    pointerAt(map, "pointermove", midpoint.x + 5, midpoint.y + 5);
    pointerAt(map, "pointerup", midpoint.x + 5, midpoint.y + 5);
    third = doc.querySelector(".map-object.selected");
    const rejoined = lineEnd(third, false);
    check(Math.hypot(firstEnd.x - rejoined.x, firstEnd.y - rejoined.y) < .01,
      "Al soltar el frente cerca de otro deben encajar sus extremos.");

    const nextFrame = () => new Promise(resolve => app.requestAnimationFrame(() => app.requestAnimationFrame(
      resolve)));
    doc.querySelector('[data-layer="upper"]').click();
    doc.querySelector('[data-jet-mode="automatic"]').click();
    await nextFrame();
    const autoPath = () => doc.querySelector('#automatic-jet path[stroke="#d2934d"]');
    const baseline = autoPath().getAttribute("d");
    doc.querySelector('[data-tool="low"][data-strength="strong"]').click();
    pointerAt(map, "pointerdown", 600, 400);
    await nextFrame();
    const withCenter = autoPath().getAttribute("d");
    check(withCenter !== baseline, "Añadir un centro de altura debe modificar el chorro automático.");
    for (let i = 0; i < 20; i++) map.dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowUp"
    }));
    await nextFrame();
    check(autoPath().getAttribute("d") !== withCenter,
      "Mover un centro de altura debe actualizar el chorro automático.");
    const automatic = autoPath();
    const automaticStart = automatic.getPointAtLength(0).matrixTransform(automatic.getCTM()).matrixTransform(map
      .getCTM().inverse());
    const automaticEnd = automatic.getPointAtLength(automatic.getTotalLength()).matrixTransform(automatic
    .getCTM()).matrixTransform(map.getCTM().inverse());
    const automaticMiddle = automatic.getPointAtLength(automatic.getTotalLength() / 2).matrixTransform(automatic
      .getCTM()).matrixTransform(map.getCTM().inverse());
    doc.querySelector('[data-jet-mode="manual"]').click();
    await nextFrame();
    let editable = doc.querySelector(".map-object.selected");
    const editableId = editable.dataset.id;
    let editablePath = editable.querySelector('path[stroke="#d2934d"]');
    const start = editablePath.getPointAtLength(0).matrixTransform(editablePath.getCTM()).matrixTransform(map
      .getCTM().inverse());
    const end = editablePath.getPointAtLength(editablePath.getTotalLength()).matrixTransform(editablePath
    .getCTM()).matrixTransform(map.getCTM().inverse());
    const middle = editablePath.getPointAtLength(editablePath.getTotalLength() / 2).matrixTransform(editablePath
      .getCTM()).matrixTransform(map.getCTM().inverse());
    check(!autoPath() && Math.hypot(start.x - automaticStart.x, start.y - automaticStart.y) < .01 && Math.hypot(
        end.x - automaticEnd.x, end.y - automaticEnd.y) < .01 && Math.hypot(middle.x - automaticMiddle.x, middle
        .y - automaticMiddle.y) < .01,
      "El modo manual debe conservar el chorro automático y añadir sus controles.");
    const originalPath = editablePath.getAttribute("d");
    const handles = editable.querySelectorAll('[data-handle^="jet-"]');
    const handleName = handles[Math.floor(handles.length / 2)].dataset.handle;
    const jet = app.activeHeightJet();
    const index = Number(handleName.slice(4));
    const x = jet.x + jet.points[index][0] - 40;
    const y = jet.y + jet.points[index][1] + 30;
    const sources = app.heightSources([{
      type: "low",
      x: 600,
      y: 300,
      strength: "strong",
      layer: "upper",
      shape: {
        east: 1,
        west: 1,
        north: 1,
        south: 1
      }
    }]);
    const beforeHeight = app.heightAt(x, y, sources, jet);
    const beforeWind = app.heightWind(x, y, sources, jet);
    const arrow = doc.querySelector(".pressure-wind");
    const oldContours = doc.querySelector(".height-contour").getAttribute("d");
    for (let i = 0; i < 16; i++) {
      doc.querySelector(`.map-object.selected [data-handle="${handleName}"]`).dispatchEvent(new app.KeyboardEvent(
        "keydown", {
          bubbles: true,
          key: "ArrowDown"
        }));
    }
    await nextFrame();
    editable = doc.querySelector(".map-object.selected");
    editablePath = editable.querySelector('path[stroke="#d2934d"]');
    const afterWind = app.heightWind(x, y, sources, app.activeHeightJet());
    check(editablePath.getAttribute("d") !== originalPath && doc.querySelector('[data-jet-mode="manual"]')
      .getAttribute("aria-pressed") === "true", "Los tiradores deben deformar el chorro existente.");
    check(Math.abs(app.heightAt(x, y, sources, jet) - beforeHeight) > 1 && Math.hypot(afterWind[0] - beforeWind[
        0], afterWind[1] - beforeWind[1]) > .05,
      "Deformar el chorro debe modificar el campo y el viento de altura.");
    check(doc.querySelector(".height-contour").getAttribute("d") !== oldContours && doc.querySelector(
      ".pressure-wind") === arrow, "Las curvas deben actualizarse sin reiniciar las flechas.");
    const savedPath = editablePath.getAttribute("d");
    const center = [...doc.querySelectorAll(".map-object")].find(node => node.getAttribute("aria-label") ===
      "Borrasca");
    pointerAt(center.querySelector("circle"), "pointerdown", 600, 300);
    pointerAt(map, "pointerup", 600, 300);
    map.dispatchEvent(new app.KeyboardEvent("keydown", {
      bubbles: true,
      key: "ArrowUp"
    }));
    await nextFrame();
    check(doc.querySelector(`[data-id="${editableId}"] path[stroke="#d2934d"]`).getAttribute("d") === savedPath,
      "Mover un centro debe conservar el chorro manual.");
    doc.querySelector('[data-jet-mode="automatic"]').click();
    await nextFrame();
    check(autoPath() && !doc.querySelector(`[data-id="${editableId}"]`),
      "El modo automático debe ocultar el chorro manual.");
    doc.querySelector('[data-jet-mode="manual"]').click();
    await nextFrame();
    check(doc.querySelector(`[data-id="${editableId}"] path[stroke="#d2934d"]`).getAttribute("d") === savedPath,
      "El chorro editado debe conservarse al alternar modos.");
    const restoredJet = app.activeHeightJet();
    const centerSources = app.heightSources([{
      type: "low",
      x: 600,
      y: 295,
      strength: "strong",
      layer: "upper",
      shape: {
        east: 1,
        west: 1,
        north: 1,
        south: 1
      }
    }]);
    const handleX = restoredJet.x + restoredJet.points[index][0];
    const handleY = restoredJet.y + restoredJet.points[index][1];
    const beforeDrag = app.heightAt(x, y, centerSources, restoredJet);
    pointerAt(doc.querySelector(`.map-object.selected [data-handle="${handleName}"]`), "pointerdown", handleX,
      handleY);
    pointerAt(map, "pointermove", handleX, handleY + 30);
    pointerAt(map, "pointerup", handleX, handleY + 30);
    await nextFrame();
    check(Math.abs(app.heightAt(x, y, centerSources, restoredJet) - beforeDrag) > .01,
      "Arrastrar un tirador del chorro debe modificar el campo de altura.");
    const beforeTranslation = app.heightAt(x, y, centerSources, restoredJet);
    const previousY = restoredJet.y;
    pointerAt(doc.querySelector(".map-object.selected .object-hit"), "pointerdown", handleX, handleY);
    pointerAt(map, "pointermove", handleX, handleY + 20);
    pointerAt(map, "pointerup", handleX, handleY + 20);
    await nextFrame();
    check(Math.abs(restoredJet.y - previousY - 20) < .01 && Math.abs(app.heightAt(x, y, centerSources,
        restoredJet) - beforeTranslation) > .01,
      "Arrastrar el chorro completo debe modificar también el campo de altura.");
    doc.querySelector("#delete").click();
    await nextFrame();
    check(doc.querySelector('[data-jet-mode="automatic"]').getAttribute("aria-pressed") === "true" && autoPath(),
      "Eliminar el chorro manual debe recuperar el modo automático.");
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
