import csv
import io
import json
import os
from collections import defaultdict
from contextlib import asynccontextmanager, contextmanager
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

ROOT = Path(__file__).resolve().parent
engine = create_engine(
    "sqlite:///" + os.environ.get("PULSO_DB", str(ROOT / "pulso.sqlite3")),
    connect_args={"timeout": 15},
)
CATEGORIES = ["Alimentación", "Vivienda", "Transporte", "Compras", "Servicios",
              "Salud", "Ocio", "Educación", "Sueldo", "Inversiones", "Otros"]


@event.listens_for(engine, "connect")
def sqlite_settings(connection, _record):
    connection.execute("PRAGMA foreign_keys=ON")


class Base(DeclarativeBase):
    pass


class Record(Base):
    __tablename__ = "records"
    id: Mapped[int] = mapped_column(primary_key=True)
    collection: Mapped[str] = mapped_column(index=True)
    payload: Mapped[str]


class Settings(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    rate: Mapped[str]


class Input(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def strip(cls, value):
        return value.strip() if isinstance(value, str) else value


class Account(Input):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["efectivo", "banco", "tarjeta", "inversión"]
    currency: Literal["ARS", "USD"]
    opening: Decimal = Field(max_digits=14, decimal_places=2)
    opened: date


class Transaction(Input):
    kind: Literal["income", "expense"]
    account: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    day: date
    category: str = Field(min_length=1, max_length=60)
    note: str = Field(default="", max_length=300)


class Transfer(Input):
    source: int = Field(gt=0)
    destination: int = Field(gt=0)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    day: date
    note: str = Field(default="", max_length=300)


class Budget(Input):
    category: str = Field(min_length=1, max_length=60)
    limit: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    month: str = Field(pattern=r"^[0-9]{4}-(0[1-9]|1[0-2])$")


class Goal(Input):
    name: str = Field(min_length=1, max_length=80)
    target: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    saved: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    due: date


class Rate(Input):
    rate: Decimal = Field(gt=0, max_digits=12, decimal_places=4)


SCHEMAS = {"accounts": Account, "transactions": Transaction, "transfers": Transfer,
           "budgets": Budget, "goals": Goal}


@asynccontextmanager
async def lifespan(_app):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Pulso Finanzas", lifespan=lifespan)


@contextmanager
def transaction(write=False):
    with Session(engine) as session:
        session.connection().exec_driver_sql("BEGIN IMMEDIATE" if write else "BEGIN")
        yield session
        if write:
            session.commit()


def entries(session, collection):
    rows = session.scalars(select(Record).where(Record.collection == collection).order_by(Record.id))
    return [(row.id, SCHEMAS[collection].model_validate_json(row.payload)) for row in rows]


def record(session, collection, item_id):
    row = session.get(Record, item_id)
    if row is None or row.collection != collection:
        raise HTTPException(404, "Registro no encontrado")
    return row


def exchange(session):
    settings = session.get(Settings, 1)
    return Decimal(settings.rate) if settings else Decimal("1200")


def money(value):
    return value.quantize(Decimal(".01"), rounding=ROUND_HALF_UP)


def item_data(item_id, item):
    return {"id": item_id, **item.model_dump(mode="json")}


def validate_entry(session, collection, item, item_id=None):
    if collection in ("transactions", "transfers"):
        ids = [item.account] if collection == "transactions" else [item.source, item.destination]
        if len(set(ids)) != len(ids):
            raise HTTPException(422, "Elegí dos cuentas distintas")
        accounts = []
        for account_id in ids:
            row = record(session, "accounts", account_id)
            account = Account.model_validate_json(row.payload)
            if item.day < account.opened:
                raise HTTPException(422, "La fecha es anterior a la apertura de la cuenta")
            accounts.append(account)
        return accounts
    if collection == "accounts" and item_id is not None:
        previous = Account.model_validate_json(record(session, collection, item_id).payload)
        dates = [txn.day for _, txn in entries(session, "transactions") if txn.account == item_id]
        dates += [txn.day for _, txn in entries(session, "transfers") if item_id in (txn.source, txn.destination)]
        if dates and (item.currency != previous.currency or item.opened > min(dates)):
            raise HTTPException(409, "La moneda y la fecha de apertura deben ser compatibles con los movimientos")
    if collection == "budgets":
        for existing_id, existing in entries(session, "budgets"):
            if existing_id != item_id and existing.month == item.month and existing.category.casefold() == item.category.casefold():
                raise HTTPException(409, "Ya existe un presupuesto para esa categoría y mes")


def save(session, collection, item, row=None):
    accounts = validate_entry(session, collection, item, row.id if row else None)
    payload = item.model_dump(mode="json")
    if collection == "transfers":
        source, destination = accounts
        rate = exchange(session)
        previous = row and Transfer.model_validate_json(row.payload)
        if previous and (previous.source, previous.destination) == (item.source, item.destination):
            rate = Decimal(row_payload(row)["rate"])
        multiplier = Decimal(1) if source.currency == destination.currency else rate if source.currency == "USD" else 1 / rate
        received = money(item.amount * multiplier)
        if received == 0:
            raise HTTPException(422, "El importe convertido debe ser de al menos un centavo")
        payload.update(received=str(received), rate=str(rate))
    if row is None:
        row = Record(collection=collection)
        session.add(row)
    row.payload = json.dumps(payload, ensure_ascii=False)
    session.flush()
    return {"id": row.id, **payload}


def row_payload(row):
    return json.loads(row.payload)


def transfers(session):
    for item_id, item in entries(session, "transfers"):
        yield item_id, item, Decimal(row_payload(session.get(Record, item_id))["received"])


def ledger(session):
    accounts = dict(entries(session, "accounts"))
    txns = entries(session, "transactions")
    moves = [(a.opened, key, a.opening) for key, a in accounts.items()]
    moves.extend((t.day, t.account, t.amount if t.kind == "income" else -t.amount) for _, t in txns)
    for _, t, received in transfers(session):
        moves.extend([(t.day, t.source, -t.amount), (t.day, t.destination, received)])
    return accounts, txns, moves


def month_from(day, offset):
    year, month = divmod(day.year * 12 + day.month - 1 + offset, 12)
    return date(year, month + 1, 1)


def metrics(session, selected):
    accounts, txns, moves = ledger(session)
    rate = exchange(session)
    today = date.today()
    cutoff = min(today, month_from(selected, 1) - timedelta(days=1))
    start = month_from(selected, -5)
    series = []
    categories = defaultdict(Decimal)
    totals = defaultdict(lambda: defaultdict(Decimal))
    for _, txn in txns:
        if start <= txn.day <= cutoff:
            amount = txn.amount * (rate if accounts[txn.account].currency == "USD" else 1)
            totals[txn.day.strftime("%Y-%m")][txn.kind] += amount
            if txn.day >= selected and txn.kind == "expense":
                categories[txn.category] += amount
    for index in range(6):
        month = month_from(start, index)
        end = min(cutoff, month_from(month, 1) - timedelta(days=1))
        key = month.strftime("%Y-%m")
        net = sum(amount * (rate if accounts[account_id].currency == "USD" else 1)
                  for day, account_id, amount in moves if day <= end)
        income, expense = totals[key]["income"], totals[key]["expense"]
        series.append(dict(month=key, balance=money(Decimal(net)), income=money(income),
                           expense=money(expense), savings=money(income - expense)))
    current, previous = series[-1], series[-2]
    variation = {key: float((current[key] - previous[key]) / abs(previous[key]) * 100)
                 if previous[key] else None for key in ("balance", "income", "expense", "savings")}
    budgets = []
    for item_id, budget in entries(session, "budgets"):
        if budget.month == current["month"]:
            spent = sum(value for key, value in categories.items() if key.casefold() == budget.category.casefold())
            budgets.append({**item_data(item_id, budget), "spent": money(Decimal(spent))})
    return {"current": current, "variation": variation, "series": series, "budgets": budgets,
            "categories": sorted((dict(name=k, amount=money(v)) for k, v in categories.items()),
                                 key=lambda entry: entry["amount"], reverse=True)}


def parse_month(value):
    try:
        month = date.fromisoformat(value + "-01") if value else date.today().replace(day=1)
        if not date(2, 1, 1) <= month <= date(9999, 11, 1):
            raise ValueError("Mes fuera de rango")
        return month
    except ValueError as error:
        raise HTTPException(422, "Mes inválido") from error


@app.get("/api/metrics")
def get_metrics(month: str = ""):
    with transaction() as session:
        return metrics(session, parse_month(month))


@app.get("/api/settings")
def get_settings():
    with transaction() as session:
        custom = {item.category for kind in ("transactions", "budgets") for _, item in entries(session, kind)}
        return {"rate": exchange(session), "categories": list(dict.fromkeys([*CATEGORIES, *sorted(custom)])),
                "today": date.today().isoformat()}


@app.put("/api/settings")
def set_settings(data: Rate):
    with transaction(write=True) as session:
        session.merge(Settings(id=1, rate=str(data.rate)))
    return data


def filtered(session, start, end, category, account, q):
    if start and end and start > end:
        raise HTTPException(422, "El rango de fechas es inválido")
    accounts = dict(entries(session, "accounts"))
    return [(key, t) for key, t in sorted(entries(session, "transactions"),
                                         key=lambda pair: (pair[1].day, pair[0]), reverse=True)
            if (not start or t.day >= start) and (not end or t.day <= end)
            and (not category or t.category.casefold() == category.casefold())
            and (not account or t.account == account)
            and q.casefold() in f"{t.note} {t.category} {accounts[t.account].name}".casefold()]


@app.get("/api/transactions")
def list_transactions(start: date | None = None, end: date | None = None, category: str = "",
                      account: int | None = None, q: str = ""):
    with transaction() as session:
        return [item_data(key, txn) for key, txn in filtered(session, start, end, category, account, q)]


@app.get("/api/transactions/export")
def export(start: date | None = None, end: date | None = None, category: str = "",
           account: int | None = None, q: str = ""):
    def safe(value):
        return "'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r", "\n")) else value

    with transaction() as session:
        accounts = dict(entries(session, "accounts"))
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Fecha", "Tipo", "Cuenta", "Moneda", "Importe", "Categoría", "Nota"])
        for _, txn in filtered(session, start, end, category, account, q):
            entry = accounts[txn.account]
            writer.writerow([txn.day, "Ingreso" if txn.kind == "income" else "Gasto",
                             safe(entry.name), entry.currency, txn.amount, safe(txn.category), safe(txn.note)])
    return Response("\ufeff" + output.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="movimientos.csv"'})


def register(collection, schema):
    path = f"/api/{collection}"

    def list_items():
        with transaction() as session:
            rows = entries(session, collection)
            if collection == "accounts":
                _, _, moves = ledger(session)
                balances = defaultdict(Decimal)
                for day, account_id, amount in moves:
                    if day <= date.today():
                        balances[account_id] += amount
                return [{**item_data(key, item), "balance": balances[key]} for key, item in rows]
            if collection == "transfers":
                return [{"id": key, **row_payload(record(session, collection, key))} for key, _ in rows]
            return [item_data(key, item) for key, item in rows]

    def get_item(item_id: int):
        with transaction() as session:
            return {"id": item_id, **row_payload(record(session, collection, item_id))}

    def create(data: schema):
        with transaction(write=True) as session:
            return save(session, collection, data)

    def update(item_id: int, data: schema):
        with transaction(write=True) as session:
            return save(session, collection, data, record(session, collection, item_id))

    def delete(item_id: int):
        with transaction(write=True) as session:
            row = record(session, collection, item_id)
            if collection == "accounts":
                linked = any(txn.account == item_id for _, txn in entries(session, "transactions"))
                linked |= any(item_id in (txn.source, txn.destination) for _, txn in entries(session, "transfers"))
                if linked:
                    raise HTTPException(409, "Eliminá o reasigná los movimientos de la cuenta primero")
            session.delete(row)
        return Response(status_code=204)

    if collection != "transactions":
        app.add_api_route(path, list_items, methods=["GET"], name=f"list_{collection}")
    app.add_api_route(path, create, methods=["POST"], status_code=201, name=f"create_{collection}")
    for endpoint, method in [(get_item, "GET"), (update, "PUT"), (delete, "DELETE")]:
        app.add_api_route(path + "/{item_id}", endpoint, methods=[method],
                          name=f"{method.lower()}_{collection}")


for name, model in SCHEMAS.items():
    register(name, model)


@app.post("/api/demo", status_code=201)
def demo():
    with transaction(write=True) as session:
        if session.scalar(select(Record.id).limit(1)) is not None:
            raise HTTPException(409, "La base debe estar vacía para cargar los datos de ejemplo")
        today = date.today()
        opened = month_from(today, -5)
        bank = save(session, "accounts", Account(name="Cuenta principal", kind="banco", currency="ARS",
                                                opening=Decimal(389500), opened=opened))["id"]
        cash = save(session, "accounts", Account(name="Efectivo", kind="efectivo", currency="ARS",
                                                opening=Decimal(65000), opened=opened))["id"]
        save(session, "accounts", Account(name="Inversiones", kind="inversión", currency="USD",
                                         opening=Decimal(340), opened=opened))
        for offset in range(-5, 1):
            month = month_from(today, offset)
            pattern = [
                (1, "income", "Sueldo", "Nómina mensual", 620000 + (offset + 5) * 43000, bank),
                (3, "expense", "Vivienda", "Alquiler", 259000, bank),
                (6, "expense", "Alimentación", "Compra semanal", 99000 + offset * 4300, bank),
                (10, "expense", "Servicios", "Luz e internet", 59000, bank),
                (15, "expense", "Transporte", "Combustible", 46000, bank),
                (18, "income", "Otros", "Proyecto freelance", 94000 + offset * 8000, bank),
                (23, "expense", "Ocio", "Cena", 25000, cash),
            ]
            for day, kind, category, note, amount, account in pattern:
                when = month.replace(day=day)
                if when <= today:
                    save(session, "transactions", Transaction(kind=kind, category=category, note=note,
                                                              amount=Decimal(amount), account=account, day=when))
        for category, limit in [("Alimentación", 115000), ("Vivienda", 250000), ("Transporte", 95000)]:
            save(session, "budgets", Budget(category=category, limit=Decimal(limit), month=today.strftime("%Y-%m")))
        for name, target, saved, days in [("Fondo de emergencia", 1800000, 1040000, 120),
                                          ("Viaje", 920000, 270000, 210)]:
            save(session, "goals", Goal(name=name, target=Decimal(target), saved=Decimal(saved),
                                       due=today + timedelta(days=days)))
    return {"loaded": True}


app.mount("/", StaticFiles(directory=ROOT / "web", html=True), name="web")
