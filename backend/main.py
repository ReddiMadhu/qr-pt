from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import triage, ml, process, properties, results, submissions

# Load .env file for SMTP credentials and other settings
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    init_db()
    yield

app = FastAPI(
    title="Underwriting Intelligence API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow the Vite dev server and any origin for demo purposes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(triage.router,       prefix="/api/triage",      tags=["triage"])
app.include_router(ml.router,           prefix="/api/ml",          tags=["ml"])
app.include_router(process.router,      prefix="/api/process",     tags=["process"])
app.include_router(properties.router,   prefix="/api/properties",  tags=["properties"])
app.include_router(results.router,      prefix="/api/results",     tags=["results"])
app.include_router(submissions.router,  prefix="/api/submissions", tags=["submissions"])


@app.get("/")
def root():
    return {"message": "Underwriting Intelligence API is running", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
