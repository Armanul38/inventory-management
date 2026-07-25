# System Requirements Specification (SRS)
## Inventory & Production Management System

---

## 1. Executive Summary

This document defines the functional and technical requirements for a streamlined **Inventory and Production Management System** built with **FastAPI** (Backend) and **Next.js** (Frontend). 

The system tracks the complete lifecycle of materials through three primary operational states:
1. **Company Inventory (Raw Materials & Supplies):** Receiving, holding, and issuing raw inputs.
2. **Working Process (Work-In-Progress / WIP):** Active manufacturing/assembly job orders consuming raw materials.
3. **Finished Goods:** Completed product stock ready for sales or dispatch.

A role-based **User Management** system governs access across all operational stages.

---

## 2. Core Material Flow

```
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
                  | Dispatch / Sales Out
                  v
              [ Customer ]
```

---

## 3. Module Breakdown & Functional Requirements

### 3.1 User Management & Access Control

#### Objectives
* Control user access based on organizational roles.
* Maintain complete auditability over stock movements and job status updates.

#### Roles & Permissions
* **Admin**
  * Full access to user lifecycle management (create, update, deactivate).
  * System-wide configuration access.
  * Stock adjustment overrides and raw transaction audit logs access.
* **Store Keeper**
  * Record incoming raw material shipments (Stock In).
  * Approve and issue raw materials to active production jobs.
  * Receive completed finished goods into warehouse storage.
  * Record finished goods dispatches.
* **Production Supervisor**
  * Create and manage Work-In-Progress (WIP) Job Orders.
  * Request material requisitions for production batches.
  * Record batch yields, scrap/waste, and mark job orders as completed.

---

### 3.2 Company Inventory (Raw Materials & Supplies)

#### Objectives
Manage raw items, component stock, and factory consumables prior to manufacturing usage.

#### Key Functions
1. **Catalog Management:**
   * Unique SKU / Code assignment.
   * Item naming, description, and categorization.
   * Unit of Measure (UOM): *e.g., Kilograms, Meters, Units, Liters, Boxes*.
   * Low-stock reorder thresholds.
2. **Stock-In Operations:**
   * Log incoming shipments with supplier reference numbers, batch numbers, and unit costs.
3. **Material Requisition (Issue to WIP):**
   * Deduct specified raw items from active inventory and transfer them to a designated Job Order.
4. **Stock Adjustments & Waste Logging:**
   * Manual recount corrections and damage write-offs with obligatory reason codes.

---

### 3.3 Working Process (Work-In-Progress / WIP)

#### Objectives
Track active production orders, monitor material consumption, and record waste/scrap during manufacturing.

#### Key Functions
1. **Job Order Creation:**
   * Define job order numbers, target finished product, target yield quantity, and start date.
2. **Material Allocation:**
   * Attach consumed raw materials directly to the active job order.
3. **Job Status Lifecycle:**
   * `DRAFT` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` / `CANCELLED`.
4. **Yield & Scrap Accounting:**
   * Track usable output units vs. scrap/defective units upon batch completion.

---

### 3.4 Finished Goods Management

#### Objectives
Track completed products ready for dispatch, calculate production unit costs, and record outbound distribution.

#### Key Functions
1. **Production Receipt:**
   * Auto-generate finished goods stock balances upon Job Order completion.
   * Inherit batch numbers and calculate cost per unit based on consumed inputs.
2. **Finished Goods Inventory:**
   * Real-time visibility into available, reserved, and dispatched unit quantities.
3. **Dispatch & Stock-Out:**
   * Record outbound dispatches with customer references, reducing finished goods inventory balance.

---

## 4. Technical Architecture & Database Design

### 4.1 System Architecture

* **Backend Framework:** FastAPI (Python 3.11+)
* **Frontend Framework:** Next.js (App Router, TypeScript, Tailwind CSS)
* **Database:** PostgreSQL
* **ORM:** SQLModel / SQLAlchemy
* **Authentication:** OAuth2 with JWT (JSON Web Tokens)

---

### 4.2 Data Model (Entity Relationship Summary)

#### 1. `Users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / Int | Primary Key | Unique user identifier |
| `email` | String | Unique, Indexed | User login email |
| `hashed_password` | String | Not Null | Bcrypt encrypted password |
| `full_name` | String | Not Null | Full user name |
| `role` | Enum | Not Null | `ADMIN`, `STORE_KEEPER`, `PRODUCTION_SUPERVISOR` |
| `is_active` | Boolean | Default True | Account activation flag |

