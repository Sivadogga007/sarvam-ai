import os
import re
import io
import json
import wave
import base64
import textwrap
from typing import List, Dict, Any, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv
from sarvamai import SarvamAI

load_dotenv()

SARVAM_SPEAKERS = [
    "rohan", "simran", "aditya", "priya", "ashutosh", "ritu", 
    "neha", "rahul", "pooja", "kavya", "amit", "dev", 
    "ishita", "shreya", "ratan", "varun", "manan", "sumit", 
    "roopa", "kabir", "aayan", "shubh", "advait", "anand", 
    "tanya", "tarun", "sunny", "mani", "gokul", "vijay", 
    "shruti", "suhani", "mohit", "kavitha", "rehan", "soham", "rupali"
]

SUPPORTED_LANGUAGES = {
    "en-IN": "English (India)",
    "hi-IN": "Hindi (हिन्दी)",
    "hinglish": "Hinglish (Hindi-English mix)",
    "bn-IN": "Bengali (বাংলা)",
    "ta-IN": "Tamil (தமிழ்)",
    "te-IN": "Telugu (తెలుగు)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "mr-IN": "Marathi (मराठी)",
    "gu-IN": "Gujarati (ગુજરાતી)"
}

def clean_speech_text(text: str) -> str:
    """Removes stage directions like *(laughs)* or [dramatic pause] for TTS."""
    cleaned = re.sub(r'\*[^*]*\*', '', text)
    cleaned = re.sub(r'\[[^\[\]]*\]', '', cleaned)
    cleaned = re.sub(r'\([A-Za-z0-9\s,\.!?-]{1,35}\)', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned if cleaned else text

def robust_json_loads(text: str) -> Dict[str, Any]:
    """
    Robust JSON parser that strips markdown code fences, removes illegal trailing commas,
    and isolates the valid JSON block if extra text is present.
    """
    cleaned = text.strip()
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[1].split("```")[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[1].split("```")[0].strip()
        
    # Strip illegal trailing commas before } and ]
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
    
    try:
        return json.loads(cleaned)
    except Exception:
        # Fallback: slice from first { to last }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            sub = cleaned[start:end+1]
            sub = re.sub(r',\s*([}\]])', r'\1', sub)
            return json.loads(sub)
        raise

def concat_wavs(wav_bytes_list: List[bytes], silence_sec: float = 0.45) -> bytes:
    """Concatenates multiple WAV audio bytes with a small silent pause in between."""
    valid_wavs = [w for w in wav_bytes_list if w and len(w) > 44]
    if not valid_wavs:
        return b""
    if len(valid_wavs) == 1:
        return valid_wavs[0]
        
    output = io.BytesIO()
    try:
        with wave.open(io.BytesIO(valid_wavs[0]), "rb") as first:
            params = first.getparams()
            
        with wave.open(output, "wb") as out_wav:
            out_wav.setparams(params)
            silence_frames = int(params.framerate * silence_sec)
            silence_data = b"\x00" * (silence_frames * params.nchannels * params.sampwidth)
            
            for i, data in enumerate(valid_wavs):
                with wave.open(io.BytesIO(data), "rb") as w:
                    out_wav.writeframes(w.readframes(w.getnframes()))
                if i < len(valid_wavs) - 1:
                    out_wav.writeframes(silence_data)
        return output.getvalue()
    except Exception as e:
        print(f"Error concatenating WAVs: {e}")
        return valid_wavs[0]

def render_comic_meme_panel(
    title: str = "THE MORNING STANDUP",
    left_name: str = "Boss",
    left_expr: str = "panicked",
    left_text: str = "WHY DID YOU DELETE THE WHOLE FILE?!",
    right_name: str = "Dev",
    right_expr: str = "smug",
    right_text: str = "BECAUSE ZERO CODE EQUALS ZERO BUGS!",
    badge: str = "EXTENDED MEME ACT 2",
    theme_color: Tuple[int, int, int] = (239, 68, 68)
) -> bytes:
    """
    Renders an authentic 2-panel comic meme image with expressive cartoon characters,
    speech bubbles pointing to each character, and bold Impact font meme text.
    """
    w, h = 840, 520
    img = Image.new("RGB", (w, h), (18, 22, 30))
    d = ImageDraw.Draw(img)

    font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
    if not os.path.exists(font_path):
        font_path = "/System/Library/Fonts/Helvetica.ttc"
        
    try:
        f_badge = ImageFont.truetype(font_path, 18)
        f_title = ImageFont.truetype(font_path, 26)
        f_name = ImageFont.truetype(font_path, 20)
        f_bubble = ImageFont.truetype(font_path, 21)
    except Exception:
        f_badge = f_title = f_name = f_bubble = ImageFont.load_default()

    # Outer Frame
    d.rounded_rectangle([8, 8, w-8, h-8], radius=16, fill=(24, 28, 38), outline=theme_color, width=3)

    # Header Banner
    d.rounded_rectangle([25, 20, 230, 56], radius=8, fill=theme_color)
    d.text((35, 26), badge.upper()[:22], font=f_badge, fill=(255, 255, 255))
    d.text((250, 25), title.upper()[:36], font=f_title, fill=(245, 245, 245))

    # Panels
    pw = (w - 70) // 2
    # Left Panel
    d.rounded_rectangle([25, 75, 25 + pw, h - 25], radius=12, fill=(15, 18, 25), outline=(56, 189, 248), width=2)
    d.text((40, 88), left_name.upper()[:20], font=f_name, fill=(56, 189, 248))
    
    # Left Avatar
    cx, cy, r = 25 + pw//2, 175, 52
    avatar_color = (255, 130, 130) if left_expr == "panicked" else (255, 215, 0)
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=avatar_color, outline=(20, 20, 20), width=3)
    if left_expr == "panicked":
        d.ellipse([cx-25, cy-20, cx-5, cy+10], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
        d.ellipse([cx+5, cy-20, cx+25, cy+10], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
        d.ellipse([cx-17, cy-10, cx-11, cy-4], fill=(0, 0, 0))
        d.ellipse([cx+11, cy-10, cx+17, cy-4], fill=(0, 0, 0))
        d.ellipse([cx-16, cy+18, cx+16, cy+42], fill=(60, 0, 0), outline=(0, 0, 0), width=2)
        d.ellipse([cx+r-6, cy-30, cx+r+4, cy-12], fill=(80, 200, 255))
    else: # smug or deadpan
        d.arc([cx-25, cy-15, cx-5, cy+5], start=0, end=180, fill=(0, 0, 0), width=3)
        d.arc([cx+5, cy-15, cx+25, cy+5], start=0, end=180, fill=(0, 0, 0), width=3)
        d.arc([cx-18, cy+10, cx+18, cy+35], start=20, end=160, fill=(0, 0, 0), width=3)

    # Bubble Left
    d.rounded_rectangle([40, 250, 25 + pw - 15, h - 35], radius=10, fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    d.polygon([(cx - 10, 250), (cx + 10, 250), (cx, 235)], fill=(255, 255, 255))
    d.line([(cx - 10, 250), (cx, 235), (cx + 10, 250)], fill=(0, 0, 0), width=2)
    b1_lines = textwrap.fill(left_text.upper(), width=25)
    d.text((50, 265), b1_lines, font=f_bubble, fill=(10, 10, 10))

    # Right Panel
    rx1 = 25 + pw + 20
    d.rounded_rectangle([rx1, 75, rx1 + pw, h - 25], radius=12, fill=(15, 18, 25), outline=(244, 114, 182), width=2)
    d.text((rx1 + 15, 88), right_name.upper()[:20], font=f_name, fill=(244, 114, 182))
    
    # Right Avatar
    cx2, cy2 = rx1 + pw//2, 175
    avatar_color_2 = (255, 220, 100) if right_expr == "smug" else (255, 130, 130)
    d.ellipse([cx2-r, cy2-r, cx2+r, cy2+r], fill=avatar_color_2, outline=(20, 20, 20), width=3)
    if right_expr == "smug":
        d.arc([cx2-25, cy2-15, cx2-5, cy2+5], start=0, end=180, fill=(0, 0, 0), width=3)
        d.arc([cx2+5, cy2-15, cx2+25, cy2+5], start=0, end=180, fill=(0, 0, 0), width=3)
        d.arc([cx2-18, cy2+12, cx2+22, cy2+38], start=20, end=160, fill=(0, 0, 0), width=3)
    else:
        d.ellipse([cx2-25, cy2-20, cx2-5, cy2+10], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
        d.ellipse([cx2+5, cy2-20, cx2+25, cy2+10], fill=(255, 255, 255), outline=(0, 0, 0), width=2)
        d.ellipse([cx2-17, cy2-10, cx2-11, cy2-4], fill=(0, 0, 0))
        d.ellipse([cx2+11, cy2-10, cx2+17, cy2-4], fill=(0, 0, 0))
        d.ellipse([cx2-16, cy2+18, cx2+16, cy2+42], fill=(60, 0, 0), outline=(0, 0, 0), width=2)

    # Bubble Right
    d.rounded_rectangle([rx1 + 15, 250, rx1 + pw - 15, h - 35], radius=10, fill=(255, 255, 255), outline=(0, 0, 0), width=2)
    d.polygon([(cx2 - 10, 250), (cx2 + 10, 250), (cx2, 235)], fill=(255, 255, 255))
    d.line([(cx2 - 10, 250), (cx2, 235), (cx2 + 10, 250)], fill=(0, 0, 0), width=2)
    b2_lines = textwrap.fill(right_text.upper(), width=25)
    d.text((rx1 + 25, 265), b2_lines, font=f_bubble, fill=(10, 10, 10))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def render_extended_meme_card(
    title: str,
    top_label: str,
    top_text: str,
    bottom_label: str,
    bottom_text: str,
    badge: str = "EXTENDED MEME SEQUEL",
    theme_color: Tuple[int, int, int] = (255, 90, 90)
) -> bytes:
    """
    Renders an extended sequel meme image using PIL with clean typography and layout.
    """
    width, height = 800, 560
    img = Image.new("RGB", (width, height), color=(18, 20, 26))
    draw = ImageDraw.Draw(img)
    
    # Outer frame
    draw.rounded_rectangle([15, 15, width-15, height-15], radius=16, fill=(26, 30, 40), outline=theme_color, width=3)
    
    font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
    if not os.path.exists(font_path):
        font_path = "/System/Library/Fonts/Helvetica.ttc"
        
    try:
        f_badge = ImageFont.truetype(font_path, 20)
        f_title = ImageFont.truetype(font_path, 30)
        f_label = ImageFont.truetype(font_path, 22)
        f_body = ImageFont.truetype(font_path, 24)
    except Exception:
        f_badge = f_title = f_label = f_body = ImageFont.load_default()
        
    # Top Header Banner
    draw.rounded_rectangle([35, 30, 260, 68], radius=8, fill=theme_color)
    draw.text((45, 38), badge.upper(), fill=(255, 255, 255), font=f_badge)
    
    # Title
    disp_title = (title[:36] + "...") if len(title) > 36 else title
    draw.text((280, 36), disp_title.upper(), fill=(240, 245, 255), font=f_title)
    
    # Card 1: Setup / Situation
    draw.rounded_rectangle([35, 95, width-35, 300], radius=12, fill=(20, 24, 32), outline=(70, 85, 110), width=2)
    draw.text((55, 110), top_label.upper(), fill=(100, 210, 255), font=f_label)
    wrapped_top = textwrap.fill(top_text, width=44)
    draw.text((55, 150), wrapped_top, fill=(250, 250, 250), font=f_body)
    
    # Card 2: Escalation / Punchline
    draw.rounded_rectangle([35, 320, width-35, 525], radius=12, fill=(20, 24, 32), outline=theme_color, width=2)
    draw.text((55, 335), bottom_label.upper(), fill=(255, 140, 140), font=f_label)
    wrapped_bottom = textwrap.fill(bottom_text, width=44)
    draw.text((55, 375), wrapped_bottom, fill=(255, 230, 140), font=f_body)
    
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class SarvamMemeService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SARVAM_API_KEY")
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY is not set. Please provide it or configure your .env file.")
        self.client = SarvamAI(api_subscription_key=self.api_key)

    def analyze_meme_and_generate_scripts(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        product_name: str = "",
        product_description: str = "",
        target_audience: str = "",
        conversation_mode: str = "meme_characters",
        humor_style: str = "standup",
        language: str = "en-IN"
    ) -> Dict[str, Any]:
        """
        Sends meme image and product details to Sarvam multimodal endpoint (glm5.3-flash).
        Acts as a digital marketing business helper:
        - Analyzes product image & value proposition
        - Creates a viral 'Talk the Meme' audio ad conversation
        - Renders multiple visual marketing meme images (comic panel memes)
        - Writes a stand-up comedy marketing pitch
        - Generates social media copy for Instagram, LinkedIn, and Twitter
        """
        b64_img = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_img}"

        lang_instruction = ""
        tts_lang = language
        if language == "hinglish":
            lang_instruction = "Generate all text in entertaining Hinglish (blend of Hindi and English like urban Indian comedy, Latin script)."
            tts_lang = "hi-IN"
        elif language == "hi-IN":
            lang_instruction = "Generate all text in conversational Hindi (Devanagari script)."
        elif language == "en-IN":
            lang_instruction = "Generate all text in witty, punchy English."
        else:
            lang_name = SUPPORTED_LANGUAGES.get(language, language)
            lang_instruction = f"Generate all text in conversational {lang_name}."

        prod_context = ""
        if product_name or product_description:
            prod_context = f"""
Product Information for Digital Marketing:
- Product Name: {product_name or 'Our Solution'}
- Product Description & Value Proposition: {product_description or 'Solves user pain points with smart automation'}
- Target Audience: {target_audience or 'General consumers / Professionals'}
"""

        prompt = f"""You are an elite creative director at a digital marketing agency specializing in high-converting viral meme marketing and audio advertising.
We are analyzing this product image and creating a complete meme marketing package to help this business get customers!

{prod_context}

Language:
{lang_instruction}

Marketing Humor Tone:
{humor_style}

You MUST return a JSON object with this exact structure:
{{
  "campaign_title": "Catchy viral campaign headline for this product",
  "core_pain_point": "The exact frustrating customer problem or meme situation being attacked",
  "how_product_solves_it": "Punchy 1-2 sentence value proposition of how the product fixes this chaos",
  "product_hook": "One-line viral hook for ad campaigns",
  "talk_the_meme": {{
    "speaker_1_name": "Customer or Skeptic (e.g. 'Stressed Dev')",
    "speaker_2_name": "Advocate or AI (e.g. '{product_name or 'Product Hero'}')",
    "dialogue": [
      {{
        "speaker": "speaker_1_name or speaker_2_name",
        "role": "speaker_1 or speaker_2",
        "emotion": "comedic emotion tag e.g. exhausted / panicked / smug / relieved",
        "text": "Spoken line (natural, snappy, high-retention audio ad conversation)"
      }}
    ]
  }},
  "marketing_memes": [
    {{
      "title": "Short Meme 1 Title (e.g. 'THE PAIN POINT')",
      "badge": "MEME 1: THE NIGHTMARE",
      "left_char": "Name of struggling person/competitor",
      "left_expr": "panicked",
      "left_bubble": "PUNCHY CAPITALIZED MEME LINE 1",
      "right_char": "Name of smart user / our product",
      "right_expr": "smug",
      "right_bubble": "PUNCHY CAPITALIZED MEME LINE 2"
    }},
    {{
      "title": "Short Meme 2 Title (e.g. 'THE PRODUCT UPGRADE')",
      "badge": "MEME 2: THE GAMECHANGER",
      "left_char": "Old Way / Skeptic",
      "left_expr": "panicked",
      "left_bubble": "PUNCHY CAPITALIZED MEME LINE 1",
      "right_char": "Product Advocate",
      "right_expr": "smug",
      "right_bubble": "PUNCHY CAPITALIZED MEME LINE 2"
    }}
  ],
  "humor_standup_pitch": "A 120-160 word stand-up comedy routine roasting the nightmare customers face without this product and hailing the product as the obvious savior, ready for comedian voice synthesis.",
  "social_copy": {{
    "instagram": "Viral Instagram caption with hook, pain point, product solution, emojis, and hashtags #startup #business #marketing",
    "linkedin": "Relatable B2B thought leadership post with meme takeaway and CTA",
    "twitter": "Short, punchy viral tweet under 240 chars"
  }}
}}

Make sure 'talk_the_meme.dialogue' has exactly 4 alternating turns.
Output ONLY the raw JSON object, without any surrounding markdown or explanation.
"""

        response = self.client.responses.create(
            model="glm5.3-flash",
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": prompt},
                        {"type": "input_image", "image_url": data_url}
                    ]
                }
            ],
            store=False
        )

        raw_text = ""
        for item in response.output:
            if hasattr(item, "role") and item.role == "assistant":
                for part in getattr(item, "content", []):
                    if hasattr(part, "text") and part.text:
                        raw_text += part.text

        data = robust_json_loads(raw_text)
        data["tts_language"] = tts_lang
        
        # Backward compatibility aliases
        if "talk_the_meme" in data and "dialogue" in data["talk_the_meme"]:
            data["dialogue"] = data["talk_the_meme"]["dialogue"]
        if "humor_standup_pitch" in data:
            data["humor_speech"] = data["humor_standup_pitch"]

        # Render all marketing meme images dynamically
        colors = [(239, 68, 68), (168, 85, 247), (59, 130, 246)]
        for i, meme_item in enumerate(data.get("marketing_memes", [])):
            try:
                m_title = meme_item.get("title", f"MEME {i+1}")
                m_badge = meme_item.get("badge", f"MARKETING MEME {i+1}")
                left_c = meme_item.get("left_char", "Skeptic / Old Way")
                left_e = meme_item.get("left_expr", "panicked")
                left_b = meme_item.get("left_bubble", "WHY IS EVERYTHING SO HARD?")
                right_c = meme_item.get("right_char", product_name or "Smart Solution")
                right_e = meme_item.get("right_expr", "smug")
                right_b = meme_item.get("right_bubble", "BECAUSE YOU ARE NOT USING THIS PRODUCT!")

                c_bytes = render_comic_meme_panel(
                    title=m_title,
                    left_name=left_c,
                    left_expr=left_e,
                    left_text=left_b,
                    right_name=right_c,
                    right_expr=right_e,
                    right_text=right_b,
                    badge=m_badge,
                    theme_color=colors[i % len(colors)]
                )
                meme_item["rendered_image_bytes"] = c_bytes
            except Exception as err:
                print(f"Error rendering marketing meme {i}: {err}")

        return data

    def escalate_humor_to_level(
        self,
        base_title: str,
        current_situation: str,
        level: int = 3,
        language: str = "en-IN",
        speaker_1: str = "Speaker 1",
        speaker_2: str = "Speaker 2"
    ) -> Dict[str, Any]:
        """
        Escalates the humor one step further (e.g. Level 3: International Crisis / Level 4: Galactic Scale).
        """
        prompt = f"""Take this comedy premise and escalate it to LEVEL {level} of pure absurdity!
Base Premise: {base_title}
Previous Situation: {current_situation}
Speakers: {speaker_1} and {speaker_2}
Language: {language}

Return a valid JSON object:
{{
  "level": {level},
  "level_title": "Level {level} Title (e.g. 'Level {level}: The UN Emergency Meeting')",
  "situation": "How the situation escalated to even more ridiculous proportions",
  "meme_top_label": "LEVEL {level} SETUP",
  "meme_top_text": "Caption describing the new escalated state",
  "meme_bottom_label": "THE FINAL CHAOS",
  "meme_bottom_text": "The absurd punchline of Level {level}",
  "dialogue": [
    {{"speaker": "{speaker_1}", "role": "speaker_1", "emotion": "emotion", "text": "line"}},
    {{"speaker": "{speaker_2}", "role": "speaker_2", "emotion": "emotion", "text": "line"}},
    {{"speaker": "{speaker_1}", "role": "speaker_1", "emotion": "emotion", "text": "line"}},
    {{"speaker": "{speaker_2}", "role": "speaker_2", "emotion": "emotion", "text": "line"}}
  ],
  "humor_speech": "120-150 word stand-up comedy monologue roasting this Level {level} catastrophe."
}}
Output ONLY valid JSON.
"""

        response = self.client.responses.create(
            model="glm5.3-flash",
            input=[{"role": "user", "content": prompt}],
            store=False
        )
        
        raw_text = ""
        for item in response.output:
            if hasattr(item, "role") and item.role == "assistant":
                for part in getattr(item, "content", []):
                    if hasattr(part, "text") and part.text:
                        raw_text += part.text

        data = robust_json_loads(raw_text)
        meme_bytes = render_extended_meme_card(
            title=data.get("level_title", f"Level {level}"),
            top_label=data.get("meme_top_label", f"LEVEL {level}"),
            top_text=data.get("meme_top_text", ""),
            bottom_label=data.get("meme_bottom_label", "CHAOS"),
            bottom_text=data.get("meme_bottom_text", ""),
            badge=f"ESCALATION LEVEL {level}",
            theme_color=(180, 80, 255) if level % 2 == 1 else (255, 170, 40)
        )
        data["rendered_meme_image"] = meme_bytes
        return data

    def synthesize_single_speech(
        self,
        text: str,
        speaker: str = "rohan",
        language_code: str = "en-IN",
        model: str = "bulbul:v3"
    ) -> bytes:
        """Synthesizes text into audio bytes using Sarvam Bulbul."""
        clean = clean_speech_text(text)
        if not clean:
            return b""
            
        try:
            resp = self.client.text_to_speech.convert(
                text=clean,
                language_code=language_code,
                speaker=speaker,
                model=model
            )
            if resp.audios and len(resp.audios) > 0:
                return base64.b64decode(resp.audios[0])
            return b""
        except Exception as e:
            print(f"Sarvam TTS error for speaker '{speaker}': {e}")
            if speaker != "rohan":
                try:
                    resp = self.client.text_to_speech.convert(
                        text=clean,
                        language_code=language_code,
                        speaker="rohan",
                        model="bulbul:v3"
                    )
                    return base64.b64decode(resp.audios[0])
                except Exception:
                    pass
            return b""

    def synthesize_conversation_audio(
        self,
        dialogue: List[Dict[str, Any]],
        speaker_1_voice: str = "rohan",
        speaker_2_voice: str = "simran",
        language_code: str = "en-IN",
        model: str = "bulbul:v3"
    ) -> Tuple[List[Dict[str, Any]], bytes]:
        """
        Synthesizes all dialogue turns concurrently.
        Returns the enriched dialogue items with audio_bytes and the full concatenated WAV.
        """
        enriched_dialogue = [dict(d) for d in dialogue]

        def process_turn(item):
            role = item.get("role", "speaker_1")
            speaker_voice = speaker_1_voice if role == "speaker_1" else speaker_2_voice
            text = item.get("text", "")
            audio_bytes = self.synthesize_single_speech(
                text=text,
                speaker=speaker_voice,
                language_code=language_code,
                model=model
            )
            return audio_bytes, speaker_voice

        with ThreadPoolExecutor(max_workers=min(len(dialogue), 6)) as executor:
            results = list(executor.map(process_turn, enriched_dialogue))

        wav_list = []
        for i, (audio_bytes, voice_used) in enumerate(results):
            enriched_dialogue[i]["audio_bytes"] = audio_bytes
            enriched_dialogue[i]["voice_used"] = voice_used
            if audio_bytes:
                wav_list.append(audio_bytes)

        full_conversation_audio = concat_wavs(wav_list, silence_sec=0.45)
        return enriched_dialogue, full_conversation_audio

    def synthesize_humor_speech(
        self,
        humor_text: str,
        comedian_voice: str = "aditya",
        language_code: str = "en-IN",
        model: str = "bulbul:v3"
    ) -> bytes:
        """Synthesizes the stand-up comedy / humor speech."""
        return self.synthesize_single_speech(
            text=humor_text,
            speaker=comedian_voice,
            language_code=language_code,
            model=model
        )
