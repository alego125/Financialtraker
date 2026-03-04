# 💰 FinTrack — Seguimiento de Gastos e Ingresos

Sistema full-stack para seguimiento financiero personal. Stack 100% open source, listo para entorno local.

## 🗂️ Estructura del Proyecto

```
expense-tracker/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Lógica de negocio
│   │   ├── routes/            # Definición de rutas
│   │   ├── middlewares/       # Auth, error handling
│   │   └── utils/             # Prisma client, helpers
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos y relaciones
│   │   └── seed.js            # Datos de ejemplo
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ui/            # Modales, tablas, cards
    │   │   ├── charts/        # Recharts components
    │   │   └── layout/        # Sidebar, Layout
    │   ├── pages/             # Dashboard, Transacciones, Categorías
    │   ├── hooks/             # useAuth, contextos
    │   ├── services/          # Axios instance
    │   └── utils/             # Formatters, PDF export
    ├── vite.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## 🛠️ Stack Tecnológico

| Capa         | Tecnología                          |
|--------------|-------------------------------------|
| Backend      | Node.js + Express                   |
| ORM          | Prisma                              |
| Base de datos| PostgreSQL (local)                  |
| Auth         | JWT + Bcryptjs                      |
| Frontend     | React 18 + Vite                     |
| Estilos      | TailwindCSS                         |
| Gráficos     | Recharts                            |
| HTTP Client  | Axios                               |
| PDF          | jsPDF + jsPDF-AutoTable             |

---

## ⚙️ Requisitos Previos

- **Node.js** >= 18
- **PostgreSQL** >= 14 corriendo localmente
- **npm** >= 9

---

## 🚀 Instalación y Configuración

### 1. Clonar el proyecto y abrir el directorio

```bash
cd expense-tracker
```

### 2. Configurar el Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env desde el ejemplo
cp .env.example .env
```

Editar `backend/.env`:
```env
DATABASE_URL="postgresql://TU_USUARIO:TU_CONTRASEÑA@localhost:5432/expense_tracker"
JWT_SECRET="cambia-esto-por-un-secreto-seguro"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
```

> ⚠️ Asegurate que PostgreSQL esté corriendo y el usuario tenga permisos para crear bases de datos.

### 3. Ejecutar Migración y Seed

```bash
# Crear la base de datos y las tablas
npx prisma migrate dev --name init

# Poblar con datos de ejemplo
npm run seed
```

El seed crea:
- Usuario demo: `demo@demo.com` / `demo1234`
- 8 categorías predefinidas
- ~48 transacciones de los últimos 6 meses

### 4. Iniciar el Backend

```bash
npm run dev
# Servidor en http://localhost:3001
```

### 5. Configurar el Frontend

```bash
cd ../frontend

# Instalar dependencias
npm install

# Crear .env (opcional, el proxy de Vite ya apunta a localhost:3001)
cp .env.example .env
```

### 6. Iniciar el Frontend

```bash
npm run dev
# App en http://localhost:5173
```

---

## 📁 Variables de Entorno

### Backend (`backend/.env`)

| Variable         | Descripción                                   | Ejemplo                                              |
|-----------------|-----------------------------------------------|------------------------------------------------------|
| `DATABASE_URL`  | URL de conexión PostgreSQL                    | `postgresql://postgres:pass@localhost:5432/fintrack`|
| `JWT_SECRET`    | Secreto para firmar tokens JWT                | `mi-secreto-super-seguro-2024`                      |
| `JWT_EXPIRES_IN`| Duración del token                            | `7d`                                                 |
| `PORT`          | Puerto del servidor                           | `3001`                                               |
| `NODE_ENV`      | Entorno de ejecución                          | `development`                                        |

### Frontend (`frontend/.env`) — Opcional

| Variable       | Descripción           | Default                         |
|----------------|-----------------------|---------------------------------|
| `VITE_API_URL` | URL base de la API    | `http://localhost:3001/api`     |

---

## 🗃️ API Endpoints

### Auth
```
POST   /api/auth/register   Registro de usuario
POST   /api/auth/login      Login
GET    /api/auth/me         Datos del usuario actual
```

### Categorías (requieren auth)
```
GET    /api/categories        Listar todas
POST   /api/categories        Crear nueva
PUT    /api/categories/:id    Actualizar
DELETE /api/categories/:id    Eliminar
```

### Transacciones (requieren auth)
```
GET    /api/transactions        Listar con filtros y paginación
GET    /api/transactions/:id    Detalle
POST   /api/transactions        Crear
PUT    /api/transactions/:id    Actualizar
DELETE /api/transactions/:id    Eliminar
```

Parámetros de filtro disponibles:
- `type` (INCOME | EXPENSE)
- `categoryId`
- `dateFrom` / `dateTo`
- `amountMin` / `amountMax`
- `paymentMethod` (búsqueda parcial)
- `comment` (búsqueda parcial LIKE)
- `page`, `limit`, `sortBy`, `sortOrder`

### Dashboard (requiere auth)
```
GET    /api/dashboard   KPIs + datos para gráficos
```

Acepta los mismos filtros que transacciones. Retorna:
- **kpis**: totalIncome, totalExpense, balance, avgMonthlyIncome, avgMonthlyExpense, savingsRate, topExpenseCategory, incomeVariation, expenseVariation
- **charts.monthly**: Datos para línea y barra apilada
- **charts.categoryExpense**: Datos para barras horizontales
- **charts.pie**: Datos con porcentajes para torta

---

## 🎨 Funcionalidades

### Dashboard Analítico
- **8 KPIs** calculados en backend con variación vs período anterior
- **4 gráficos Recharts** reactivos a filtros combinables
- Filtros: fechas, tipo, categoría, monto, método de pago, comentario
- Tabla paginada con ordenamiento por columnas

### Gestión de Transacciones
- CRUD completo con validaciones frontend y backend
- Búsqueda en tiempo real por comentario
- Filtro rápido por tipo

### Gestión de Categorías
- CRUD con selector de color (12 presets + picker)
- Categorías separadas por tipo (ingresos/gastos)
- Protección: no se pueden eliminar categorías con transacciones

### Exportación PDF
- Portada con KPIs destacados
- Tablas de evolución mensual
- Tabla por categorías con porcentajes
- Detalle completo de transacciones
- Totales finales y numeración de páginas

---

## 🧪 Scripts Disponibles

### Backend
```bash
npm run dev        # Servidor con hot-reload (nodemon)
npm run start      # Servidor producción
npm run seed       # Poblar BD con datos de ejemplo
npm run studio     # Abrir Prisma Studio (GUI BD)
npx prisma migrate dev   # Ejecutar migraciones
npx prisma db push       # Push schema sin migración
npx prisma generate      # Regenerar cliente Prisma
```

### Frontend
```bash
npm run dev        # Servidor desarrollo (Vite)
npm run build      # Build para producción
npm run preview    # Preview del build
```

---

## 🐛 Troubleshooting

**Error de conexión a PostgreSQL:**
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# Crear la base de datos manualmente si es necesario
psql -U postgres -c "CREATE DATABASE expense_tracker;"
```

**Error "Prisma client not generated":**
```bash
cd backend
npx prisma generate
```

**Puerto 3001 ocupado:**
```bash
# Cambiar PORT en backend/.env
PORT=3002
```

**Frontend no conecta al backend:**
```bash
# Verificar que el backend esté corriendo
# Revisar vite.config.js — el proxy apunta a localhost:3001
# O configurar VITE_API_URL en frontend/.env
```

---

## 📄 Licencia

MIT — Uso libre para proyectos personales y comerciales.
