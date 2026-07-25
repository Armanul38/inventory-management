# 📘 Easy User Manual: Inventory, Sales & Accounting System
## Simple Step-by-Step Guide for Non-Technical Users

---

Welcome! This manual is written in simple, plain language. You don't need any computer programming knowledge to use this software. Just follow this guide click-by-click.

---

## 💡 How the Whole System Works (In Plain Words)

Think of your factory/business as a simple step-by-step chain:

```
[ 1. Supplier ] ──(Buy Raw Materials)──► [ 2. Raw Inventory ]
                                                 │
                                         (Send to Factory)
                                                 ▼
[ 4. Finished Goods ] ◄──(Finish Batch)── [ 3. Work-In-Progress (WIP) ]
         │
  (Sell to Customer)
         ▼
[ 5. Customer ] ──(Collect Payment)──► [ 6. Accounts & Cash ]
```

1. **Suppliers**: The companies who sell you raw materials.
2. **Raw Inventory**: The warehouse where you store raw materials (e.g. fabric, steel, plastic).
3. **WIP (Work-In-Progress)**: The factory floor where materials are turned into products.
4. **Finished Goods**: The storage room for ready-to-sell complete items.
5. **Customers**: The buyers who order finished goods from you.
6. **Accounts & Cash**: Where the system tracks payments, invoices, dues, and money balance.

---

## 🚀 How to Start the App (One-Click)

Look at your main project folder. Double-click these three icon files in order:

1. **`start-docker.bat`**  
   *(Wait until the window says `[SUCCESS] Containers started successfully!`)*
2. **`start-server.bat`**  
   *(This opens the backend engine — keep this window minimized!)*
3. **`start-client.bat`**  
   *(This opens the website interface!)*

Now open your web browser (Chrome or Edge) and go to:  
👉 **`http://localhost:3000`**

---

## 🔑 Demo Accounts to Log In

| Role | Email | Password | What Can They Do? |
|---|---|---|---|
| **Admin** | `admin@example.com` | `AdminPassword123!` | Can see and do **EVERYTHING** |
| **Store Keeper** | `storekeeper@example.com` | `StorePassword123!` | Receives raw stock and dispatches goods |
| **Supervisor** | `supervisor@example.com` | `SupervisorPassword123!` | Controls factory production batches |
| **Purchase Officer** | `purchase@example.com` | `PurchasePassword123!` | Manages suppliers and purchase orders |
| **Sales Officer** | `sales@example.com` | `SalesPassword123!` | Manages customers, sales orders, and invoices |
| **Accountant** | `accountant@example.com` | `AccountPassword123!` | Manages payments, dues, and financial reports |

---

## 📖 Step-by-Step Daily Workflows

---

### Workflow 1: Buying Raw Materials from a Supplier

#### Step 1: Create a Supplier (If New)
1. Click **`Suppliers`** on the left menu under **PROCUREMENT**.
2. Click the green **`+ New Supplier`** button at the top right.
3. Fill in:
   - **Company Name** (e.g. *Apex Cotton Ltd*)
   - **Contact Person** & **Phone Number**
   - **Payment Terms** (e.g. *30 days*)
4. Click **`Create Supplier`**.

#### Step 2: Make a Purchase Order (PO)
1. Click **`Purchase Orders`** on the left menu.
2. Click **`Create Purchase Order`**.
3. Select your **Supplier**, choose **Order Date**, and pick the **Raw Materials** you want to buy along with quantity and agreed price.
4. Click **`Save PO`**.

#### Step 3: Receive the Stock in Warehouse (GRN)
1. When the truck arrives at the factory, click on the **PO Number** (e.g. `PO-2026-0001`).
2. Click **`Receive Goods (GRN)`**.
3. Type the actual quantity received and type a **Batch Number** (e.g. `BATCH-101`).
4. Click **`Confirm Goods Receipt`**.
5. **Magic!** The system automatically adds the raw materials to your inventory stock and logs the amount owed in **Accounts Payable**.
6. **Print Document**: Click **`Print / Save PDF`** at the top right to print or save an official copy of the Purchase Order for your records.

---

### Workflow 2: Manufacturing Products in the Factory (WIP)

