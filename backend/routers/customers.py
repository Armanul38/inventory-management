from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from pydantic import BaseModel

from backend.database import get_session
from backend.models import Customer, SalesOrder, Invoice, PaymentReceived, CreditNote, CustomerType
from backend.auth import get_current_user, RoleChecker

router = APIRouter(tags=["Customers"])

sales_roles = RoleChecker(["ADMIN", "SALES_OFFICER"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CustomerCreateSchema(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    credit_limit: float = 0.0
    payment_terms_days: int = 30
    tax_id: Optional[str] = None
    customer_type: CustomerType = CustomerType.RETAIL

class CustomerUpdateSchema(CustomerCreateSchema):
    is_active: bool = True

class CustomerResponse(BaseModel):
    id: int
    customer_code: str
    company_name: str
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    billing_address: Optional[str]
    shipping_address: Optional[str]
    credit_limit: float
    payment_terms_days: int
    currency: str
    tax_id: Optional[str]
    customer_type: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Helper ───────────────────────────────────────────────────────────────────

def _next_customer_code(session: Session) -> str:
    count = session.exec(select(func.count(Customer.id))).one()
    return f"CUS-{(count + 1):04d}"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    customer_type: Optional[CustomerType] = None,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    query = select(Customer)
    if search:
        query = query.where(
            Customer.company_name.ilike(f"%{search}%") |
            Customer.customer_code.ilike(f"%{search}%")
        )
    if is_active is not None:
        query = query.where(Customer.is_active == is_active)
    if customer_type:
        query = query.where(Customer.customer_type == customer_type.value)
    return session.exec(query.order_by(Customer.company_name)).all()


@router.post("/customers", response_model=CustomerResponse, status_code=201)
def create_customer(
    body: CustomerCreateSchema,
    session: Session = Depends(get_session),
    current_user=Depends(sales_roles),
):
    customer = Customer(
        customer_code=_next_customer_code(session),
        company_name=body.company_name,
        contact_person=body.contact_person,
        phone=body.phone,
        email=body.email,
        billing_address=body.billing_address,
        shipping_address=body.shipping_address,
        credit_limit=body.credit_limit,
        payment_terms_days=body.payment_terms_days,
        tax_id=body.tax_id,
        customer_type=body.customer_type.value,
    )
    session.add(customer)
    session.commit()
    session.refresh(customer)
    return customer


@router.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    return c


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    body: CustomerUpdateSchema,
    session: Session = Depends(get_session),
    current_user=Depends(sales_roles),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    update_data = body.dict()
    update_data["customer_type"] = body.customer_type.value
    for k, v in update_data.items():
        setattr(c, k, v)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


@router.delete("/customers/{customer_id}", status_code=204)
def deactivate_customer(
    customer_id: int,
    session: Session = Depends(get_session),
    current_user=Depends(sales_roles),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")
    c.is_active = False
    session.add(c)
    session.commit()


@router.get("/customers/{customer_id}/ledger")
def customer_ledger(
    customer_id: int,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")

    invoices = session.exec(
        select(Invoice).where(Invoice.customer_id == customer_id)
    ).all()
    payments = session.exec(
        select(PaymentReceived).where(PaymentReceived.customer_id == customer_id)
    ).all()
    credit_notes = session.exec(
        select(CreditNote).where(CreditNote.customer_id == customer_id)
    ).all()

    total_invoiced = sum(i.grand_total for i in invoices)
    total_paid = sum(p.amount for p in payments)
    total_credited = sum(cn.amount for cn in credit_notes)
    outstanding = total_invoiced - total_paid - total_credited

    return {
        "customer": {
            "id": c.id, "customer_code": c.customer_code,
            "company_name": c.company_name, "credit_limit": c.credit_limit,
        },
        "summary": {
            "total_invoiced": round(total_invoiced, 2),
            "total_paid": round(total_paid, 2),
            "total_credited": round(total_credited, 2),
            "outstanding_balance": round(outstanding, 2),
            "available_credit": round(c.credit_limit - outstanding, 2),
        },
        "invoices": [
            {"invoice_number": i.invoice_number, "invoice_date": i.invoice_date,
             "due_date": i.due_date, "grand_total": i.grand_total,
             "amount_paid": i.amount_paid, "balance_due": i.balance_due,
             "status": i.status}
            for i in sorted(invoices, key=lambda x: x.invoice_date)
        ],
        "payments": [
            {"payment_number": p.payment_number, "payment_date": p.payment_date,
             "amount": p.amount, "payment_method": p.payment_method}
            for p in sorted(payments, key=lambda x: x.payment_date)
        ],
    }


@router.get("/customers/{customer_id}/statement")
def customer_statement(
    customer_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    c = session.get(Customer, customer_id)
    if not c:
        raise HTTPException(404, "Customer not found")

    inv_query = select(Invoice).where(Invoice.customer_id == customer_id)
    pay_query = select(PaymentReceived).where(PaymentReceived.customer_id == customer_id)

    if from_date:
        inv_query = inv_query.where(Invoice.invoice_date >= from_date)
        pay_query = pay_query.where(PaymentReceived.payment_date >= from_date)
    if to_date:
        inv_query = inv_query.where(Invoice.invoice_date <= to_date)
        pay_query = pay_query.where(PaymentReceived.payment_date <= to_date)

    invoices = session.exec(inv_query).all()
    payments = session.exec(pay_query).all()

    # Build chronological statement entries
    entries = []
    running_balance = 0.0

    all_events = (
        [("INVOICE", i.invoice_date, i.invoice_number, i.grand_total, 0.0) for i in invoices] +
        [("PAYMENT", p.payment_date, p.payment_number, 0.0, p.amount) for p in payments]
    )
    all_events.sort(key=lambda x: x[1])

    for event_type, evt_date, ref, debit, credit in all_events:
        running_balance += debit - credit
        entries.append({
            "date": evt_date, "type": event_type, "reference": ref,
            "debit": debit, "credit": credit, "balance": round(running_balance, 2),
        })

    return {
        "customer": {"id": c.id, "company_name": c.company_name,
                     "customer_code": c.customer_code},
        "period": {"from_date": from_date, "to_date": to_date},
        "closing_balance": round(running_balance, 2),
        "entries": entries,
    }
