from typing import Optional, List
from datetime import datetime, date
from enum import Enum
from sqlmodel import SQLModel, Field, Relationship


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    STORE_KEEPER = "STORE_KEEPER"
    PRODUCTION_SUPERVISOR = "PRODUCTION_SUPERVISOR"
    SALES_OFFICER = "SALES_OFFICER"
    PURCHASE_OFFICER = "PURCHASE_OFFICER"
    ACCOUNTANT = "ACCOUNTANT"

class ItemType(str, Enum):
    RAW_MATERIAL = "RAW_MATERIAL"
    SUPPLY = "SUPPLY"
    FINISHED_GOOD = "FINISHED_GOOD"

class JobStatus(str, Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class TransactionType(str, Enum):
    STOCK_IN = "STOCK_IN"
    ISSUE_TO_WIP = "ISSUE_TO_WIP"
    FG_PRODUCED = "FG_PRODUCED"
    DISPATCH = "DISPATCH"
    ADJUSTMENT = "ADJUSTMENT"
    RETURN = "RETURN"

class POStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    FULLY_RECEIVED = "FULLY_RECEIVED"
    CANCELLED = "CANCELLED"

class SOStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED"
    FULLY_DELIVERED = "FULLY_DELIVERED"
    CANCELLED = "CANCELLED"

class InvoiceStatus(str, Enum):
    UNPAID = "UNPAID"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    OVERDUE = "OVERDUE"

class PaymentMethod(str, Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    CHEQUE = "CHEQUE"
    MOBILE_BANKING = "MOBILE_BANKING"

class CustomerType(str, Enum):
    WHOLESALE = "WHOLESALE"
    RETAIL = "RETAIL"
    DISTRIBUTOR = "DISTRIBUTOR"

class AccountType(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class JournalRefType(str, Enum):
    GRN = "GRN"
    INVOICE = "INVOICE"
    PAYMENT = "PAYMENT"
    CREDIT_NOTE = "CREDIT_NOTE"
    SUPPLIER_PAYMENT = "SUPPLIER_PAYMENT"
    MANUAL = "MANUAL"

class DeliveryStatus(str, Enum):
    PENDING = "PENDING"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"


# ─── Existing Models ──────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    full_name: str = Field(nullable=False)
    role: str = Field(nullable=False)  # Stored as string, validated as UserRole
    is_active: bool = Field(default=True)

    # Relationships
    created_jobs: List["JobOrder"] = Relationship(back_populates="creator")
    performed_transactions: List["StockTransaction"] = Relationship(back_populates="performer")


class Item(SQLModel, table=True):
    __tablename__ = "items"
    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str = Field(unique=True, index=True, nullable=False)
    name: str = Field(nullable=False)
    item_type: str = Field(nullable=False)  # Stored as string, validated as ItemType
    unit_of_measure: str = Field(nullable=False)
    reorder_level: float = Field(default=0.0)

    # Relationships
    stock_records: List["InventoryStock"] = Relationship(back_populates="item")
    transactions: List["StockTransaction"] = Relationship(back_populates="item")
    job_orders: List["JobOrder"] = Relationship(back_populates="finished_item")


class InventoryStock(SQLModel, table=True):
    __tablename__ = "inventory_stock"
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", nullable=False)
    quantity_on_hand: float = Field(default=0.0)
    quantity_reserved: float = Field(default=0.0)   # reserved by confirmed Sales Orders
    location: Optional[str] = Field(default=None)

    # Relationships
    item: Item = Relationship(back_populates="stock_records")


class JobOrder(SQLModel, table=True):
    __tablename__ = "job_orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    order_number: str = Field(unique=True, index=True, nullable=False)
    finished_item_id: int = Field(foreign_key="items.id", nullable=False)
    target_quantity: float = Field(nullable=False)
    actual_yield: float = Field(default=0.0)
    scrap_quantity: float = Field(default=0.0)
    status: str = Field(default=JobStatus.DRAFT, nullable=False)  # Stored as string, validated as JobStatus
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    # Relationships
    finished_item: Item = Relationship(back_populates="job_orders")
    creator: User = Relationship(back_populates="created_jobs")
    transactions: List["StockTransaction"] = Relationship(back_populates="job_order")


class StockTransaction(SQLModel, table=True):
    __tablename__ = "stock_transactions"
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = Field(foreign_key="items.id", nullable=False)
    job_order_id: Optional[int] = Field(default=None, foreign_key="job_orders.id", nullable=True)
    quantity_change: float = Field(nullable=False)
    transaction_type: str = Field(nullable=False)  # Stored as string, validated as TransactionType
    performed_by: int = Field(foreign_key="users.id", nullable=False)
    timestamp: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    batch_number: Optional[str] = Field(default=None, nullable=True)
    unit_cost: Optional[float] = Field(default=None, nullable=True)
    reference_number: Optional[str] = Field(default=None, nullable=True)
    notes: Optional[str] = Field(default=None, nullable=True)

    # Relationships
    item: Item = Relationship(back_populates="transactions")
    job_order: Optional[JobOrder] = Relationship(back_populates="transactions")
    performer: User = Relationship(back_populates="performed_transactions")


# ─── Supplier Models ──────────────────────────────────────────────────────────

class Supplier(SQLModel, table=True):
    __tablename__ = "suppliers"
    id: Optional[int] = Field(default=None, primary_key=True)
    supplier_code: str = Field(unique=True, index=True, nullable=False)
    company_name: str = Field(nullable=False)
    contact_person: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    payment_terms_days: int = Field(default=30)
    currency: str = Field(default="BDT")
    tax_id: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    purchase_orders: List["PurchaseOrder"] = Relationship(back_populates="supplier")
    payments: List["SupplierPayment"] = Relationship(back_populates="supplier")


class PurchaseOrder(SQLModel, table=True):
    __tablename__ = "purchase_orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    po_number: str = Field(unique=True, index=True, nullable=False)
    supplier_id: int = Field(foreign_key="suppliers.id", nullable=False)
    order_date: date = Field(nullable=False)
    expected_delivery_date: Optional[date] = Field(default=None)
    status: str = Field(default=POStatus.DRAFT)
    notes: Optional[str] = Field(default=None)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    supplier: Supplier = Relationship(back_populates="purchase_orders")
    lines: List["PurchaseOrderLine"] = Relationship(back_populates="purchase_order")
    grns: List["GoodsReceiptNote"] = Relationship(back_populates="purchase_order")


class PurchaseOrderLine(SQLModel, table=True):
    __tablename__ = "purchase_order_lines"
    id: Optional[int] = Field(default=None, primary_key=True)
    po_id: int = Field(foreign_key="purchase_orders.id", nullable=False)
    item_id: int = Field(foreign_key="items.id", nullable=False)
    quantity_ordered: float = Field(nullable=False)
    quantity_received: float = Field(default=0.0)
    unit_cost: float = Field(nullable=False)
    line_total: float = Field(nullable=False)

    purchase_order: PurchaseOrder = Relationship(back_populates="lines")


class GoodsReceiptNote(SQLModel, table=True):
    __tablename__ = "goods_receipt_notes"
    id: Optional[int] = Field(default=None, primary_key=True)
    grn_number: str = Field(unique=True, index=True, nullable=False)
    po_id: int = Field(foreign_key="purchase_orders.id", nullable=False)
    supplier_id: int = Field(foreign_key="suppliers.id", nullable=False)
    received_date: date = Field(nullable=False)
    received_by: int = Field(foreign_key="users.id", nullable=False)
    notes: Optional[str] = Field(default=None)
    total_amount: float = Field(default=0.0)
    amount_paid: float = Field(default=0.0)
    balance_due: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    purchase_order: PurchaseOrder = Relationship(back_populates="grns")
    lines: List["GRNLine"] = Relationship(back_populates="grn")
    supplier_payments: List["SupplierPayment"] = Relationship(back_populates="grn")


class GRNLine(SQLModel, table=True):
    __tablename__ = "grn_lines"
    id: Optional[int] = Field(default=None, primary_key=True)
    grn_id: int = Field(foreign_key="goods_receipt_notes.id", nullable=False)
    item_id: int = Field(foreign_key="items.id", nullable=False)
    quantity_received: float = Field(nullable=False)
    unit_cost: float = Field(nullable=False)
    batch_number: Optional[str] = Field(default=None)

    grn: GoodsReceiptNote = Relationship(back_populates="lines")


class SupplierPayment(SQLModel, table=True):
    __tablename__ = "supplier_payments"
    id: Optional[int] = Field(default=None, primary_key=True)
    payment_number: str = Field(unique=True, index=True, nullable=False)
    supplier_id: int = Field(foreign_key="suppliers.id", nullable=False)
    grn_id: Optional[int] = Field(default=None, foreign_key="goods_receipt_notes.id")
    payment_date: date = Field(nullable=False)
    amount: float = Field(nullable=False)
    payment_method: str = Field(default=PaymentMethod.BANK_TRANSFER)
    reference_number: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    recorded_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    supplier: Supplier = Relationship(back_populates="payments")
    grn: Optional[GoodsReceiptNote] = Relationship(back_populates="supplier_payments")


# ─── Customer Models ──────────────────────────────────────────────────────────

class Customer(SQLModel, table=True):
    __tablename__ = "customers"
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_code: str = Field(unique=True, index=True, nullable=False)
    company_name: str = Field(nullable=False)
    contact_person: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    billing_address: Optional[str] = Field(default=None)
    shipping_address: Optional[str] = Field(default=None)
    credit_limit: float = Field(default=0.0)
    payment_terms_days: int = Field(default=30)
    currency: str = Field(default="BDT")
    tax_id: Optional[str] = Field(default=None)
    customer_type: str = Field(default=CustomerType.RETAIL)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    sales_orders: List["SalesOrder"] = Relationship(back_populates="customer")
    payments_received: List["PaymentReceived"] = Relationship(back_populates="customer")
    credit_notes: List["CreditNote"] = Relationship(back_populates="customer")


# ─── Sales Models ─────────────────────────────────────────────────────────────

class SalesOrder(SQLModel, table=True):
    __tablename__ = "sales_orders"
    id: Optional[int] = Field(default=None, primary_key=True)
    so_number: str = Field(unique=True, index=True, nullable=False)
    customer_id: int = Field(foreign_key="customers.id", nullable=False)
    order_date: date = Field(nullable=False)
    expected_delivery_date: Optional[date] = Field(default=None)
    status: str = Field(default=SOStatus.DRAFT)
    notes: Optional[str] = Field(default=None)
    grand_total: float = Field(default=0.0)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    customer: Customer = Relationship(back_populates="sales_orders")
    lines: List["SalesOrderLine"] = Relationship(back_populates="sales_order")
    invoices: List["Invoice"] = Relationship(back_populates="sales_order")
    deliveries: List["DeliveryNote"] = Relationship(back_populates="sales_order")


class SalesOrderLine(SQLModel, table=True):
    __tablename__ = "sales_order_lines"
    id: Optional[int] = Field(default=None, primary_key=True)
    so_id: int = Field(foreign_key="sales_orders.id", nullable=False)
    finished_item_id: int = Field(foreign_key="items.id", nullable=False)
    quantity_ordered: float = Field(nullable=False)
    quantity_delivered: float = Field(default=0.0)
    unit_price: float = Field(nullable=False)
    discount_pct: float = Field(default=0.0)
    tax_pct: float = Field(default=15.0)
    line_total: float = Field(nullable=False)  # qty × price × (1-disc) × (1+tax)

    sales_order: SalesOrder = Relationship(back_populates="lines")


class DeliveryNote(SQLModel, table=True):
    __tablename__ = "delivery_notes"
    id: Optional[int] = Field(default=None, primary_key=True)
    dn_number: str = Field(unique=True, index=True, nullable=False)
    so_id: int = Field(foreign_key="sales_orders.id", nullable=False)
    customer_id: int = Field(foreign_key="customers.id", nullable=False)
    dispatch_date: date = Field(nullable=False)
    delivery_date: Optional[date] = Field(default=None)
    status: str = Field(default=DeliveryStatus.PENDING)
    dispatched_by: int = Field(foreign_key="users.id", nullable=False)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    sales_order: SalesOrder = Relationship(back_populates="deliveries")
    lines: List["DeliveryLine"] = Relationship(back_populates="delivery_note")


class DeliveryLine(SQLModel, table=True):
    __tablename__ = "delivery_lines"
    id: Optional[int] = Field(default=None, primary_key=True)
    dn_id: int = Field(foreign_key="delivery_notes.id", nullable=False)
    so_line_id: int = Field(foreign_key="sales_order_lines.id", nullable=False)
    finished_item_id: int = Field(foreign_key="items.id", nullable=False)
    quantity_dispatched: float = Field(nullable=False)
    unit_cost: float = Field(default=0.0)  # weighted avg cost at dispatch time

    delivery_note: DeliveryNote = Relationship(back_populates="lines")


class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_number: str = Field(unique=True, index=True, nullable=False)
    so_id: int = Field(foreign_key="sales_orders.id", nullable=False)
    customer_id: int = Field(foreign_key="customers.id", nullable=False)
    invoice_date: date = Field(nullable=False)
    due_date: date = Field(nullable=False)
    subtotal: float = Field(default=0.0)
    tax_amount: float = Field(default=0.0)
    grand_total: float = Field(default=0.0)
    amount_paid: float = Field(default=0.0)
    balance_due: float = Field(default=0.0)
    status: str = Field(default=InvoiceStatus.UNPAID)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    sales_order: SalesOrder = Relationship(back_populates="invoices")
    lines: List["InvoiceLine"] = Relationship(back_populates="invoice")
    payments: List["PaymentReceived"] = Relationship(back_populates="invoice")
    credit_notes: List["CreditNote"] = Relationship(back_populates="invoice")


class InvoiceLine(SQLModel, table=True):
    __tablename__ = "invoice_lines"
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoices.id", nullable=False)
    so_line_id: int = Field(foreign_key="sales_order_lines.id", nullable=False)
    finished_item_id: int = Field(foreign_key="items.id", nullable=False)
    quantity: float = Field(nullable=False)
    unit_price: float = Field(nullable=False)
    tax_pct: float = Field(default=15.0)
    line_total: float = Field(nullable=False)

    invoice: Invoice = Relationship(back_populates="lines")


class PaymentReceived(SQLModel, table=True):
    __tablename__ = "payments_received"
    id: Optional[int] = Field(default=None, primary_key=True)
    payment_number: str = Field(unique=True, index=True, nullable=False)
    customer_id: int = Field(foreign_key="customers.id", nullable=False)
    invoice_id: int = Field(foreign_key="invoices.id", nullable=False)
    payment_date: date = Field(nullable=False)
    amount: float = Field(nullable=False)
    payment_method: str = Field(default=PaymentMethod.BANK_TRANSFER)
    reference_number: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    recorded_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    customer: Customer = Relationship(back_populates="payments_received")
    invoice: Invoice = Relationship(back_populates="payments")


class CreditNote(SQLModel, table=True):
    __tablename__ = "credit_notes"
    id: Optional[int] = Field(default=None, primary_key=True)
    cn_number: str = Field(unique=True, index=True, nullable=False)
    invoice_id: int = Field(foreign_key="invoices.id", nullable=False)
    customer_id: int = Field(foreign_key="customers.id", nullable=False)
    cn_date: date = Field(nullable=False)
    reason: Optional[str] = Field(default=None)
    amount: float = Field(nullable=False)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    invoice: Invoice = Relationship(back_populates="credit_notes")
    customer: Customer = Relationship(back_populates="credit_notes")


# ─── Accounts / Ledger Models ─────────────────────────────────────────────────

class ChartOfAccount(SQLModel, table=True):
    __tablename__ = "chart_of_accounts"
    id: Optional[int] = Field(default=None, primary_key=True)
    account_code: str = Field(unique=True, index=True, nullable=False)
    account_name: str = Field(nullable=False)
    account_type: str = Field(nullable=False)  # AccountType enum value
    parent_account_id: Optional[int] = Field(default=None, foreign_key="chart_of_accounts.id")
    is_active: bool = Field(default=True)

    journal_lines: List["JournalLine"] = Relationship(back_populates="account")


class JournalEntry(SQLModel, table=True):
    __tablename__ = "journal_entries"
    id: Optional[int] = Field(default=None, primary_key=True)
    entry_number: str = Field(unique=True, index=True, nullable=False)
    entry_date: date = Field(nullable=False)
    description: str = Field(nullable=False)
    reference_type: str = Field(nullable=False)  # JournalRefType enum value
    reference_id: Optional[int] = Field(default=None)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    lines: List["JournalLine"] = Relationship(back_populates="journal_entry")


class JournalLine(SQLModel, table=True):
    __tablename__ = "journal_lines"
    id: Optional[int] = Field(default=None, primary_key=True)
    journal_entry_id: int = Field(foreign_key="journal_entries.id", nullable=False)
    account_id: int = Field(foreign_key="chart_of_accounts.id", nullable=False)
    debit_amount: float = Field(default=0.0)
    credit_amount: float = Field(default=0.0)
    notes: Optional[str] = Field(default=None)

    journal_entry: JournalEntry = Relationship(back_populates="lines")
    account: ChartOfAccount = Relationship(back_populates="journal_lines")
