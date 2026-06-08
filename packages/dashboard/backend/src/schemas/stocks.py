'''
Schema for stocks.
'''
from pydantic import BaseModel
from typing import List

class OHLCV(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int

class OHLCVResponse(BaseModel):
    ticker: str
    data: List[OHLCV]