#### 2. `Items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / Int | Primary Key | Item identifier |
| `sku` | String | Unique, Indexed | Stock Keeping Unit code |
| `name` | String | Not Null | Item name |
| `item_type` | Enum | Not Null | `RAW_MATERIAL`, `SUPPLY`, `FINISHED_GOOD` |
| `unit_of_measure` | String | Not Null | Unit (e.g., `KG`, `PCS`, `LITER`) |
| `reorder_level` | Numeric | Default 0 | Minimum threshold for low-stock alerts |

#### 3. `Inventory_Stock`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / Int | Primary Key | Stock record identifier |
| `item_id` | Foreign Key | References `Items.id` | Associated item |
| `quantity_on_hand` | Numeric | Not Null, Default 0 | Current live physical quantity |
| `location` | String | Nullable | Warehouse / Shelf location |

#### 4. `Job_Orders` (WIP)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / Int | Primary Key | Job order identifier |
| `order_number` | String | Unique, Indexed | Human-readable batch/job number |
| `finished_item_id` | Foreign Key | References `Items.id` | Target finished product |
| `target_quantity` | Numeric | Not Null | Desired production output count |
| `actual_yield` | Numeric | Default 0 | Actual completed product output |
| `scrap_quantity` | Numeric | Default 0 | Total scrapped/defective output |
| `status` | Enum | Not Null | `DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `created_by` | Foreign Key | References `Users.id` | Supervisor who opened the job |
| `created_at` | Timestamp | Default NOW | Creation timestamp |

#### 5. `Stock_Transactions` (Audit Log)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID / Int | Primary Key | Transaction identifier |
| `item_id` | Foreign Key | References `Items.id` | Item being moved |
| `job_order_id` | Foreign Key | Nullable | Associated WIP Job Order (if applicable) |
| `quantity_change` | Numeric | Not Null | Delta amount (+ for add, - for deduct) |
| `transaction_type` | Enum | Not Null | `STOCK_IN`, `ISSUE_TO_WIP`, `FG_PRODUCED`, `DISPATCH`, `ADJUSTMENT` |
| `performed_by` | Foreign Key | References `Users.id` | Responsible user |
| `timestamp` | Timestamp | Default NOW | Exact time of record entry |

---

## 5. API Reference Blueprint (FastAPI)

### Authentication & Users
* `POST /api/v1/auth/login` - Authenticate user & return JWT token.
* `GET  /api/v1/users/me` - Get current active user details.
* `POST /api/v1/users` - Create a new user (*Admin only*).
* `GET  /api/v1/users` - List all system users (*Admin only*).

### Raw Inventory Management
* `GET  /api/v1/inventory/items` - List all inventory items (filtered by type).
* `POST /api/v1/inventory/items` - Create new raw material or supply SKU.
* `POST /api/v1/inventory/stock-in` - Receive incoming raw material shipment.
* `POST /api/v1/inventory/issue-to-wip` - Transfer raw materials from stock to WIP job.

### Work-In-Progress (WIP)
* `GET  /api/v1/production/jobs` - List all production job orders.
* `POST /api/v1/production/jobs` - Create a new production job order.
* `GET  /api/v1/production/jobs/{id}` - Retrieve job order details & material allocations.
* `POST /api/v1/production/jobs/{id}/complete` - Finalize job order, deduct inputs, & output Finished Goods.

### Finished Goods & Sales Dispatch
* `GET  /api/v1/finished-goods` - Retrieve current finished goods stock levels.
* `POST /api/v1/finished-goods/dispatch` - Record finished goods outbound sales/dispatch.

---

## 6. Business Logic Rules & Safety Constraints

1. **Immutable Transaction History:** Stock transactions must **never** be deleted or updated. Corrections require explicit adjustment transactions with reverse quantities.
2. **Negative Stock Prevention:** Stock deductions (`ISSUE_TO_WIP`, `DISPATCH`) must fail if `quantity_on_hand < requested_quantity`.
3. **Atomic Production Completion:** Marking a Job Order as `COMPLETED` must execute within a single database transaction block:
   * Verify all allocated raw material quantities.
   * Increment finished goods balance in `Inventory_Stock`.
   * Record `FG_PRODUCED` transaction log.
   * Transition `Job_Orders.status` to `COMPLETED`.
