'''
Health-check and metadata endpoints for the dashboard backend API.
'''
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def root():
    '''
    Root endpoint that provides basic information about the API.
    '''
    return {"message": "Welcome to the Dashboard Backend API. Use /docs for API documentation."}

@router.get("/health")
async def health_check():
    '''
    Health-check endpoint to verify that the API is running.
    '''
    return {"status": "ok"}
