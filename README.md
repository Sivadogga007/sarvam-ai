# 🎭 MemeSpeak AI: Sarvam Meme Speech & Extended Humor Studio

An AI application powered by **Sarvam AI** that:
1. **Perceives Meme Images**: Feeds any meme image directly to Sarvam AI's multimodal vision intelligence (`glm5.3-flash`).
2. **Creates a Comical Speech Conversation**: Brings the meme characters or comedy podcast hosts to life with snappy, humorous dialogue synthesized with distinct **Sarvam Bulbul TTS** voices.
3. **Delivers a Stand-up Humor Speech**: Produces a comedy club stand-up monologue breaking down what joke the meme is cracking, why it's funny, and roasting the situation.
4. **Extends the Meme & Humor (The Sequel)**: Automatically generates **Act 2 (The Extended Sequel)** — complete with a dynamically generated **Sequel Meme Card Image**, follow-up speech conversation (the aftermath), and escalation roast!
5. **Deploy Ready on Vercel**:
   - Comes pre-configured with `vercel.json`, `api/index.py`, and `public/index.html` for 1-click full-stack Vercel deployment.

---

## 🚀 Quick Start (Local)

### 1. Requirements
Ensure your `.env` contains your `SARVAM_API_KEY`:
```bash
SARVAM_API_KEY=your_sarvam_api_key_here
```

### 2. Run the Web Application
```bash
python3 main.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

*(Alternatively, you can also run the Streamlit version with `streamlit run app.py`)*

---

## 🌐 Deploying this Application to Vercel

This repository is pre-configured with `vercel.json` and the `api/` serverless directory:
1. Push this directory to a GitHub repository or run:
   ```bash
   vercel
   ```
2. In the Vercel Dashboard, go to **Settings → Environment Variables** and add:
   - `SARVAM_API_KEY` = your Sarvam API subscription key.
3. Vercel automatically deploys:
   - `public/index.html` as the static web interface.
   - `api/index.py` as Python serverless functions for `/api/analyze`, `/api/fetch_image`, and `/api/synthesize`.

---

## 🧠 Architecture

```
sarvam-ai/
├── api/
│   └── index.py            # FastAPI serverless entrypoint for Vercel
├── public/
│   ├── index.html          # Web application UI
│   ├── app.js              # Frontend pipeline & standalone HTML exporter
│   └── styles.css          # Dark neon comedy club theme & audio visualizer aesthetics
├── sample_memes/           # Pre-loaded classic memes (3 AM Bug Fix, Client Budget, etc.)
├── sarvam_service.py       # Core Sarvam AI integration (Multimodal + Bulbul TTS + Concatenation)
├── app.py                  # Streamlit alternative interface
├── create_sample_memes.py  # Generates initial sample memes with PIL
├── main.py                 # Local server runner (http://localhost:8000)
├── vercel.json             # Vercel configuration for static routing & serverless Python
└── requirements.txt        # Deployment dependencies
```

---

## 🎙️ Supported Voices & Languages
- **Sarvam Bulbul TTS Speakers**: `rohan`, `simran`, `aditya`, `priya`, `sunny`, `kabir`, `ritu`, `dev`, `ishita`, `pooja`, `kavya`, `amit`, and more.
- **Languages**: English (India), Hinglish, Hindi, Bengali, Tamil, Telugu, Kannada, Marathi, Gujarati.

