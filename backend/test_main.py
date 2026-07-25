import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from backend.main import app
from backend.database import get_session
from backend.models import User, UserRole, Item, ItemType, JobOrder, JobStatus, StockTransaction, TransactionType
from backend.auth import get_password_hash

# Create a clean SQLite database for tests
sqlite_url = "sqlite:///./test.db"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

@pytest.fixture(name="session")
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Seed default users
        admin = User(
            email="admin_test@example.com",
            hashed_password=get_password_hash("testpass"),
            full_name="Admin Test",
            role=UserRole.ADMIN.value,
            is_active=True
        )
        keeper = User(
            email="keeper_test@example.com",
            hashed_password=get_password_hash("testpass"),
            full_name="Keeper Test",
            role=UserRole.STORE_KEEPER.value,
            is_active=True
        )
        supervisor = User(
            email="supervisor_test@example.com",
            hashed_password=get_password_hash("testpass"),
            full_name="Supervisor Test",
            role=UserRole.PRODUCTION_SUPERVISOR.value,
            is_active=True
        )
        session.add(admin)
        session.add(keeper)
        session.add(supervisor)
        session.commit()
        
        yield session
        
    SQLModel.metadata.drop_all(engine)

@pytest.fixture(name="client")
def client_fixture(session):
    def get_session_override():
        return session
        
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def get_token(client, email):
    res = client.post("/api/v1/auth-users/login", data={"username": email, "password": "testpass"})
    assert res.status_code == 200
    return res.json()["access_token"]

def test_login(client):
    res = client.post("/api/v1/auth-users/login", data={"username": "admin_test@example.com", "password": "testpass"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin_test@example.com"

def test_create_item_auth(client):
    # Store keeper token
    token = get_token(client, "keeper_test@example.com")
    
    # Store keeper can create catalog items
    res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "sku": "RAW-TEST-01",
            "name": "Test Raw Material",
            "item_type": "RAW_MATERIAL",
            "unit_of_measure": "KG",
            "reorder_level": 10.0
        }
    )
    assert res.status_code == 201
    assert res.json()["sku"] == "RAW-TEST-01"

def test_negative_stock_prevention(client):
    keeper_token = get_token(client, "keeper_test@example.com")
    super_token = get_token(client, "supervisor_test@example.com")
    
    # 1. Create a Raw Material SKU
    res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "sku": "RAW-ALUM",
            "name": "Aluminium",
            "item_type": "RAW_MATERIAL",
            "unit_of_measure": "KG",
            "reorder_level": 5.0
        }
    )
    item_id = res.json()["id"]
    
    # 2. Create a Finished Good SKU
    res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "sku": "FG-PLATE",
            "name": "Aluminium Plate",
            "item_type": "FINISHED_GOOD",
            "unit_of_measure": "PCS"
        }
    )
    fg_id = res.json()["id"]
    
    # 3. Create a Job Order (DRAFT)
    res = client.post(
        "/api/v1/production/jobs",
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "order_number": "JOB-101",
            "finished_item_id": fg_id,
            "target_quantity": 100.0
        }
    )
    job_id = res.json()["id"]
    
    # 4. Attempt to issue 50kg raw materials to WIP (should fail because stock is 0)
    res = client.post(
        "/api/v1/inventory/issue-to-wip",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "job_order_id": job_id,
            "item_id": item_id,
            "quantity": 50.0,
            "batch_number": "BATCH-01"
        }
    )
    assert res.status_code == 400
    assert "Negative stock prevention" in res.json()["detail"]

