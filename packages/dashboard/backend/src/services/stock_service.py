'''
Read relevant stock data from the data/ directory and returns it in a format suitable for the endpoint to use.
'''

import os
from pathlib import Path
import pandas as pd
from ..schemas.stocks import OHLCV, OHLCVResponse

_REPO_ROOT = Path(__file__).resolve().parents[5]
ARCHIVE_DIR = str(_REPO_ROOT / os.getenv("ARCHIVE_DATA_DIR", "data/archive_stock_data/"))

async def fetch(ticker: str, days: int = 30):
    '''
    Fetch stock data for a given ticker and number of days.
    Args:
        ticker (str): The stock ticker symbol.
        days (int, optional): The number of days of data to retrieve. Defaults to 30.
    Returns:
        OHLCVResponse: The stock data for the specified ticker and time period.
    '''
    files = os.listdir(ARCHIVE_DIR)
    ticker_files = sorted(f for f in files if f.startswith(ticker) and f.endswith(".csv"))
    if not ticker_files:
        raise ValueError(f"No CSV data found for ticker: {ticker}")
    file_path = os.path.join(ARCHIVE_DIR, ticker_files[-1])
    df = pd.read_csv(file_path)
    df.columns = [col.lower() for col in df.columns]
    records = df.tail(days).to_dict(orient="records")
    return OHLCVResponse(
        ticker=ticker,
        data=[OHLCV(**row) for row in records]
    )

