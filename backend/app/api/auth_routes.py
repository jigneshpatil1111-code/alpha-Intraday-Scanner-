import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.db_models import User
from backend.app.models.schemas import UserCreate, UserLogin, Token, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{pw_hash}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    try:
        salt, pw_hash = stored_password.split(":")
        check_hash = hashlib.pbkdf2_hmac('sha256', provided_password.encode(), salt.encode(), 100000).hex()
        return secrets.compare_digest(pw_hash, check_hash)
    except Exception:
        return False

@router.post("/signup", response_model=Token)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A trader account with this email already exists.")

    new_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token_str = secrets.token_urlsafe(32)
    return Token(
        access_token=token_str,
        user=UserOut(id=new_user.id, email=new_user.email, full_name=new_user.full_name)
    )

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    if not user or not verify_password(user.hashed_password, login_in.password):
        raise HTTPException(status_code=401, detail="Invalid trader email or password.")

    token_str = secrets.token_urlsafe(32)
    return Token(
        access_token=token_str,
        user=UserOut(id=user.id, email=user.email, full_name=user.full_name)
    )
