import uvicorn
import os
import sys

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"🚀 Starting MemeSpeak AI server on http://localhost:{port}")
    print(f"📂 Serving public/index.html and /api endpoints")
    uvicorn.run("api.index:app", host=host, port=port, reload=True)

