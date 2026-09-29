from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List, Any
from datetime import date, time as dt_time, datetime
import re


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str
    password: str = Field(..., min_length=8, max_length=128)
    phone: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Invalid email address")
        return value.lower()


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Invalid email address")
        return value.lower()


class OtpChallengeOut(BaseModel):
    otp_required: bool = True
    challenge_id: str
    email: str
    purpose: str
    expires_in: int
    resend_in: int
    attempts_left: int


class VerifyOtpRequest(BaseModel):
    challenge_id: str = Field(..., min_length=10, max_length=64)
    code: str = Field(..., pattern=r"^\s*\d{6}\s*$")


class EmailChangeStart(BaseModel):
    new_email: str
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("new_email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Invalid email address")
        return value


class ResendOtpRequest(BaseModel):
    challenge_id: str = Field(..., min_length=10, max_length=64)


UPI_PATTERN = re.compile(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$")


class UserOut(BaseModel):
    id: int
    public_id: Optional[int] = None
    name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    country: str
    currency: str
    upi_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(Token):
    user: UserOut


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    upi_id: Optional[str] = None  # "" clears it

    @field_validator("upi_id")
    @classmethod
    def validate_upi(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if value and not UPI_PATTERN.fullmatch(value):
            raise ValueError("Enter a valid UPI ID, like name@okaxis")
        return value.lower()

    @field_validator("email")
    @classmethod
    def validate_optional_email(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Invalid email address")
        return value.lower()


class TransactionCreate(BaseModel):
    merchant_name: Optional[str] = None
    category: str
    amount: float
    date: date
    time: Optional[dt_time] = None
    icon: Optional[str] = ""
    type: str  # income | expense

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        value = value.lower().strip()
        if value not in ("income", "expense"):
            raise ValueError("type must be 'income' or 'expense'")
        return value

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value == 0:
            raise ValueError("amount must be non-zero")
        return value


class TransactionBulkCreate(BaseModel):
    transactions: List[TransactionCreate] = Field(..., max_length=2000)


class TransactionOut(BaseModel):
    id: int
    name: Optional[str]
    category: str
    amount: float
    date: date
    time: Optional[dt_time]
    icon: Optional[str]
    type: str

    model_config = ConfigDict(from_attributes=True)


class ReceiptOut(BaseModel):
    id: int
    image_url: str
    raw_text: Optional[str]
    parsed_json: Optional[Any]

    model_config = ConfigDict(from_attributes=True)


class ReceiptScanRequest(BaseModel):
    filename: Optional[str] = "receipt.jpg"
    image_base64: Optional[str] = None
    raw_text: Optional[str] = None


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


class BudgetContext(BaseModel):
    name: str
    limit: float


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)
    budgets: List[BudgetContext] = Field(default_factory=list, max_length=50)


class ParseTransactionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    today: Optional[date] = None


class SplitParticipantIn(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=80)
    amount: float = Field(..., ge=0)
    settled: bool = False


class SplitShareRequest(BaseModel):
    client_id: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=120)
    total: float = Field(..., gt=0)
    participants: List[SplitParticipantIn] = Field(..., min_length=1, max_length=30)


class SplitClaimRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=64)


class ParseSplitRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    friends: List[str] = Field(default_factory=list, max_length=200)


class GoogleSignInRequest(BaseModel):
    credential: str = Field(..., min_length=20, max_length=4096)


class ForgotPasswordStart(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Invalid email address")
        return value


class PasswordOtpVerify(BaseModel):
    challenge_id: str = Field(..., min_length=10, max_length=64)
    code: str = Field(..., pattern=r"^\s*\d{6}\s*$")
    new_password: str = Field(..., min_length=8, max_length=128)
