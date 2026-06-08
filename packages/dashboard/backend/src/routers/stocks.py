'''
Router for stock-related endpoints.
'''
from fastapi import HTTPException, APIRouter
from ..schemas.stocks import OHLCVResponse
from ..services import stock_service

router = APIRouter()

@router.get("/stocks/{ticker}", response_model=OHLCVResponse)
async def get_stock(ticker: str, days: int = 30):
    '''
    Get stock data for a given ticker and number of days.
    Args:
        ticker (str): The stock ticker symbol.
        days (int, optional): The number of days of data to retrieve. Defaults to 30.
    Returns:
            OHLCVResponse: The stock data for the specified ticker and time period.
    '''
    try:
        data = await stock_service.fetch(ticker, days)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return data

