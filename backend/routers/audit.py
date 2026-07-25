from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, Field

from backend.database import get_session
from backend.models import User, Item, InventoryStock, StockTransaction, TransactionType, JobOrder
from backend.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/audit", tags=["Audit Log & Stock Adjustments"])

# Schemas
class TransactionResponseSchema(BaseModel):
    id: int
    item_id: int
    item_sku: str
    item_name: str
    item_type: str
    job_order_id: Optional[int]
    job_order_number: Optional[str]
    quantity_change: float
    transaction_type: str
    performed_by: int
    performed_by_name: str
    timestamp: datetime
    batch_number: Optional[str]
    unit_cost: Optional[float]
    reference_number: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True

class AdjustmentSchema(BaseModel):
    item_id: int
    quantity_change: float = Field(..., ne=0.0)  # delta cannot be 0
    batch_number: Optional[str] = None
    reason: str = Field(..., min_length=3)
    location: Optional[str] = "Main Warehouse"

# Endpoints
@router.get("/transactions", response_model=List[TransactionResponseSchema])
def list_transactions(
    item_id: Optional[int] = None,
    transaction_type: Optional[TransactionType] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)  # Keep viewable by all, but can filter role-based logic if needed
):
    query = select(StockTransaction)
    if item_id:
        query = query.where(StockTransaction.item_id == item_id)
    if transaction_type:
        query = query.where(StockTransaction.transaction_type == transaction_type.value)
        
    query = query.order_by(StockTransaction.timestamp.desc())
    txns = session.exec(query).all()
    
    result = []
    for t in txns:
        item = session.get(Item, t.item_id)
        job = session.get(JobOrder, t.job_order_id) if t.job_order_id else None
        performer = session.get(User, t.performed_by)
        
        result.append(
            TransactionResponseSchema(
                id=t.id,
                item_id=t.item_id,
                item_sku=item.sku if item else "Unknown",
                item_name=item.name if item else "Unknown",
                item_type=item.item_type if item else "Unknown",
                job_order_id=t.job_order_id,
                job_order_number=job.order_number if job else None,
                quantity_change=t.quantity_change,
                transaction_type=t.transaction_type,
                performed_by=t.performed_by,
                performed_by_name=performer.full_name if performer else "Unknown",
                timestamp=t.timestamp,
                batch_number=t.batch_number,
                unit_cost=t.unit_cost,
                reference_number=t.reference_number,
                notes=t.notes
            )
        )
    return result

# Post Stock Adjustment (Admin & Store Keeper)
@router.post("/adjustments", status_code=status.HTTP_200_OK)
def create_adjustment(
    payload: AdjustmentSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "STORE_KEEPER"]))
):
    # Verify Item
    item = session.get(Item, payload.item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
        
    # Check Negative Stock Prevention
    stocks = session.exec(select(InventoryStock).where(InventoryStock.item_id == payload.item_id)).all()
    total_qoh = sum(s.quantity_on_hand for s in stocks)
    
    if payload.quantity_change < 0:
        abs_change = abs(payload.quantity_change)
        if total_qoh < abs_change:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Negative stock prevention triggered. Cannot adjust stock down by {abs_change} because only {total_qoh} is available."
            )
            
        # Deduct from locations
        remaining = abs_change
        for stock in stocks:
            if stock.quantity_on_hand >= remaining:
                stock.quantity_on_hand -= remaining
                session.add(stock)
                remaining = 0
                break
            else:
                remaining -= stock.quantity_on_hand
                stock.quantity_on_hand = 0
                session.add(stock)
    else:
        # Increment stock (find or create at location)
        stock = session.exec(
            select(InventoryStock)
            .where(InventoryStock.item_id == payload.item_id)
            .where(InventoryStock.location == payload.location)
        ).first()
        
        if not stock:
            stock = InventoryStock(
                item_id=payload.item_id,
                quantity_on_hand=payload.quantity_change,
                location=payload.location
            )
            session.add(stock)
        else:
            stock.quantity_on_hand += payload.quantity_change
            session.add(stock)
            
    # Resolve unit cost
    # Search for latest unit cost of this item to keep asset valuations clean
    latest_txn = session.exec(
        select(StockTransaction)
        .where(StockTransaction.item_id == payload.item_id)
        .where(StockTransaction.unit_cost != None)
        .order_by(StockTransaction.timestamp.desc())
    ).first()
    
    unit_cost = latest_txn.unit_cost if latest_txn else 0.0
    
    # Write ADJUSTMENT transaction
    txn = StockTransaction(
        item_id=payload.item_id,
        quantity_change=payload.quantity_change,
        transaction_type=TransactionType.ADJUSTMENT.value,
        performed_by=current_user.id,
        batch_number=payload.batch_number,
        unit_cost=unit_cost,
        notes=payload.reason
    )
    session.add(txn)
    session.commit()
    
    return {"message": "Adjustment recorded successfully", "new_total_qoh": total_qoh + payload.quantity_change}
