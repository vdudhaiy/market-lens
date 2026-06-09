'''Main file for the dashboard backend. Sets up the FastAPI application and includes the necessary routers.'''

import os
from fastapi import FastAPI
from .routers import stocks
from .routers import health

app = FastAPI(
    title=os.getenv("APP_NAME", "Dashboard Backend API"),
    openapi_url="/openapi",
    docs_url="/docs",
)

app.include_router(stocks.router)
app.include_router(health.router)