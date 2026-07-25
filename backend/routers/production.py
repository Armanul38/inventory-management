from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel, Field

from backend.database import get_session
from backend.models import User, Item, InventoryStock, StockTransaction, JobOrder, ItemType, TransactionType, JobStatus
from backend.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/production", tags=["WIP Production Jobs"])

# Schemas
class JobOrderCreateSchema(BaseModel):
    order_number: str
    finished_item_id: int
    target_quantity: float = Field(..., gt=0.0)

class JobOrderResponseSchema(BaseModel):
    id: int
    order_number: str
    finished_item_id: int
    finished_item_sku: str
    finished_item_name: str
    target_quantity: float
    actual_yield: float
    scrap_quantity: float
    status: str
    created_by: int
    created_by_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class JobCompleteSchema(BaseModel):
    actual_yield: float = Field(..., ge=0.0)
    scrap_quantity: float = Field(default=0.0, ge=0.0)
    finished_goods_location: Optional[str] = "Finished Goods Warehouse"

class AllocatedMaterialResponse(BaseModel):
    item_id: int
    sku: str
    name: str
    quantity_allocated: float
    unit_cost: float
    total_cost: float
    batch_number: str

class JobDetailResponse(BaseModel):
    job: JobOrderResponseSchema
    allocated_materials: List[AllocatedMaterialResponse]
    total_materials_cost: float

# Endpoints
@router.get("/jobs", response_model=List[JobOrderResponseSchema])
def list_jobs(
    status_filter: Optional[JobStatus] = None,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = select(JobOrder)
    if status_filter:
        query = query.where(JobOrder.status == status_filter.value)
    query = query.order_by(JobOrder.created_at.desc())
    
    jobs = session.exec(query).all()
    
    result = []
    for job in jobs:
        # Join display strings
        finished_item = session.get(Item, job.finished_item_id)
        creator = session.get(User, job.created_by)
        
        result.append(
            JobOrderResponseSchema(
                id=job.id,
                order_number=job.order_number,
                finished_item_id=job.finished_item_id,
                finished_item_sku=finished_item.sku if finished_item else "Unknown",
                finished_item_name=finished_item.name if finished_item else "Unknown",
                target_quantity=job.target_quantity,
                actual_yield=job.actual_yield,
                scrap_quantity=job.scrap_quantity,
                status=job.status,
                created_by=job.created_by,
                created_by_name=creator.full_name if creator else "Unknown",
                created_at=job.created_at
            )
        )
    return result

# Create WIP Job Order (Production Supervisor & Admin)
@router.post("/jobs", response_model=JobOrderResponseSchema, status_code=status.HTTP_201_CREATED)
def create_job(
    job_in: JobOrderCreateSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "PRODUCTION_SUPERVISOR"]))
):
    # Verify target item exists and is a Finished Good
    item = session.get(Item, job_in.finished_item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target finished item SKU/ID not found"
        )
    if item.item_type != ItemType.FINISHED_GOOD.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target item must be a FINISHED_GOOD in the catalog"
        )
        
    # Verify order number is unique
    existing = session.exec(select(JobOrder).where(JobOrder.order_number == job_in.order_number)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job Order number {job_in.order_number} is already taken"
        )
        
    new_job = JobOrder(
        order_number=job_in.order_number,
        finished_item_id=job_in.finished_item_id,
        target_quantity=job_in.target_quantity,
        status=JobStatus.DRAFT.value,
        created_by=current_user.id
    )
    session.add(new_job)
    session.commit()
    session.refresh(new_job)
    
    return JobOrderResponseSchema(
        id=new_job.id,
        order_number=new_job.order_number,
        finished_item_id=new_job.finished_item_id,
        finished_item_sku=item.sku,
        finished_item_name=item.name,
        target_quantity=new_job.target_quantity,
        actual_yield=new_job.actual_yield,
        scrap_quantity=new_job.scrap_quantity,
        status=new_job.status,
        created_by=new_job.created_by,
        created_by_name=current_user.full_name,
        created_at=new_job.created_at
    )

