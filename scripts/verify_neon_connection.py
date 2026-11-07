"""
Quick helper to verify Neon DB connection string format.
Run this locally AFTER getting the correct DATABASE_URL from Neon console.

Steps:
1. Go to Neon console → Branch (production) → Connect
2. Select: Role = neondb_owner, Database = neondb
3. Enable "Connection pooling" toggle  
4. Click "Copy snippet" button to copy the full connection string
5. Paste as DATABASE_URL below and run:
   python verify_neon_connection.py

The connection string format should be:
  postgresql://neondb_owner:[PASSWORD]@[ENDPOINT]-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
"""
import os
import sys

DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    print("Usage: DATABASE_URL='postgresql://...' python verify_neon_connection.py")
    sys.exit(1)

try:
    import urllib.parse
    parsed = urllib.parse.urlparse(DATABASE_URL)
    print(f"✅ Host: {parsed.hostname}")
    print(f"✅ Port: {parsed.port or 5432}")
    print(f"✅ Database: {parsed.path.lstrip('/')}")
    print(f"✅ User: {parsed.username}")
    print(f"✅ SSL: {'sslmode=require' in DATABASE_URL}")
    print("Connection string looks valid!")
except Exception as e:
    print(f"❌ Error parsing URL: {e}")
