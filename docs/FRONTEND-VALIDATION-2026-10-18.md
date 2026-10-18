# Frontend: solicitudes y exportaciones

- Dashboard, movimientos, socio y dashboard compartido conservan la identidad de la solicitud al cambiar filtros. Respuestas, errores y finalizadores obsoletos no reemplazan resultados vigentes.
- Inversiones y listados de cuentas/transferencias cancelan solicitudes anteriores y muestran errores de carga. Las categorías del socio se cancelan al cambiar de fuente.
- Los reportes conjuntos recuperan todas las páginas verificadas de movimientos y transferencias; no generan un archivo parcial ante un fallo, duplicados o cambios en el total. El reporte se construye desde un efecto cancelable.
- PDF, CSV y texto mantienen los importes ARS y USD separados. Los CSV incluyen moneda y protegen las celdas de texto que comienzan con fórmulas. La descarga que antes era XLSX ahora usa CSV UTF-8 compatible con Excel; las filas de resumen identifican indicador, moneda y valor.
- Los paneles de exportación y el detalle de cuenta utilizan Modal, que administra foco, Escape, Tab, bloqueo de scroll y modales anidados.
- Cerrar sesión espera la respuesta del servidor; si falla conserva la pantalla y muestra un error. Registro valida 10 caracteres y el límite UTF-8 de 72 bytes.

## Verificación

`node --test backend/test/frontend-remaining.test.cjs`: 8 pruebas, 8 correctas (paginación completa, detección de datos incompletos/duplicados/cambiantes, abortos, identidad de solicitud, monedas y CSV).

`npm run build` desde frontend: compilación de producción Vite 7 correcta en las ejecuciones verificadas; sin avisos de chunks superiores a 500 kB en el build final. La compilación comprueba transformación y empaquetado, no sustituye pruebas manuales de navegación, foco y respuestas de red lentas.

## Límites

La paginación comprueba metadatos, duplicados y cantidad final; no representa una instantánea transaccional si se editan importes conservando el mismo total de filas. La verificación de navegador se limita a los recorridos descritos al final; no se probó lector de pantalla. Las cargas auxiliares de filtros al montar algunas páginas conservan mensajes de error, pero no tienen un estado de carga independiente para cada selector.

## Verificación navegador final

Playwright contra preview local y respuestas API simuladas: login sin token en localStorage; cuentas a 375 px sin desbordamiento horizontal; modal Nueva Cuenta recibe foco, retiene Shift+Tab, cierra con Escape y restaura foco al botón. Esto verifica esos flujos concretos, no reemplaza pruebas de todos los recorridos con datos reales. Smoke PDF con jsPDF4/AutoTable5 generó un PDF de 4364 bytes.
