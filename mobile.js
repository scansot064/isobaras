const mobileScreen = matchMedia("(max-width: 650px)");
const mobileTools = document.getElementById("mobile-tools");
const mobileAdd = document.getElementById("mobile-add");
const desktopOptions = document.getElementById("desktop-options");
const desktopOptionsButton = document.getElementById("desktop-options-button");
const fileDrawerButton = document.getElementById("file-drawer-button");
const fileDrawerPanel = document.getElementById("file-drawer-panel");
const fileDrawerClose = document.getElementById("file-drawer-close");
const mobilePan = document.getElementById("mobile-pan");
const zoomIn = document.getElementById("zoom-in");
const zoomOut = document.getElementById("zoom-out");
const zoomReset = document.getElementById("zoom-reset");
let zoom = 1;
let viewX = 0;
let viewY = 0;
let panDrag = null;

function updateMobileTargets() {
  if (!mobileScreen.matches) return;
  const scale = map.getScreenCTM().a;
  if (!scale) return;
  objectsLayer.querySelectorAll(".transform-handle").forEach(handle => handle.setAttribute("r", 14 / scale));
  objectsLayer.querySelectorAll(".map-object").forEach(node => {
    const object = state.objects.find(item => item.id === Number(node.dataset.id));
    if (!object || !isCenter(object)) return;
    let hit = node.querySelector(".mobile-center-hit");
    if (!hit) {
      hit = svgElement("circle", { fill: "transparent", class: "mobile-center-hit", "aria-hidden": "true" });
      node.prepend(hit);
    }
    hit.setAttribute("r", 22 / scale);
  });
}

function updateView() {
  const width = MAP_WIDTH / zoom;
  const height = MAP_HEIGHT / zoom;
  viewX = Math.max(0, Math.min(MAP_WIDTH - width, viewX));
  viewY = Math.max(0, Math.min(MAP_HEIGHT - height, viewY));
  map.setAttribute("viewBox", `${viewX} ${viewY} ${width} ${height}`);
  zoomIn.disabled = zoom >= 4;
  zoomOut.disabled = zoom <= 1;
  zoomReset.textContent = `${Math.round(zoom * 100)}%`;
  mobilePan.disabled = zoom <= 1;
  if (zoom <= 1) setPan(false);
  updateMobileTargets();
  updateSelectionDelete();
}

function setZoom(next) {
  const selected = state.objects.find(object => object.id === state.selected && object.layer === state.layer);
  const centerX = selected ? selected.x : viewX + MAP_WIDTH / zoom / 2;
  const centerY = selected ? selected.y : viewY + MAP_HEIGHT / zoom / 2;
  zoom = Math.max(1, Math.min(4, next));
  viewX = centerX - MAP_WIDTH / zoom / 2;
  viewY = centerY - MAP_HEIGHT / zoom / 2;
  updateView();
}

function setPan(active) {
  panDrag = null;
  map.classList.toggle("map-panning", active);
  mobilePan.setAttribute("aria-pressed", String(active));
}

function closeFileDrawer(restoreFocus = false) {
  fileDrawerPanel.hidden = true;
  fileDrawerButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) fileDrawerButton.focus();
}

mobileAdd.addEventListener("click", () => {
  closeFileDrawer();
  desktopOptions.hidden = true;
  desktopOptionsButton.setAttribute("aria-expanded", "false");
  mobileTools.hidden = !mobileTools.hidden;
  mobileAdd.setAttribute("aria-expanded", String(!mobileTools.hidden));
});
desktopOptionsButton.addEventListener("click", () => {
  closeFileDrawer();
  mobileTools.hidden = true;
  mobileAdd.setAttribute("aria-expanded", "false");
  desktopOptions.hidden = !desktopOptions.hidden;
  desktopOptionsButton.setAttribute("aria-expanded", String(!desktopOptions.hidden));
});
fileDrawerButton.addEventListener("click", () => {
  mobileTools.hidden = true;
  mobileAdd.setAttribute("aria-expanded", "false");
  desktopOptions.hidden = true;
  desktopOptionsButton.setAttribute("aria-expanded", "false");
  fileDrawerPanel.hidden = !fileDrawerPanel.hidden;
  fileDrawerButton.setAttribute("aria-expanded", String(!fileDrawerPanel.hidden));
  if (!fileDrawerPanel.hidden) fileDrawerClose.focus();
});
fileDrawerClose.addEventListener("click", () => closeFileDrawer(true));
fileDrawerPanel.addEventListener("click", event => {
  if (event.target.closest("#save-map, #load-map, #export-png")) closeFileDrawer();
});
document.addEventListener("pointerdown", event => {
  if (fileDrawerPanel.hidden || fileDrawerPanel.contains(event.target) || fileDrawerButton.contains(event.target)) return;
  closeFileDrawer();
  if (map.contains(event.target)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || fileDrawerPanel.hidden) return;
  closeFileDrawer(true);
});
mobileTools.querySelectorAll("[data-tool]").forEach(button => button.addEventListener("click", () => {
  setPan(false);
  mobileTools.hidden = true;
  mobileAdd.setAttribute("aria-expanded", "false");
  map.scrollIntoView({ block: "nearest", behavior: "smooth" });
}));
zoomIn.addEventListener("click", () => setZoom(zoom * 2));
zoomOut.addEventListener("click", () => setZoom(zoom / 2));
zoomReset.addEventListener("click", () => setZoom(1));
mobilePan.addEventListener("click", () => {
  const active = mobilePan.getAttribute("aria-pressed") !== "true";
  if (active) setTool(null);
  setPan(active);
  status.textContent = active ? "Arrastra el mapa para desplazarte; pulsa Mover mapa para volver a editar." :
    "Desplazamiento del mapa desactivado.";
});
map.addEventListener("pointerdown", event => {
  if (mobilePan.getAttribute("aria-pressed") !== "true" || event.button !== 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  panDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewX, viewY };
  map.setPointerCapture(event.pointerId);
}, true);
map.addEventListener("pointermove", event => {
  if (!panDrag || event.pointerId !== panDrag.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const bounds = map.getBoundingClientRect();
  viewX = panDrag.viewX - (event.clientX - panDrag.x) * (MAP_WIDTH / zoom) / bounds.width;
  viewY = panDrag.viewY - (event.clientY - panDrag.y) * (MAP_HEIGHT / zoom) / bounds.height;
  updateView();
}, true);
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  map.addEventListener(type, event => {
    if (!panDrag || event.pointerId !== panDrag.pointerId) return;
    event.stopImmediatePropagation();
    panDrag = null;
  }, true);
}
mobileScreen.addEventListener("change", () => {
  desktopOptions.hidden = true;
  desktopOptionsButton.setAttribute("aria-expanded", "false");
  if (!mobileScreen.matches) {
    zoom = 1;
    viewX = 0;
    viewY = 0;
    setPan(false);
    mobileTools.hidden = true;
    mobileAdd.setAttribute("aria-expanded", "false");
    render();
  }
  updateView();
});
window.addEventListener("resize", () => {
  updateMobileTargets();
  updateSelectionDelete();
});
updateView();
