# Rediseño Banca Digital A — 2026-10-18

Diseño elegido por el usuario entre tres mockups, implementado con UI-UX-PRO-MAX y React/Tailwind existentes. No se añadieron dependencias ni se modificaron contratos backend.

## Cambios

- Tokens comunes de fondo gris azulado, tarjetas blancas, navegación azul profundo, acciones azules, colores semánticos de ingresos/gastos y tema oscuro azul noche.
- DM Sans consistente, cifras tabulares, bordes finos, radios16/8 y sombras discretas. Botones/inputs44px, foco visible y reduced motion.
- Navegación con SVG, grupos, colapso y menú móvil con foco, Escape y fondo inert. Conserva rutas, socios, tema y logout.
- Dashboard con balance de período protagonista (no se presenta como saldo bancario), KPI limpios y acciones PDF/CSV/exportación de datos.
- Páginas de cuentas, movimientos, inversiones, análisis, calculadora, informes, vínculos, categorías, perfil y autenticación alineadas visualmente; se mantienen filtros/exportaciones y separación monetaria.
- Tablas con acciones visibles para teclado/tacto, iconos SVG y orden mediante botones; filtros seleccionados con texto de contraste por tema.

## Verificaciones ejecutadas

- npm run build frontend: PASS,1004 módulos; mayor chunk443.56kB.
- npm test backend:66/66PASS (incluye utilidades frontend/reportes y dominio existente).
- Playwright con API y datos ficticios: rutas dashboard,transactions,accounts,categories,partnerships,profile,calculator,investments,investmentdashboard,reports,analysis abiertas y encabezados renderizados a1440px y375px. Revisados y corregidos overflows de fechas/calculadora y acciones de inversiones. Tablas extensas mantienen scroll local.
- Tema oscuro en cuentas y tema claro en dashboard revisados visualmente. Menú móvil foco inicial,Shift+Tab,Escape y restauración PASS. Modal crear cuenta/movimiento abre y cierra con Escape.
- Revisión independiente detectó contrastes en filtros y checks: corregidos con on-primary. No se identificó regresión financiera concreta.

Capturas con datos ficticios: .superpowers/banking-dashboard-desktop.png,banking-dashboard-mobile.png,banking-accounts-dark.png.

No equivale a auditoría WCAG completa ni prueba de todos los flujos con backend real. No hubo despliegue ni intervención sobre datos reales. IA permanece fuera del alcance. Se conservó el logo existente.
