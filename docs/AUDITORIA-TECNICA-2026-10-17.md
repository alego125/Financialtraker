# Auditoría técnica de FinancialTracker

Fecha: 17 de octubre de 2026. Evaluación del código disponible en el directorio local.

## Dictamen

La aplicación tiene una base funcional amplia y una elección de tecnologías razonable para finanzas personales. Sin embargo, presenta fallos de autorización, recuperación de cuentas e integridad contable que impiden considerarla preparada para un uso multiusuario con datos financieros sensibles.

Conviene conservar el stack y corregir primero las reglas del dominio. Una reescritura completa aumentaría el alcance sin resolver por sí misma estos defectos.

## Alcance y evidencia

Se revisaron estructura, servidor activo, rutas, middleware, controladores, modelo Prisma, historial SQL, autenticación cliente, páginas y componentes principales, generación de informes, configuración y documentación. Se consultó el grafo existente mediante un recorrido local de relaciones porque el ejecutable Graphify falla con `uv trampoline failed to canonicalize script path`. El grafo se utilizó para navegación; los hallazgos se contrastaron con código actual.

Comprobaciones ejecutadas:

- `node docs/audit-checks.cjs`: cinco defectos reproducidos usando los controladores reales y dependencias simuladas en memoria.
- `node --check`: 33 archivos JavaScript del backend, sin errores sintácticos.
- No hay scripts de test o lint en los package.json revisados ni una suite de pruebas de aplicación localizada en el inventario.
- No hay node_modules en backend ni frontend. No se ejecutaron compilación React, integración con PostgreSQL, auditoría de dependencias ni pruebas visuales en navegador.
- El directorio no tiene un repositorio Git reconocido. No se pudo evaluar historial, ramas o estado de CI remoto.

Las reproducciones aisladas prueban la lógica descrita; no constituyen una prueba del despliegue público. No se accedió a datos reales, no se ejecutaron migraciones y no se modificó código de aplicación.

## Arquitectura y fortalezas

Flujo principal: React/React Router → Axios con JWT → Express → controladores → Prisma → PostgreSQL.

El backend es un monolito organizado por rutas y controladores. El cliente separa páginas, componentes, utilidades y servicio HTTP. Hay cuentas personales y compartidas, categorías, movimientos, transferencias, crédito, operaciones de cambio, inversiones, análisis e informes.

Aspectos acertados:

- PostgreSQL y Prisma aportan relaciones, claves foráneas, restricciones únicas y tipos Decimal en almacenamiento.
- Las contraseñas se almacenan mediante bcrypt con coste 12.
- Muchas consultas comprueban userId y las vistas del socio verifican una relación aceptada.
- La creación de transferencias agrupa el registro y sus dos movimientos en una transacción de base de datos.
- El análisis nuevo utiliza agregaciones y consultas SQL parametrizadas de Prisma.
- Las inversiones contemplan coste promedio, inserciones históricas y validación cronológica de ventas.
- Se centralizan el cliente Prisma, el transporte Axios y parte del manejo de errores.

## Hallazgos prioritarios

### A01 — Crítico: recuperación de contraseña permite tomar una cuenta

Referencias: `backend/src/routes/auth.js`, `backend/src/controllers/auth.controller.js:109`.

POST /api/auth/forgot-password es público. Con un email existente cambia inmediatamente passwordHash y devuelve tempPassword en la respuesta. No exige demostrar acceso al correo. La interfaz actual muestra recuperación manual, pero eso no desactiva el endpoint.

Impacto: quien conoce un email puede obtener una credencial válida y bloquear el acceso anterior. Confirmado con ejecución aislada del controlador.

Corrección: retirar el comportamiento vulnerable; usar token aleatorio de un solo uso, con hash almacenado y vencimiento, enviado desde backend al correo. Cambiar la contraseña únicamente tras validar el token. Responder de manera uniforme exista o no la cuenta y limitar intentos.

### A02 — Crítico: edición de movimientos sin autorización de la cuenta destino

Referencia: `backend/src/controllers/transactions.controller.js:143`.

La edición comprueba la propiedad del movimiento y de la categoría, pero asigna accountId/sharedAccountId sin verificar propiedad o membresía. Tampoco repite restricciones de crédito/inversión, saldo suficiente o exclusividad de la cuenta.

