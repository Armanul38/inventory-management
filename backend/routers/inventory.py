from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, func
from pydantic import BaseModel, Field

from backend.database import get_session
from backend.models import User, Item, InventoryStock, StockTransaction, JobOrder, ItemType, TransactionType, JobStatus
from backend.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/inventory", tags=["Inventory Operations"])

# Schema definitions
class ItemCreateSchema(BaseModel):
    sku: str
    name: str
    item_type: ItemType
    unit_of_measure: str
    reorder_level: float = Field(default=0.0, ge=0.0)

class ItemResponseSchema(BaseModel):
    id: int
    sku: str
    name: str
    item_type: str
    unit_of_measure: str
    reorder_level: float
    quantity_on_hand: float = 0.0

    class Config:
        from_attributes = True

class StockInSchema(BaseModel):
    item_id: int
    quantity: float = Field(..., gt=0.0)
    unit_cost: float = Field(..., ge=0.0)
    batch_number: str
    location: Optional[str] = None
    reference_number: Optional[str] = None

class IssueToWIPSchema(BaseModel):
    job_order_id: int
    item_id: int
    quantity: float = Field(..., gt=0.0)
    batch_number: str

# Endpoints
@router.get("/items", response_model=List[ItemResponseSchema])
def list_items(
    item_type: Optional[ItemType] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Item)
    if item_type:
        query = query.where(Item.item_type == item_type.value)
    if search:
        query = query.where(
            (Item.sku.ilike(f"%{search}%")) | (Item.name.ilike(f"%{search}%"))
        )
        
    items = session.exec(query).all()
    
    # Calculate current live stock for each item from InventoryStock
    result = []
    for item in items:
        # Get sum of stock
        stocks = session.exec(select(InventoryStock).where(InventoryStock.item_id == item.id)).all()
        qoh = sum(s.quantity_on_hand for s in stocks)
        
        item_data = ItemResponseSchema(
            id=item.id,
            sku=item.sku,
            name=item.name,
            item_type=item.item_type,
            unit_of_measure=item.unit_of_measure,
            reorder_level=item.reorder_level,
            quantity_on_hand=qoh
        )
        result.append(item_data)
        
    return result

# Create Catalog Item (Admin & Store Keeper & Production Supervisor can view, Admin & Store Keeper create)
@router.post("/items", response_model=ItemResponseSchema, status_code=status.HTTP_201_CREATED)
def create_item(
    item_in: ItemCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "STORE_KEEPER"]))
):
    existing = session.exec(select(Item).where(Item.sku == item_in.sku)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SKU {item_in.sku} already exists in the catalog"
        )
        
    new_item = Item(
        sku=item_in.sku,
        name=item_in.name,
        item_type=item_in.item_type.value,
        unit_of_measure=item_in.unit_of_measure,
        reorder_level=item_in.reorder_level
    )
    session.add(new_item)
    session.commit()
    session.refresh(new_item)
    
    return ItemResponseSchema(
        id=new_item.id,
        sku=new_item.sku,
        name=new_item.name,
        item_type=new_item.item_type,
        unit_of_measure=new_item.unit_of_measure,
        reorder_level=new_item.reorder_level,
        quantity_on_hand=0.0
    )

# Stock In Shipment (Store Keeper & Admin)
@router.post("/stock-in", status_code=status.HTTP_200_OK)
def stock_in(
    payload: StockInSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "STORE_KEEPER"]))
):
    item = session.get(Item, payload.item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
        
    if item.item_type == ItemType.FINISHED_GOOD.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform raw stock-in for Finished Goods directly. Finished Goods are produced via Job Orders."
        )
        
    # Increment physical stock
    stock = session.exec(
        select(InventoryStock)
        .where(InventoryStock.item_id == payload.item_id)
        .where(InventoryStock.location == payload.location)
    ).first()
    
    if not stock:
        stock = InventoryStock(
            item_id=payload.item_id,
            quantity_on_hand=payload.quantity,
            location=payload.location
        )
        session.add(stock)
    else:
        stock.quantity_on_hand += payload.quantity
        session.add(stock)
        
    # Write Audit Log
    transaction = StockTransaction(
        item_id=payload.item_id,
        quantity_change=payload.quantity,
        transaction_type=TransactionType.STOCK_IN.value,
        performed_by=current_user.id,
        batch_number=payload.batch_number,
        unit_cost=payload.unit_cost,
        reference_number=payload.reference_number,
        notes=f"Received incoming shipment of SKU {item.sku} from {payload.reference_number or 'supplier'}"
    )
    session.add(transaction)
    session.commit()
    
    return {"message": "Stock received successfully", "quantity_on_hand": stock.quantity_on_hand}

