import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException

from app.config import settings

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".md",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
}


def validate_upload(file: UploadFile) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    return ext


async def save_upload(file: UploadFile) -> str:
    ext = validate_upload(file)
    name = f"{uuid.uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / name
    os.makedirs(dest.parent, exist_ok=True)
    contents = await file.read()
    if len(contents) > settings.max_upload_size:
        raise HTTPException(status_code=413, detail="File too large")
    with open(dest, "wb") as f:
        f.write(contents)
    return f"/uploads/{name}"
