from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from insightface.app import FaceAnalysis
import numpy as np
import cv2

app = FastAPI(title="Face Verification API", description="Verify a driver's face against a database image")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

face_app = None

@app.on_event("startup")
async def startup_event():
    global face_app
    print("Initializing AuraFace model...")
    # Initialize model
    face_app = FaceAnalysis(
        name="auraface",
        root=".",   # IMPORTANT: searches in ./models/auraface
        providers=["CPUExecutionProvider"]  # use CUDA if GPU available
    )
    # The models directory needs to contain models/auraface
    face_app.prepare(ctx_id=0)
    print("Model initialized.")

def get_face_embedding(img_bytes: bytes):
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image content")

    faces = face_app.get(img)
    if len(faces) == 0:
        return None
    # Return the largest face if multiple faces are present (not currently sorting, just taking first)
    return faces[0].normed_embedding

def compute_cosine_similarity(emb1, emb2):
    return np.dot(emb1, emb2)

@app.post("/verify")
async def verify_faces(driver_image: UploadFile = File(...), database_image: UploadFile = File(...)):
    try:
        driver_bytes = await driver_image.read()
        db_bytes = await database_image.read()
        
        driver_embedding = get_face_embedding(driver_bytes)
        if driver_embedding is None:
            raise HTTPException(status_code=400, detail="No face detected in Driver Image")
            
        db_embedding = get_face_embedding(db_bytes)
        if db_embedding is None:
            raise HTTPException(status_code=400, detail="No face detected in Database Image")
            
        similarity = compute_cosine_similarity(driver_embedding, db_embedding)
        
        # Typically similarity > 0.6 is a good match for embeddings, adjust according to actual AuraFace evaluation
        threshold = 0.6
        is_verified = bool(similarity > threshold)
        
        return {
            "verified": is_verified,
            "similarity_score": float(similarity),
            "threshold": threshold
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
