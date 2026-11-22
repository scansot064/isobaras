# Generador interactivo de mapas de isobaras

Editor didáctico de mapas meteorológicos para el Atlántico norte y Europa occidental. Abre `index.html` en un navegador moderno; funciona sin conexión y no necesita instalar dependencias.

## Uso

- Edita el **título**, el **día y mes** y, si lo deseas, el **año** en la banda superior del mapa. En móvil, pulsa el resumen de fecha y título para abrir el panel de edición; se cierra con su botón, Escape o pulsando fuera. El año es opcional y no modifica la fecha seleccionada ni la simulación. El título se comparte entre ambos planos.
- Elige **Superficie** o **Altura · 500 hPa**. Cada plano mantiene sus propios elementos mientras la página esté abierta.
- Elige **Anticiclón** o **Borrasca** con la intensidad deseada y después haz clic en el mapa. En superficie, todos los centros contribuyen a un mismo campo de presión y sus isobaras en hPa se recalculan conjuntamente desde el primer centro. En altura, los centros modifican conjuntamente un campo de geopotencial, con curvas discontinuas en metros y flechas de viento.
- Usa **Copiar a altura** o **Copiar a superficie** para copiar los centros del plano activo al otro, conservando su posición, intensidad y deformación. Los centros existentes en el destino se sustituyen tras una confirmación; los frentes y el chorro se conservan. Las copias se pueden editar independientemente.
- Añade frentes en superficie desde sus botones. Arrastra los elementos para moverlos. Selecciona un elemento y pulsa la papelera que aparece junto a él para eliminarlo; también puedes seleccionarlo con el teclado y moverlo con las flechas o borrarlo con Supr.
- Selecciona un anticiclón o una borrasca en superficie y usa los botones junto al centro para ajustar su potencia adicional en pasos de 4 hPa, entre 0 y 48 hPa. El botón opuesto a la papelera aumenta la potencia (**+** en anticiclones y **−** en borrascas); el otro la reduce. La presión resultante también depende de los demás centros. El ajuste se guarda y se conserva al copiar centros entre planos, aunque solo afecta al campo de superficie.
- Los frentes muestran bandas de posible precipitación, que se pueden ocultar con el interruptor de **Capas**. La banda acompaña al frente al moverlo, curvarlo, girarlo o cambiar su longitud: es amplia por delante del cálido, estrecha cerca del frío y se extiende a ambos lados del ocluido.
- Selecciona un centro y arrastra cualquiera de los cuatro tiradores para estirar su influencia hacia ese lado. En superficie las isobaras resultantes dependen de todos los centros. En un frente, arrastra el punto central para curvarlo, el tirador superior para girarlo o los extremos para cambiar su longitud y orientación. Al colocar o soltar un frente o su extremo cerca del extremo de otro, se unen automáticamente; puedes separarlos arrastrándolos de nuevo. Los tiradores también se pueden enfocar con Tab y manejar con las flechas.
- En altura, el chorro **Automático** se recalcula al mover, añadir, eliminar o deformar centros de altura. Al elegir **Manual**, el chorro existente se mantiene y aparecen tiradores para deformarlo verticalmente; también puedes arrastrar el trazado completo. Las curvas y las flechas de altura se adaptan. Al modificar centros se conserva el trazado manual; al alternar modos se oculta o recupera sin perderse. Si no se encuentra un trazado automático para empezar a editar, ajusta los centros de altura.
- En superficie, la fecha establece la distribución inicial de aire frío y cálido; los centros desplazan los colores siguiendo el viento. Cambiar de fecha reinicia esa distribución y eliminar el último centro la restablece. El interruptor y la capa de altura ocultan y pausan la simulación. **Limpiar capa**, en **Capas**, elimina únicamente los elementos del plano activo.
- Con el icono de disquete de la cabecera abre **Archivo**. Usa **Guardar mapa** para descargar un JSON editable que conserva el título, el día, el mes y el año opcional, ambos planos, los centros y frentes con sus deformaciones y la potencia adicional de los centros, el chorro manual, las opciones visibles y la distribución actual del aire. **Cargar mapa** recupera ese archivo y, tras confirmarlo, sustituye ambos planos del mapa abierto. También admite los mapas guardados con formatos anteriores. La simulación de aire continuará desde la distribución guardada. El panel se cierra al elegir una acción, pulsar fuera o usar su botón de cierre.
- El icono de información, junto al disquete, abre una guía sobre isobaras, centros de acción, frentes, mapas de superficie y altura y corriente en chorro. Sus enlaces a Wikipedia se abren en otra pestaña y requieren conexión. La guía se cierra con su botón, Escape o pulsando fuera.
- Usa **Descargar PNG** para guardar el mapa del plano visible, con su fecha, título completo, capas mostradas y pie de atribución, sin las indicaciones ni la barra inferior de información interactiva. En móvil, el título largo se ajusta en varias líneas en la imagen aunque el resumen se muestre abreviado.
- La barra flotante **Añadir** reúne los planos, centros y frentes, y **Capas** permite controlar las masas de aire, la precipitación o el chorro y copiar centros entre planos.
- Usa **+** y **−** para ampliar o alejar el mapa; si hay un elemento seleccionado, el zoom se centra en él. Con **Mover mapa** activado, arrastra para recorrer la zona ampliada y vuelve a pulsarlo para editar. En teléfonos, fuera de ese modo, arrastrar una zona libre permite desplazar la página; los elementos y tiradores se arrastran directamente. **100%** vuelve a mostrar todo el mapa. El zoom no modifica el mapa guardado ni el PNG.
- El botón de café de la barra inferior abre **Buy me a coffee** en otra pestaña y requiere conexión a Internet.

