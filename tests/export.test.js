document.getElementById("app").addEventListener("load", async () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const doc = app.document;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    async function pixels(blob) {
      check(blob.type === "image/png" && blob.size > 1000, "La exportación debe producir un PNG.");
      const url = app.URL.createObjectURL(blob);
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
    function differences(first, second, top, bottom) {
      let count = 0;
      for (let y = top; y < bottom; y++) {
        for (let x = 0; x < first.width; x++) {
          const index = (y * first.width + x) * 4;
          if (first.data[index] !== second.data[index] || first.data[index + 1] !== second.data[index + 1] ||
              first.data[index + 2] !== second.data[index + 2]) count++;
        }
      }
      return count;
    }

    doc.querySelector("#air-toggle").click();
    const card = doc.querySelector(".map-card").getBoundingClientRect();
    const map = doc.querySelector("#map").getBoundingClientRect();
    const footer = doc.querySelector(".map-footer");
    const exportHeight = footer.getBoundingClientRect().top - card.top +
      parseFloat(app.getComputedStyle(doc.querySelector(".map-card")).borderTopWidth);
    const scale = Math.max(1, 1200 / map.width);
    const empty = await pixels(await app.renderMapPng());
    check(empty.width === Math.ceil(card.width * scale) && empty.height === Math.ceil(exportHeight * scale) &&
      empty.width >= 1200 && exportHeight < card.height && app.getComputedStyle(footer).display !== "none",
      "El PNG debe excluir la barra inferior sin ocultarla en el editor y conservar la resolución del mapa.");
    doc.querySelector("#status").textContent = "Información interactiva que no se exporta";
    const changedStatus = await pixels(await app.renderMapPng());
    check(differences(empty, changedStatus, 0, empty.height) === 0,
      "El contenido de la barra inferior no debe aparecer en el PNG.");
    const title = doc.querySelector("#map-title-input");
    title.value = "Situación atlántica";
    title.dispatchEvent(new app.Event("input", { bubbles: true }));
    const titled = await pixels(await app.renderMapPng());
    const mapTop = Math.floor((map.top - card.top) * scale);
    check(differences(empty, titled, 0, mapTop) > 20, "El título debe aparecer en la banda superior del PNG.");
    const date = doc.querySelector("#date");
    date.value = "2024-01-19";
    date.dispatchEvent(new app.Event("change", { bubbles: true }));
    const dated = await pixels(await app.renderMapPng());
    check(differences(titled, dated, 0, mapTop) > 10, "La fecha mostrada debe aparecer en el PNG.");

    doc.querySelector('[data-tool="low"][data-strength="strong"]').click();
    const point = doc.querySelector("#map").createSVGPoint();
    point.x = 600;
    point.y = 350;
    const screen = point.matrixTransform(doc.querySelector("#map").getScreenCTM());
    doc.querySelector("#map").dispatchEvent(new app.PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: screen.x,
      clientY: screen.y
    }));
    const center = await pixels(await app.renderMapPng());
    check(differences(dated, center, mapTop, Math.min(center.height, mapTop + 700)) > 100,
      "El mapa exportado debe incluir los centros y sus isobaras.");
    doc.querySelector("#air-toggle").click();
    const air = await pixels(await app.renderMapPng());
    check(differences(center, air, mapTop, Math.min(air.height, mapTop + 700)) > 1000,
      "El PNG debe incluir la capa visible de masas de aire.");
    doc.querySelector('[data-layer="upper"]').click();
    const upper = await pixels(await app.renderMapPng());
    check(differences(air, upper, mapTop, Math.min(upper.height, mapTop + 700)) > 1000,
      "El PNG debe reflejar el plano de altura cuando está activo.");

    const originalClick = app.HTMLAnchorElement.prototype.click;
    let download;
    app.HTMLAnchorElement.prototype.click = function () {
      download = { name: this.download, url: this.href };
    };
    const waitForExport = () => new Promise(resolve => {
      const wait = () => doc.querySelector("#export-png").disabled ? app.requestAnimationFrame(wait) : resolve();
      wait();
    });
    doc.querySelector("#export-png").click();
    await waitForExport();
    app.HTMLAnchorElement.prototype.click = originalClick;
    check(download && download.name === "isobaras.png" && (await app.fetch(download.url)).ok &&
      doc.querySelector("#status").textContent === "Mapa descargado en PNG.",
      "El botón debe iniciar la descarga del PNG e indicar el resultado.");
    const originalToBlob = app.HTMLCanvasElement.prototype.toBlob;
    app.HTMLCanvasElement.prototype.toBlob = callback => callback(null);
    doc.querySelector("#export-png").click();
    await waitForExport();
    app.HTMLCanvasElement.prototype.toBlob = originalToBlob;
    check(doc.querySelector("#status").textContent === "No se pudo descargar el mapa en PNG.",
      "Los errores de generación deben mostrarse y el botón debe volver a habilitarse.");
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
