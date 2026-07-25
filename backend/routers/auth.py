from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr

from backend.database import get_session
from backend.models import User, UserRole
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    RoleChecker
)

router = APIRouter(prefix="/auth-users", tags=["Authentication & Users"])

class UserCreateSchema(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    password: str

class UserResponseSchema(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponseSchema(BaseModel):
    access_token: str
    token_type: str
    user: UserResponseSchema

class UserUpdateSchema(BaseModel):
    full_name: str
    role: UserRole
    is_active: bool

@router.post("/login", response_model=TokenResponseSchema)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )
        
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponseSchema)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Admin only endpoints
admin_required = RoleChecker(["ADMIN"])

@router.post("/users", response_model=UserResponseSchema, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreateSchema,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    # Check if email is already taken
    existing = session.exec(select(User).where(User.email == user_in.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role.value,
        is_active=True
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@router.get("/users", response_model=List[UserResponseSchema])
def list_users(
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    users = session.exec(select(User)).all()
    return users

@router.put("/users/{user_id}", response_model=UserResponseSchema)
def update_user(
    user_id: int,
    user_in: UserUpdateSchema,
    session: Session = Depends(get_session),
    admin: User = Depends(admin_required)
):
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db_user.full_name = user_in.full_name
    db_user.role = user_in.role.value
    db_user.is_active = user_in.is_active
    
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user