1. Click **`WIP Job Orders`** on the left menu.
2. Click **`Create Job Order`**.
3. Choose the **Finished Product** you want to make and enter the **Target Quantity** (e.g., 500 T-Shirts).
4. Click **`Issue Raw Materials`** to allocate the raw fabric/buttons from warehouse to this factory batch.
5. When production finishes, click **`Complete Job Order`**:
   - Enter **Actual Yield** (e.g. 490 good units).
   - Enter **Scrap Quantity** (e.g. 10 damaged units).
6. Click **`Finalize & Close Job`**.
7. **Magic!** Raw materials are deducted from inventory, and 490 new finished items automatically appear in **Finished Goods**.

---

### Workflow 3: Selling Goods to Customers & Getting Paid

#### Step 1: Add a Customer (If New)
1. Click **`Customers`** on the left menu under **SALES & DISTRIBUTION**.
2. Click **`New Customer`**.
3. Type Company Name (e.g. *Rahman Trading*), Phone, and set a **Credit Limit** (e.g. *৳100,000*).
4. Click **`Create Customer`**.

#### Step 2: Create & Confirm a Sales Order (SO)
1. Click **`Sales Orders`** on the left menu.
2. Click **`Create Sales Order`**.
3. Choose the **Customer**, pick the **Finished Good**, set the selling **Price** and **Quantity**.
4. Click **`Create SO`**.
5. Open the created SO and click **`Confirm Order & Reserve Stock`**.
   - *Note: The system will automatically block the sale if the customer exceeds their credit limit or if you don't have enough finished goods stock!*

#### Step 3: Deliver Goods & Send Invoice
1. Click **`Generate Invoice`** inside the Sales Order page.
2. The system calculates the **15% VAT** and total amount automatically.
3. Open the Invoice detail page and click **`Print / Save PDF`** to print an official paper invoice to send to the customer!

#### Step 4: Collect Payment from Customer
1. Click **`Invoices`** on the left menu.
2. Open the unpaid invoice.
3. Click **`Record Customer Payment`**.
4. Enter the amount received, choose payment method (**Bank Transfer**, **Cash**, **Mobile Banking**), and click **`Confirm Payment`**.
5. **Magic!** Customer due balance goes to 0, and the money enters your Cash/Bank account.

---

### Workflow 4: Checking Financials & Downloading Reports

- **Accounts Payable (AP)** (`Finance → Accounts Payable`): Shows all suppliers you currently owe money to. Click **`Export Excel (CSV)`** to download vendor payment schedules.
- **Accounts Receivable (AR)** (`Finance → Accounts Receivable`): Shows all customers who currently owe you money. Click **`Export Excel (CSV)`** to download customer collection lists.
- **General Ledger** (`Finance → General Ledger`): Shows every single debit and credit transaction that happened in the business.
- **Trial Balance Report** (`Finance → Reports`): Shows the total balance sheet of your company. Click **`Export Excel (CSV)`** or **`Print / Save PDF`** to generate end-of-month audit documents.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: How do I export reports to Excel?**  
*A: On pages like `Accounts Receivable`, `Accounts Payable`, and `Financial Reports`, click the green **`Export Excel (CSV)`** button at the top right. A `.csv` file will automatically download to your computer, which opens directly in Microsoft Excel.*

**Q: How do I print or save a PDF of an Invoice or Purchase Order?**  
*A: Open any Invoice or Purchase Order page and click the **`Print / Save PDF`** button at the top right. A print window will pop up where you can print to paper or select "Save as PDF".*

**Q: Can I edit or delete a completed transaction if I made a mistake?**  
*A: No. To prevent fraud, financial and stock records can never be deleted. If you made a mistake, record a correction/adjustment entry.*

**Q: Why does the system block me when I try to confirm a Sales Order?**  
*A: Check two things: 1) Does your finished goods room have enough stock? 2) Has the customer crossed their assigned Credit Limit?*

**Q: How do I know when raw materials are running out?**  
*A: Check `Raw Inventory`. Items highlighted with low stock warnings have dropped below their set Reorder Level.*

---

## 🆘 Need Help?
Contact your System Administrator or check the **Audit Logs** tab to see who performed any recent action in the system.