# Issue Materials to WIP Job (Store Keeper & Admin)
@router.post("/issue-to-wip", status_code=status.HTTP_200_OK)
def issue_to_wip(
    payload: IssueToWIPSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "STORE_KEEPER"]))
):
    # Verify Job Order
    job = session.get(JobOrder, payload.job_order_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job Order not found"
        )
    if job.status not in [JobStatus.DRAFT.value, JobStatus.IN_PROGRESS.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot issue materials to a job in status {job.status}. Must be DRAFT or IN_PROGRESS."
        )
        
    # Verify Item
    item = session.get(Item, payload.item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    if item.item_type == ItemType.FINISHED_GOOD.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot issue Finished Goods to a WIP job."
        )
        
    # Check Negative Stock Prevention
    # Summing all locations for simple stock check
    stocks = session.exec(select(InventoryStock).where(InventoryStock.item_id == payload.item_id)).all()
    total_qoh = sum(s.quantity_on_hand for s in stocks)
    if total_qoh < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Negative stock prevention triggered. Requested {payload.quantity} {item.unit_of_measure}, but only {total_qoh} available."
        )
        
    # Deduct stock from InventoryStock (using FIFO or first available location with enough stock)
    remaining_to_deduct = payload.quantity
    for stock in stocks:
        if stock.quantity_on_hand >= remaining_to_deduct:
            stock.quantity_on_hand -= remaining_to_deduct
            session.add(stock)
            remaining_to_deduct = 0
            break
        else:
            remaining_to_deduct -= stock.quantity_on_hand
            stock.quantity_on_hand = 0
            session.add(stock)
            
    if remaining_to_deduct > 0:
        # Fallback safeguard
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stock subtraction error across multiple locations"
        )
        
    # Resolve Unit Cost for the given batch number
    # Search for the STOCK_IN transaction for this item and batch
    shipment_txn = session.exec(
        select(StockTransaction)
        .where(StockTransaction.item_id == payload.item_id)
        .where(StockTransaction.batch_number == payload.batch_number)
        .where(StockTransaction.transaction_type == TransactionType.STOCK_IN.value)
    ).first()
    
    unit_cost = 0.0
    if shipment_txn:
        unit_cost = shipment_txn.unit_cost or 0.0
    else:
        # Fallback to latest cost of this SKU
        latest_txn = session.exec(
            select(StockTransaction)
            .where(StockTransaction.item_id == payload.item_id)
            .where(StockTransaction.unit_cost != None)
            .order_by(StockTransaction.timestamp.desc())
        ).first()
        if latest_txn:
            unit_cost = latest_txn.unit_cost or 0.0
            
    # Write Audit Log (Negative quantity_change)
    transaction = StockTransaction(
        item_id=payload.item_id,
        job_order_id=payload.job_order_id,
        quantity_change=-payload.quantity,
        transaction_type=TransactionType.ISSUE_TO_WIP.value,
        performed_by=current_user.id,
        batch_number=payload.batch_number,
        unit_cost=unit_cost,
        notes=f"Issued {payload.quantity} {item.unit_of_measure} to Job Order {job.order_number} (Batch: {payload.batch_number})"
    )
    
    # If the job order is still DRAFT, auto-advance it to IN_PROGRESS upon first material issuance!
    # This is a very clean user convenience.
    if job.status == JobStatus.DRAFT.value:
        job.status = JobStatus.IN_PROGRESS.value
        session.add(job)
        
    session.add(transaction)
    session.commit()
    
    return {
        "message": "Materials issued successfully to Job Order",
        "job_status": job.status,
        "quantity_issued": payload.quantity,
        "unit_cost": unit_cost
    }

# Get list of active raw material batches with remaining quantities
@router.get("/batches/{item_id}")
def get_item_batches(
    item_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Query all transactions for this item
    txns = session.exec(
        select(StockTransaction)
        .where(StockTransaction.item_id == item_id)
        .where(StockTransaction.batch_number != None)
    ).all()
    
    # Calculate net quantity for each batch number
    batches = {}
    for t in txns:
        batch = t.batch_number
        if batch not in batches:
            batches[batch] = {"batch_number": batch, "remaining_quantity": 0.0, "unit_cost": 0.0}
            
        batches[batch]["remaining_quantity"] += t.quantity_change
        if t.transaction_type == TransactionType.STOCK_IN.value:
            batches[batch]["unit_cost"] = t.unit_cost or 0.0
            
    # Return batches that have positive remaining quantity
    return [b for b in batches.values() if b["remaining_quantity"] > 0.0]
