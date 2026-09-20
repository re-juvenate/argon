from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent.router import router as agent_router
from deploy.router import router as deploy_router
from runner.consumer import Consumer
from runner.dependencies import get_runner_queue, get_runner_service, get_runner_store
from runner.router import router as runner_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    service = get_runner_service()
    consumer = Consumer(get_runner_queue(), get_runner_store(), workers=service.settings.workers)
    consumer.start()
    yield
    consumer.stop()


app = FastAPI(title="Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_router)
app.include_router(deploy_router)
app.include_router(runner_router)
