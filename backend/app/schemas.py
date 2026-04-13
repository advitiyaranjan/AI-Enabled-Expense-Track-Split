from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import date, time, datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr

    class Config:
        orm_mode = True


class TransactionCreate(BaseModel):
    merchant_name: Optional[str]
    category: str
    amount: float
    date: date
    time: Optional[time]
    icon: Optional[str] = ""
    type: str  # income | expense


class TransactionOut(BaseModel):
    id: int
    name: Optional[str]
    category: str
    amount: float
    date: date
    time: Optional[time]
    icon: Optional[str]
    type: str

    class Config:
        orm_mode = True


class ReceiptOut(BaseModel):
    id: int
    image_url: str
    raw_text: Optional[str]
    parsed_json: Optional[Any]

    class Config:
        orm_mode = True


class GroupCreate(BaseModel):
    name: str


class AddMemberRequest(BaseModel):
    user_id: int


class ExpenseSplitRequest(BaseModel):
    group_id: int
    paid_by: int
    total_amount: float
    description: Optional[str] = None
    splits: Optional[List[dict]] = None  # optional explicit splits [{user_id, amount}]


class BalanceEntry(BaseModel):
    user_id: int
    name: Optional[str]
    balance: float


class SettlementEntry(BaseModel):
    from_user_id: int
    to_user_id: int
    amount: float


class InsightsOut(BaseModel):
    monthly_totals: List[dict]
    category_breakdown: List[dict]
    predictions: List[dict]
    unusual_spending: List[dict]
