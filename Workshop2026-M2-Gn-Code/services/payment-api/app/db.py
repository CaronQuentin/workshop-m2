"""Connexion base et modèles. Toutes les données sont fictives."""
import os
from sqlalchemy import create_engine, String, Integer, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Solde fictif de départ attribué à chaque compte (en centimes) : 50 000,00 €.
STARTING_BALANCE_CENTS = 5_000_000


class Base(DeclarativeBase):
    pass


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    account: Mapped[str] = mapped_column(String(64), index=True)
    beneficiary_name: Mapped[str] = mapped_column(String(128), default="")
    label: Mapped[str] = mapped_column(String(160), default="")
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    status: Mapped[str] = mapped_column(String(16), default="captured")
    created_at: Mapped["DateTime"] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Beneficiary(Base):
    __tablename__ = "beneficiaries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(128))
    iban: Mapped[str] = mapped_column(String(34), default="")
    created_at: Mapped["DateTime"] = mapped_column(DateTime(timezone=True), server_default=func.now())


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