Sin guardar un archivo JSON, los cambios se conservan solo mientras la página esté abierta: al recargarla se pierden. Los JSON incluyen un identificador de formato y una versión para detectar archivos incompatibles.

## Alcance meteorológico

Es un esquema para aprender, no un pronóstico ni un análisis meteorológico real. La temperatura inicial es un gradiente idealizado por latitud y estación, con una zona relativamente más fresca en torno a Terranova y el Atlántico occidental: el aire frío se extiende más al sur en invierno y se concentra al norte en verano, con transiciones progresivas. El viento de los centros de superficie transporta ese campo en una malla mediante una aproximación de advección; entra aire estacional por los bordes. El tiempo está acelerado y los colores no representan temperaturas medidas. Las bandas de precipitación son esquemáticas: no indican una probabilidad calculada ni lluvia garantizada. No se modelan las masas reales, la fricción, la radiación, la humedad ni el efecto de los frentes o del chorro de altura sobre la temperatura.

En superficie se suman influencias idealizadas a una presión de referencia de 1013 hPa y se trazan isobaras cada 4 hPa sobre un campo interpolado. Las flechas siguen trayectorias del mismo viento esquemático que desplaza los colores: una aproximación geostrófica del hemisferio norte, paralela a las isobaras, sin fricción ni velocidades reales. Las letras indican las posiciones de las influencias introducidas, que al interactuar no siempre coinciden con máximos o mínimos del campo resultante.

En altura se suman las influencias a un gradiente latitudinal idealizado, incluso sin centros, y se trazan curvas cada 60 metros. Las flechas siguen el viento aproximado de ese campo. El chorro automático selecciona una trayectoria orientativa de viento del oeste relativamente intenso; sus ondulaciones e intensidad dependen del campo de 500 hPa, no del mapa de superficie. El modo manual ajusta el campo para que el trazado editado siga aproximadamente una curva de altura, conservando las influencias de los centros. Es una representación didáctica: la corriente real suele analizarse a niveles más altos y no se calcula como un pronóstico.

## Cartografía

Las tierras proceden de [Natural Earth, escala 1:110m](https://www.naturalearthdata.com/), datos de dominio público. El mapa usa una proyección cónica equivalente de Albers, centrada cerca de la península ibérica (7°O, 44°N; paralelos estándar 35°N y 65°N).

## Organización del código

- `index.html` y `style.css`: estructura y presentación de la interfaz.
- `map.js`: proyección, cartografía y cuadrícula; `assets/land.js` contiene datos geográficos compactos de Natural Earth.
- `symbols.js`: representación y geometría de centros, frentes y chorro.
- `pressure.js`: campos de presión y altura, curvas y cálculo del viento.
- `air.js`, `wind.js` y `jet.js`: simulación de masas de aire, animación de flechas y chorro automático.
- `app.js`: estado, herramientas e interacción con el mapa; `mobile.js`: barra flotante, zoom y herramientas táctiles; `export.js`: descarga del recuadro en PNG; `save.js`: guardado y carga de mapas JSON.
- `tests/`: pruebas ejecutables en el navegador.

Los archivos JavaScript se cargan en el orden indicado en `index.html` y comparten funciones globales; no requieren compilación.

## Pruebas

Abre `tests/transform.html`, `tests/pressure.html`, `tests/controls.html`, `tests/projection.html`, `tests/air.html`, `tests/export.html`, `tests/save.html`, `tests/mobile.html` y `tests/desktop.html` en el navegador y comprueba que muestran `PASS`.

## Licencia

El proyecto se distribuye bajo [Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.es). Para la atribución, indica «Generador interactivo de mapas de isobaras, scansot064 y colaboradores», enlaza al repositorio y a la licencia e indica los cambios realizados. Los datos de Natural Earth mencionados arriba son de dominio público y no quedan sujetos a esta licencia.
