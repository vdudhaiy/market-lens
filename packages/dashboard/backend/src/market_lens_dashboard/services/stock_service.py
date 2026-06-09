'''
Read relevant stock data from the data/ directory and returns it in a format suitable for the endpoint to use.
'''

import os
from pathlib import Path
import pandas as pd
import yfinance as yf
from ..config import ARCHIVE_DATA_DIR
from ..schemas.stocks import *
import pandas_market_calendars as mcal
from datetime import datetime, timezone

async def get_market_status():
    '''
    Check if the stock market is currently open or closed.
    Returns:
        bool: True if the market is open, False if it is closed.
    '''
    nyse = mcal.get_calendar('NYSE')

    now = datetime.now(timezone.utc)

    schedule = nyse.schedule(start_date=now.date(), end_date=now.date())

    is_open = nyse.open_at_time(schedule, now)

    return is_open


async def get_all_stocks():
    '''
    Get a list of all available stocks in the system.
    Returns:
        list: A list of stock ticker symbols available in the archive directory.
    '''
    files = os.listdir(ARCHIVE_DATA_DIR)
    tickers = set(f.split("_")[0] for f in files if f.endswith(".csv"))
    return sorted(tickers)


async def add_stock(ticker: str):
    '''
    Add stock data for a given ticker.
    Args:
        ticker (str): The stock ticker symbol.
    Returns:
        OHLCVResponse: The stock data for the specified ticker and time period.
        StockDetailedResponse: Detailed information about the stock, including financials, calendar events, analyst price targets, and recommendations.
    '''
    try:
        # Fetch data from yfinance and save to archive directory using pipeline's price fetcher
        from market_lens_pipeline.fetchers.price import fetch_historical_price_data
        fetch_historical_price_data(ticker)
        ohlcv = await fetch(ticker)  # Return the fetched data
        service = StockService()
        stock = yf.Ticker(ticker)
        detailed_info = service.get_stock_details(stock)  # Get detailed info for the stock
        return ohlcv, detailed_info
    except Exception as e:
        raise ValueError(f"Error creating stock data for {ticker}: {str(e)}")


async def fetch(ticker: str, days: int = 30):
    '''
    Fetch stock data for a given ticker and number of days. If data is outdated, use pipeline's price fetcher to get the latest data and update the archive. Ensure that no new data is fetched if the current date is a weekend.
    Args:
        ticker (str): The stock ticker symbol.
        days (int, optional): The number of days of data to retrieve. Defaults to 30.
    Returns:
        OHLCVResponse: The stock data for the specified ticker and time period.
    '''
    files = os.listdir(ARCHIVE_DATA_DIR)
    ticker_files = sorted(f for f in files if f.startswith(ticker) and f.endswith(".csv"))
    if not ticker_files:
        raise ValueError(f"No CSV data found for ticker: {ticker}")
    
    # Check last date in the latest file and compare with today's date
    file_path = os.path.join(ARCHIVE_DATA_DIR, ticker_files[-1])
    df = pd.read_csv(file_path)
    df.columns = [col.lower() for col in df.columns]
    records = df.tail(days).to_dict(orient="records")
    last_date = pd.to_datetime(records[-1]['date'])
    if (pd.Timestamp.now() - last_date).days > 1 and last_date.weekday() < 5:  # If data is outdated and last date is not a weekend
        # Data is outdated, fetch new data and update the archive
        from market_lens_pipeline.fetchers.price import append_price_data
        append_price_data(ticker)
        df = pd.read_csv(file_path)
        df.columns = [col.lower() for col in df.columns]
        records = df.tail(days).to_dict(orient="records")

    return OHLCVResponse(
        ticker=ticker,
        data=[OHLCV(**row) for row in records]
    )


async def fetch_current(ticker: str):
    '''
    Fetch the current stock price for a given ticker.
    Args:
        ticker (str): The stock ticker symbol.
    Returns:
        OHLCVResponse: The current stock data for the specified ticker.
    '''
    try:
        stock = yf.Ticker(ticker)
        is_market_open = await get_market_status()

        if is_market_open:
            df_current = stock.history(
                interval="1m",
                period="1d",
                prepost=True
            )
            # Convert index and filter to Regular Trading Hours only
            df = df_current.copy()
            df.index = pd.to_datetime(df.index)
            df = df.between_time("09:30", "16:00")

            if df.empty:
                raise ValueError(f"No intraday data available for {ticker}")

            session_open = df.iloc[0]["Open"]
            session_high = df["High"].max()
            session_low = df["Low"].min()
            session_volume = df["Volume"].sum()

            last_row = df.iloc[-1]
            current_price = last_row["Close"]
            today = df.index[-1].date().isoformat()

            return OHLCVResponse(
                ticker=ticker,
                data=[OHLCV(
                    date=today,
                    open=float(session_open),
                    high=float(session_high),
                    low=float(session_low),
                    close=float(current_price),
                    volume=int(session_volume),
                )]
            )
        else:
            last_data = await fetch(ticker, days=1)
            if not last_data.data:
                raise ValueError(f"No data available for {ticker} to determine current price")
            df_current = stock.history(
                interval="1m",
                period="1d",
                prepost=True
            )
            # Convert index and filter to outside Regular Trading Hours only
            df = df_current.copy()
            df.index = pd.to_datetime(df.index)
            df = df[~df.index.to_series().between_time("09:30", "16:00")]
            if df.empty:
                return last_data  # Return last known data if no after-hours data is available
            last_row = df.iloc[-1]
            current_price = last_row["Close"]
            today = df.index[-1].strftime("%Y-%m-%dT%H:%M")
            return OHLCVResponse(
                ticker=ticker,
                data=[OHLCV(
                    date=today,
                    open=float(last_data.data[0].open),
                    high=float(last_data.data[0].high),
                    low=float(last_data.data[0].low),
                    close=float(current_price),
                    volume=int(last_data.data[0].volume),
                )]
            )
    except Exception as e:
        raise ValueError(f"Error fetching current stock data for {ticker}: {str(e)}")


