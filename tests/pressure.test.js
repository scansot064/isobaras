document.getElementById("app").addEventListener("load", () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const makeCenter = (type, x, strength = "medium") => ({
      type,
      x,
      y: 350,
      strength,
      layer: "surface",
      shape: {
        east: 1,
        west: 1,
        north: 1,
        south: 1
      }
    });
    const high = makeCenter("high", 480);
    const low = makeCenter("low", 720);
    const sources = app.pressureSources([high, low]);
    check(app.pressureAt(480, 350, sources) > 1013, "El anticiclón debe elevar la presión.");
    check(app.pressureAt(720, 350, sources) < 1013, "La borrasca debe reducir la presión.");
    for (const type of ["high", "low"]) {
      const center = makeCenter(type, 600, "strong");
      const baseline = app.pressureAt(600, 350, app.pressureSources([center]));
      center.intensityBoost = 20;
      const adjusted = app.pressureAt(600, 350, app.pressureSources([center]));
      check(adjusted === baseline + (type === "high" ? 20 : -20),
        "La potencia adicional debe elevar el anticiclón o profundizar la borrasca en la cantidad indicada.");
      check(app.heightSources([{ ...center, layer: "upper" }])[0].amplitude ===
        app.heightSources([{ ...center, intensityBoost: 0, layer: "upper" }])[0].amplitude,
        "La potencia adicional de superficie no debe afectar al campo de altura.");
    }
    const deepLow = { ...makeCenter("low", 600, "strong"), intensityBoost: 24 };
    const deepSources = app.pressureSources([deepLow]);
    check(app.pressureAt(600, 350, deepSources) <= 970 &&
      app.pressureContours(app.pressureGrid(deepSources)).has(968),
      "Una borrasca intensa ajustada debe poder alcanzar menos de 970 hPa y dibujar la isobara de 968.");
    check(app.pressureAt(600, 350, sources) !== app.pressureAt(600, 350, app.pressureSources([high])),
      "Ambos centros deben contribuir al mismo campo.");
    const initial = app.pressureAt(580, 350, app.pressureSources([high]));
    high.shape.east = 2;
    check(app.pressureAt(580, 350, app.pressureSources([high])) > initial,
      "La deformación debe modificar la influencia del centro.");
    const contours = app.pressureContours(app.pressureGrid(app.pressureSources([high, low]), 36, 21));
    check(contours.size > 1, "Deben generarse varios niveles de isobaras.");

    function cross(a, b, c) {
      return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    function checkContoursDoNotCross(contours, message) {
      const lines = [...contours].flatMap(([, segments]) => segments);
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const [a, b] = lines[i];
          const [c, d] = lines[j];
          const opposite = (x, y) => (x > 1e-8 && y < -1e-8) || (x < -1e-8 && y > 1e-8);
          const intersects = opposite(cross(a, b, c), cross(a, b, d)) && opposite(cross(c, d, a), cross(c, d, b));
          check(!intersects, message);
        }
      }
    }
    checkContoursDoNotCross(contours, "Las isobaras no deben cruzarse.");
    const saddle = app.pressureContours({
      values: new Float64Array([1000, 1010, 1010, 1000]),
      columns: 1,
      rows: 1
    });
    check(saddle.has(1004) && saddle.has(1008), "Las celdas de tipo silla deben producir ambos niveles.");
    const surfaceCenter = app.renderObject(high, true);
    check(surfaceCenter.querySelectorAll(".contour").length === 0,
      "Los centros de superficie no deben dibujar isobaras independientes.");
    app.drawPressureField([high, low], "surface");
    check(app.document.querySelectorAll(".pressure-contour").length > 0, "El campo de superficie debe dibujarse.");
    const isolatedHigh = makeCenter("high", 420);
    isolatedHigh.y = 385;
    app.updateWindSources([isolatedHigh], "surface");
    const eastHigh = app.document.querySelector('.pressure-wind[transform^="translate(540 385)"]');
    check(eastHigh && eastHigh.getAttribute("transform").includes("rotate(90)"),
      "Al este de un anticiclón el viento debe dirigirse hacia el sur.");
    const highSources = app.pressureSources([isolatedHigh]);
    let position = [540, 385];
    const initialPressure = app.pressureAt(...position, highSources);
    for (let i = 0; i < 1000; i++) position = app.advanceWindPosition(...position, highSources, .025);
    check(position[0] < 420, "La flecha debe continuar girando alrededor del anticiclón, no volver al inicio.");
    check(Math.abs(app.pressureAt(...position, highSources) - initialPressure) < .05,
      "La trayectoria debe seguir la isobara.");
    app.drawPressureField([isolatedHigh], "surface");
    app.updateWindSources([isolatedHigh], "surface");
    check(app.document.querySelector('.pressure-wind[transform^="translate(540 385)"]') === eastHigh,
      "Redibujar las isobaras no debe reiniciar las flechas.");
    const isolatedLow = makeCenter("low", 420);
    isolatedLow.y = 385;
    app.updateWindSources([isolatedLow], "surface");
    const eastLow = app.document.querySelector('.pressure-wind[transform^="translate(540 385)"]');
    check(eastLow && eastLow.getAttribute("transform").includes("rotate(-90)"),
      "Al este de una borrasca el viento debe dirigirse hacia el norte.");
    const upperHigh = {
      ...makeCenter("high", 480, "strong"),
      layer: "upper"
    };
    const upperLow = {
      ...makeCenter("low", 720, "strong"),
      layer: "upper"
    };
    const upperSources = app.heightSources([upperHigh, upperLow, high]);
    check(upperSources.length === 2, "El campo de altura debe usar únicamente sus propios centros.");
    const weakHeight = app.heightSources([{
      ...upperHigh,
      strength: "weak"
    }]);
    check(app.heightAt(480, 350, app.heightSources([upperHigh])) > app.heightAt(480, 350, weakHeight),
      "La intensidad debe modificar la influencia del centro de altura.");
    check(app.heightAt(480, 350, upperSources) > app.heightAt(480, 350, app.heightSources([upperLow])),
      "El anticiclón debe elevar el geopotencial.");
    check(app.heightAt(720, 350, upperSources) < app.heightAt(720, 350, app.heightSources([upperHigh])),
      "La borrasca debe reducir el geopotencial.");
    const heights = app.pressureContours(app.pressureGrid(upperSources, 36, 21, app.heightAt, 60));
    check(heights.size > 1 && [...heights.keys()].every(level => level % 60 === 0),
      "El geopotencial debe representarse con niveles de 60 metros.");
    checkContoursDoNotCross(heights, "Las curvas de altura no deben cruzarse.");
    app.drawPressureField([upperHigh, upperLow, high], "upper");
    check(app.document.querySelectorAll(".height-contour").length > 0,
      "El campo conjunto de altura debe dibujarse.");
    app.updateWindSources([upperHigh, upperLow, high], "upper");
    check(app.document.getElementById("wind-layer").style.display !== "none",
      "Las flechas deben aparecer en altura.");
    const upperArrow = app.document.querySelector(".pressure-wind");
    app.drawPressureField([upperHigh], "upper");
    app.updateWindSources([upperHigh], "upper");
    check(app.document.querySelector(".pressure-wind") === upperArrow,
      "Redibujar la altura no debe reiniciar las flechas.");
    const highWind = app.heightWind(580, 350, app.heightSources([upperHigh]));
    const lowAtHigh = {
      ...upperHigh,
      type: "low"
    };
    const lowWind = app.heightWind(580, 350, app.heightSources([lowAtHigh]));
    check(highWind[1] > 0 && lowWind[1] < 0,
      "Las flechas deben reflejar la circulación de ambos tipos de centro en altura.");
    const upperPosition = app.advanceWindPosition(580, 350, app.heightSources([upperHigh]), 1, "upper");
    check(Math.hypot(upperPosition[0] - 580, upperPosition[1] - 350) > 1,
      "El viento de altura debe mover las flechas.");
    const backgroundJet = app.automaticJet([]);
    const northJet = app.automaticJet(app.heightSources([{
      ...upperLow,
      x: 600,
      y: 180
    }]));
    const southJet = app.automaticJet(app.heightSources([{
      ...upperLow,
      x: 600,
      y: 400
    }]));
    check(backgroundJet && backgroundJet.points.length > 4 && backgroundJet.points.every(([x, y]) => x >= 0 && x <=
      1200 && y >= 0 && y <= 700), "El chorro automático debe recorrer el mapa.");
    check(northJet && backgroundJet.type === "jet-weak" && northJet.type === "jet-strong",
      "El grosor del chorro debe responder a la intensidad del viento de altura.");
    const nearCenter = jet => jet.points.reduce((best, point) => Math.abs(point[0] - 600) < Math.abs(best[0] -
      600) ? point : best);
    check(northJet && southJet && nearCenter(southJet)[1] > nearCenter(northJet)[1] + 100,
      "La latitud del chorro debe responder a la posición del centro de altura.");
    const southSources = app.heightSources([{
      ...upperLow,
      x: 600,
      y: 400
    }]);
    const jetLevels = southJet.points.map(point => app.heightAt(...point, southSources));
    check(Math.max(...jetLevels) - Math.min(...jetLevels) < 15,
      "El chorro automático debe seguir aproximadamente el viento del campo de altura.");
    const alteredShape = {
      ...upperHigh,
      shape: {
        ...upperHigh.shape,
        east: 2
      }
    };
    check(JSON.stringify(app.automaticJet(app.heightSources([upperHigh])).points) !== JSON.stringify(app
        .automaticJet(app.heightSources([alteredShape])).points),
      "Deformar un centro de altura debe modificar el chorro.");
    const manualJet = {
      x: 0,
      y: 0,
      referenceHeight: 5640,
      points: [
        [0, 200],
        [300, 200],
        [600, 350],
        [900, 200],
        [1200, 200]
      ]
    };
    for (const x of [150, 450, 600, 750, 1050]) {
      const y = app.jetYAt(manualJet, x);
      check(Math.abs(app.heightAt(x, y, upperSources, manualJet) - manualJet.referenceHeight) < 1e-8,
        "El chorro manual debe seguir una curva del campo de altura.");
      const wind = app.heightWind(x, y, upperSources, manualJet);
      const slope = (app.jetYAt(manualJet, x + 1) - app.jetYAt(manualJet, x - 1)) / 2;
      check(Math.abs(wind[1] - wind[0] * slope) < .1,
      "El viento de altura debe seguir la forma del chorro manual.");
    }
    const editedHeights = app.pressureContours(app.pressureGrid(upperSources, 36, 21, (x, y, sources) => app
      .heightAt(x, y, sources, manualJet), 60));
    checkContoursDoNotCross(editedHeights, "Las curvas de altura deformadas no deben cruzarse.");
    const movedSources = app.heightSources([{
      ...upperHigh,
      x: 550
    }, upperLow]);
    check(Math.abs(app.heightAt(600, app.jetYAt(manualJet, 600), movedSources, manualJet) - manualJet
      .referenceHeight) < 1e-8, "Cambiar los centros debe conservar el chorro manual en el campo.");

    const windState = app.eval("windState");
    const particle = windState.particles[0];
    particle.x = 450;
    particle.y = 350;
    app.updateWindSources([upperHigh, upperLow], "upper", manualJet);
    app.stopWind();
    const previousVelocity = particle.velocity;
    manualJet.points[2][1] += 100;
    const expectedPosition = app.advanceWindPosition(particle.x, particle.y, windState.sources, .025, "upper",
      manualJet);
    const stalePosition = app.advanceWindPosition(particle.x, particle.y, windState.sources, .025, "upper", manualJet,
      previousVelocity);
    check(Math.hypot(expectedPosition[0] - stalePosition[0], expectedPosition[1] - stalePosition[1]) > 1e-6,
      "La prueba debe modificar el viento después de calcular la velocidad.");
    windState.lastFrame = 1000;
    const hiddenProperty = Object.getOwnPropertyDescriptor(app.document, "hidden");
    Object.defineProperty(app.document, "hidden", { configurable: true, value: false });
    try {
      app.windTick(1010);
    } finally {
      if (hiddenProperty) Object.defineProperty(app.document, "hidden", hiddenProperty);
      else delete app.document.hidden;
    }
    app.stopWind();
    check(Math.hypot(particle.x - expectedPosition[0], particle.y - expectedPosition[1]) < 1e-8,
      "Al editar el chorro manual, las flechas deben usar el viento actualizado.");

    particle.x = upperHigh.x;
    particle.y = upperHigh.y;
    particle.opacity = 0;
    app.renderWindParticle(particle, 0);
    particle.x += 1;
    app.renderWindParticle(particle, 0);
    check(particle.element.style.opacity === "0" &&
      particle.element.getAttribute("transform").startsWith(`translate(${particle.x} ${particle.y})`),
      "Las flechas ocultas deben mantener actualizada su posición.");

    app.drawPressureField([], "surface");
    app.updateWindSources([], "surface");
    check(app.document.querySelectorAll(".pressure-contour").length === 0, "Sin centros no debe haber isobaras.");
    check(app.document.querySelectorAll(".pressure-wind").length === 0, "Sin centros no debe haber flechas.");
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
