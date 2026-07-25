from sqlmodel import SQLModel, create_engine, Session, select
from backend.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, echo=True, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session

def init_db():
    SQLModel.metadata.create_all(engine)

    from backend.models import User, UserRole
    from backend.auth import get_password_hash

    with Session(engine) as session:
        # ── Seed default users ────────────────────────────────────────────────
        users_exist = session.exec(select(User)).first()
        if not users_exist:
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
            session.commit()

        # ── Seed Chart of Accounts ────────────────────────────────────────────
        from backend.models import ChartOfAccount, AccountType
        coa_exists = session.exec(select(ChartOfAccount)).first()
        if not coa_exists:
            default_accounts = [
                # Assets
                ChartOfAccount(account_code="1000", account_name="Cash in Hand",
                                account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1010", account_name="Bank Account",
                                account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1100", account_name="Accounts Receivable",
                                account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1200", account_name="Raw Material Inventory",
                                account_type=AccountType.ASSET.value),
                ChartOfAccount(account_code="1300", account_name="Finished Goods Inventory",
                                account_type=AccountType.ASSET.value),
                # Liabilities
                ChartOfAccount(account_code="2000", account_name="Accounts Payable",
                                account_type=AccountType.LIABILITY.value),
                ChartOfAccount(account_code="6010", account_name="VAT Payable",
                                account_type=AccountType.LIABILITY.value),
                # Equity
                ChartOfAccount(account_code="3000", account_name="Owner's Equity",
                                account_type=AccountType.EQUITY.value),
                # Income
                ChartOfAccount(account_code="4000", account_name="Sales Revenue",
                                account_type=AccountType.INCOME.value),
                ChartOfAccount(account_code="4010", account_name="Sales Returns & Allowances",
                                account_type=AccountType.INCOME.value),
                # Expenses
                ChartOfAccount(account_code="5000", account_name="Cost of Goods Sold",
                                account_type=AccountType.EXPENSE.value),
                ChartOfAccount(account_code="5100", account_name="Raw Material Purchases",
                                account_type=AccountType.EXPENSE.value),
                ChartOfAccount(account_code="6000", account_name="Operating Expenses",
                                account_type=AccountType.EXPENSE.value),
            ]
            for acct in default_accounts:
                session.add(acct)
            session.commit()
