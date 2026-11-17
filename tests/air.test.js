document.getElementById("app").addEventListener("load", () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const winter = app.seasonalBoundary("2026-01-15");
    const spring = app.seasonalBoundary("2026-04-15");
    const summer = app.seasonalBoundary("2026-07-15");
    const autumn = app.seasonalBoundary("2026-10-15");
    check(winter < spring && spring < summer && winter < autumn && autumn < summer,
      "La extensión del aire frío debe variar gradualmente entre estaciones.");
    check(app.seasonalAirTemperature(60, winter) < .3 && app.seasonalAirTemperature(60, summer) > .65,
      "El aire frío debe llegar más al sur en invierno que en verano.");
    check(app.seasonalAirTemperature(78, summer) < .23,
      "En verano debe seguir habiendo aire frío en latitudes altas.");

    const newfoundland = app.project(-50, 45);
    const easternAtlantic = app.project(-10, 45);
    for (const boundary of [winter, spring, summer, autumn]) {
      const west = app.backgroundAirAt(...newfoundland, boundary);
      const east = app.backgroundAirAt(...easternAtlantic, boundary);
      check(west < east - .1,
        "Terranova debe ser más fresca que el este del Atlántico a la misma latitud durante todo el año.");
    }
    const winterWest = app.backgroundAirAt(...newfoundland, winter);
    const summerWest = app.backgroundAirAt(...newfoundland, summer);
    check(winterWest > .3 && winterWest < .5, "El aire templado y fresco debe alcanzar Terranova en invierno.");
    check(summerWest > .7 && summerWest < .9,
      "En verano Terranova debe calentarse sin alcanzar el extremo tropical.");
    check(app.backgroundAirAt(...app.project(-50, 75), summer) < .2,
      "El aire polar debe permanecer en latitudes altas en verano.");

    const initial = app.initialAirField(winter);
    const still = new Float32Array(initial.length);
    const stationary = app.advanceAirField(initial, still, still, winter);
    check(stationary.every((value, i) => Math.abs(value - initial[i]) < 1e-6),
      "Sin viento no debe desplazarse el aire.");
    const gradient = new Float32Array(initial.length);
    const southward = new Float32Array(initial.length).fill(20);
    for (let i = 0; i < gradient.length; i++) gradient[i] = Math.floor(i / 120) / 70;
    const advected = app.advanceAirField(gradient, still, southward, winter);
    const sample = 35 * 120 + 60;
    check(advected[sample] < gradient[sample],
      "El viento hacia el sur debe transportar aire más frío desde el norte.");

    const high = {
      type: "high",
      layer: "surface",
      strength: "strong",
      x: 550,
      y: 240,
      shape: {
        east: 1,
        west: 1,
        north: 1,
        south: 1
      }
    };
    const sources = app.pressureSources([high]);
    const velocity = app.airVelocityGrid(sources);
    const wind = app.pressureWind(650, 240, sources);
    check(wind[1] > 0, "Al este de un anticiclón el viento debe llevar aire hacia el sur.");
    let moving = initial;
    for (let i = 0; i < 10; i++) moving = app.advanceAirField(moving, velocity.velocityX, velocity.velocityY,
      winter);
    check(moving.some((value, i) => Math.abs(value - initial[i]) > .02),
      "Un centro de acción debe desplazar el campo de temperatura.");
    const low = {
      ...high,
      type: "low",
      x: 700,
      y: 240
    };
    const combined = app.airVelocityGrid(app.pressureSources([high, low]));
    check(combined.velocityY.some((value, i) => Math.abs(value - velocity.velocityY[i]) > 1),
      "El transporte debe combinar el viento de todos los centros.");

    const overlay = app.document.getElementById("air-overlay");
    app.configureAir("2026-01-15", true);
    const opacity = Number(overlay.getAttribute("opacity"));
    check(opacity > 0 && opacity < .45, "Las masas de aire deben seguir visibles, pero ser más transparentes.");
    check(app.getComputedStyle(app.document.querySelector("#geography .land")).fill === "rgb(255, 255, 255)",
      "La base de los continentes debe ser blanca.");
    const initialImage = overlay.getAttribute("href");
    app.configureAir("2026-07-15", true);
    check(overlay.getAttribute("href") !== initialImage, "Cambiar la fecha debe reiniciar el mapa estacional.");
    app.configureAir("2026-01-15", true);
    app.updateAirSources([high]);
    app.updateAirSources([]);
    check(overlay.getAttribute("href") === initialImage,
      "Al retirar el último centro debe restablecerse el mapa estacional.");
    app.configureAir("2026-01-15", false);
    check(overlay.getAttribute("opacity") === "0", "La simulación debe poder ocultarse.");
    app.configureAir("2026-01-15", true);
    check(Number(overlay.getAttribute("opacity")) === opacity,
      "Al volver a activarla debe recuperarse la transparencia.");
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
