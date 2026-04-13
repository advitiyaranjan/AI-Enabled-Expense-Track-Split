from fastapi import APIRouter

router = APIRouter()

from . import auth, transactions, receipts, groups, insights  # noqa: F401
