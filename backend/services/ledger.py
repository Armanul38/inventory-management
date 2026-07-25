"""
Ledger service — posts double-entry journal entries atomically.
All financial events (GRN, Invoice, Payment, etc.) call post_journal()
to ensure every debit has a matching credit.
"""
from datetime import date
from typing import List, Dict
from sqlmodel import Session, select, func

from backend.models import (
    ChartOfAccount, JournalEntry, JournalLine, JournalRefType
)


def _next_entry_number(session: Session) -> str:
    """Generate next sequential journal entry number: JE-0001, JE-0002 …"""
    count = session.exec(select(func.count(JournalEntry.id))).one()
    return f"JE-{(count + 1):04d}"


def get_account_by_code(session: Session, code: str) -> ChartOfAccount:
    acct = session.exec(
        select(ChartOfAccount).where(ChartOfAccount.account_code == code)
    ).first()
    if not acct:
        raise ValueError(f"GL account '{code}' not found in Chart of Accounts.")
    return acct


def post_journal(
    session: Session,
    ref_type: str,          # JournalRefType value
    ref_id: int | None,
    entry_date: date,
    description: str,
    created_by: int,
    lines: List[Dict],      # [{"account_code": "1100", "debit": 500, "credit": 0}, ...]
) -> JournalEntry:
    """
    Create a balanced double-entry journal entry.
    Raises ValueError if debits != credits.
    """
    total_debit = sum(l.get("debit", 0.0) for l in lines)
    total_credit = sum(l.get("credit", 0.0) for l in lines)
    if round(total_debit, 4) != round(total_credit, 4):
        raise ValueError(
            f"Journal entry is unbalanced: debits={total_debit}, credits={total_credit}"
        )

    entry = JournalEntry(
        entry_number=_next_entry_number(session),
        entry_date=entry_date,
        description=description,
        reference_type=ref_type,
        reference_id=ref_id,
        created_by=created_by,
    )
    session.add(entry)
    session.flush()  # get entry.id

    for l in lines:
        acct = get_account_by_code(session, l["account_code"])
        jl = JournalLine(
            journal_entry_id=entry.id,
            account_id=acct.id,
            debit_amount=l.get("debit", 0.0),
            credit_amount=l.get("credit", 0.0),
            notes=l.get("notes"),
        )
        session.add(jl)

    return entry


# ─── Standard GL account codes ────────────────────────────────────────────────
class GL:
    CASH_IN_HAND      = "1000"
    BANK_ACCOUNT      = "1010"
    ACCOUNTS_RECV     = "1100"
    RAW_MATERIAL_INV  = "1200"
    FINISHED_GOODS_INV= "1300"
    ACCOUNTS_PAY      = "2000"
    VAT_PAYABLE       = "6010"
    SALES_REVENUE     = "4000"
    SALES_RETURNS     = "4010"
    COGS              = "5000"
    RAW_MAT_PURCHASES = "5100"
