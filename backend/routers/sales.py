from typing import List, Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from pydantic import BaseModel

from backend.database import get_session
from backend.models import (
    User, Customer, Item, InventoryStock, StockTransaction,
    SalesOrder, SalesOrderLine, DeliveryNote, DeliveryLine,
    Invoice, InvoiceLine, PaymentReceived, CreditNote,
    SOStatus, InvoiceStatus, DeliveryStatus, TransactionType, ItemType, PaymentMethod
)
from backend.auth import get_current_user, RoleChecker
from backend.services.ledger import post_journal, GL, JournalRefType

router = APIRouter(tags=["Sales"])

sales_roles = RoleChecker(["ADMIN", "SALES_OFFICER"])
dispatch_roles = RoleChecker(["ADMIN", "SALES_OFFICER", "STORE_KEEPER"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SOLineCreateSchema(BaseModel):
    finished_item_id: int
    quantity_ordered: float
    unit_price: float
    discount_pct: float = 0.0
    tax_pct: float = 15.0

class SOCreateSchema(BaseModel):
    customer_id: int
    order_date: date
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[SOLineCreateSchema]

class SOLineResponse(BaseModel):
    id: int
    finished_item_id: int
    quantity_ordered: float
    quantity_delivered: float
    unit_price: float
    discount_pct: float
    tax_pct: float
    line_total: float
    class Config:
        from_attributes = True

class SOResponse(BaseModel):
    id: int
    so_number: str
    customer_id: int
    customer_name: Optional[str] = None
    order_date: date
    expected_delivery_date: Optional[date]
    status: str
    grand_total: float
    notes: Optional[str]
    lines: List[SOLineResponse] = []
    created_at: datetime
    class Config:
        from_attributes = True

class DeliveryLineCreateSchema(BaseModel):
    so_line_id: int
    finished_item_id: int
    quantity_dispatched: float

class DeliveryCreateSchema(BaseModel):
    dispatch_date: date
    notes: Optional[str] = None
    lines: List[DeliveryLineCreateSchema]

class DeliveryResponse(BaseModel):
    id: int
    dn_number: str
    so_id: int
    customer_id: int
    dispatch_date: date
    delivery_date: Optional[date]
    status: str
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    so_id: int
    customer_id: int
    customer_name: Optional[str] = None
    invoice_date: date
    due_date: date
    subtotal: float
    tax_amount: float
    grand_total: float
    amount_paid: float
    balance_due: float
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class InvoiceLineResponse(BaseModel):
    id: int
    finished_item_id: int
    quantity: float
    unit_price: float
    tax_pct: float
    line_total: float
    class Config:
        from_attributes = True

class PaymentCreateSchema(BaseModel):
    payment_date: date
    amount: float
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    payment_number: str
    customer_id: int
    invoice_id: int
    payment_date: date
    amount: float
    payment_method: str
    reference_number: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class CreditNoteCreateSchema(BaseModel):
    cn_date: date
    reason: Optional[str] = None
    amount: float
    lines: List[DeliveryLineCreateSchema] = []  # items to restock

class CreditNoteResponse(BaseModel):
    id: int
    cn_number: str
    invoice_id: int
    customer_id: int
    cn_date: date
    reason: Optional[str]
    amount: float
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _next_so_number(session: Session) -> str:
    count = session.exec(select(func.count(SalesOrder.id))).one()
    return f"SO-{datetime.utcnow().year}-{(count + 1):04d}"

def _next_dn_number(session: Session) -> str:
    count = session.exec(select(func.count(DeliveryNote.id))).one()
    return f"DN-{datetime.utcnow().year}-{(count + 1):04d}"

def _next_invoice_number(session: Session) -> str:
    count = session.exec(select(func.count(Invoice.id))).one()
    return f"INV-{datetime.utcnow().year}-{(count + 1):04d}"

def _next_payment_number(session: Session) -> str:
    count = session.exec(select(func.count(PaymentReceived.id))).one()
    return f"PMT-{(count + 1):04d}"

def _next_cn_number(session: Session) -> str:
    count = session.exec(select(func.count(CreditNote.id))).one()
    return f"CN-{(count + 1):04d}"

def _line_total(qty: float, price: float, disc: float, tax: float) -> float:
    after_disc = qty * price * (1 - disc / 100)
    return round(after_disc * (1 + tax / 100), 2)

def _weighted_avg_cost(session: Session, item_id: int) -> float:
    """Compute weighted average unit cost from all STOCK_IN transactions."""
    txns = session.exec(
        select(StockTransaction).where(
            StockTransaction.item_id == item_id,
            StockTransaction.transaction_type == TransactionType.STOCK_IN.value,
            StockTransaction.unit_cost != None,
        )
    ).all()
    total_qty = sum(t.quantity_change for t in txns)
    total_cost = sum(t.quantity_change * t.unit_cost for t in txns)
    return round(total_cost / total_qty, 4) if total_qty > 0 else 0.0

def _get_outstanding_ar(session: Session, customer_id: int) -> float:
    invoices = session.exec(
        select(Invoice).where(
            Invoice.customer_id == customer_id,
            Invoice.status != InvoiceStatus.PAID.value,
        )
    ).all()
    return sum(i.balance_due for i in invoices)


# ─── Sales Order Endpoints ────────────────────────────────────────────────────

@router.get("/sales/orders", response_model=List[SOResponse])
def list_sales_orders(
    customer_id: Optional[int] = None,
    so_status: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(SalesOrder)
    if customer_id:
        query = query.where(SalesOrder.customer_id == customer_id)
    if so_status:
        query = query.where(SalesOrder.status == so_status)
    orders = session.exec(query.order_by(SalesOrder.created_at.desc())).all()
    result = []
    for o in orders:
        r = SOResponse.from_orm(o)
        if o.customer:
            r.customer_name = o.customer.company_name
        result.append(r)
    return result


@router.post("/sales/orders", response_model=SOResponse, status_code=201)
def create_sales_order(
    body: SOCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(sales_roles),
):
    customer = session.get(Customer, body.customer_id)
    if not customer or not customer.is_active:
        raise HTTPException(400, "Customer not found or inactive")

    grand_total = sum(
        _line_total(l.quantity_ordered, l.unit_price, l.discount_pct, l.tax_pct)
        for l in body.lines
    )

    so = SalesOrder(
        so_number=_next_so_number(session),
        customer_id=body.customer_id,
        order_date=body.order_date,
        expected_delivery_date=body.expected_delivery_date,
        status=SOStatus.DRAFT.value,
        notes=body.notes,
        grand_total=grand_total,
        created_by=current_user.id,
    )
    session.add(so)
    session.flush()

    for line in body.lines:
        item = session.get(Item, line.finished_item_id)
        if not item or item.item_type != ItemType.FINISHED_GOOD.value:
            raise HTTPException(400, f"Item {line.finished_item_id} is not a finished good")
        sol = SalesOrderLine(
            so_id=so.id,
            finished_item_id=line.finished_item_id,
            quantity_ordered=line.quantity_ordered,
            unit_price=line.unit_price,
            discount_pct=line.discount_pct,
            tax_pct=line.tax_pct,
            line_total=_line_total(line.quantity_ordered, line.unit_price, line.discount_pct, line.tax_pct),
        )
        session.add(sol)

    session.commit()
    session.refresh(so)
    return so


@router.get("/sales/orders/{so_id}", response_model=SOResponse)
def get_sales_order(
    so_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    so = session.get(SalesOrder, so_id)
    if not so:
        raise HTTPException(404, "Sales Order not found")
    r = SOResponse.from_orm(so)
    if so.customer:
        r.customer_name = so.customer.company_name
    return r


@router.patch("/sales/orders/{so_id}/confirm")
def confirm_sales_order(
    so_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(sales_roles),
):
    """
    Confirm a Sales Order:
    - Checks credit limit
    - Checks FG stock availability
    - Reserves stock (quantity_reserved += ordered)
    """
    so = session.get(SalesOrder, so_id)
    if not so:
        raise HTTPException(404, "Sales Order not found")
    if so.status != SOStatus.DRAFT.value:
        raise HTTPException(400, f"Cannot confirm SO with status '{so.status}'")

    customer = session.get(Customer, so.customer_id)
    if customer and customer.credit_limit > 0:
        outstanding = _get_outstanding_ar(session, so.customer_id)
        if outstanding + so.grand_total > customer.credit_limit:
            raise HTTPException(400,
                f"Credit limit exceeded. Outstanding: {outstanding:.2f}, "
                f"Limit: {customer.credit_limit:.2f}")

    lines = session.exec(
        select(SalesOrderLine).where(SalesOrderLine.so_id == so_id)
    ).all()

    for line in lines:
        stock = session.exec(
            select(InventoryStock).where(InventoryStock.item_id == line.finished_item_id)
        ).first()
        available = (stock.quantity_on_hand - stock.quantity_reserved) if stock else 0
        if available < line.quantity_ordered:
            raise HTTPException(400,
                f"Insufficient stock for item {line.finished_item_id}. "
                f"Available: {available}, Required: {line.quantity_ordered}")

    # Reserve stock
    for line in lines:
        stock = session.exec(
            select(InventoryStock).where(InventoryStock.item_id == line.finished_item_id)
        ).first()
        stock.quantity_reserved += line.quantity_ordered
        session.add(stock)

    so.status = SOStatus.CONFIRMED.value
    session.add(so)
    session.commit()
    return {"message": "Sales Order confirmed and stock reserved", "so_number": so.so_number}


# ─── Delivery Endpoints ───────────────────────────────────────────────────────

@router.post("/sales/orders/{so_id}/deliveries", response_model=DeliveryResponse, status_code=201)
def create_delivery(
    so_id: int,
    body: DeliveryCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(dispatch_roles),
):
    """
    Create a Delivery Note. Atomically:
      1. Creates DeliveryNote + lines
      2. Reduces FG stock (on_hand & reserved)
      3. Creates DISPATCH StockTransaction
      4. Posts COGS journal entry
    """
    so = session.get(SalesOrder, so_id)
    if not so:
        raise HTTPException(404, "Sales Order not found")
    if so.status not in [SOStatus.CONFIRMED.value, SOStatus.PARTIALLY_DELIVERED.value]:
        raise HTTPException(400, "SO must be CONFIRMED before dispatching")

    dn = DeliveryNote(
        dn_number=_next_dn_number(session),
        so_id=so_id,
        customer_id=so.customer_id,
        dispatch_date=body.dispatch_date,
        status=DeliveryStatus.DISPATCHED.value,
        dispatched_by=current_user.id,
        notes=body.notes,
    )
    session.add(dn)
    session.flush()

    total_cogs = 0.0

    for line in body.lines:
        unit_cost = _weighted_avg_cost(session, line.finished_item_id)
        cogs_amount = round(unit_cost * line.quantity_dispatched, 2)
        total_cogs += cogs_amount

        dl = DeliveryLine(
            dn_id=dn.id,
            so_line_id=line.so_line_id,
            finished_item_id=line.finished_item_id,
            quantity_dispatched=line.quantity_dispatched,
            unit_cost=unit_cost,
        )
        session.add(dl)

        # Reduce FG stock
        stock = session.exec(
            select(InventoryStock).where(InventoryStock.item_id == line.finished_item_id)
        ).first()
        if not stock or stock.quantity_on_hand < line.quantity_dispatched:
            raise HTTPException(400, f"Insufficient stock for item {line.finished_item_id}")

        stock.quantity_on_hand -= line.quantity_dispatched
        stock.quantity_reserved = max(stock.quantity_reserved - line.quantity_dispatched, 0)
        session.add(stock)

        # Stock transaction
        session.add(StockTransaction(
            item_id=line.finished_item_id,
            quantity_change=-line.quantity_dispatched,
            transaction_type=TransactionType.DISPATCH.value,
            performed_by=current_user.id,
            unit_cost=unit_cost,
            reference_number=dn.dn_number,
            notes=f"Dispatch for SO {so.so_number}",
        ))

        # Update SO line delivered qty
        so_line = session.get(SalesOrderLine, line.so_line_id)
        if so_line:
            so_line.quantity_delivered += line.quantity_dispatched
            session.add(so_line)

    # Post COGS journal
    if total_cogs > 0:
        post_journal(
            session=session,
            ref_type=JournalRefType.INVOICE.value,
            ref_id=dn.id,
            entry_date=body.dispatch_date,
            description=f"COGS on dispatch {dn.dn_number}",
            created_by=current_user.id,
            lines=[
                {"account_code": GL.COGS, "debit": total_cogs, "credit": 0.0},
                {"account_code": GL.FINISHED_GOODS_INV, "debit": 0.0, "credit": total_cogs},
            ],
        )

    # Update SO status
    so_lines = session.exec(select(SalesOrderLine).where(SalesOrderLine.so_id == so_id)).all()
    fully = all(l.quantity_delivered >= l.quantity_ordered for l in so_lines)
    so.status = SOStatus.FULLY_DELIVERED.value if fully else SOStatus.PARTIALLY_DELIVERED.value
    session.add(so)

    session.commit()
    session.refresh(dn)
    return dn


@router.get("/sales/deliveries", response_model=List[DeliveryResponse])
def list_deliveries(
    so_id: Optional[int] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(DeliveryNote)
    if so_id:
        query = query.where(DeliveryNote.so_id == so_id)
    return session.exec(query.order_by(DeliveryNote.created_at.desc())).all()


@router.patch("/sales/deliveries/{dn_id}/status")
def update_delivery_status(
    dn_id: int,
    new_status: DeliveryStatus,
    delivery_date: Optional[date] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(dispatch_roles),
):
    dn = session.get(DeliveryNote, dn_id)
    if not dn:
        raise HTTPException(404, "Delivery Note not found")
    dn.status = new_status.value
    if delivery_date:
        dn.delivery_date = delivery_date
    session.add(dn)
    session.commit()
    return {"message": f"Delivery status updated to {new_status.value}"}


# ─── Invoice Endpoints ────────────────────────────────────────────────────────

@router.post("/sales/orders/{so_id}/invoices", response_model=InvoiceResponse, status_code=201)
def create_invoice(
    so_id: int,
    invoice_date: date,
    session: Session = Depends(get_session),
    current_user: User = Depends(sales_roles),
):
    """
    Generate invoice from Sales Order. Atomically creates Invoice and posts AR journal.
    """
    so = session.get(SalesOrder, so_id)
    if not so:
        raise HTTPException(404, "Sales Order not found")
    if so.status not in [SOStatus.CONFIRMED.value, SOStatus.PARTIALLY_DELIVERED.value, SOStatus.FULLY_DELIVERED.value]:
        raise HTTPException(400, "SO must be confirmed before invoicing")

    customer = session.get(Customer, so.customer_id)
    due_date = invoice_date + timedelta(days=customer.payment_terms_days if customer else 30)

    lines = session.exec(select(SalesOrderLine).where(SalesOrderLine.so_id == so_id)).all()
    subtotal = sum(
        l.quantity_ordered * l.unit_price * (1 - l.discount_pct / 100)
        for l in lines
    )
    tax_amount = sum(
        l.quantity_ordered * l.unit_price * (1 - l.discount_pct / 100) * (l.tax_pct / 100)
        for l in lines
    )
    grand_total = round(subtotal + tax_amount, 2)

    inv = Invoice(
        invoice_number=_next_invoice_number(session),
        so_id=so_id,
        customer_id=so.customer_id,
        invoice_date=invoice_date,
        due_date=due_date,
        subtotal=round(subtotal, 2),
        tax_amount=round(tax_amount, 2),
        grand_total=grand_total,
        amount_paid=0.0,
        balance_due=grand_total,
        status=InvoiceStatus.UNPAID.value,
        created_by=current_user.id,
    )
    session.add(inv)
    session.flush()

    for line in lines:
        il = InvoiceLine(
            invoice_id=inv.id,
            so_line_id=line.id,
            finished_item_id=line.finished_item_id,
            quantity=line.quantity_ordered,
            unit_price=line.unit_price,
            tax_pct=line.tax_pct,
            line_total=line.line_total,
        )
        session.add(il)

    # Post AR journal: DR Accounts Receivable / CR Sales Revenue + VAT Payable
    tax_amount_r = round(tax_amount, 2)
    revenue = round(grand_total - tax_amount_r, 2)
    post_journal(
        session=session,
        ref_type=JournalRefType.INVOICE.value,
        ref_id=inv.id,
        entry_date=invoice_date,
        description=f"Sales invoice: {inv.invoice_number}",
        created_by=current_user.id,
        lines=[
            {"account_code": GL.ACCOUNTS_RECV, "debit": grand_total, "credit": 0.0},
            {"account_code": GL.SALES_REVENUE, "debit": 0.0, "credit": revenue},
            {"account_code": GL.VAT_PAYABLE, "debit": 0.0, "credit": tax_amount_r},
        ],
    )

    session.commit()
    session.refresh(inv)
    r = InvoiceResponse.from_orm(inv)
    if customer:
        r.customer_name = customer.company_name
    return r


@router.get("/sales/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    customer_id: Optional[int] = None,
    inv_status: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Invoice)
    if customer_id:
        query = query.where(Invoice.customer_id == customer_id)
    if inv_status:
        query = query.where(Invoice.status == inv_status)
    invoices = session.exec(query.order_by(Invoice.created_at.desc())).all()
    result = []
    for inv in invoices:
        r = InvoiceResponse.from_orm(inv)
        if inv.sales_order and inv.sales_order.customer:
            r.customer_name = inv.sales_order.customer.company_name
        result.append(r)
    return result


@router.get("/sales/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    lines = session.exec(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice_id)).all()
    payments = session.exec(select(PaymentReceived).where(PaymentReceived.invoice_id == invoice_id)).all()
    return {
        "invoice": InvoiceResponse.from_orm(inv),
        "lines": [InvoiceLineResponse.from_orm(l) for l in lines],
        "payments": [PaymentResponse.from_orm(p) for p in payments],
    }


# ─── Payment Endpoints ────────────────────────────────────────────────────────

@router.post("/sales/invoices/{invoice_id}/payments", response_model=PaymentResponse, status_code=201)
def record_payment(
    invoice_id: int,
    body: PaymentCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(sales_roles),
):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.status == InvoiceStatus.PAID.value:
        raise HTTPException(400, "Invoice is already fully paid")
    if body.amount > inv.balance_due:
        raise HTTPException(400, f"Payment {body.amount} exceeds balance due {inv.balance_due}")

    payment = PaymentReceived(
        payment_number=_next_payment_number(session),
        customer_id=inv.customer_id,
        invoice_id=invoice_id,
        payment_date=body.payment_date,
        amount=body.amount,
        payment_method=body.payment_method.value,
        reference_number=body.reference_number,
        notes=body.notes,
        recorded_by=current_user.id,
    )
    session.add(payment)
    session.flush()

    # Update invoice
    inv.amount_paid += body.amount
    inv.balance_due = max(inv.grand_total - inv.amount_paid, 0.0)
    if inv.balance_due <= 0:
        inv.status = InvoiceStatus.PAID.value
    else:
        inv.status = InvoiceStatus.PARTIALLY_PAID.value
    session.add(inv)

    # Post journal: DR Bank / CR Accounts Receivable
    post_journal(
        session=session,
        ref_type=JournalRefType.PAYMENT.value,
        ref_id=payment.id,
        entry_date=body.payment_date,
        description=f"Payment received for {inv.invoice_number}",
        created_by=current_user.id,
        lines=[
            {"account_code": GL.BANK_ACCOUNT, "debit": body.amount, "credit": 0.0},
            {"account_code": GL.ACCOUNTS_RECV, "debit": 0.0, "credit": body.amount},
        ],
    )

    session.commit()
    session.refresh(payment)
    return payment


# ─── Credit Note Endpoints ────────────────────────────────────────────────────

@router.post("/sales/invoices/{invoice_id}/credit-note", response_model=CreditNoteResponse, status_code=201)
def create_credit_note(
    invoice_id: int,
    body: CreditNoteCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(sales_roles),
):
    """
    Create a credit note (sales return). Atomically:
      1. Creates CreditNote
      2. Reduces AR
      3. Restocks FG items (if lines provided)
      4. Posts reversal journal entries
    """
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if body.amount > inv.grand_total:
        raise HTTPException(400, "Credit note amount cannot exceed invoice total")

    cn = CreditNote(
        cn_number=_next_cn_number(session),
        invoice_id=invoice_id,
        customer_id=inv.customer_id,
        cn_date=body.cn_date,
        reason=body.reason,
        amount=body.amount,
        created_by=current_user.id,
    )
    session.add(cn)
    session.flush()

    # Reduce AR on invoice
    inv.balance_due = max(inv.balance_due - body.amount, 0.0)
    inv.amount_paid = inv.grand_total - inv.balance_due
    if inv.balance_due <= 0:
        inv.status = InvoiceStatus.PAID.value
    session.add(inv)

    # Restock returned items
    for ret_line in body.lines:
        stock = session.exec(
            select(InventoryStock).where(InventoryStock.item_id == ret_line.finished_item_id)
        ).first()
        if stock:
            stock.quantity_on_hand += ret_line.quantity_dispatched
            session.add(stock)
        else:
            session.add(InventoryStock(
                item_id=ret_line.finished_item_id,
                quantity_on_hand=ret_line.quantity_dispatched,
                quantity_reserved=0.0,
            ))
        session.add(StockTransaction(
            item_id=ret_line.finished_item_id,
            quantity_change=ret_line.quantity_dispatched,
            transaction_type=TransactionType.RETURN.value,
            performed_by=current_user.id,
            reference_number=cn.cn_number,
            notes=f"Sales return credit note {cn.cn_number}",
        ))

    # Post reversal journal: DR Sales Returns / CR Accounts Receivable
    post_journal(
        session=session,
        ref_type=JournalRefType.CREDIT_NOTE.value,
        ref_id=cn.id,
        entry_date=body.cn_date,
        description=f"Credit note: {cn.cn_number} for {inv.invoice_number}",
        created_by=current_user.id,
        lines=[
            {"account_code": GL.SALES_RETURNS, "debit": body.amount, "credit": 0.0},
            {"account_code": GL.ACCOUNTS_RECV, "debit": 0.0, "credit": body.amount},
        ],
    )

    session.commit()
    session.refresh(cn)
    return cn
