"""Shared setup for the backend tests.

The backend modules are flat (they sit in backend/, not a package), so we
put that folder on the path before importing anything.
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
