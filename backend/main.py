from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import datasets, preprocess, training

app = FastAPI(
    title="ML Model Playground API",
    description="Upload a dataset, train models, and get results as JSON."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(preprocess.router)
app.include_router(training.router)


@app.get("/")
def root():
    return {"app": "ML Model Playground", "status": "alive"}


@app.get("/api/health")
def health():
    """The frontend pings this to show a live 'API connected' badge."""
    return {"status": "ok", "version": app.version}
