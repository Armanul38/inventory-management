Requirements Specification
Supplier, Customer, Sales & Accounts Modules
Inventory & Production Management System — Extension
IMPORTANT

This document extends the existing SRS. All existing modules (Inventory, WIP, Finished Goods, User Management) remain unchanged. The new modules integrate into the same FastAPI + Next.js + PostgreSQL stack.

1. Updated System Flow

[ SUPPLIER ]
     |
     | Purchase Order → Goods Receipt
     v
+-----------------------------------+
|    1. Company Inventory           |
|    (Raw Materials & Supplies)     |
+-----------------------------------+
              |
              | Issue Materials to Production
              v
+-----------------------------------+
|    2. Working Process (WIP)       |
|    (Job / Batch Orders)           |
+-----------------------------------+
              |
              | Complete Job / Produce
              v
+-----------------------------------+
|    3. Finished Goods              |
|    (Completed Inventory)          |
+-----------------------------------+
              |
              | Sales Order → Invoice → Delivery
              v
+-----------------------------------+
|    4. Sales                       |
|    (Orders, Invoices, Receipts)   |
+-----------------------------------+
              |
              | Payment Received
              v
[ CUSTOMER ]          [ ACCOUNTS / LEDGER ]
                              |
                    +---------+---------+
                    |                   |
              Accounts             Accounts
              Receivable           Payable
              (Customers)         (Suppliers)
2. New Roles & Permissions
Role	New Permissions Added
Admin	Full access to all new modules; approve credit limits; view all ledger reports
Sales Officer (new)	Create & manage customers; create sales orders & invoices; record customer payments
Purchase Officer (new)	Create & manage suppliers; create purchase orders; record supplier payments
Accountant (new)	Full ledger access; journal entries; financial reports; reconciliation
Store Keeper (existing)	Receive goods against purchase orders; dispatch goods against sales orders
3. Module 4 — Supplier Management
3.1 Objectives
Maintain a master registry of all vendors who supply raw materials. Link every raw material stock-in transaction to a verified supplier and track outstanding payables.

3.2 Supplier Master Data
Field	Type	Notes
id	Int / UUID	Primary Key
supplier_code	String	Unique, auto-generated (e.g. SUP-001)
company_name	String	Vendor company name
contact_person	String	Primary point of contact
phone	String	Contact number
email	String	Contact email
address	Text	Physical / mailing address
payment_terms_days	Int	Credit period (e.g. 30, 60, 90 days)
currency	String	Default BDT or configurable
tax_id	String	Nullable — VAT/TIN number
is_active	Boolean	Soft delete flag
created_at	Timestamp	
3.3 Key Functions
Supplier CRUD — Create, view, update, deactivate suppliers.
Link to Stock-In — Every raw material goods receipt must reference a supplier_id.
Purchase Orders (PO)
Raise a PO against a supplier listing raw material items, quantities, and agreed unit prices.
PO statuses: DRAFT → SENT → PARTIALLY_RECEIVED → FULLY_RECEIVED → CANCELLED.
Goods Receipt Note (GRN)
When goods arrive, Store Keeper creates a GRN against the PO.
GRN auto-triggers a STOCK_IN transaction and creates an Accounts Payable entry.
Supplier Payment
Record payments against outstanding AP entries.
Partial payments supported; balance tracked.
Supplier Ledger
Full transaction history per supplier: POs raised, GRNs received, payments made, outstanding balance.
3.4 API Endpoints (Supplier)

GET    /api/v1/suppliers                   List all suppliers
POST   /api/v1/suppliers                   Create supplier
GET    /api/v1/suppliers/{id}              Get supplier detail
PUT    /api/v1/suppliers/{id}              Update supplier
DELETE /api/v1/suppliers/{id}              Deactivate supplier
GET    /api/v1/purchase-orders             List POs
POST   /api/v1/purchase-orders             Create PO
GET    /api/v1/purchase-orders/{id}        PO detail with line items
PATCH  /api/v1/purchase-orders/{id}/status Update PO status
POST   /api/v1/purchase-orders/{id}/grn    Create GRN (triggers stock-in + AP)
GET    /api/v1/suppliers/{id}/ledger       Supplier ledger statement
POST   /api/v1/suppliers/{id}/payments     Record supplier payment
4. Module 5 — Customer Management
4.1 Objectives
Maintain a registry of all buyers of finished goods. Track credit limits, outstanding receivables, and full sales history per customer.