Impacto: con un identificador válido de otra cuenta puede vincularse un movimiento propio a ella, modificar su saldo y obtener los metadatos incluidos en la respuesta. Los UUID no sustituyen autorización. Confirmado el camino de escritura mediante simulación.

Corrección: validar el estado final del movimiento y todos sus recursos relacionados en creación y edición mediante el mismo servicio de dominio.

### A03 — Alto: cancelación de transferencia altera saldos

Referencia: `backend/src/controllers/transfers.controller.js:358`.

cancel registra movimientos inversos y después elimina los movimientos originales. Para una transferencia A→B de 100, la cancelación deja A con +100 y B con −100 respecto de sus saldos anteriores a la transferencia. Además, los nuevos movimientos llevan transferId null y entran en informes de ingresos/gastos.

Corrección: conservar originales y agregar reversión vinculada, o eliminar el conjunto sin crear reversión. Para trazabilidad financiera es preferible conservar ambos con estado de cancelación, referencia e idempotencia. Confirmado con ejecución aislada.

### A04 — Alto: edición y concurrencia permiten saltarse límites de saldo

Referencias: `transactions.controller.js:143`, `transfers.controller.js:460`, `transfers.controller.js:180`.

fullUpdate vuelve a crear los movimientos de una transferencia sin comprobar saldo disponible. La edición de transacciones tampoco lo comprueba. En creación, la lectura del saldo ocurre antes de la escritura y fuera de una protección frente a operaciones simultáneas: dos solicitudes pueden aprobarse sobre el mismo saldo.

Corrección: ejecutar validación y escritura con un protocolo consistente por cuenta, bloqueo o aislamiento apropiado con reintentos controlados. Al editar, considerar el efecto del movimiento anterior. Verificar concurrencia con PostgreSQL real.

### A05 — Alto: se pueden modificar o borrar movimientos de sistemas derivados

Referencias: `transactions.controller.js:143`, `transactions.controller.js:189`, `schema.prisma`, modelo InvestmentOperation.

Las rutas genéricas de actualización y borrado no protegen los movimientos con transferId ni los resultados de inversiones. Un usuario puede alterar una sola pata de una transferencia. gainTransactionId es un String sin relación declarada: borrar el movimiento deja una referencia huérfana. recomputeGroup puede omitir su reparación porque sale temprano cuando la ganancia calculada no cambió.

Corrección: identificar el origen de cada movimiento y canalizar su modificación exclusivamente por el flujo que mantiene todas las entidades relacionadas.

### A06 — Alto: indicadores mezclan monedas

Referencias: `dashboard.controller.js`, función computeKpis; `partnership.controller.js`, getPartnerSolo/getPartnerDashboard.

El dashboard separa gastos USD, pero suma todos los ingresos y reembolsos en un único total. Por ejemplo, 1000 ARS + 100 USD produce ingreso 1100. Las vistas de socios también suman importes de distintas monedas. No existe una conversión asociada a esa suma.

Corrección: expresar todos los KPIs por moneda, incluidos balance, ahorro y comparativas. Una consolidación requiere cotización, fecha y criterio explícitos. La página Analysis ya separa varias magnitudes y puede servir como punto de unificación. Defecto del dashboard confirmado en memoria.

### A07 — Alto: migraciones no reconstruyen el esquema actual

Referencias: `backend/prisma/migrations/`, `migration-v6.sql`, `migration-v7.sql`, `migration-v7b.sql`, `backend/render.yaml`.

Las migraciones Prisma disponibles no crean Currency, AccountType, PaymentType, Transfer y otras estructuras que aparecen en schema.prisma. Hay cambios en SQL manual fuera de la carpeta que ejecuta migrate deploy. La migración de InvestmentPosition utiliza Currency, cuya creación no se encontró en el historial Prisma.

Impacto: el despliegue sobre una base vacía no es reproducible con el comando documentado. Una base existente puede funcionar por intervenciones manuales; su estado real no se comprobó.

Corrección: reconciliar esquema e historial mediante una estrategia de baseline que preserve datos existentes y verificar desde una base temporal vacía.

### A08 — Alto: inversiones se actualizan en varias escrituras independientes

Referencias: `investment.controller.js:216`, `:276`, `:428`.

