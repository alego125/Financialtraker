# Tercera etapa: inversiones y separación por moneda

Objetivo autorizado: corregir precisión y atomicidad de inversiones, KPIs multimoneda y su presentación, incluyendo el informe que aún consultaba posiciones legacy.

- [x] Reproducir cantidades fraccionarias perdidas, monedas mezcladas y cambios de moneda con historial.
- [x] Calcular coste promedio, cantidades, valoración y resultados con Decimal de Prisma; validar escala de entrada (cantidad 6, precio 4).
- [x] Usar financialMutation Serializable para operaciones y catálogo. Sincronizar todos los campos derivados; no ocultar fallos de persistencia.
- [x] Validar el impacto neto de cambiar/eliminar resultados sobre fondos ya utilizados; reparar vínculos ausentes sin apropiarse de movimientos ajenos.
- [x] Unificar KPIs por moneda conservando campos existentes como ARS y añadiendo equivalentes USD. Aplicar los mismos filtros al período anterior.
- [x] Mostrar moneda y cantidades correctas en dashboards/inversiones; conectar PDF al board vigente sin ocultar errores de carga.
- [x] Ejecutar pruebas de regresión e integración PostgreSQL, build frontend y documentar límites.

Decisiones: conservar el método de coste promedio y la regla existente que registra sólo ganancia/pérdida realizada en la cuenta. Las compras/ventas no empezarán a debitar/acreditar su principal en esta etapa. No sumar ARS y USD sin cotización. No ejecutar migraciones ni despliegue en la base real.

## Implementación

- `decimal.js` configura un constructor Decimal local de 48 dígitos, sin modificar globalmente Prisma. `investmentMath.js` conserva cantidades hasta seis decimales y calcula el coste promedio con Decimal; las salidas monetarias redondean a centavos con HALF_UP.
- `investmentLedger.js` recalcula todo el grupo activo/cuenta y sincroniza importe, signo, categoría, moneda, fecha, cuenta y comentario. Recrea movimientos faltantes; rechaza vínculos compartidos con otra operación o una transferencia. Los fallos de persistencia abortan la transacción completa.
- Las operaciones y el catálogo usan el cliente transaccional explícito. La validación de historia y su persistencia comparten identificador, fecha de creación y desempate por id, para un orden determinista.
- `financeReport.js` centraliza los KPIs del dashboard personal y las dos variantes compartidas. Campos existentes como totalIncome/balance representan ARS; totalIncomeUSD/balanceUSD y equivalentes representan USD. Los reembolsos se separan por moneda y no se consideran ingresos ordinarios.
- Las comparaciones usan todos los filtros originales y un período anterior adyacente de igual duración, sin solapamiento. Con un solo límite de fecha se conserva la consulta pero no se inventa una variación.
- La selección de moneda de inversiones afecta totales, distribución y resumen por cuenta; cantidades y precios permiten seis y cuatro decimales respectivamente. Los dashboards personales/compartidos muestran los valores USD además de ARS.
- El informe principal consulta `/investments/board`, conserva las monedas y etiqueta las posiciones como actuales. No transforma fallos de carga en posiciones vacías. El formateo de fechas ya no desplaza las fechas elegidas un día hacia atrás.

## Evidencia de verificación

- 42/42 pruebas unitarias/de controladores y utilidades de frontend: `npm test` en backend.
- 17/17 pruebas de integración: `npm run test:integration` contra `fintrack_integrity_test_v2` en 127.0.0.1:55439. Incluyen ventas simultáneas, exceso de una millonésima, recálculo de compras anteriores, cambio de cuenta, sincronización de fechas con ganancia constante, vínculo faltante, ganancia gastada, validación agregada del borrado histórico y fallo de persistencia provocado mediante trigger temporal. Los triggers se retiran al terminar la prueba.
- Build de producción Vite correcto. Avisos existentes: bundle principal mayor de 500 kB y datos Browserslist antiguos; no se actualizaron dependencias fuera del lockfile.
- Navegador con respuestas API ficticias: inversiones y dashboard de inversiones, selección USD con posición 0,004; dashboard personal y compartido; sin errores de ejecución ni desbordamiento horizontal a 390 px.
- PDF generado por la interfaz con esas respuestas ficticias: dos páginas, tabla de posiciones actuales, ganancias ARS y USD separadas y rango 01/10/26–18/10/26. Texto verificado con pypdf y segunda página renderizada con Poppler e inspeccionada visualmente. El aviso de Poppler sobre la fuente Symbol no impidió el render.

## Límites y trabajo restante

La aritmética de inversiones y KPIs se calcula con Decimal; el saldo general y otras utilidades anteriores aún usan Number. Las respuestas JSON numéricas y la presentación del navegador siguen las limitaciones de precisión de JavaScript en magnitudes extremas. No se hizo conversión entre monedas ni se cambió el tratamiento del principal invertido.

La reparación de vínculos faltantes se realiza al editar el grupo; no se recorrieron ni repararon datos históricos de producción. Se mantienen endpoints legacy por compatibilidad, aunque el informe principal ya no los consulta. La actualización en masa de formatos/exportaciones antiguos, el hardening de autenticación/CORS, los límites de paginación y las carreras de solicitudes del frontend siguen pendientes.

La revisión independiente detectó y permitió corregir dos defectos adicionales: validación parcial de la retirada de una ganancia al borrar una venta histórica (ahora se agrega todo el efecto de los grupos y movimientos eliminados antes de validar) e inputs HTML con paso de dos decimales (ahora 0.0001 para precios unitarios y de referencia). Se reprodujeron ambos: rechazo HTTP400 frente al saldo final válido de0,67 y stepMismatch nativo al introducir1,2345.

La segunda revisión confirmó ambos hallazgos cerrados sin otros problemas importantes en esas correcciones. La última comprobación de navegador aceptó1,2345 sin stepMismatch. Revisión sintáctica: 47 archivos, sin errores. Al terminar se apagaron PostgreSQL temporal y la vista previa Vite de pruebas.

Graphify sigue fallando con `uv trampoline failed to canonicalize script path`; su grafo anterior no refleja estos cambios. No se ejecutaron migraciones de producción ni despliegue. Los archivos de QA permanecen en .test-postgres/ y .playwright-mcp/, ambos ignorados.
