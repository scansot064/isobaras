document.getElementById("app").addEventListener("load", () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const center = app.project(-7, 44);
    check(Math.abs(center[0] - 600) < 1e-8 && Math.abs(center[1] - 350) < 1e-8,
      "El centro de la proyección debe coincidir con el centro del mapa.");

    function areaScale(lon, lat) {
      const step = .001;
      const p = app.project(lon, lat);
      const x = app.project(lon + step, lat);
      const y = app.project(lon, lat + step);
      return Math.abs((x[0] - p[0]) * (y[1] - p[1]) - (x[1] - p[1]) * (y[0] - p[0])) / Math.cos(lat * Math.PI /
      180);
    }
    const south = areaScale(-40, 35);
    const north = areaScale(-40, 70);
    check(Math.abs(south / north - 1) < .0001,
      "La escala de superficie debe ser equivalente en Groenlandia y latitudes más bajas.");
    const spain = app.project(-4, 40);
    const iceland = app.project(-20, 65);
    check(Math.abs(spain[0] - 600) < 70 && Math.abs(spain[1] - 350) < 80,
      "España debe estar cerca del centro del mapa.");
    check(iceland[0] >= 0 && iceland[0] <= 1200 && iceland[1] >= 0 && iceland[1] <= 700,
      "Islandia debe estar dentro del mapa.");
    check(app.project(-60, 50)[1] < app.project(-7, 50)[1],
    "Los paralelos deben curvarse en la proyección cónica.");
    const clipped = app.clipRing([
      [-160, 30],
      [-100, 30],
      [-100, 40],
      [-160, 40],
      [-160, 30]
    ]);
    check(clipped.length >= 4 && clipped.every(([lon, lat]) => lon >= -145 && lon <= 100 && lat >= -10 && lat <=
      89), "La cartografía debe recortarse antes de proyectarse.");
    check(app.document.querySelectorAll("#grid path").length > 10, "La cuadrícula proyectada debe aparecer.");
    for (const [lon, lat] of [
        [-60, 35],
        [-20, 65],
        [-4, 40],
        [20, 55]
      ]) {
      const [x, y] = app.project(lon, lat);
      check(Math.abs(app.latitudeAtPoint(x, y) - lat) < 1e-8,
        "La simulación debe recuperar la latitud correcta en toda la proyección.");
      check(Math.abs(app.longitudeAtPoint(x, y) - lon) < 1e-8,
        "La simulación debe recuperar la longitud correcta en toda la proyección.");
    }
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
