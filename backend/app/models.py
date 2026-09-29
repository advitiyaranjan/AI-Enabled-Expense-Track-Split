from sqlalchemy import Column, Integer, String, Date, Time, DateTime, ForeignKey, Numeric, Boolean, Text
from sqlalchemy.types import JSON
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    country = Column(String, nullable=False, default="United States")
    currency = Column(String, nullable=False, default="USD")
    created_at = Column(DateTime, default=datetime.utcnow)


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    merchant_name = Column(String, nullable=True)
    category = Column(String, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, index=True)
    time = Column(Time, nullable=True)
    icon = Column(String, nullable=True)
    type = Column(String, nullable=False)  # income / expense
    receipt_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    image_url = Column(String, nullable=False)
    raw_text = Column(Text, nullable=True)
    parsed_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GroupMember(Base):
    __tablename__ = "group_members"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    paid_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExpenseSplit(Base):
    __tablename__ = "expense_splits"
    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount_owed = Column(Numeric(12, 2), nullable=False)
    is_settled = Column(Boolean, default=False)
