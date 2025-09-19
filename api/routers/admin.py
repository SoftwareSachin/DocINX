from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.session import get_db
from schemas.user import UserResponse, UserRoleUpdate
from services.user_service import UserService

router = APIRouter()
user_service = UserService()


@router.get("/admin/users", response_model=List[UserResponse])
async def get_all_users(db: AsyncSession = Depends(get_db)):
    """Get all users (admin endpoint)"""
    try:
        users = await user_service.get_all_users(db)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch users")


@router.patch("/admin/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    role_update: UserRoleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update user role"""
    try:
        if role_update.role not in ["admin", "user"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        updated_user = await user_service.update_user_role(
            db=db,
            user_id=user_id,
            role=role_update.role
        )
        
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update user role")