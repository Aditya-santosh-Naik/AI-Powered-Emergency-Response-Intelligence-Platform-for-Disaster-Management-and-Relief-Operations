"""Emergency response backend application package."""

import os
import sys

# Ensure workspace root (containing ml, dataset) is accessible on sys.path
_WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, _WORKSPACE_ROOT)