class StockService:
    def get_stock_details(self, ticker: str) -> StockDetailedResponse:
        '''
        Get detailed stock information for a given ticker.
        Args:
            ticker (str): The stock ticker symbol.
        Returns:
            StockDetailedResponse: Detailed information about the stock, including financials, calendar events, analyst price targets, and recommendations.
        '''
        return StockDetailedResponse(
            ticker=ticker.ticker,
            info=self._parse_info(ticker),
            analyst_price_targets=self._parse_analyst_price_targets(ticker),
            recommendations_summary=self._parse_recommendations_summary(ticker),
            earnings_estimate=self._parse_earnings_estimate(ticker),
            revenue_estimate=self._parse_revenue_estimate(ticker),
        )

    def _parse_info(self, ticker: yf.Ticker) -> dict:
        return ticker.info if ticker.info else {}

    def _parse_analyst_price_targets(self, ticker: yf.Ticker) -> dict:
        return ticker.analyst_price_targets if ticker.analyst_price_targets is not None else {}

    def _parse_recommendations_summary(self, ticker: yf.Ticker) -> list:
        if ticker.recommendations_summary is None:
            return []
        df = ticker.recommendations_summary.copy()
        df = df.rename(columns={"strongBuy": "strong_buy", "strongSell": "strong_sell"})
        return df.to_dict(orient="records")

    def _parse_earnings_estimate(self, ticker: yf.Ticker) -> list:
        if ticker.earnings_estimate is None:
            return []
        df = ticker.earnings_estimate.copy()
        df.index.name = "period"
        df = df.reset_index()
        df = df.rename(columns={
            "numberOfAnalysts": "number_of_analysts",
            "yearAgoEps": "year_ago_eps",
        })
        return df.to_dict(orient="records")

    def _parse_revenue_estimate(self, ticker: yf.Ticker) -> list:
        if ticker.revenue_estimate is None:
            return []
        df = ticker.revenue_estimate.copy()
        df.index.name = "period"
        df = df.reset_index()
        df = df.rename(columns={
            "numberOfAnalysts": "number_of_analysts",
            "yearAgoRevenue": "year_ago_revenue",
        })
        return df.to_dict(orient="records")


async def fetch_detailed(ticker: str):
    '''
    Fetch detailed stock information for a given ticker.
    Args:
        ticker (str): The stock ticker symbol.
    Returns:
        StockDetailedResponse: Detailed information about the stock, including financials, calendar events, analyst price targets, and recommendations.
    '''
    service = StockService()
    stock = yf.Ticker(ticker)
    return service.get_stock_details(stock)


async def get_industry_map() -> dict:
    '''
    Build a mapping of industry names to the tickers that belong to each.
    Returns:
        dict: { industry_name: [ticker, ...] } sorted alphabetically.
    '''
    result: dict[str, list[str]] = {}
    for ticker in await get_all_stocks():
        try:
            info = yf.Ticker(ticker).info
            industry = info.get("industry")
            if industry:
                result.setdefault(industry, []).append(ticker)
        except Exception:
            pass
    return {k: sorted(v) for k, v in sorted(result.items())}


async def get_sector_map() -> dict:
    '''
    Build a mapping of sector names to the tickers that belong to each.
    Returns:
        dict: { sector_name: [ticker, ...] } sorted alphabetically.
    '''
    result: dict[str, list[str]] = {}
    for ticker in await get_all_stocks():
        try:
            info = yf.Ticker(ticker).info
            sector = info.get("sector")
            if sector:
                result.setdefault(sector, []).append(ticker)
        except Exception:
            pass
    return {k: sorted(v) for k, v in sorted(result.items())}


async def fetch_industry_stocks(industry: str):
    '''
    Fetch stock data for all stocks in a given industry.
    Args:
        industry (str): The industry to filter stocks by.
    Returns:
        IndustryStocksResponse: A list of stocks in the specified industry along with their OHLCV data.
    '''
    response = {"industry": industry, "ohlcv": []}
    for ticker in await get_all_stocks():
        stock = yf.Ticker(ticker)
        if stock.info.get("industry", "").lower() == industry.lower():
            ohlcv_data = await fetch(ticker)
            response["ohlcv"].append(ohlcv_data)
    return IndustryStocksResponse(**response)


async def fetch_sector_stocks(sector: str):
    '''
    Fetch stock data for all stocks in a given sector.
    Args:
        sector (str): The sector to filter stocks by.
    Returns:
        SectorStocksResponse: A list of stocks in the specified sector along with their OHLCV data.
    '''
    response = {"sector": sector, "ohlcv": []}
    for ticker in await get_all_stocks():
        stock = yf.Ticker(ticker)
        if stock.info.get("sector", "").lower() == sector.lower():
            ohlcv_data = await fetch(ticker)
            response["ohlcv"].append(ohlcv_data)
    return SectorStocksResponse(**response)