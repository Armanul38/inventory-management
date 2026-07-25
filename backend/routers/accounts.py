from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from pydantic import BaseModel

from backend.database import get_session
from backend.models import (
    User, ChartOfAccount, JournalEntry, JournalLine,
    GoodsReceiptNote, Invoice, PaymentReceived, SupplierPayment,
    Supplier, Customer,
    AccountType, JournalRefType
)
from backend.auth import get_current_user, RoleChecker
from backend.services.ledger import post_journal

router = APIRouter(tags=["Accounts & Ledger"])

finance_roles = RoleChecker(["ADMIN", "ACCOUNTANT"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CoACreateSchema(BaseModel):
    account_code: str
    account_name: str
    account_type: AccountType
    parent_account_id: Optional[int] = None

class CoAResponse(BaseModel):
    id: int
    account_code: str
    account_name: str
    account_type: str
    parent_account_id: Optional[int]
    is_active: bool
    class Config:
        from_attributes = True

class JournalLineManualSchema(BaseModel):
    account_code: str
    debit: float = 0.0
    credit: float = 0.0
    notes: Optional[str] = None

class ManualJournalSchema(BaseModel):
    entry_date: date
    description: str
    lines: List[JournalLineManualSchema]

class JournalEntryResponse(BaseModel):
    id: int
    entry_number: str
    entry_date: date
    description: str
    reference_type: str
    reference_id: Optional[int]
    created_at: datetime
    class Config:
        from_attributes = True

class JournalLineResponse(BaseModel):
    id: int
    account_id: int
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    debit_amount: float
    credit_amount: float
    notes: Optional[str]
    class Config:
        from_attributes = True


# ─── Chart of Accounts ────────────────────────────────────────────────────────

@router.get("/accounts/chart-of-accounts", response_model=List[CoAResponse])
def list_chart_of_accounts(
    account_type: Optional[AccountType] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(ChartOfAccount).where(ChartOfAccount.is_active == True)
    if account_type:
        query = query.where(ChartOfAccount.account_type == account_type.value)
    return session.exec(query.order_by(ChartOfAccount.account_code)).all()


@router.post("/accounts/chart-of-accounts", response_model=CoAResponse, status_code=201)
def create_account(
    body: CoACreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(finance_roles),
):
    existing = session.exec(
        select(ChartOfAccount).where(ChartOfAccount.account_code == body.account_code)
    ).first()
    if existing:
        raise HTTPException(400, f"Account code '{body.account_code}' already exists")

    acct = ChartOfAccount(
        account_code=body.account_code,
        account_name=body.account_name,
        account_type=body.account_type.value,
        parent_account_id=body.parent_account_id,
    )
    session.add(acct)
    session.commit()
    session.refresh(acct)
    return acct


# ─── Journal Entries ──────────────────────────────────────────────────────────

@router.get("/accounts/journal-entries")
def list_journal_entries(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    ref_type: Optional[str] = None,
    account_code: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(JournalEntry)
    if from_date:
        query = query.where(JournalEntry.entry_date >= from_date)
    if to_date:
        query = query.where(JournalEntry.entry_date <= to_date)
    if ref_type:
        query = query.where(JournalEntry.reference_type == ref_type)

    entries = session.exec(query.order_by(JournalEntry.entry_date.desc())).all()

    result = []
    for e in entries:
        lines = session.exec(
            select(JournalLine).where(JournalLine.journal_entry_id == e.id)
        ).all()
        # Filter by account code if requested
        if account_code:
            lines = [l for l in lines if l.account and l.account.account_code == account_code]
            if not lines:
                continue

        entry_data = {
            "id": e.id,
            "entry_number": e.entry_number,
            "entry_date": e.entry_date,
            "description": e.description,
            "reference_type": e.reference_type,
            "reference_id": e.reference_id,
            "lines": [
                {
                    "account_code": l.account.account_code if l.account else None,
                    "account_name": l.account.account_name if l.account else None,
                    "debit": l.debit_amount,
                    "credit": l.credit_amount,
                    "notes": l.notes,
                }
                for l in lines
            ],
        }
        result.append(entry_data)
    return result


@router.post("/accounts/journal-entries", status_code=201)
def manual_journal_entry(
    body: ManualJournalSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(finance_roles),
):
    entry = post_journal(
        session=session,
        ref_type=JournalRefType.MANUAL.value,
        ref_id=None,
        entry_date=body.entry_date,
        description=body.description,
        created_by=current_user.id,
        lines=[{"account_code": l.account_code, "debit": l.debit, "credit": l.credit,
                "notes": l.notes} for l in body.lines],
    )
    session.commit()
    session.refresh(entry)
    return {"message": "Journal entry posted", "entry_number": entry.entry_number}


# ─── Accounts Payable ─────────────────────────────────────────────────────────

@router.get("/accounts/payable")
def accounts_payable_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    suppliers = session.exec(select(Supplier).where(Supplier.is_active == True)).all()
    result = []
    total_outstanding = 0.0

    for s in suppliers:
        grns = session.exec(
            select(GoodsReceiptNote).where(GoodsReceiptNote.supplier_id == s.id)
        ).all()
        payments = session.exec(
            select(SupplierPayment).where(SupplierPayment.supplier_id == s.id)
        ).all()
        total_purchases = sum(g.total_amount for g in grns)
        total_paid = sum(p.amount for p in payments)
        balance = total_purchases - total_paid
        if balance > 0:
            total_outstanding += balance
            result.append({
                "supplier_id": s.id,
                "supplier_code": s.supplier_code,
                "company_name": s.company_name,
                "total_purchases": round(total_purchases, 2),
                "total_paid": round(total_paid, 2),
                "outstanding_balance": round(balance, 2),
            })

    result.sort(key=lambda x: x["outstanding_balance"], reverse=True)
    return {"total_outstanding": round(total_outstanding, 2), "suppliers": result}


@router.get("/accounts/payable/aging")
def accounts_payable_aging(
    as_of_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    today = as_of_date or date.today()
    grns = session.exec(select(GoodsReceiptNote).where(GoodsReceiptNote.balance_due > 0)).all()

    buckets = {"current": 0.0, "1_30": 0.0, "31_60": 0.0, "61_90": 0.0, "over_90": 0.0}
    details = []

    for g in grns:
        supplier = session.get(Supplier, g.supplier_id)
        due_date = g.received_date + timedelta(days=supplier.payment_terms_days if supplier else 30)
        days_overdue = (today - due_date).days if isinstance(due_date, date) else 0

        bucket = "current"
        if days_overdue > 90:
            bucket = "over_90"
        elif days_overdue > 60:
            bucket = "61_90"
        elif days_overdue > 30:
            bucket = "31_60"
        elif days_overdue > 0:
            bucket = "1_30"

        buckets[bucket] += g.balance_due
        details.append({
            "grn_number": g.grn_number,
            "supplier": supplier.company_name if supplier else "N/A",
            "received_date": g.received_date,
            "due_date": due_date,
            "days_overdue": max(days_overdue, 0),
            "balance_due": round(g.balance_due, 2),
            "bucket": bucket,
        })

    return {
        "as_of_date": today,
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "total": round(sum(buckets.values()), 2),
        "details": sorted(details, key=lambda x: x["days_overdue"], reverse=True),
    }


# ─── Accounts Receivable ──────────────────────────────────────────────────────

@router.get("/accounts/receivable")
def accounts_receivable_summary(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    customers = session.exec(select(Customer).where(Customer.is_active == True)).all()
    result = []
    total_outstanding = 0.0

    for c in customers:
        invoices = session.exec(
            select(Invoice).where(
                Invoice.customer_id == c.id,
                Invoice.balance_due > 0,
            )
        ).all()
        balance = sum(i.balance_due for i in invoices)
        if balance > 0:
            total_outstanding += balance
            result.append({
                "customer_id": c.id,
                "customer_code": c.customer_code,
                "company_name": c.company_name,
                "credit_limit": c.credit_limit,
                "outstanding_balance": round(balance, 2),
                "open_invoices": len(invoices),
            })

    result.sort(key=lambda x: x["outstanding_balance"], reverse=True)
    return {"total_outstanding": round(total_outstanding, 2), "customers": result}


@router.get("/accounts/receivable/aging")
def accounts_receivable_aging(
    as_of_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    today = as_of_date or date.today()
    invoices = session.exec(select(Invoice).where(Invoice.balance_due > 0)).all()

    buckets = {"current": 0.0, "1_30": 0.0, "31_60": 0.0, "61_90": 0.0, "over_90": 0.0}
    details = []

    for inv in invoices:
        customer = session.get(Customer, inv.customer_id)
        days_overdue = (today - inv.due_date).days if isinstance(inv.due_date, date) else 0

        bucket = "current"
        if days_overdue > 90:
            bucket = "over_90"
        elif days_overdue > 60:
            bucket = "61_90"
        elif days_overdue > 30:
            bucket = "31_60"
        elif days_overdue > 0:
            bucket = "1_30"

        buckets[bucket] += inv.balance_due
        details.append({
            "invoice_number": inv.invoice_number,
            "customer": customer.company_name if customer else "N/A",
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "days_overdue": max(days_overdue, 0),
            "balance_due": round(inv.balance_due, 2),
            "status": inv.status,
            "bucket": bucket,
        })

    return {
        "as_of_date": today,
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "total": round(sum(buckets.values()), 2),
        "details": sorted(details, key=lambda x: x["days_overdue"], reverse=True),
    }
