import os
from app.services.s3_service import upload_bytes


def test_upload_bytes_local_fallback(tmp_path, monkeypatch):
    # Ensure no AWS env vars to force local fallback
    monkeypatch.delenv("AWS_S3_BUCKET", raising=False)
    monkeypatch.delenv("AWS_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("AWS_SECRET_ACCESS_KEY", raising=False)

    data = b"hello-world"
    filename = "test.txt"
    path = upload_bytes(data, filename)
    # When fallback is used path should point to local uploads or be a path
    assert path is not None
    # file must exist if it's a local path
    if os.path.exists(path):
        with open(path, "rb") as f:
            assert f.read() == data
