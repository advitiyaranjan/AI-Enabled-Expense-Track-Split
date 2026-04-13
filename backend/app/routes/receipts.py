from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..auth import get_current_user
from ..services import s3_service, ocr_service, openai_service
from .. import models

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("/upload")
async def upload_receipt(file: UploadFile = File(...), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    # upload to S3 or local storage
    url = s3_service.upload_bytes(contents, file.filename)

    # OCR
    raw_text = ocr_service.extract_text_from_image_bytes(contents)

    # Parse via OpenAI
    parsed = openai_service.parse_receipt_text(raw_text)

    # store receipt
    receipt = models.Receipt(user_id=current_user.id, image_url=url, raw_text=raw_text, parsed_json=parsed)
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return {"id": receipt.id, "image_url": receipt.image_url, "raw_text": receipt.raw_text, "parsed": receipt.parsed_json}
