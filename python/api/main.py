from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.domains.latex.routes import router as latex_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Domain routers — one per python/api/domains/<domain>/routes.py
# (see .claude/rules/python-compute.md). [CV]
app.include_router(latex_router)


@app.get("/health")
def health():
    return {"status": "ok"}
