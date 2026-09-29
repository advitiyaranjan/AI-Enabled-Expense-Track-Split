import os
import re
import uuid
from ..config import settings

try:
    import boto3
    from botocore.exceptions import BotoCoreError, ClientError
    _HAS_BOTO = True
except Exception:
    _HAS_BOTO = False


def upload_bytes(file_bytes: bytes, filename: str) -> str:
    """Upload bytes to S3 if configured, otherwise save to local uploads/ and return path/URL."""
    # Client-supplied names must never reach the filesystem path as-is (e.g. "../../app/main.py")
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(filename or "upload"))[-80:].lstrip(".") or "upload"
    name = f"{uuid.uuid4().hex}_{safe_name}"
    if _HAS_BOTO and settings.AWS_S3_BUCKET and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        try:
            s3.put_object(Bucket=settings.AWS_S3_BUCKET, Key=name, Body=file_bytes)
            url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{name}"
            return url
        except (BotoCoreError, ClientError):
            pass

    # Fallback: save to local uploads folder
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        path = os.path.join(settings.UPLOAD_DIR, name)
        with open(path, "wb") as f:
            f.write(file_bytes)
        return path
    except OSError:
        # Read-only filesystem: the receipt is still parsed, we just don't keep the image
        return "not-stored"
