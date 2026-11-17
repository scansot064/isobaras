function cardText(card, bounds) {
  const lines = [];
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement.closest("svg, .map-footer, #instruction") ?
        NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }
  });
  const range = document.createRange();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const style = getComputedStyle(node.parentElement);
    if (style.visibility === "hidden" || style.display === "none") continue;
    let offset = 0;
    let line = null;
    for (const character of node.data) {
      range.setStart(node, offset);
      offset += character.length;
      range.setEnd(node, offset);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      if (!line || Math.abs(line.y - rect.top) > 1) {
        line = {
          text: "",
          x: rect.left - bounds.left,
          y: rect.top - bounds.top,
          height: rect.height,
          font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
          color: style.color,
          letterSpacing: style.letterSpacing
        };
        lines.push(line);
      }
      line.text += character;
    }
  }
  return lines;
}

function wrapAttribution(context, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const combined = line ? `${line} ${word}` : word;
    if (context.measureText(combined).width <= width) {
      line = combined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderMapPng() {
  await new Promise(resolve => requestAnimationFrame(resolve));
  const card = document.querySelector(".map-card");
  const map = document.getElementById("map");
  const bounds = card.getBoundingClientRect();
  const mapBounds = map.getBoundingClientRect();
  if (!bounds.width || !bounds.height || !mapBounds.width) throw new Error("El mapa no está visible.");
  const borderWidth = parseFloat(getComputedStyle(card).borderTopWidth);
  const instructionBounds = document.getElementById("instruction").getBoundingClientRect();
  const mapHeight = card.querySelector(".map-footer").getBoundingClientRect().top - bounds.top + borderWidth -
    instructionBounds.height;
  const scale = Math.max(1, 1200 / mapBounds.width);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se puede crear la imagen del mapa.");
  const attribution = document.getElementById("attribution");
  const attributionStyle = getComputedStyle(attribution);
  const attributionFont = `${attributionStyle.fontStyle} ${attributionStyle.fontWeight} ${attributionStyle.fontSize} ${attributionStyle.fontFamily}`;
  const lineHeight = parseFloat(attributionStyle.lineHeight);
  context.font = attributionFont;
  const attributionLines = wrapAttribution(context, attribution.textContent.replace(/\s+/g, " ").trim(),
    Math.max(1, bounds.width - 38));
  const height = mapHeight + 24 + attributionLines.length * lineHeight;
  canvas.width = Math.ceil(bounds.width * scale);
  canvas.height = Math.ceil(height * scale);
  context.scale(scale, scale);

  const text = cardText(card, bounds).map(line => ({
    ...line,
    y: line.y >= instructionBounds.bottom - bounds.top ? line.y - instructionBounds.height : line.y
  }));
  const dots = [...card.querySelectorAll(".live-dot")].map(dot => {
    const rect = dot.getBoundingClientRect();
    return {
      x: rect.left - bounds.left,
      y: rect.top - bounds.top,
      width: rect.width,
      height: rect.height,
      color: getComputedStyle(dot).backgroundColor
    };
  });
  const clone = map.cloneNode(true);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules].map(rule => rule.cssText))
    .join("\n");
  clone.prepend(style);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "1200");
  clone.setAttribute("height", "700");
  const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml"
  }));
  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();
    context.fillStyle = getComputedStyle(card).backgroundColor;
    context.fillRect(0, 0, bounds.width, height);
    context.drawImage(image, mapBounds.left - bounds.left, mapBounds.top - bounds.top - instructionBounds.height,
      mapBounds.width, mapBounds.height);
    for (const dot of dots) {
      context.fillStyle = dot.color;
      context.beginPath();
      context.ellipse(dot.x + dot.width / 2, dot.y + dot.height / 2, dot.width / 2, dot.height / 2, 0, 0,
        Math.PI * 2);
      context.fill();
    }
    for (const line of text) {
      context.fillStyle = line.color;
      context.font = line.font;
      context.textBaseline = "middle";
      if ("letterSpacing" in context) context.letterSpacing = line.letterSpacing;
      context.fillText(line.text, line.x, line.y + line.height / 2);
    }
    context.fillStyle = attributionStyle.backgroundColor;
    context.fillRect(borderWidth, mapHeight, bounds.width - 2 * borderWidth, height - mapHeight - borderWidth);
    context.fillStyle = attributionStyle.color;
    context.font = attributionFont;
    context.textAlign = "center";
    context.textBaseline = "middle";
    if ("letterSpacing" in context) context.letterSpacing = "0px";
    attributionLines.forEach((line, index) => {
      context.fillText(line, bounds.width / 2, mapHeight + 12 + (index + .5) * lineHeight);
    });
    context.strokeStyle = getComputedStyle(card).borderTopColor;
    context.lineWidth = borderWidth;
    context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, bounds.width - context.lineWidth,
      height - context.lineWidth);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo generar el PNG."));
    }, "image/png"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  try {
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

document.getElementById("export-png").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const blob = await renderMapPng();
    downloadBlob(blob, "isobaras.png");
    status.textContent = "Mapa descargado en PNG.";
  } catch (error) {
    console.error("No se pudo exportar el mapa:", error);
    status.textContent = "No se pudo descargar el mapa en PNG.";
  } finally {
    button.disabled = false;
  }
});
