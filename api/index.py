import os
import sys
import io
import json
import base64
import re
import requests
import instaloader
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

# Ensure parent directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from sarvam_service import (
    SarvamMemeService,
    SARVAM_SPEAKERS,
    SUPPORTED_LANGUAGES,
    render_extended_meme_card,
    clean_speech_text,
    concat_wavs
)

load_dotenv()

app = FastAPI(title="MemeSpeak AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_service(custom_key: Optional[str] = None) -> SarvamMemeService:
    key = custom_key or os.getenv("SARVAM_API_KEY")
    if not key:
        raise HTTPException(
            status_code=400,
            detail="SARVAM_API_KEY not found. Please provide an API key in settings or set it in .env"
        )
    return SarvamMemeService(api_key=key)

class FetchImageRequest(BaseModel):
    url: str

class AnalyzeRequest(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    product_name: Optional[str] = ""
    product_description: Optional[str] = ""
    target_audience: Optional[str] = ""
    conversation_mode: str = "meme_characters"
    humor_style: str = "standup"
    language: str = "en-IN"
    api_key: Optional[str] = None

class SynthesizeRequest(BaseModel):
    dialogue: List[Dict[str, Any]]
    speaker_1_voice: str = "rohan"
    speaker_2_voice: str = "simran"
    humor_speech: Optional[str] = ""
    comedian_voice: str = "aditya"
    language_code: str = "en-IN"
    api_key: Optional[str] = None

class EscalateRequest(BaseModel):
    base_title: str
    current_situation: str
    level: int = 3
    language: str = "en-IN"
    speaker_1: str = "Speaker 1"
    speaker_2: str = "Speaker 2"
    api_key: Optional[str] = None

@app.get("/api/health")
def health():
    key_set = bool(os.getenv("SARVAM_API_KEY"))
    return {
        "status": "healthy",
        "sarvam_configured": key_set,
        "speakers": SARVAM_SPEAKERS,
        "languages": SUPPORTED_LANGUAGES
    }

@app.get("/api/samples")
def get_sample_memes():
    """Returns the pre-loaded sample memes with their names and base64 preview data."""
    samples_dir = os.path.join(BASE_DIR, "sample_memes")
    results = []
    
    sample_meta = {
        "3am_bug_fix.png": {"title": "Debugging at 3:00 AM", "desc": "Delete entire file to fix bug. Zero errors."},
        "client_budget.png": {"title": "Client vs Budget", "desc": "Wants AI blockchain app for $25 gift card."},
        "meeting_vs_email.png": {"title": "Corporate Meeting vs Email", "desc": "90 min sync vs 2 sentence Slack message."},
        "framework_hype.png": {"title": "Frontend Framework Hype", "desc": "Rewrite profitable business in 45-min-old framework."}
    }
    
    if os.path.exists(samples_dir):
        for fname in sorted(os.listdir(samples_dir)):
            if fname.endswith((".png", ".jpg", ".jpeg", ".webp")):
                fpath = os.path.join(samples_dir, fname)
                try:
                    with open(fpath, "rb") as f:
                        b64 = base64.b64encode(f.read()).decode("utf-8")
                    meta = sample_meta.get(fname, {"title": fname, "desc": "Sample Meme"})
                    results.append({
                        "filename": fname,
                        "title": meta["title"],
                        "description": meta["desc"],
                        "data_url": f"data:image/png;base64,{b64}"
                    })
                except Exception as e:
                    print(f"Error reading sample {fname}: {e}")
                    
    return {"samples": results}

@app.post("/api/fetch_image")
def fetch_image(req: FetchImageRequest):
    """
    Fetches an image from a URL or Instagram post/reel link.
    - If Instagram link: resolves the post image via Instaloader.
    - If direct image or web link: fetches the image or og:image.
    Converts to base64 data URL to prevent browser CORS issues.
    """
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL. Must begin with http:// or https://")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # 1. Check if Instagram post or reel link
    ig_match = re.search(r"instagram\.com/(?:p|reel|reels)/([A-Za-z0-9_-]+)", url)
    if ig_match:
        shortcode = ig_match.group(1)
        try:
            L = instaloader.Instaloader()
            post = instaloader.Post.from_shortcode(L.context, shortcode)
            target_url = post.url
            if not target_url:
                raise ValueError("Could not extract image URL from Instagram post")
            
            res = requests.get(target_url, headers=headers, timeout=15)
            if res.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download Instagram image: HTTP {res.status_code}")
                
            b64 = base64.b64encode(res.content).decode("utf-8")
            return {
                "data_url": f"data:image/jpeg;base64,{b64}",
                "content_type": "image/jpeg",
                "size_bytes": len(res.content),
                "source": "instagram",
                "caption": post.caption[:200] if post.caption else ""
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Instagram link error: {str(e)}")

    # 2. Direct Image or Standard Web Page
    try:
        res = requests.get(url, headers=headers, timeout=15)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch image: HTTP {res.status_code}")
        
        content_type = res.headers.get("Content-Type", "").split(";")[0].strip().lower()

        # If an HTML page was returned (e.g. webpage with meme), look for og:image
        if "text/html" in content_type:
            soup = BeautifulSoup(res.text, "html.parser")
            og_tag = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
            if og_tag and og_tag.get("content"):
                og_url = og_tag["content"].strip()
                res = requests.get(og_url, headers=headers, timeout=15)
                content_type = res.headers.get("Content-Type", "").split(";")[0].strip().lower()

        # Detect image format
        if not content_type.startswith("image/"):
            if res.content.startswith(b"\x89PNG\r\n\x1a\n"):
                content_type = "image/png"
            elif res.content.startswith(b"\xff\xd8\xff"):
                content_type = "image/jpeg"
            elif res.content.startswith(b"RIFF") and b"WEBP" in res.content[:16]:
                content_type = "image/webp"
            else:
                content_type = "image/png"
                
        b64 = base64.b64encode(res.content).decode("utf-8")
        return {
            "data_url": f"data:{content_type};base64,{b64}",
            "content_type": content_type,
            "size_bytes": len(res.content),
            "source": "direct_url"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not load image from URL: {str(e)}")

@app.post("/api/analyze")
def analyze_meme(req: AnalyzeRequest):
    """
    Multimodal meme analysis and script generation using Sarvam AI (glm5.3-flash).
    Generates original breakdown, dialogue, humor speech, and extended sequel.
    Supports either image_base64 or image_url.
    """
    service = get_service(req.api_key)
    
    # Handle image from URL if base64 not directly supplied
    data_url = req.image_base64
    if not data_url and req.image_url:
        fetch_res = fetch_image(FetchImageRequest(url=req.image_url))
        data_url = fetch_res["data_url"]
        
    if not data_url:
        raise HTTPException(status_code=400, detail="Please provide either image_base64 or image_url.")
    
    # Extract raw bytes from base64 data URL
    if "," in data_url:
        header, b64_str = data_url.split(",", 1)
        mime_type = "image/png"
        if "jpeg" in header or "jpg" in header:
            mime_type = "image/jpeg"
        elif "webp" in header:
            mime_type = "image/webp"
    else:
        b64_str = data_url
        mime_type = "image/png"
        
    try:
        img_bytes = base64.b64decode(b64_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {e}")

    try:
        result = service.analyze_meme_and_generate_scripts(
            image_bytes=img_bytes,
            mime_type=mime_type,
            product_name=req.product_name or "",
            product_description=req.product_description or "",
            target_audience=req.target_audience or "",
            conversation_mode=req.conversation_mode,
            humor_style=req.humor_style,
            language=req.language
        )
        
        # Convert marketing meme images to data URLs for frontend display
        for m in result.get("marketing_memes", []):
            if "rendered_image_bytes" in m and m["rendered_image_bytes"]:
                m_b64 = base64.b64encode(m["rendered_image_bytes"]).decode("utf-8")
                m["rendered_image_url"] = f"data:image/png;base64,{m_b64}"
                del m["rendered_image_bytes"]

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Sarvam AI processing error: {str(e)}")

@app.post("/api/synthesize")
def synthesize_audio(req: SynthesizeRequest):
    """
    Synthesizes dialogue turns and humor speech into speech audio via Sarvam Bulbul TTS.
    """
    service = get_service(req.api_key)
    
    try:
        # Synthesize dialogue
        enriched_dialogue, full_dialogue_wav = service.synthesize_conversation_audio(
            dialogue=req.dialogue,
            speaker_1_voice=req.speaker_1_voice,
            speaker_2_voice=req.speaker_2_voice,
            language_code=req.language_code
        )
        
        # Encode turn audios to data URLs
        turns_output = []
        for turn in enriched_dialogue:
            turn_copy = dict(turn)
            aud = turn_copy.pop("audio_bytes", None)
            if aud:
                turn_copy["audio_url"] = f"data:audio/wav;base64,{base64.b64encode(aud).decode('utf-8')}"
            else:
                turn_copy["audio_url"] = None
            turns_output.append(turn_copy)
            
        full_audio_url = None
        if full_dialogue_wav:
            full_audio_url = f"data:audio/wav;base64,{base64.b64encode(full_dialogue_wav).decode('utf-8')}"
            
        # Synthesize humor speech
        humor_audio_url = None
        if req.humor_speech:
            humor_wav = service.synthesize_humor_speech(
                humor_text=req.humor_speech,
                comedian_voice=req.comedian_voice,
                language_code=req.language_code
            )
            if humor_wav:
                humor_audio_url = f"data:audio/wav;base64,{base64.b64encode(humor_wav).decode('utf-8')}"

        return {
            "dialogue_turns": turns_output,
            "full_dialogue_audio_url": full_audio_url,
            "humor_audio_url": humor_audio_url
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")

@app.post("/api/escalate")
def escalate_level(req: EscalateRequest):
    """
    Escalates the meme humor further to Level 3, 4, etc.
    """
    service = get_service(req.api_key)
    try:
        data = service.escalate_humor_to_level(
            base_title=req.base_title,
            current_situation=req.current_situation,
            level=req.level,
            language=req.language,
            speaker_1=req.speaker_1,
            speaker_2=req.speaker_2
        )
        
        if "rendered_meme_image" in data:
            meme_bytes = data.pop("rendered_meme_image")
            if meme_bytes:
                b64 = base64.b64encode(meme_bytes).decode("utf-8")
                data["rendered_meme_image_url"] = f"data:image/png;base64,{b64}"
                
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Escalation error: {str(e)}")

# Mount public directory for local testing
public_path = os.path.join(BASE_DIR, "public")
if os.path.exists(public_path):
    app.mount("/", StaticFiles(directory=public_path, html=True), name="public")