# Retrieve Job Order details & material allocations
@router.get("/jobs/{job_id}", response_model=JobDetailResponse)
def get_job(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    job = session.get(JobOrder, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job Order not found"
        )
        
    finished_item = session.get(Item, job.finished_item_id)
    creator = session.get(User, job.created_by)
    
    job_data = JobOrderResponseSchema(
        id=job.id,
        order_number=job.order_number,
        finished_item_id=job.finished_item_id,
        finished_item_sku=finished_item.sku if finished_item else "Unknown",
        finished_item_name=finished_item.name if finished_item else "Unknown",
        target_quantity=job.target_quantity,
        actual_yield=job.actual_yield,
        scrap_quantity=job.scrap_quantity,
        status=job.status,
        created_by=job.created_by,
        created_by_name=creator.full_name if creator else "Unknown",
        created_at=job.created_at
    )
    
    # Query material allocations (ISSUE_TO_WIP transactions)
    allocations = session.exec(
        select(StockTransaction)
        .where(StockTransaction.job_order_id == job_id)
        .where(StockTransaction.transaction_type == TransactionType.ISSUE_TO_WIP.value)
    ).all()
    
    allocated_materials = []
    total_materials_cost = 0.0
    for alloc in allocations:
        raw_item = session.get(Item, alloc.item_id)
        qty = abs(alloc.quantity_change)
        cost = alloc.unit_cost or 0.0
        line_total = qty * cost
        total_materials_cost += line_total
        
        allocated_materials.append(
            AllocatedMaterialResponse(
                item_id=alloc.item_id,
                sku=raw_item.sku if raw_item else "Unknown",
                name=raw_item.name if raw_item else "Unknown",
                quantity_allocated=qty,
                unit_cost=cost,
                total_cost=line_total,
                batch_number=alloc.batch_number or "N/A"
            )
        )
        
    return JobDetailResponse(
        job=job_data,
        allocated_materials=allocated_materials,
        total_materials_cost=total_materials_cost
    )

# Start a Job Order (DRAFT -> IN_PROGRESS)
@router.put("/jobs/{job_id}/start", response_model=JobOrderResponseSchema)
def start_job(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "PRODUCTION_SUPERVISOR"]))
):
    job = session.get(JobOrder, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job Order not found"
        )
    if job.status != JobStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start a job in status {job.status}. Must be DRAFT."
        )
        
    job.status = JobStatus.IN_PROGRESS.value
    session.add(job)
    session.commit()
    session.refresh(job)
    
    finished_item = session.get(Item, job.finished_item_id)
    creator = session.get(User, job.created_by)
    return JobOrderResponseSchema(
        id=job.id,
        order_number=job.order_number,
        finished_item_id=job.finished_item_id,
        finished_item_sku=finished_item.sku if finished_item else "Unknown",
        finished_item_name=finished_item.name if finished_item else "Unknown",
        target_quantity=job.target_quantity,
        actual_yield=job.actual_yield,
        scrap_quantity=job.scrap_quantity,
        status=job.status,
        created_by=job.created_by,
        created_by_name=creator.full_name if creator else "Unknown",
        created_at=job.created_at
    )

# Cancel a Job Order (DRAFT/IN_PROGRESS -> CANCELLED)
# Auto reverses issued materials
@router.put("/jobs/{job_id}/cancel", response_model=JobOrderResponseSchema)
def cancel_job(
    job_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "PRODUCTION_SUPERVISOR"]))
):
    job = session.get(JobOrder, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job Order not found"
        )
    if job.status not in [JobStatus.DRAFT.value, JobStatus.IN_PROGRESS.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a job in status {job.status}. Must be DRAFT or IN_PROGRESS."
        )
        
    # Process reversals if materials were issued
    allocations = session.exec(
        select(StockTransaction)
        .where(StockTransaction.job_order_id == job_id)
        .where(StockTransaction.transaction_type == TransactionType.ISSUE_TO_WIP.value)
    ).all()
    
    for alloc in allocations:
        returned_qty = abs(alloc.quantity_change)
        
        # Add back to stock
        stock = session.exec(
            select(InventoryStock)
            .where(InventoryStock.item_id == alloc.item_id)
        ).first()
        
        if stock:
            stock.quantity_on_hand += returned_qty
            session.add(stock)
        else:
            # If stock record was deleted, recreate it
            stock = InventoryStock(
                item_id=alloc.item_id,
                quantity_on_hand=returned_qty,
                location="Main Warehouse"
            )
            session.add(stock)
            
        # Create ADJUSTMENT transaction for auditing
        reversal_txn = StockTransaction(
            item_id=alloc.item_id,
            job_order_id=job_id,
            quantity_change=returned_qty,
            transaction_type=TransactionType.ADJUSTMENT.value,
            performed_by=current_user.id,
            batch_number=alloc.batch_number,
            unit_cost=alloc.unit_cost,
            notes=f"Reversed {returned_qty} due to Job {job.order_number} cancellation"
        )
        session.add(reversal_txn)
        
    job.status = JobStatus.CANCELLED.value
    session.add(job)
    session.commit()
    session.refresh(job)
    
    finished_item = session.get(Item, job.finished_item_id)
    creator = session.get(User, job.created_by)
    return JobOrderResponseSchema(
        id=job.id,
        order_number=job.order_number,
        finished_item_id=job.finished_item_id,
        finished_item_sku=finished_item.sku if finished_item else "Unknown",
        finished_item_name=finished_item.name if finished_item else "Unknown",
        target_quantity=job.target_quantity,
        actual_yield=job.actual_yield,
        scrap_quantity=job.scrap_quantity,
        status=job.status,
        created_by=job.created_by,
        created_by_name=creator.full_name if creator else "Unknown",
        created_at=job.created_at
    )

