# Corrección móvil — 2026-10-18

Se reprodujeron desbordamientos con nombres largos y cantidades cercanas al máximo de almacenamiento, no sólo con vistas vacías. Causas: tamaño intrínseco de flex/grid, filas monetarias nowrap, ancho máximo de contenido de tarjetas con align-items:start, campos de moneda estrechos, encabezados largos de modal y tablas recortadas.

Corregido: min-width0 en primitivas y descendientes flex/grid, títulos e importes multilínea, apilado móvil de resúmenes/fechas/moneda-monto, paneles de cuentas compartidas alineados al ancho disponible, tablas con scroll horizontal local (sin recortar columnas), leyendas de gráficos con espacio reservado y scroll local, labels eje acotados con tooltip completo, modales con max-height100dvh y cuerpo desplazable. Keypad calculadora conserva cuatro columnas. Sin cambios de reglas financieras, API ni migraciones.

## Evidencia

- Matriz Playwright con API simulada:13 rutas ×4 anchos320/375/390/768 =52 comprobaciones, cero elementos desbordados fuera de contenedores auto/scroll. Incluye dashboard, transacciones, cuentas, categorías, vínculos, perfil, calculadora, inversiones, tablero inversiones, reportes, análisis, compartido y socio.
- Acceso/registro/recuperación ×4 anchos =12 comprobaciones sin overflow.
- Modales a320px: transacción,exportación,cuenta,compraUSD con título largo,transferencia,inversión: sin overflow; rango dashboard también verificado. Tema oscuro cuenta y títulos compartidos largos verificados.
- npm run build frontend:PASS1004módulos. npm test backend:66PASS.
- Capturas locales: .superpowers/mobile-shared-fixed.png y mobile-transaction-fixed.png (datos ficticios).

Límites: navegación visual y mediciones en Chromium simulado; no equivalen a pruebas físicas exhaustivas en todos los dispositivos/Safari ni a lector de pantalla. Las tablas anchas se desplazan dentro de su contenedor; los nombres completos están disponibles en sus detalles. La comprobación inicial anterior no había cubierto todos estos estados de datos y modales.
