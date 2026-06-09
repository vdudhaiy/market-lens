'''
Configuration for the Market Lens Dashboard backend, including environment variable loading and constants.
'''
import os
from pathlib import Path

ARCHIVE_DATA_DIR = Path(__file__).resolve().parents[5] / os.getenv("ARCHIVE_DATA_DIR", "data/archive_stock_data/")

MODEL_DIR = Path(__file__).resolve().parents[5] / os.getenv("MODEL_DIR", "model-store/")