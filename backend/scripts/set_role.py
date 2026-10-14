"""Set a user's role directly in the database (SQLite or PostgreSQL).

Usage (local):      python -m scripts.set_role <username> <role>
Usage (VM/Docker):  sudo docker exec -it zecathon-backend python -m scripts.set_role <username> <role>

Roles: superadmin, admin, organizer, judge, participant
"""
import sys

from app.database import Base, SessionLocal, engine
from app.models import User, UserRole


def set_role(username: str, role: str) -> None:
    try:
        new_role = UserRole(role)
    except ValueError:
        print(f"Invalid role. Choose one of: {', '.join(r.value for r in UserRole)}")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"User '{username}' not found")
            sys.exit(1)
        user.role = new_role
        db.commit()
        print(f"Updated '{username}' to role '{new_role.value}'")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    set_role(sys.argv[1], sys.argv[2])