Crear, editar o borrar operaciones y recalcular sus resultados no ocurre dentro de una única transacción. Hay errores de actualización/borrado de movimientos que se descartan con catch vacío. Una interrupción puede dejar la operación registrada con resultados parciales. Dos ventas simultáneas también pueden superar la validación sobre el mismo historial.

Corrección: pasar un cliente transaccional a las funciones auxiliares, hacer atómica la operación completa y no ocultar fallos de integridad.

### A09 — Alto: pérdida de precisión en cantidades de inversiones

Referencias: `investment.controller.js:171`, `:201`, `:454`.

El esquema admite seis decimales de cantidad, pero replay redondea qty a dos antes de valorar la posición. Una compra de 0.004 unidades desaparece del tablero porque se convierte en cero; otras posiciones se valoran con una cantidad incorrecta. Confirmado con getBoard.

Corrección: preservar la precisión de cantidades y precios durante todos los cálculos; redondear sólo los importes o la presentación según su unidad. Evitar convertir Decimal a Number para la aritmética contable central.

### A10 — Medio/alto: resultados de inversiones pueden quedar desactualizados

Referencias: `investment.controller.js:124`, `:227`.

recomputeGroup compara sólo realizedGain. Si se cambia la fecha o cantidad de una venta y su resultado numérico permanece igual, el movimiento asociado conserva fecha o comentario anterior. Cambiar la moneda de un activo con operaciones existentes también reinterpreta el historial sin actualizar todos los movimientos derivados.

Corrección: sincronizar todos los campos derivados, verificar existencia del movimiento y bloquear o migrar explícitamente cambios de moneda con historial.

### A11 — Alto: validaciones declaradas que no se aplican

Referencias: `routes/accounts.js`, `routes/sharedAccounts.js`, controladores correspondientes.

Varias rutas declaran express-validator, pero update y exchange no consumen validationResult. Los cambios de divisas comprueban sólo la presencia de usdAmount/rate y no fondos suficientes. Un tipo de cambio negativo puede invertir signos de los efectos contables. También hay pagos/ediciones de transferencias con validación manual incompleta.

Corrección: middleware único que rechace errores antes del controlador, schemas de entrada completos y comprobaciones de negocio para fondos y tipos de cuenta. Definir explícitamente cómo se representan compra y venta de divisas.

### A12 — Medio: informe de inversiones desconectado del sistema actual

Referencia: `frontend/src/pages/ReportPage.jsx:464`, `backend/src/routes/investment.js`.

El PDF consulta GET /investments, que devuelve InvestmentPosition legacy. La interfaz actual utiliza assets/operations/board. Las inversiones nuevas no se reflejan en ese informe. Además, el resumen patrimonial suma ganancias de posiciones de diferentes monedas y las etiqueta ARS; un fallo al consultar inversiones se transforma silenciosamente en una lista vacía.

Corrección: generar el informe desde el modelo vigente, preservar separación monetaria y distinguir un fallo de carga de la ausencia real de posiciones.

### A13 — Medio: integración IA sin ruta activa

Referencias: `backend/server.js`, `backend/src/routes/ai.js`, `frontend/src/components/ui/AIAnalysisPanel.jsx:150`.

El componente llama /api/ai/analyze, pero el servidor usado por package.json no monta aiRoutes. Existe código de integración que no forma parte del servidor activo. El componente también tiene un fallback de URL distinto al cliente Axios.

Corrección: decidir si la función está soportada, montar y verificar su contrato o retirar la interfaz/código inactivo. No se verificó la disponibilidad actual del modelo externo.

## Rendimiento y experiencia de usuario

- Listar cuentas carga todo el historial de movimientos y cambios para recalcular saldos en Node. accountsAnalysis vuelve a recorrerlo por cada mes. Escala con el historial, aunque el usuario sólo quiera ver un resumen. Agregar en SQL y medir con volúmenes representativos antes de introducir saldos materializados.
- page/limit se convierten con parseInt sin límites generales ni rechazo consistente de valores inválidos. Establecer máximos y contratos específicos para exportaciones.
- Exportaciones de varias pantallas solicitan una sola página con límites fijos de 1000 o 5000. Pueden omitir filas sin indicarlo. Paginar hasta completar o generar exportación dedicada con verificación de total.
- DashboardPage y AnalysisPage no cancelan solicitudes antiguas al cambiar filtros. Una respuesta lenta puede sobrescribir los datos de un filtro posterior. Usar AbortController o una identidad de solicitud.
- Hay numerosos catch que sólo escriben en consola o ignoran errores. El usuario puede ver ceros, datos viejos o listas vacías sin conocer el fallo.
- Modal.jsx no implementa role dialog, aria-modal, asociación del título, captura/restauración del foco ni cierre con Escape. Corregir y verificar teclado/lector de pantalla.
- No se midieron tiempos, consumo de memoria, tamaño del bundle ni comportamiento móvil. Las observaciones de rendimiento son estructurales, no resultados de un benchmark.

