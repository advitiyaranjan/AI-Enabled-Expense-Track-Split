import os
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
    name = f"{uuid.uuid4().hex}_{filename}"
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
    uploads_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    path = os.path.join(uploads_dir, name)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path
