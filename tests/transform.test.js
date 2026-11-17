document.getElementById("app").addEventListener("load", () => {
  const result = document.getElementById("result");
  try {
    const app = document.getElementById("app").contentWindow;
    const check = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const center = {
      id: 1,
      type: "high",
      label: "Anticiclón",
      strength: "medium",
      layer: "surface",
      x: 300,
      y: 200,
      shape: {
        east: 1,
        west: 1,
        north: 1,
        south: 1
      }
    };
    const original = app.centerBounds(center, 3);
    app.resizeCenter(center, "east", original.east + 50);
    const stretched = app.centerBounds(center, 3);
    check(stretched.east > original.east && stretched.west === original.west,
      "El lado este debe deformarse sin modificar el oeste.");
    check(stretched.north === original.north && stretched.south === original.south,
      "La deformación horizontal no debe modificar la vertical.");
    app.resizeCenter(center, "north", -10000);
    check(center.shape.north === 3, "La deformación debe respetar el máximo.");
    app.resizeCenter(center, "south", -10000);
    check(center.shape.south === .4, "La deformación debe respetar el mínimo sin invertir las curvas.");
    const node = app.renderObject({
      ...center,
      layer: "upper"
    }, true);
    check(node.querySelectorAll(".contour").length === 0,
      "Los centros de altura deben compartir el campo de curvas.");
    check(node.querySelectorAll("[data-handle]").length === 4,
      "El centro seleccionado debe ofrecer cuatro tiradores.");
    check(app.normalizeAngle(190) === -170 && app.normalizeAngle(-190) === 170,
      "El ángulo debe normalizarse en ambos sentidos.");
    const front = app.renderObject({
      id: 2,
      type: "warm",
      label: "Frente cálido",
      x: 0,
      y: 0,
      rotation: 90
    }, true);
    check(front.querySelector(".front-shape").getAttribute("transform") === "rotate(90)",
      "El frente y sus símbolos deben girar juntos.");
    check(front.querySelector('[data-handle="rotate"]'), "El frente seleccionado debe ofrecer un tirador de giro.");
    check(front.querySelectorAll('[data-handle^="front-"]').length === 3 && front.querySelector(
        '[data-handle="front-bend"]'),
      "El frente seleccionado debe ofrecer dos tiradores para sus extremos y uno para curvarlo.");
    const adjustable = {
      id: 4,
      type: "cold",
      layer: "surface",
      x: 300,
      y: 200,
      rotation: 30,
      length: 250
    };
    const fixed = app.frontEndpoint(adjustable, "start");
    app.resizeFront(adjustable, "end", fixed.x + 80, fixed.y + 60);
    const fixedAfter = app.frontEndpoint(adjustable, "start");
    check(Math.hypot(fixed.x - fixedAfter.x, fixed.y - fixedAfter.y) < 1e-8 && Math.abs(adjustable.length - 100) <
      1e-8, "Ajustar un extremo debe mantener el opuesto fijo y cambiar la longitud.");
    app.resizeFront(adjustable, "end", fixed.x, fixed.y);
    check(adjustable.length === 50 && Number.isFinite(adjustable.rotation),
      "La longitud mínima debe evitar un frente degenerado.");
    app.resizeFront(adjustable, "end", 1200, 700);
    check(adjustable.length === 500, "La longitud máxima debe limitar el frente.");
    adjustable.rotation = 90;
    const startBeforeBend = app.frontEndpoint(adjustable, "start");
    const endBeforeBend = app.frontEndpoint(adjustable, "end");
    const bendPoint = app.frontBendPoint(adjustable);
    app.moveFrontBend(adjustable, bendPoint.x - 60, bendPoint.y);
    check(Math.abs(adjustable.bend - (60 - 11.25)) < 1e-8,
      "La curvatura debe seguir el movimiento perpendicular al frente girado.");
    check(Math.hypot(startBeforeBend.x - app.frontEndpoint(adjustable, "start").x, startBeforeBend.y - app
        .frontEndpoint(adjustable, "start").y) < 1e-8 &&
      Math.hypot(endBeforeBend.x - app.frontEndpoint(adjustable, "end").x, endBeforeBend.y - app.frontEndpoint(
        adjustable, "end").y) < 1e-8, "Curvar un frente debe mantener fijos sus extremos.");
    for (const type of ["jet-strong", "jet-weak"]) {
      const jet = {
        id: 3,
        type,
        label: "Chorro",
        x: 300,
        y: 200,
        points: app.defaultJetPoints(type)
      };
      const path = app.jetPath(jet.points);
      const other = [...jet.points[2]];
      app.moveJetPoint(jet, 1, jet.points[1][0], jet.points[1][1] + 30);
      check(app.jetPath(jet.points) !== path, "Mover un punto debe cambiar la forma del chorro.");
      check(jet.points[2][0] === other[0] && jet.points[2][1] === other[1],
        "Mover un punto no debe desplazar los demás.");
      const node = app.renderObject(jet, true);
      check(node.querySelectorAll("[data-handle]").length === jet.points.length,
        "Cada punto del chorro debe tener un tirador.");
      app.moveJetPoint(jet, jet.points.length - 1, -10000, 10000);
      check(jet.points.at(-1)[0] === -jet.x && jet.points.at(-1)[1] === 700 - jet.y,
        "Los puntos deben quedar dentro del mapa.");
      const rotated = app.renderObject(jet, false).querySelector(".jet-arrow").getAttribute("transform");
      check(rotated !== node.querySelector(".jet-arrow").getAttribute("transform"),
        "La flecha debe seguir el extremo y la dirección del chorro.");
    }
    result.textContent = "PASS";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
    throw error;
  }
});
