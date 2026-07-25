import os
import sys
from sqlmodel import SQLModel, Session, create_engine, select

# Ensure parent directory is in the path for proper module resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from backend.config import settings
from backend.database import init_db
from backend.models import (
    User, UserRole, ChartOfAccount, AccountType, Item, ItemType,
    InventoryStock, Supplier, Customer, CustomerType
)
from backend.auth import get_password_hash

# Create engine
engine = create_engine(settings.DATABASE_URL, echo=True)

def seed_database():
    print("[Seed Script] Initializing database tables...")
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        # ── 1. Seed Users ─────────────────────────────────────────────────────
        print("[Seed Script] Seeding Users and Roles...")
        existing_users = session.exec(select(User)).all()
        if not existing_users:
            default_users = [
                User(email="admin@example.com",
                     hashed_password=get_password_hash("AdminPassword123!"),
                     full_name="Admin User", role=UserRole.ADMIN.value, is_active=True),
                User(email="storekeeper@example.com",
                     hashed_password=get_password_hash("StorePassword123!"),
                     full_name="Store Keeper", role=UserRole.STORE_KEEPER.value, is_active=True),
                User(email="supervisor@example.com",
                     hashed_password=get_password_hash("SupervisorPassword123!"),
                     full_name="Production Supervisor", role=UserRole.PRODUCTION_SUPERVISOR.value, is_active=True),
                User(email="sales@example.com",
                     hashed_password=get_password_hash("SalesPassword123!"),
                     full_name="Sales Officer", role=UserRole.SALES_OFFICER.value, is_active=True),
                User(email="purchase@example.com",
                     hashed_password=get_password_hash("PurchasePassword123!"),
                     full_name="Purchase Officer", role=UserRole.PURCHASE_OFFICER.value, is_active=True),
                User(email="accountant@example.com",
                     hashed_password=get_password_hash("AccountPassword123!"),
                     full_name="Accountant", role=UserRole.ACCOUNTANT.value, is_active=True),
            ]
            for user in default_users:
                session.add(user)
            print(f"[Seed Script] Added {len(default_users)} users.")
        else:
            print("[Seed Script] Users table already contains data, skipping...")

        # ── 2. Seed Chart of Accounts ─────────────────────────────────────────
        print("[Seed Script] Seeding Chart of Accounts...")
        existing_accounts = session.exec(select(ChartOfAccount)).all()
        if not existing_accounts:
            default_accounts = [
                # Assets
                ChartOfAccount(account_code="1000", account_name="Cash in Hand", account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1010", account_name="Bank Account", account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1100", account_name="Accounts Receivable", account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1200", account_name="Raw Material Inventory", account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1300", account_name="Finished Goods Inventory", account_type=AccountType.ASSET.value),
                # Liabilities
                ChartOfAccount(account_code="2000", account_name="Accounts Payable", account_type=AccountType.LIABILITY.value),
                ChartOfAccount(account_code="6010", account_name="VAT Payable", account_type=AccountType.LIABILITY.value),
                # Equity
                ChartOfAccount(account_code="3000", account_name="Owner's Equity", account_type=AccountType.EQUITY.value),
                # Income
                ChartOfAccount(account_code="4000", account_name="Sales Revenue", account_type=AccountType.INCOME.value),
                ChartOfAccount(account_code="4010", account_name="Sales Returns & Allowances", account_type=AccountType.INCOME.value),
                # Expenses
                ChartOfAccount(account_code="5000", account_name="Cost of Goods Sold", account_type=AccountType.EXPENSE.value),
                ChartOfAccount(account_code="5100", account_name="Raw Material Purchases", account_type=AccountType.EXPENSE.value),
                ChartOfAccount(account_code="6000", account_name="Operating Expenses", account_type=AccountType.EXPENSE.value),
            ]
            for acct in default_accounts:
                session.add(acct)
            print(f"[Seed Script] Added {len(default_accounts)} account codes.")
        else:
            print("[Seed Script] Chart of Accounts table already contains data, skipping...")

        # ── 3. Seed Initial Catalog Items ─────────────────────────────────────
        print("[Seed Script] Seeding Catalog Items...")
        existing_items = session.exec(select(Item)).all()
        if not existing_items:
            # Raw Materials
            rm_items = [
                Item(sku="RM-PLASTIC", name="Plastic Resin (Granules)", item_type=ItemType.RAW_MATERIAL.value, unit_of_measure="KG", reorder_level=500.0),
                Item(sku="RM-STEEL-ROD", name="Steel Support Rods", item_type=ItemType.RAW_MATERIAL.value, unit_of_measure="PCS", reorder_level=100.0),
                Item(sku="RM-PACK-BOX", name="Packaging Cardboard Boxes", item_type=ItemType.RAW_MATERIAL.value, unit_of_measure="PCS", reorder_level=200.0),
            ]
            # Finished Goods
            fg_items = [
                Item(sku="FG-CHAIR-01", name="Ergonomic Office Chair", item_type=ItemType.FINISHED_GOOD.value, unit_of_measure="PCS", reorder_level=20.0),
                Item(sku="FG-DESK-02", name="Executive Wooden Desk", item_type=ItemType.FINISHED_GOOD.value, unit_of_measure="PCS", reorder_level=10.0),
            ]
            
            for item in rm_items + fg_items:
                session.add(item)
            session.commit() # Commit to generate item IDs

            # Add initial empty stock tracking records
            for item in rm_items + fg_items:
                stock_record = InventoryStock(item_id=item.id, quantity_on_hand=0.0, quantity_reserved=0.0, location="Main Warehouse A")
                session.add(stock_record)
            print(f"[Seed Script] Added {len(rm_items)} raw materials and {len(fg_items)} finished goods items.")
        else:
            print("[Seed Script] Items table already contains data, skipping...")

        # ── 4. Seed Suppliers ─────────────────────────────────────────────────
        print("[Seed Script] Seeding Suppliers...")
        existing_suppliers = session.exec(select(Supplier)).all()
        if not existing_suppliers:
            default_suppliers = [
                Supplier(supplier_code="SUP-PLAST-INC", company_name="Plastic Polymers Corp", contact_name="John Doe", email="john@plasticpolymers.com", phone="+1-555-0199", address="45 Industrial Way, NJ", is_active=True),
                Supplier(supplier_code="SUP-STEEL-IND", company_name="Apex Steel Industries", contact_name="Sarah Smith", email="sales@apexsteel.com", phone="+1-555-0144", address="89 Foundry St, MI", is_active=True),
            ]
            for sup in default_suppliers:
                session.add(sup)
            print(f"[Seed Script] Added {len(default_suppliers)} suppliers.")
        else:
            print("[Seed Script] Suppliers table already contains data, skipping...")

        # ── 5. Seed Customers ─────────────────────────────────────────────────
        print("[Seed Script] Seeding Customers...")
        existing_customers = session.exec(select(Customer)).all()
        if not existing_customers:
            default_customers = [
                Customer(customer_code="CUST-GLOBAL-OFF", company_name="Global Office Solutions", contact_name="Alice Green", email="purchasing@globaloffice.com", phone="+1-555-0101", address="102 corporate Plaza, NY", customer_type=CustomerType.DISTRIBUTOR.value, credit_limit=500000.0, is_active=True),
                Customer(customer_code="CUST-LOCAL-RET", company_name="City Furniture Retail", contact_name="Bob Miller", email="bob@cityfurniture.com", phone="+1-555-0122", address="442 Broadway St, NY", customer_type=CustomerType.RETAIL.value, credit_limit=100000.0, is_active=True),
            ]
            for cust in default_customers:
                session.add(cust)
            print(f"[Seed Script] Added {len(default_customers)} customers.")
        else:
            print("[Seed Script] Customers table already contains data, skipping...")

        session.commit()
    print("[Seed Script] Seeding completed successfully!")

if __name__ == "__main__":
    # Ensure DATABASE_URL defaults to local Postgres if not set
    if "DATABASE_URL" not in os.environ:
        os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:5434/inventory"
    seed_database()