## Seguridad y operación adicionales

- server.js acepta cualquier origen terminado en .vercel.app y credentials true. Restringir a dominios concretos. CORS no reemplaza autorización y este hallazgo no demuestra por sí solo robo de JWT.
- No se encontró limitación de intentos en login, registro y recuperación. Incorporar límites y observabilidad de abuso.
- El middleware JWT no consulta una versión de sesión. Cambiar contraseña no invalida tokens ya emitidos. Diseñar revocación acorde con el uso esperado.
- El JWT reside en localStorage. Una eventual vulnerabilidad XSS podría exponerlo; no se demostró XSS en esta auditoría. Revisar almacenamiento, CSP y estrategia de sesiones conjuntamente.
- errorHandler devuelve err.message para errores inesperados y registra stack completo. En producción devolver mensajes genéricos con identificador de seguimiento.
- El cliente redirige ante cualquier 401, incluso un currentPassword incorrecto en la edición del perfil. Diferenciar credencial de sesión inválida de rechazo de una operación sensible.
- prisma.js reintenta operaciones tras desconectar/reconectar por errores genéricos de conexión. Si una escritura se confirmó antes de perder la respuesta, repetirla puede duplicar efectos. Revisar idempotencia y limitar reintentos por tipo de operación.
- El health check sólo confirma que Express responde. No demuestra disponibilidad de PostgreSQL o coherencia del esquema.
- No se comprobaron backups, restauración, secretos del despliegue, monitorización ni vulnerabilidades actuales de paquetes. Evitar afirmar que existen o faltan en infraestructura a partir del código local.

## Mantenibilidad

AccountsPage.jsx tiene 1350 líneas; SharedDashboardPage 703; ReportPage 583. Mezclan interfaz, llamadas HTTP, reglas y exportación. Hay cálculos de saldo, filtros y KPIs duplicados entre controladores, con diferencias funcionales ya visibles.

También conviven server.js/backend-server.js, esquemas Prisma alternativos, rutas con y sin sufijo .routes y modelos legacy. El punto de entrada real debe ser la referencia: no todos los archivos presentes se ejecutan.

Separar progresivamente:

1. Validación de transporte y manejo uniforme de errores.
2. Servicios de dominio para movimientos, transferencias, crédito, cambios e inversiones.
3. Consultas de reporting compartidas con reglas de moneda y fechas únicas.
4. Componentes y hooks por flujo de usuario.

No hace falta introducir microservicios. La prioridad es reducir lugares donde una misma regla puede divergir.

README está desactualizado respecto a funcionalidades, rutas y variables: menciona .env.example que no aparece con ese nombre en el inventario y omite DIRECT_URL exigida por el esquema. Debe verificarse un arranque desde cero siguiendo exclusivamente la documentación.

## Orden recomendado de trabajo

1. Contener la recuperación vulnerable y corregir autorización de edición; proteger movimientos derivados.
2. Reparar cancelación y validación de saldo, con pruebas de conservación por cuenta y moneda.
3. Unificar precisión y monedas; hacer atómicas las inversiones y sincronizar movimientos derivados.
4. Reconciliar migraciones en una base temporal y establecer pruebas de integración con dos usuarios y concurrencia.
5. Alinear PDF/IA con los contratos activos, corregir exportaciones incompletas y errores silenciosos.
6. Añadir CI con compilación frontend, validación Prisma, pruebas de dominio y revisión de dependencias; después refactorizar los módulos grandes y medir rendimiento.

Criterios de aceptación esenciales: ningún recurso ajeno puede mutarse por ID; transferir y cancelar conserva saldos originales; una transferencia siempre tiene dos patas coherentes; dos gastos simultáneos no eluden la política de fondos; una posición fraccionaria conserva cantidad y valor; cada KPI e informe coincide por moneda y período; una base vacía puede desplegarse con el historial oficial.
