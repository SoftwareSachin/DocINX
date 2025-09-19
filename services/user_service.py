from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime

from db.models import User
from schemas.user import UserResponse


class UserService:
    
    async def get_user(self, db: AsyncSession, user_id: str) -> Optional[UserResponse]:
        """Get user by ID"""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if user:
            return UserResponse.model_validate(user)
        return None
    
    async def get_all_users(self, db: AsyncSession) -> List[UserResponse]:
        """Get all users ordered by creation date"""
        result = await db.execute(
            select(User).order_by(desc(User.created_at))
        )
        users = result.scalars().all()
        
        return [UserResponse.model_validate(user) for user in users]
    
    async def update_user_role(
        self,
        db: AsyncSession,
        user_id: str,
        role: str
    ) -> Optional[UserResponse]:
        """Update user role"""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        user.role = role
        user.updated_at = datetime.now()
        
        await db.commit()
        await db.refresh(user)
        
        return UserResponse.model_validate(user)
    
    async def delete_user(self, db: AsyncSession, user_id: str) -> bool:
        """Delete user"""
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        await db.delete(user)
        await db.commit()
        return True