# Complete WIP Job (Production Supervisor & Admin)
# Performs atomic operations inside a single transaction block
@router.post("/jobs/{job_id}/complete", response_model=JobOrderResponseSchema)
def complete_job(
    job_id: int,
    payload: JobCompleteSchema,
    session: Session = Depends(get_session),
    current_user: User = Depends(RoleChecker(["ADMIN", "PRODUCTION_SUPERVISOR"]))
):
    # Verify Job Order
    job = session.get(JobOrder, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job Order not found"
        )
    if job.status != JobStatus.IN_PROGRESS.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete a job in status {job.status}. Must be IN_PROGRESS."
        )
        
    # 1. Verify allocated materials
    allocations = session.exec(
        select(StockTransaction)
        .where(StockTransaction.job_order_id == job_id)
        .where(StockTransaction.transaction_type == TransactionType.ISSUE_TO_WIP.value)
    ).all()
    
    # Calculate total cost of consumed inputs
    total_materials_cost = 0.0
    for alloc in allocations:
        total_materials_cost += abs(alloc.quantity_change) * (alloc.unit_cost or 0.0)
        
    # Calculate cost per finished unit
    unit_cost = 0.0
    if payload.actual_yield > 0:
        unit_cost = total_materials_cost / payload.actual_yield
        
    # 2. Increment finished goods stock balance in InventoryStock
    finished_stock = session.exec(
        select(InventoryStock)
        .where(InventoryStock.item_id == job.finished_item_id)
        .where(InventoryStock.location == payload.finished_goods_location)
    ).first()
    
    if not finished_stock:
        finished_stock = InventoryStock(
            item_id=job.finished_item_id,
            quantity_on_hand=payload.actual_yield,
            location=payload.finished_goods_location
        )
        session.add(finished_stock)
    else:
        finished_stock.quantity_on_hand += payload.actual_yield
        session.add(finished_stock)
        
    # 3. Record FG_PRODUCED transaction log
    prod_txn = StockTransaction(
        item_id=job.finished_item_id,
        job_order_id=job_id,
        quantity_change=payload.actual_yield,
        transaction_type=TransactionType.FG_PRODUCED.value,
        performed_by=current_user.id,
        batch_number=job.order_number,  # Inherits batch number from Job Order number
        unit_cost=unit_cost,
        reference_number=job.order_number,
        notes=f"Production Yield for Job Order {job.order_number}. Cost per unit: ${unit_cost:.2f} (Total input: ${total_materials_cost:.2f})"
    )
    session.add(prod_txn)
    
    # 4. Transition Job status to COMPLETED
    job.status = JobStatus.COMPLETED.value
    job.actual_yield = payload.actual_yield
    job.scrap_quantity = payload.scrap_quantity
    session.add(job)
    
    session.commit()
    session.refresh(job)
    
    finished_item = session.get(Item, job.finished_item_id)
    creator = session.get(User, job.created_by)
    return JobOrderResponseSchema(
        id=job.id,
        order_number=job.order_number,
        finished_item_id=job.finished_item_id,
        finished_item_sku=finished_item.sku if finished_item else "Unknown",
        finished_item_name=finished_item.name if finished_item else "Unknown",
        target_quantity=job.target_quantity,
        actual_yield=job.actual_yield,
        scrap_quantity=job.scrap_quantity,
        status=job.status,
        created_by=job.created_by,
        created_by_name=creator.full_name if creator else "Unknown",
        created_at=job.created_at
    )
