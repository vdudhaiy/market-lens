'''
Fetch Stock Price Data using yfinance library.
'''

import yfinance as yf
import os
import logging
import pandas as pd
import dotenv
from pathlib import Path

dotenv.load_dotenv()

_REPO_ROOT = Path(__file__).resolve().parents[5]
ARCHIVE_DATA_DIR = str(_REPO_ROOT / os.getenv("ARCHIVE_DATA_DIR", "data/archive_stock_data/"))

logger = logging.getLogger(__name__)

def _yesterday() -> str:
    return (pd.Timestamp.now() - pd.Timedelta(days=1)).strftime("%Y-%m-%d")

def _flatten_yfinance_df(df):
    '''Flatten yfinance MultiIndex columns and strip timezone from index.'''
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    if hasattr(df.index, 'tz') and df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    return df



def fetch_historical_price_data(ticker, start_date=None, end_date=None, interval='1d', force_refresh=False):
    '''
    Download historical price data for a given ticker and date range.

    Parameters:
    ticker (str): The stock ticker symbol.
    start_date (str): The start date in 'YYYY-MM-DD' format. Default is '2023-01-01' or the value of ARCHIVE_START_DATE environment variable.
    end_date (str): The end date in 'YYYY-MM-DD' format. Default is today's date.
    interval (str): The interval for the historical data (e.g., '1d', '1wk', '1mo'). Default is '1d'.
    force_refresh (bool): If True, forces re-download of data even if it already exists in the archive. Default is False.

    Returns:
    None
    '''
    # First check if ticker file exists in archive
    archive_files = os.listdir(ARCHIVE_DATA_DIR)
    if any(f.startswith(ticker) and f.endswith(".csv") for f in archive_files) and not force_refresh:
        logger.info(f"Historical price data for {ticker} already exists in archive. Skipping download.")
        return

    if start_date is None:
        start_date = pd.Timestamp(os.getenv("ARCHIVE_START_DATE", "2023-01-01")).strftime("%Y-%m-%d")
    if end_date is None:
        end_date = _yesterday()

    save_file_name = ARCHIVE_DATA_DIR + f"{ticker}_{start_date}_{end_date}.csv"
    try:
        data = yf.download(ticker, start=start_date, end=end_date, interval=interval)
        data = _flatten_yfinance_df(data)
        data.to_csv(save_file_name)
    except Exception as e:
        logger.error(f"Error fetching data for {ticker}: {e}")
        return None


def fetch_current_price(ticker):
    '''
    Fetch the current price of a stock.

    Parameters:
    ticker (str): The stock ticker symbol.

    Returns:
    float: The current price of the stock.
    '''
    try:
        stock = yf.Ticker(ticker)
        current_price = stock.get_info['currentPrice']
        return current_price
    except Exception as e:
        logger.error(f"Error fetching current price for {ticker}: {e}")
        return None


def append_price_data(ticker):
    '''
    Refresh price data for a ticker by re-fetching all data from ARCHIVE_START_DATE to yesterday.
    Replaces any existing archive file for the ticker.

    Parameters:
    ticker (str): The stock ticker symbol.

    Returns:
    None
    '''
    start_date = pd.Timestamp(os.getenv("ARCHIVE_START_DATE", "2023-01-01")).strftime("%Y-%m-%d")
    end_date = _yesterday()

    existing_files = [
        f for f in os.listdir(ARCHIVE_DATA_DIR)
        if f.startswith(ticker) and f.endswith(".csv")
    ]
    for f in existing_files:
        os.remove(os.path.join(ARCHIVE_DATA_DIR, f))
        logger.debug(f"Removed old archive file: {f}")

    save_file_name = os.path.join(ARCHIVE_DATA_DIR, f"{ticker}_{start_date}_{end_date}.csv")
    try:
        data = yf.download(ticker, start=start_date, end=end_date, interval="1d", progress=False)
        data = _flatten_yfinance_df(data)
        data.to_csv(save_file_name)
        logger.info(f"Re-fetched {len(data)} rows for {ticker} ({start_date} to {end_date}, exclusive).")
    except Exception as e:
        logger.error(f"Error re-fetching price data for {ticker}: {e}")
    
