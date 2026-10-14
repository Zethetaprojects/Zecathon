"""Create a superadmin account, or promote an existing user and reset their password.

This is the recovery path when no superadmin can log in. It prompts for the
password so it never appears in shell history.

Usage (local):      python -m scripts.create_superadmin <username> <email>
Usage (VM/Docker):  sudo docker exec -it zecathon-backend python -m scripts.create_superadmin <username> <email>
"""
import getpass
import sys

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import User, UserRole
from app.schemas import check_password_strength


def main(username: str, email: str) -> None:
    password = getpass.getpass("New password: ")
    if password != getpass.getpass("Repeat password: "):
        print("Passwords do not match")
        sys.exit(1)
    try:
        check_password_strength(password)
    except ValueError as exc:
        print(exc)
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.role = UserRole.superadmin
            user.is_active = True
            user.hashed_password = get_password_hash(password)
            action = "Promoted existing user"
        else:
            if db.query(User).filter(User.email == email).first():
                print(f"Email '{email}' already belongs to another user")
                sys.exit(1)
            user = User(username=username, email=email, hashed_password=get_password_hash(password), role=UserRole.superadmin)
            db.add(user)
            action = "Created"
        db.commit()
        print(f"{action} '{username}' as superadmin")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
