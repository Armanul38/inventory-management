from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from pydantic import BaseModel

from backend.database import get_session
from backend.models import (
    User, Invoice, GoodsReceiptNote, StockTransaction,
    ChartOfAccount, JournalEntry, JournalLine,
    Customer, Supplier, Item,
    TransactionType
)
from backend.auth import get_current_user, RoleChecker

router = APIRouter(tags=["Reports"])

finance_roles = RoleChecker(["ADMIN", "ACCOUNTANT"])


@router.get("/reports/trial-balance")
def trial_balance(
    as_of_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Sum all debits and credits per GL account up to as_of_date."""
    accounts = session.exec(
        select(ChartOfAccount).where(ChartOfAccount.is_active == True)
        .order_by(ChartOfAccount.account_code)
    ).all()

    rows = []
    total_debit = 0.0
    total_credit = 0.0

    for acct in accounts:
        lines_query = select(JournalLine).where(JournalLine.account_id == acct.id)
        if as_of_date:
            # Join to filter by date
            entry_ids = [
                e.id for e in session.exec(
                    select(JournalEntry).where(JournalEntry.entry_date <= as_of_date)
                ).all()
            ]
            if entry_ids:
                lines_query = lines_query.where(JournalLine.journal_entry_id.in_(entry_ids))
            else:
                rows.append({
                    "account_code": acct.account_code,
                    "account_name": acct.account_name,
                    "account_type": acct.account_type,
                    "total_debit": 0.0,
                    "total_credit": 0.0,
                    "balance": 0.0,
                })
                continue

        lines = session.exec(lines_query).all()
        debit = sum(l.debit_amount for l in lines)
        credit = sum(l.credit_amount for l in lines)
        balance = debit - credit

        total_debit += debit
        total_credit += credit

        rows.append({
            "account_code": acct.account_code,
            "account_name": acct.account_name,
            "account_type": acct.account_type,
            "total_debit": round(debit, 2),
            "total_credit": round(credit, 2),
            "balance": round(balance, 2),
        })

    return {
        "as_of_date": as_of_date or date.today(),
        "accounts": rows,
        "totals": {
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "difference": round(total_debit - total_credit, 2),
        },
    }


@router.get("/reports/general-ledger")
def general_ledger(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    account_code: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Full general ledger listing, filterable by date range and account."""
    entry_query = select(JournalEntry)
    if from_date:
        entry_query = entry_query.where(JournalEntry.entry_date >= from_date)
    if to_date:
        entry_query = entry_query.where(JournalEntry.entry_date <= to_date)

    entries = session.exec(entry_query.order_by(JournalEntry.entry_date)).all()
    result = []

    for e in entries:
        lines = session.exec(
            select(JournalLine).where(JournalLine.journal_entry_id == e.id)
        ).all()

        if account_code:
            lines = [l for l in lines if l.account and l.account.account_code == account_code]
            if not lines:
                continue

        result.append({
            "entry_number": e.entry_number,
            "date": e.entry_date,
            "description": e.description,
            "reference_type": e.reference_type,
            "reference_id": e.reference_id,
            "lines": [
                {
                    "account_code": l.account.account_code if l.account else "?",
                    "account_name": l.account.account_name if l.account else "?",
                    "debit": l.debit_amount,
                    "credit": l.credit_amount,
                }
                for l in lines
            ],
        })

    return {"from_date": from_date, "to_date": to_date, "entries": result}


@router.get("/reports/sales")
def sales_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    customer_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Invoice)
    if from_date:
        query = query.where(Invoice.invoice_date >= from_date)
    if to_date:
        query = query.where(Invoice.invoice_date <= to_date)
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)

    invoices = session.exec(query.order_by(Invoice.invoice_date)).all()

    total_revenue = sum(i.subtotal for i in invoices)
    total_tax = sum(i.tax_amount for i in invoices)
    total_grand = sum(i.grand_total for i in invoices)
    total_paid = sum(i.amount_paid for i in invoices)
    total_outstanding = sum(i.balance_due for i in invoices)

    rows = []
    for inv in invoices:
        customer = session.get(Customer, inv.customer_id)
        rows.append({
            "invoice_number": inv.invoice_number,
            "invoice_date": inv.invoice_date,
            "customer": customer.company_name if customer else "N/A",
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "grand_total": inv.grand_total,
            "amount_paid": inv.amount_paid,
            "balance_due": inv.balance_due,
            "status": inv.status,
        })

    return {
        "period": {"from_date": from_date, "to_date": to_date},
        "summary": {
            "total_invoices": len(invoices),
            "total_revenue": round(total_revenue, 2),
            "total_tax": round(total_tax, 2),
            "total_grand": round(total_grand, 2),
            "total_paid": round(total_paid, 2),
            "total_outstanding": round(total_outstanding, 2),
        },
        "invoices": rows,
    }


@router.get("/reports/purchases")
def purchase_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    supplier_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(GoodsReceiptNote)
    if from_date:
        query = query.where(GoodsReceiptNote.received_date >= from_date)
    if to_date:
        query = query.where(GoodsReceiptNote.received_date <= to_date)
    if supplier_id:
        query = query.where(GoodsReceiptNote.supplier_id == supplier_id)

    grns = session.exec(query.order_by(GoodsReceiptNote.received_date)).all()

    rows = []
    for g in grns:
        supplier = session.get(Supplier, g.supplier_id)
        rows.append({
            "grn_number": g.grn_number,
            "received_date": g.received_date,
            "supplier": supplier.company_name if supplier else "N/A",
            "total_amount": g.total_amount,
            "amount_paid": g.amount_paid,
            "balance_due": g.balance_due,
        })

    return {
        "period": {"from_date": from_date, "to_date": to_date},
        "summary": {
            "total_grns": len(grns),
            "total_purchases": round(sum(g.total_amount for g in grns), 2),
            "total_paid": round(sum(g.amount_paid for g in grns), 2),
            "total_outstanding": round(sum(g.balance_due for g in grns), 2),
        },
        "grns": rows,
    }


@router.get("/reports/cogs")
def cogs_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """COGS from DISPATCH stock transactions, grouped by item."""
    query = select(StockTransaction).where(
        StockTransaction.transaction_type == TransactionType.DISPATCH.value
    )
    if from_date:
        query = query.where(StockTransaction.timestamp >= from_date)
    if to_date:
        query = query.where(StockTransaction.timestamp <= to_date)

    txns = session.exec(query.order_by(StockTransaction.timestamp)).all()

    item_map: dict = {}
    for t in txns:
        qty = abs(t.quantity_change)
        cost = (t.unit_cost or 0.0) * qty
        if t.item_id not in item_map:
            item = session.get(Item, t.item_id)
            item_map[t.item_id] = {
                "item_id": t.item_id,
                "item_name": item.name if item else "N/A",
                "sku": item.sku if item else "N/A",
                "total_qty_sold": 0.0,
                "total_cogs": 0.0,
            }
        item_map[t.item_id]["total_qty_sold"] += qty
        item_map[t.item_id]["total_cogs"] += cost

    rows = [
        {**v, "total_cogs": round(v["total_cogs"], 2)}
        for v in item_map.values()
    ]
    rows.sort(key=lambda x: x["total_cogs"], reverse=True)

    return {
        "period": {"from_date": from_date, "to_date": to_date},
        "total_cogs": round(sum(r["total_cogs"] for r in rows), 2),
        "by_item": rows,
    }
