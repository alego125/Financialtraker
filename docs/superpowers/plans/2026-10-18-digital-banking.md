# Digital Banking Implementation Plan

> For agentic workers: use superpowers:executing-plans or subagent-driven-development task-by-task.

**Goal:** Aplicar la opción A aprobada a toda la aplicación.
**Architecture:** Tokens globales y primitivas compartidas; navegación y páginas consumen el mismo sistema, preservando contratos.
**Tech Stack:** React18, Tailwind3, CSS variables, Vite7.
**Spec:** docs/superpowers/specs/2026-10-18-digital-banking-design.md

## Constraints
Sin cambios backend, dependencias nuevas ni reglas monetarias. Mantener temas, rutas, cancelación y accesibilidad. Sin IA nueva.

## Review focus
Importes largos, tablas móvil, contraste botones/tema oscuro, foco y menú, estados error/vacío.

- [x] Tokens index.css y tailwind, botones, inputs, tablas, foco, motion.
- [x] Layout con navegación azul, SVG, grupos, menú móvil y tema.
- [x] KPI/charts y presentación páginas: eliminar estética dorada y iconos emoji decorativos; conservar contenido funcional.
- [x] Build y tests existentes; navegador con API ficticia en todas las rutas, temas y móvil. Capturar resultado.
