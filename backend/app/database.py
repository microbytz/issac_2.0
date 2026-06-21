import os
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv

# Load package environment variables
load_dotenv()

# Initialize Firebase App using Admin SDK
if not firebase_admin._apps:
    credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
    
    if credentials_path and os.path.exists(credentials_path):
        cred = credentials.Certificate(credentials_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': bucket_name
        })
    else:
        # Fallback for local development or default environmental credentials
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name
            })
        except Exception:
            # Fallback for quick manual setups using mock credentials or unauthenticated client
            firebase_admin.initialize_app(options={
                'storageBucket': bucket_name
            })

# Clients
db = firestore.client()
bucket = storage.bucket()

def get_firestore_db():
    return db

def get_storage_bucket():
    return bucket
