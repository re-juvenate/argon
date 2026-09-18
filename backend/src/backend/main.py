from fastapi import FastAPI

from backend.agent.router import router as agent_router

app = FastAPI(title="Backend", version="0.1.0")

app.include_router(agent_router)