4.2 Customer Master Data
Field	Type	Notes
id	Int / UUID	Primary Key
customer_code	String	Unique, auto-generated (e.g. CUS-001)
company_name	String	Buyer company / individual name
contact_person	String	
phone	String	
email	String	
billing_address	Text	
shipping_address	Text	Nullable if same as billing
credit_limit	Numeric	Max outstanding balance allowed
payment_terms_days	Int	Due date calculation (e.g. 30 days from invoice)
currency	String	Default BDT
tax_id	String	Nullable
customer_type	Enum	WHOLESALE, RETAIL, DISTRIBUTOR
is_active	Boolean	
created_at	Timestamp	
4.3 Key Functions
Customer CRUD — Create, view, update, deactivate customers.
Credit Control — Block new sales orders if customer's outstanding AR exceeds credit_limit.
Customer Ledger — Full history: sales orders, invoices, payments received, outstanding balance.
Statement of Account — Printable/exportable statement for a date range.
4.4 API Endpoints (Customer)

GET    /api/v1/customers                   List all customers
POST   /api/v1/customers                   Create customer
GET    /api/v1/customers/{id}              Customer detail
PUT    /api/v1/customers/{id}              Update customer
DELETE /api/v1/customers/{id}              Deactivate customer
GET    /api/v1/customers/{id}/ledger       Customer ledger statement
GET    /api/v1/customers/{id}/statement    Statement of account (date range)
5. Module 6 — Sales Module
5.1 Objectives
Handle the complete order-to-cash cycle: Sales Order → Invoice → Delivery → Payment Receipt.

5.2 Sales Order
Sales Order (SO) Master

Field	Type	Notes
id	Int / UUID	Primary Key
so_number	String	Unique, auto-generated (e.g. SO-2025-001)
customer_id	FK → Customers	
order_date	Date	
expected_delivery_date	Date	Nullable
status	Enum	DRAFT → CONFIRMED → PARTIALLY_DELIVERED → FULLY_DELIVERED → CANCELLED
notes	Text	Nullable
created_by	FK → Users	
created_at	Timestamp	
Sales Order Line Items

Field	Type	Notes
id	Int / UUID	Primary Key
so_id	FK → Sales_Orders	
finished_item_id	FK → Items	Must be FINISHED_GOOD type
quantity_ordered	Numeric	
unit_price	Numeric	Selling price at time of order
discount_pct	Numeric	Default 0
tax_pct	Numeric	e.g. VAT 15%
line_total	Numeric	Computed: qty × price × (1 - discount) × (1 + tax)
5.3 Delivery / Dispatch Note
Created against a confirmed SO (partial or full delivery).
Each delivery reduces quantity_on_hand in Finished Goods stock.
Auto-creates a DISPATCH stock transaction (links back to existing Stock_Transactions).
Delivery statuses: PENDING → DISPATCHED → DELIVERED.
5.4 Sales Invoice
Generated from a confirmed SO (can be proforma or tax invoice).
Invoice auto-creates an Accounts Receivable debit entry in the ledger.
An SO can have multiple invoices (for partial billing).
Invoice Fields

Field	Notes
invoice_number	Unique, auto-generated (e.g. INV-2025-001)
so_id	Linked Sales Order
customer_id	
invoice_date	
due_date	invoice_date + customer.payment_terms_days
subtotal	Sum of line totals before tax
tax_amount	Total tax
grand_total	Final payable amount
status	UNPAID → PARTIALLY_PAID → PAID → OVERDUE
5.5 Payment Receipt
Record customer payments against one or more invoices.
Payment methods: CASH, BANK_TRANSFER, CHEQUE, MOBILE_BANKING.
Partial payments allowed; remaining balance tracked in AR.
Creates a ledger credit entry (reduces AR, increases Cash/Bank).
5.6 Sales Returns
Customer can return finished goods (damage, wrong item, etc.).
Creates a Credit Note against the original invoice.
Returns stock back into Finished Goods inventory.
Reduces AR balance by the credit note amount.
5.7 API Endpoints (Sales)

GET    /api/v1/sales/orders                      List sales orders
POST   /api/v1/sales/orders                      Create SO
GET    /api/v1/sales/orders/{id}                 SO detail with line items
PATCH  /api/v1/sales/orders/{id}/confirm         Confirm SO
POST   /api/v1/sales/orders/{id}/deliveries      Create delivery note (dispatch)
POST   /api/v1/sales/orders/{id}/invoices        Generate invoice from SO
GET    /api/v1/sales/invoices                    List all invoices
GET    /api/v1/sales/invoices/{id}               Invoice detail
POST   /api/v1/sales/invoices/{id}/payments      Record payment receipt
POST   /api/v1/sales/invoices/{id}/credit-note   Create credit note (return)
GET    /api/v1/sales/deliveries                  List all delivery notes
PATCH  /api/v1/sales/deliveries/{id}/status      Update delivery status
6. Module 7 — Accounts & Ledger
6.1 Objectives
Maintain a double-entry general ledger that accurately tracks all financial movements — purchases, sales, payments, and adjustments — and supports financial reporting.

