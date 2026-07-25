from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from pydantic import BaseModel

from backend.database import get_session
from backend.models import (
    User, Supplier, PurchaseOrder, PurchaseOrderLine,
    GoodsReceiptNote, GRNLine, SupplierPayment,
    InventoryStock, StockTransaction,
    POStatus, PaymentMethod, TransactionType
)
from backend.auth import get_current_user, RoleChecker
from backend.services.ledger import post_journal, GL, JournalRefType

router = APIRouter(tags=["Suppliers & Procurement"])

# Role checkers
procurement_roles = RoleChecker(["ADMIN", "PURCHASE_OFFICER", "STORE_KEEPER"])
purchase_only = RoleChecker(["ADMIN", "PURCHASE_OFFICER"])
admin_accountant = RoleChecker(["ADMIN", "ACCOUNTANT"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SupplierCreateSchema(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30
    tax_id: Optional[str] = None

class SupplierUpdateSchema(BaseModel):
    company_name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30
    tax_id: Optional[str] = None
    is_active: bool = True

class SupplierResponse(BaseModel):
    id: int
    supplier_code: str
    company_name: str
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    payment_terms_days: int
    currency: str
    tax_id: Optional[str]
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class POLineCreateSchema(BaseModel):
    item_id: int
    quantity_ordered: float
    unit_cost: float

class POCreateSchema(BaseModel):
    supplier_id: int
    order_date: date
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[POLineCreateSchema]

class POLineResponse(BaseModel):
    id: int
    item_id: int
    quantity_ordered: float
    quantity_received: float
    unit_cost: float
    line_total: float
    class Config:
        from_attributes = True

class POResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    supplier_name: Optional[str] = None
    order_date: date
    expected_delivery_date: Optional[date]
    status: str
    notes: Optional[str]
    lines: List[POLineResponse] = []
    created_at: datetime
    class Config:
        from_attributes = True

class GRNLineCreateSchema(BaseModel):
    item_id: int
    quantity_received: float
    unit_cost: float
    batch_number: Optional[str] = None

class GRNCreateSchema(BaseModel):
    received_date: date
    notes: Optional[str] = None
    lines: List[GRNLineCreateSchema]

class GRNResponse(BaseModel):
    id: int
    grn_number: str
    po_id: int
    supplier_id: int
    received_date: date
    total_amount: float
    amount_paid: float
    balance_due: float
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class SupplierPaymentCreateSchema(BaseModel):
    grn_id: Optional[int] = None
    payment_date: date
    amount: float
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    reference_number: Optional[str] = None
    notes: Optional[str] = None

class SupplierPaymentResponse(BaseModel):
    id: int
    payment_number: str
    supplier_id: int
    grn_id: Optional[int]
    payment_date: date
    amount: float
    payment_method: str
    reference_number: Optional[str]
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _next_supplier_code(session: Session) -> str:
    count = session.exec(select(func.count(Supplier.id))).one()
    return f"SUP-{(count + 1):04d}"

def _next_po_number(session: Session) -> str:
    count = session.exec(select(func.count(PurchaseOrder.id))).one()
    return f"PO-{datetime.utcnow().year}-{(count + 1):04d}"

def _next_grn_number(session: Session) -> str:
    count = session.exec(select(func.count(GoodsReceiptNote.id))).one()
    return f"GRN-{datetime.utcnow().year}-{(count + 1):04d}"

def _next_sp_number(session: Session) -> str:
    count = session.exec(select(func.count(SupplierPayment.id))).one()
    return f"SP-{(count + 1):04d}"


# ─── Supplier Endpoints ───────────────────────────────────────────────────────

@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(Supplier)
    if search:
        query = query.where(
            Supplier.company_name.ilike(f"%{search}%") |
            Supplier.supplier_code.ilike(f"%{search}%")
        )
    if is_active is not None:
        query = query.where(Supplier.is_active == is_active)
    return session.exec(query.order_by(Supplier.company_name)).all()


@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
def create_supplier(
    body: SupplierCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(purchase_only),
):
    supplier = Supplier(
        supplier_code=_next_supplier_code(session),
        **body.dict(),
    )
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    return supplier


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    s = session.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(404, "Supplier not found")
    return s


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    body: SupplierUpdateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(purchase_only),
):
    s = session.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(404, "Supplier not found")
    for k, v in body.dict().items():
        setattr(s, k, v)
    session.add(s)
    session.commit()
    session.refresh(s)
    return s


@router.delete("/suppliers/{supplier_id}", status_code=204)
def deactivate_supplier(
    supplier_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(purchase_only),
):
    s = session.get(Supplier, supplier_id)
    if not s:
        raise HTTPException(404, "Supplier not found")
    s.is_active = False
    session.add(s)
    session.commit()


# ─── Purchase Order Endpoints ─────────────────────────────────────────────────

@router.get("/purchase-orders", response_model=List[POResponse])
def list_purchase_orders(
    supplier_id: Optional[int] = None,
    po_status: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    query = select(PurchaseOrder)
    if supplier_id:
        query = query.where(PurchaseOrder.supplier_id == supplier_id)
    if po_status:
        query = query.where(PurchaseOrder.status == po_status)
    orders = session.exec(query.order_by(PurchaseOrder.created_at.desc())).all()
    result = []
    for o in orders:
        r = POResponse.from_orm(o)
        if o.supplier:
            r.supplier_name = o.supplier.company_name
        result.append(r)
    return result


@router.post("/purchase-orders", response_model=POResponse, status_code=201)
def create_purchase_order(
    body: POCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(purchase_only),
):
    supplier = session.get(Supplier, body.supplier_id)
    if not supplier or not supplier.is_active:
        raise HTTPException(400, "Supplier not found or inactive")

    po = PurchaseOrder(
        po_number=_next_po_number(session),
        supplier_id=body.supplier_id,
        order_date=body.order_date,
        expected_delivery_date=body.expected_delivery_date,
        notes=body.notes,
        status=POStatus.DRAFT,
        created_by=current_user.id,
    )
    session.add(po)
    session.flush()

    for line in body.lines:
        pol = PurchaseOrderLine(
            po_id=po.id,
            item_id=line.item_id,
            quantity_ordered=line.quantity_ordered,
            unit_cost=line.unit_cost,
            line_total=round(line.quantity_ordered * line.unit_cost, 2),
        )
        session.add(pol)

    session.commit()
    session.refresh(po)
    return po


@router.get("/purchase-orders/{po_id}", response_model=POResponse)
def get_purchase_order(
    po_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Purchase Order not found")
    r = POResponse.from_orm(po)
    if po.supplier:
        r.supplier_name = po.supplier.company_name
    return r


@router.patch("/purchase-orders/{po_id}/status")
def update_po_status(
    po_id: int,
    new_status: POStatus,
    session: Session = Depends(get_session),
    current_user: User = Depends(purchase_only),
):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Purchase Order not found")
    po.status = new_status.value
    session.add(po)
    session.commit()
    return {"message": f"PO status updated to {new_status.value}"}


# ─── GRN Endpoints ────────────────────────────────────────────────────────────

@router.post("/purchase-orders/{po_id}/grn", response_model=GRNResponse, status_code=201)
def create_grn(
    po_id: int,
    body: GRNCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(procurement_roles),
):
    """
    Create a Goods Receipt Note against a PO.
    Atomically:
      1. Creates GRN + GRN lines
      2. STOCK_IN for each line item
      3. Posts journal: DR Raw Material Inventory / CR Accounts Payable
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Purchase Order not found")
    if po.status == POStatus.CANCELLED:
        raise HTTPException(400, "Cannot receive against a cancelled PO")

    total_amount = sum(l.quantity_received * l.unit_cost for l in body.lines)

    grn = GoodsReceiptNote(
        grn_number=_next_grn_number(session),
        po_id=po_id,
        supplier_id=po.supplier_id,
        received_date=body.received_date,
        received_by=current_user.id,
        notes=body.notes,
        total_amount=round(total_amount, 2),
        amount_paid=0.0,
        balance_due=round(total_amount, 2),
    )
    session.add(grn)
    session.flush()

    for line in body.lines:
        grn_line = GRNLine(
            grn_id=grn.id,
            item_id=line.item_id,
            quantity_received=line.quantity_received,
            unit_cost=line.unit_cost,
            batch_number=line.batch_number,
        )
        session.add(grn_line)

        # Update or create InventoryStock
        stock = session.exec(
            select(InventoryStock).where(InventoryStock.item_id == line.item_id)
        ).first()
        if stock:
            stock.quantity_on_hand += line.quantity_received
            session.add(stock)
        else:
            session.add(InventoryStock(
                item_id=line.item_id,
                quantity_on_hand=line.quantity_received,
                quantity_reserved=0.0,
            ))

        # Stock transaction record
        session.add(StockTransaction(
            item_id=line.item_id,
            quantity_change=line.quantity_received,
            transaction_type=TransactionType.STOCK_IN.value,
            performed_by=current_user.id,
            unit_cost=line.unit_cost,
            batch_number=line.batch_number,
            reference_number=grn.grn_number,
            notes=f"GRN from supplier ID {po.supplier_id}",
        ))

    # Update PO line quantities received and PO status
    for grn_line_in in body.lines:
        po_line = session.exec(
            select(PurchaseOrderLine).where(
                PurchaseOrderLine.po_id == po_id,
                PurchaseOrderLine.item_id == grn_line_in.item_id,
            )
        ).first()
        if po_line:
            po_line.quantity_received += grn_line_in.quantity_received
            session.add(po_line)

    # Post double-entry journal
    post_journal(
        session=session,
        ref_type=JournalRefType.GRN.value,
        ref_id=grn.id,
        entry_date=body.received_date,
        description=f"Goods received: {grn.grn_number}",
        created_by=current_user.id,
        lines=[
            {"account_code": GL.RAW_MATERIAL_INV, "debit": total_amount, "credit": 0.0,
             "notes": grn.grn_number},
            {"account_code": GL.ACCOUNTS_PAY, "debit": 0.0, "credit": total_amount,
             "notes": f"AP for {grn.grn_number}"},
        ],
    )

    # Refresh PO status
    all_lines = session.exec(select(PurchaseOrderLine).where(PurchaseOrderLine.po_id == po_id)).all()
    fully = all(l.quantity_received >= l.quantity_ordered for l in all_lines)
    po.status = POStatus.FULLY_RECEIVED.value if fully else POStatus.PARTIALLY_RECEIVED.value
    session.add(po)

    session.commit()
    session.refresh(grn)
    return grn


@router.get("/purchase-orders/{po_id}/grns", response_model=List[GRNResponse])
def list_grns_for_po(
    po_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    grns = session.exec(
        select(GoodsReceiptNote).where(GoodsReceiptNote.po_id == po_id)
    ).all()
    return grns


# ─── Supplier Ledger & Payments ───────────────────────────────────────────────

@router.get("/suppliers/{supplier_id}/ledger")
def supplier_ledger(
    supplier_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    grns = session.exec(
        select(GoodsReceiptNote).where(GoodsReceiptNote.supplier_id == supplier_id)
    ).all()
    payments = session.exec(
        select(SupplierPayment).where(SupplierPayment.supplier_id == supplier_id)
    ).all()

    total_purchases = sum(g.total_amount for g in grns)
    total_paid = sum(p.amount for p in payments)
    outstanding = total_purchases - total_paid

    return {
        "supplier": {"id": supplier.id, "company_name": supplier.company_name,
                     "supplier_code": supplier.supplier_code},
        "summary": {
            "total_purchases": round(total_purchases, 2),
            "total_paid": round(total_paid, 2),
            "outstanding_balance": round(outstanding, 2),
        },
        "grns": [
            {"grn_number": g.grn_number, "received_date": g.received_date,
             "total_amount": g.total_amount, "amount_paid": g.amount_paid,
             "balance_due": g.balance_due}
            for g in sorted(grns, key=lambda x: x.received_date)
        ],
        "payments": [
            {"payment_number": p.payment_number, "payment_date": p.payment_date,
             "amount": p.amount, "payment_method": p.payment_method,
             "reference_number": p.reference_number}
            for p in sorted(payments, key=lambda x: x.payment_date)
        ],
    }


@router.post("/suppliers/{supplier_id}/payments", response_model=SupplierPaymentResponse, status_code=201)
def record_supplier_payment(
    supplier_id: int,
    body: SupplierPaymentCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(procurement_roles),
):
    supplier = session.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(404, "Supplier not found")

    payment = SupplierPayment(
        payment_number=_next_sp_number(session),
        supplier_id=supplier_id,
        grn_id=body.grn_id,
        payment_date=body.payment_date,
        amount=body.amount,
        payment_method=body.payment_method.value,
        reference_number=body.reference_number,
        notes=body.notes,
        recorded_by=current_user.id,
    )
    session.add(payment)
    session.flush()

    # Update GRN balance if linked
    if body.grn_id:
        grn = session.get(GoodsReceiptNote, body.grn_id)
        if grn:
            grn.amount_paid = min(grn.amount_paid + body.amount, grn.total_amount)
            grn.balance_due = max(grn.total_amount - grn.amount_paid, 0.0)
            session.add(grn)

    # Post journal: DR Accounts Payable / CR Bank
    post_journal(
        session=session,
        ref_type=JournalRefType.SUPPLIER_PAYMENT.value,
        ref_id=payment.id,
        entry_date=body.payment_date,
        description=f"Supplier payment: {supplier.company_name}",
        created_by=current_user.id,
        lines=[
            {"account_code": GL.ACCOUNTS_PAY, "debit": body.amount, "credit": 0.0},
            {"account_code": GL.BANK_ACCOUNT, "debit": 0.0, "credit": body.amount},
        ],
    )

    session.commit()
    session.refresh(payment)
    return payment
