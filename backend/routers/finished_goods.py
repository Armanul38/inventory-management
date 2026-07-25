from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, Field

from backend.database import get_session
from backend.models import User, Item, InventoryStock, StockTransaction, ItemType, TransactionType
from backend.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/finished-goods", tags=["Finished Goods & Outbound Sales"])

# Schemas
class DispatchSchema(BaseModel):
    item_id: int
    quantity: float = Field(..., gt=0.0)
    customer_reference: str
    batch_number: str

class FinishedGoodStockResponse(BaseModel):
    item_id: int
    sku: str
    name: str
    quantity_on_hand: float
    unit_of_measure: str
    reorder_level: float
    batches: List[dict]  # list of dicts with batch_number, remaining_quantity, unit_cost

# Endpoints
@router.get("", response_model=List[FinishedGoodStockResponse])
def get_finished_goods_stock(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Query finished goods items
    fg_items = session.exec(select(Item).where(Item.item_type == ItemType.FINISHED_GOOD.value)).all()
    
    result = []
    for item in fg_items:
        # Sum current stock
        stocks = session.exec(select(InventoryStock).where(InventoryStock.item_id == item.id)).all()
        qoh = sum(s.quantity_on_hand for s in stocks)
        
        # Calculate batches from StockTransaction
        txns = session.exec(
            select(StockTransaction)
            .where(StockTransaction.item_id == item.id)
            .where(StockTransaction.batch_number != None)
        ).all()
        
        batches_map = {}
        for t in txns:
            batch = t.batch_number
            if batch not in batches_map:
                batches_map[batch] = {"batch_number": batch, "remaining_quantity": 0.0, "unit_cost": 0.0}
            batches_map[batch]["remaining_quantity"] += t.quantity_change
            if t.transaction_type == TransactionType.FG_PRODUCED.value:
                batches_map[batch]["unit_cost"] = t.unit_cost or 0.0
                
        batches_list = [
            b for b in batches_map.values() if b["remaining_quantity"] > 0.0
        ]
        
        result.append(
            FinishedGoodStockResponse(
                item_id=item.id,
                sku=item.sku,
                name=item.name,
                quantity_on_hand=qoh,
                unit_of_measure=item.unit_of_measure,
                reorder_level=item.reorder_level,
                batches=batches_list
            )
        )
        
    return result

# Dispatch Sales Out (Store Keeper & Admin)
@router.post("/dispatch", status_code=status.HTTP_200_OK)
def dispatch_finished_goods(
    payload: DispatchSchema,
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
    if item.item_type != ItemType.FINISHED_GOOD.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item is not a Finished Good. Only Finished Goods can be dispatched."
        )
        
    # Check Negative Stock Prevention
    stocks = session.exec(select(InventoryStock).where(InventoryStock.item_id == payload.item_id)).all()
    total_qoh = sum(s.quantity_on_hand for s in stocks)
    if total_qoh < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Negative stock prevention triggered. Requested {payload.quantity} for dispatch, but only {total_qoh} on hand."
        )
        
    # Verify the specific batch has enough stock
    txns = session.exec(
        select(StockTransaction)
        .where(StockTransaction.item_id == payload.item_id)
        .where(StockTransaction.batch_number == payload.batch_number)
    ).all()
    batch_qoh = sum(t.quantity_change for t in txns)
    if batch_qoh < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected batch {payload.batch_number} only has {batch_qoh} available. Cannot dispatch {payload.quantity}."
        )
        
    # Deduct stock from InventoryStock
    remaining = payload.quantity
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
            
    # Resolve Finished Goods unit cost for COGS tracking (from FG_PRODUCED)
    fg_produced_txn = session.exec(
        select(StockTransaction)
        .where(StockTransaction.item_id == payload.item_id)
        .where(StockTransaction.batch_number == payload.batch_number)
        .where(StockTransaction.transaction_type == TransactionType.FG_PRODUCED.value)
    ).first()
    
    unit_cost = 0.0
    if fg_produced_txn:
        unit_cost = fg_produced_txn.unit_cost or 0.0
        
    # Record DISPATCH transaction
    dispatch_txn = StockTransaction(
        item_id=payload.item_id,
        quantity_change=-payload.quantity,
        transaction_type=TransactionType.DISPATCH.value,
        performed_by=current_user.id,
        batch_number=payload.batch_number,
        unit_cost=unit_cost,
        reference_number=payload.customer_reference,
        notes=f"Dispatched {payload.quantity} {item.unit_of_measure} to Customer Ref {payload.customer_reference} (Batch: {payload.batch_number})"
    )
    session.add(dispatch_txn)
    session.commit()
    
    return {
        "message": "Outbound dispatch recorded successfully",
        "remaining_batch_quantity": batch_qoh - payload.quantity,
        "unit_cost": unit_cost
    }