6.2 Chart of Accounts (CoA)
A predefined set of accounts is seeded at system setup. Additional accounts can be created by Admin/Accountant.

Account Code	Account Name	Type
1000	Cash in Hand	Asset
1010	Bank Account	Asset
1100	Accounts Receivable	Asset
1200	Raw Material Inventory	Asset
1300	Finished Goods Inventory	Asset
2000	Accounts Payable	Liability
3000	Owner's Equity	Equity
4000	Sales Revenue	Income
4010	Sales Returns & Allowances	Income (contra)
5000	Cost of Goods Sold (COGS)	Expense
5100	Raw Material Purchases	Expense
5200	Production Overhead	Expense
6000	Operating Expenses	Expense
6010	VAT / Tax Payable	Liability
6.3 Journal Entries
Every financial event auto-generates a double-entry journal:

Event	Debit	Credit
Goods Received from Supplier	Raw Material Inventory (1200)	Accounts Payable (2000)
Pay Supplier	Accounts Payable (2000)	Cash/Bank (1000/1010)
Sales Invoice Raised	Accounts Receivable (1100)	Sales Revenue (4000)
COGS on Dispatch	COGS (5000)	Finished Goods Inventory (1300)
Customer Payment Received	Cash/Bank (1000/1010)	Accounts Receivable (1100)
Sales Return	Sales Returns (4010) + FG Inventory (1300)	Accounts Receivable (1100) + COGS (5000)
Manual Adjustment	User-defined	User-defined
6.4 Accounts Payable (AP)
An AP entry is created for every GRN (goods received from supplier).
AP is reduced when supplier payments are recorded.
AP Aging Report: Buckets outstanding payables into: Current, 1–30 days, 31–60 days, 61–90 days, 90+ days.
6.5 Accounts Receivable (AR)
An AR entry is created for every sales invoice.
AR is reduced when customer payments are received or credit notes are applied.
AR Aging Report: Same aging buckets as AP.
Overdue Alert: Auto-flag invoices past their due date.
6.6 Financial Reports
Report	Description
General Ledger	All journal entries, filterable by account, date range
Trial Balance	Sum of all debits vs credits per account at a point in time
Accounts Receivable Aging	Outstanding customer balances by age bucket
Accounts Payable Aging	Outstanding supplier balances by age bucket
Sales Report	Revenue by period, by customer, by product
Purchase Report	Purchases by period, by supplier, by item
Customer Statement	Per-customer: invoices, payments, balance
Supplier Statement	Per-supplier: POs, GRNs, payments, balance
COGS Report	Cost of goods sold by period / by product
6.7 API Endpoints (Accounts)

GET    /api/v1/accounts/chart-of-accounts          List all GL accounts
POST   /api/v1/accounts/chart-of-accounts          Create new GL account
POST   /api/v1/accounts/journal-entries            Manual journal entry
GET    /api/v1/accounts/journal-entries            List journal entries (filterable)
GET    /api/v1/accounts/payable                    AP summary (by supplier)
GET    /api/v1/accounts/payable/aging              AP aging report
GET    /api/v1/accounts/receivable                 AR summary (by customer)
GET    /api/v1/accounts/receivable/aging           AR aging report
GET    /api/v1/reports/trial-balance               Trial balance
GET    /api/v1/reports/general-ledger              General ledger (date range)
GET    /api/v1/reports/sales                       Sales report
GET    /api/v1/reports/purchases                   Purchase report
GET    /api/v1/reports/cogs                        Cost of Goods Sold report
7. Updated Data Models
Suppliers

id, supplier_code, company_name, contact_person, phone, email,
address, payment_terms_days, currency, tax_id, is_active, created_at
Customers

id, customer_code, company_name, contact_person, phone, email,
billing_address, shipping_address, credit_limit, payment_terms_days,
currency, tax_id, customer_type, is_active, created_at
Purchase_Orders

id, po_number, supplier_id, order_date, expected_delivery_date,
status, notes, created_by, created_at
Purchase_Order_Lines

id, po_id, item_id, quantity_ordered, quantity_received, unit_cost, line_total
Goods_Receipt_Notes (GRN)

