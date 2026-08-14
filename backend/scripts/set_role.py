"""Set a user's role directly in the database.

Usage:
    python -m scripts.set_role <username> <role>

Roles: admin, organizer, judge, participant
"""
import sys
from pathlib import Path

import sqlite3

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "hackathon.db"

VALID_ROLES = {"admin", "organizer", "judge", "participant"}


def set_role(username: str, role: str) -> None:
    if role not in VALID_ROLES:
        print(f"Invalid role. Choose one of: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    db_path = str(DB_PATH)
    con = sqlite3.connect(db_path)
    cur = con.execute("SELECT id FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    if not user:
        print(f"User '{username}' not found in {db_path}")
        con.close()
        sys.exit(1)

    con.execute("UPDATE users SET role = ? WHERE username = ?", (role, username))
    con.commit()
    con.close()
    print(f"Updated '{username}' to role '{role}'")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    set_role(sys.argv[1], sys.argv[2])
