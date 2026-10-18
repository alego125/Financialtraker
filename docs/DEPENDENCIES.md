# Dependencias: revisión 2026-10-18

Consulta real a npm audit sobre los locks actuales:

| Árbol | Resultado |
|---|---|
| Backend completo | 0 vulnerabilidades |
| Backend producción (`--omit=dev`) | 0 vulnerabilidades |
| Frontend producción (`--omit=dev`) | 0 vulnerabilidades |
| Frontend completo | 7: 5 altas, 2 moderadas, 0 críticas |

Se actualizaron dependencias compatibles, jsPDF/AutoTable, React Router y Vite. Se eliminó xlsx sin parche y se exporta CSV con protección contra fórmulas. Node --watch reemplaza nodemon. El override de qs ^6.16.0 evita el rango antiguo fijado por Express; las pruebas HTTP deben mantenerse al actualizar Express.

## Pendiente acotado al tooling CSS

Tailwind 3 conserva braces (GHSA-vfj7-8cjw-p6xm), alcanzable a través de chokidar/micromatch/fast-glob, y postcss-selector-parser <7.1.6 a través de postcss-nested. npm audit los agrupa en 5 paquetes con severidad alta y 2 moderada. No existe un parche compatible de braces en el árbol actual; el arreglo sugerido requiere migrar a Tailwind 4 y validar cambios visuales y de configuración. No se aplicó una migración global de estilos a ciegas.

Mitigación aplicada: el build sólo consume rutas fijas del repositorio (`index.html`, `src/**/*.{js,jsx}`), sin una función de carga de CSS/configuración proporcionados por usuarios. El servidor Vite se enlaza a loopback explícitamente; no usar `--host` público. El artefacto desplegado es dist estático, sin Tailwind, watchers ni tooling Node. CI falla ante avisos altos en dependencias de producción; esta excepción de build no equivale a una auditoría completa limpia. No ejecutar builds de contribuciones desconocidas con secretos ni acceso a infraestructura sensible.

Revisión pendiente: migrar Tailwind en un cambio independiente con comparación visual, o revisar nuevamente advisories/parches antes del próximo despliegue.
