from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.domains.compute.routes import router as compute_router
from api.domains.latex.routes import router as latex_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(compute_router)
app.include_router(latex_router)


@app.get("/health")
def health():
    return {"status": "ok"}
