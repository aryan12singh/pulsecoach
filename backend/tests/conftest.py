import os
import sys

# Settings require DATABASE_URL at import time; tests never open a connection.
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