def test_atomic_production_completion(client):
    keeper_token = get_token(client, "keeper_test@example.com")
    super_token = get_token(client, "supervisor_test@example.com")
    
    # 1. Create Raw, Finished SKUs
    raw_res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={"sku": "RAW-WOOD", "name": "Plank", "item_type": "RAW_MATERIAL", "unit_of_measure": "M"}
    )
    raw_id = raw_res.json()["id"]
    
    fg_res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={"sku": "FG-CHAIR", "name": "Chair", "item_type": "FINISHED_GOOD", "unit_of_measure": "PCS"}
    )
    fg_id = fg_res.json()["id"]
    
    # 2. Stock In Raw Material (100 Meters @ $5.00 each)
    client.post(
        "/api/v1/inventory/stock-in",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "item_id": raw_id,
            "quantity": 100.0,
            "unit_cost": 5.00,
            "batch_number": "LOT-WOOD-01",
            "location": "Aisle 1"
        }
    )
    
    # 3. Open Job Order
    job_res = client.post(
        "/api/v1/production/jobs",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"order_number": "JOB-CHAIR-1", "finished_item_id": fg_id, "target_quantity": 10.0}
    )
    job_id = job_res.json()["id"]
    
    # 4. Issue 20 Meters of Wood to Job
    client.post(
        "/api/v1/inventory/issue-to-wip",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "job_order_id": job_id,
            "item_id": raw_id,
            "quantity": 20.0,
            "batch_number": "LOT-WOOD-01"
        }
    )
    
    # 5. Complete Job: Yield 10 chairs (20 meters consumed * $5.00 = $100 total cost. Cost per chair = $10.00)
    complete_res = client.post(
        "/api/v1/production/jobs/{}/complete".format(job_id),
        headers={"Authorization": f"Bearer {super_token}"},
        json={
            "actual_yield": 10.0,
            "scrap_quantity": 1.0,
            "finished_goods_location": "Aisle 5"
        }
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "COMPLETED"
    assert complete_res.json()["actual_yield"] == 10.0
    
    # 6. Verify Finished Goods Stock levels and Unit Cost
    fg_stock_res = client.get("/api/v1/finished-goods", headers={"Authorization": f"Bearer {keeper_token}"})
    assert fg_stock_res.status_code == 200
    fg_item = next(item for item in fg_stock_res.json() if item["sku"] == "FG-CHAIR")
    assert fg_item["quantity_on_hand"] == 10.0
    assert len(fg_item["batches"]) == 1
    assert fg_item["batches"][0]["batch_number"] == "JOB-CHAIR-1"
    assert fg_item["batches"][0]["unit_cost"] == 10.00 # $100 / 10 chairs = $10.00 unit cost!

def test_job_cancellation_reversal(client):
    keeper_token = get_token(client, "keeper_test@example.com")
    super_token = get_token(client, "supervisor_test@example.com")
    
    # 1. Create Raw, Finished SKUs
    raw_res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={"sku": "RAW-STEEL", "name": "Steel Tube", "item_type": "RAW_MATERIAL", "unit_of_measure": "M"}
    )
    raw_id = raw_res.json()["id"]
    
    fg_res = client.post(
        "/api/v1/inventory/items",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={"sku": "FG-FRAME", "name": "Frame", "item_type": "FINISHED_GOOD", "unit_of_measure": "PCS"}
    )
    fg_id = fg_res.json()["id"]
    
    # 2. Stock In Raw Material (50m @ $10.00 each)
    client.post(
        "/api/v1/inventory/stock-in",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "item_id": raw_id,
            "quantity": 50.0,
            "unit_cost": 10.00,
            "batch_number": "LOT-STEEL-01"
        }
    )
    
    # 3. Open Job Order
    job_res = client.post(
        "/api/v1/production/jobs",
        headers={"Authorization": f"Bearer {super_token}"},
        json={"order_number": "JOB-STEEL-1", "finished_item_id": fg_id, "target_quantity": 5.0}
    )
    job_id = job_res.json()["id"]
    
    # 4. Issue 10 Meters of Steel to Job
    client.post(
        "/api/v1/inventory/issue-to-wip",
        headers={"Authorization": f"Bearer {keeper_token}"},
        json={
            "job_order_id": job_id,
            "item_id": raw_id,
            "quantity": 10.0,
            "batch_number": "LOT-STEEL-01"
        }
    )
    
    # Verify stock dropped to 40m
    items_res = client.get("/api/v1/inventory/items", headers={"Authorization": f"Bearer {keeper_token}"})
    raw_item = next(i for i in items_res.json() if i["sku"] == "RAW-STEEL")
    assert raw_item["quantity_on_hand"] == 40.0
    
    # 5. Cancel Job Order
    cancel_res = client.put(
        "/api/v1/production/jobs/{}/cancel".format(job_id),
        headers={"Authorization": f"Bearer {super_token}"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"
    
    # 6. Verify raw stock is reversed back to 50m!
    items_res = client.get("/api/v1/inventory/items", headers={"Authorization": f"Bearer {keeper_token}"})
    raw_item = next(i for i in items_res.json() if i["sku"] == "RAW-STEEL")
    assert raw_item["quantity_on_hand"] == 50.0
