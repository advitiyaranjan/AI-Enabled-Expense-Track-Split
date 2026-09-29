import base64
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..services import s3_service, ocr_service, openai_service
from .. import models, schemas

router = APIRouter(prefix="/receipts", tags=["receipts"])

MAX_IMAGE_BYTES = 20 * 1024 * 1024


def decode_image(image_base64: str | None) -> bytes:
    if not image_base64:
        return b""
    payload = image_base64.split(",", 1)[-1]
    try:
        return base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc


@router.post("/scan")
def scan_receipt(
    payload: schemas.ReceiptScanRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    contents = decode_image(payload.image_base64)
    raw_text = payload.raw_text or ""
    filename = payload.filename or "receipt.jpg"
    parsed = None
    source = "text"

    if contents:
        if len(contents) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Receipt image is too large (max 20 MB)")
        url = s3_service.upload_bytes(contents, filename)
        if not raw_text:
            # Vision model reads the photo directly; OCR is the offline fallback
            parsed = openai_service.parse_receipt_image(contents, filename)
            if parsed is not None:
                raw_text = parsed.pop("raw_text", "") or ""
                source = "vision"
            else:
                raw_text = ocr_service.extract_text_from_image_bytes(contents)
                source = "ocr"
    elif raw_text:
        url = "manual-text"
    else:
        raise HTTPException(status_code=400, detail="Provide image_base64 or raw_text")

    if parsed is None:
        parsed = openai_service.parse_receipt_text(raw_text)

    receipt = models.Receipt(user_id=current_user.id, image_url=url, raw_text=raw_text, parsed_json=parsed)
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return {"id": receipt.id, "image_url": receipt.image_url, "raw_text": receipt.raw_text, "parsed": receipt.parsed_json, "source": source, "ai": openai_service.ai_enabled()}