id, grn_number, po_id, supplier_id, received_date,
received_by, notes, created_at
GRN_Lines

id, grn_id, item_id, quantity_received, unit_cost, batch_number
Sales_Orders

id, so_number, customer_id, order_date, expected_delivery_date,
status, notes, created_by, created_at
Sales_Order_Lines

id, so_id, finished_item_id, quantity_ordered, quantity_delivered,
unit_price, discount_pct, tax_pct, line_total
Delivery_Notes

id, dn_number, so_id, customer_id, dispatch_date, delivery_date,
status, dispatched_by, notes, created_at
Delivery_Lines

id, dn_id, so_line_id, finished_item_id, quantity_dispatched
Invoices

id, invoice_number, so_id, customer_id, invoice_date, due_date,
subtotal, tax_amount, grand_total, amount_paid, balance_due,
status, created_by, created_at
Invoice_Lines

id, invoice_id, so_line_id, finished_item_id,
quantity, unit_price, tax_pct, line_total
Payments_Received

id, payment_number, customer_id, invoice_id, payment_date,
amount, payment_method, reference_number, notes, recorded_by, created_at
Credit_Notes

id, cn_number, invoice_id, customer_id, cn_date,
reason, amount, status, created_by, created_at
Supplier_Payments

id, payment_number, supplier_id, grn_id, payment_date,
amount, payment_method, reference_number, notes, recorded_by, created_at
Chart_Of_Accounts

id, account_code, account_name, account_type (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE),
parent_account_id, is_active
Journal_Entries

id, entry_number, entry_date, description, reference_type
(GRN/INVOICE/PAYMENT/MANUAL), reference_id, created_by, created_at
Journal_Lines

id, journal_entry_id, account_id, debit_amount, credit_amount, notes
8. Business Logic Rules
Credit Limit Enforcement — A Sales Order cannot be confirmed if the customer's total outstanding AR would exceed their credit_limit.
Stock Reservation — On SO confirmation, the ordered quantities are reserved in Finished Goods so they cannot be double-sold.
Invoice Before Dispatch (optional) — Configurable: system can require an invoice to exist before a delivery note is dispatched.
COGS Calculation — Automatically computed on dispatch using the weighted average cost of the finished goods batch.
Immutable Ledger — Journal entries can never be deleted. Reversals require a counter-entry.
Atomic Transactions — GRN creation, invoice creation, and payment recording each execute inside a single DB transaction (stock change + ledger entry together).
Overdue Auto-Update — A scheduled task (daily) updates invoice status to OVERDUE if due_date < today and balance_due > 0.
Tax Handling — VAT/tax is calculated per line item and collected into 6010 VAT Payable account on invoicing.
9. Frontend Pages (New)
Page	Path	Role Access
Supplier List	/suppliers	Admin, Purchase Officer
Supplier Detail / Ledger	/suppliers/[id]	Admin, Purchase Officer, Accountant
Purchase Orders	/purchase-orders	Admin, Purchase Officer
PO Detail + GRN	/purchase-orders/[id]	Admin, Purchase Officer, Store Keeper
Customer List	/customers	Admin, Sales Officer
Customer Detail / Ledger	/customers/[id]	Admin, Sales Officer, Accountant
Sales Orders	/sales/orders	Admin, Sales Officer
SO Detail + Delivery	/sales/orders/[id]	Admin, Sales Officer, Store Keeper
Invoices	/sales/invoices	Admin, Sales Officer, Accountant
Invoice Detail + Payment	/sales/invoices/[id]	Admin, Sales Officer, Accountant
Accounts Payable	/accounts/payable	Admin, Accountant
Accounts Receivable	/accounts/receivable	Admin, Accountant
General Ledger	/accounts/ledger	Admin, Accountant
Reports	/reports	Admin, Accountant
10. Open Questions for Review
IMPORTANT

Please review and confirm the following before implementation begins:

Currency — Is the system single-currency (BDT only) or multi-currency?
Tax — Is VAT applicable? What is the rate — fixed (15%) or per-item configurable?
Inventory Costing Method — FIFO, LIFO, or Weighted Average Cost for COGS?
Sales Returns — Should returned finished goods go back into sellable inventory, or a separate "returns" bin?
Purchase Returns — Do you need the ability to return goods back to suppliers (Debit Notes)?
Proforma Invoice — Do you need proforma invoices before confirmed tax invoices?
Roles — Should Sales Officer, Purchase Officer, and Accountant be separate roles, or combined with existing roles?
Partial Payments — Can a single payment cover multiple invoices at once?