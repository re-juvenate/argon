from fastapi import FastAPI

from agent.router import router as agent_router
from deploy.router import router as deploy_router

app = FastAPI(title="Backend", version="0.1.0")

app.include_router(agent_router)
app.include_router(deploy_router)
