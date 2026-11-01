# 🚀 MemeMarket AI: Business Digital Marketing Meme & Speech Studio

Turn product images and descriptions into viral meme marketing campaigns powered by **Sarvam AI**!

🌐 **Live Demo on GitHub Pages**: [https://sivadogga007.github.io/sarvam-ai/](https://sivadogga007.github.io/sarvam-ai/)

---

## 🌟 Key Capabilities

1. **Product Image & Link Intake**:
   - Upload any product image (PNG, JPG, WEBP).
   - Paste direct image links or **Instagram post/reel links** (`instagram.com/p/...` or `/reel/...`) — automatically resolved and loaded.
2. **Product Pitch & Audience Targeting**:
   - Provide your **Product Name**, **Description / Pain Point Solved**, and select your **Target Audience** (Freelancers, Developers, Startups, Corporate 9-to-5, Gen Z, Students).
3. **🗣️ "Talk the Meme" (Voice Ad Skit)**:
   - Sarvam AI converts the product's core customer pain point into a snappy, conversational audio ad skit between a stressed customer and the product solution, synthesized into multi-character audio with **Sarvam Bulbul TTS** voices.
4. **🖼️ Generates New Marketing Meme Images**:
   - Automatically generates a set of **new visual meme images** (rendered with comic panels, expressive cartoon characters, pointing speech bubbles, and bold Impact font copy) highlighting your product!
5. **🎙️ Stand-up Product Roast & Pitch**:
   - Generates and synthesizes a full comedy club stand-up routine roasting the old nightmare customers face and hailing your product as the hero!
6. **📱 Ready-to-Post Social Media Copy**:
   - Instant viral captions with emojis and hashtags for **Instagram**, **LinkedIn**, and **Twitter / X** with 1-click copy buttons!

---

## 🌐 GitHub Pages Deployment

The application is deployed to **GitHub Pages**:
🔗 **[https://sivadogga007.github.io/sarvam-ai/](https://sivadogga007.github.io/sarvam-ai/)**

### How it Works on GitHub Pages:
- Fully client-side capable: When opened on GitHub Pages, the application calls Sarvam AI's multimodal and TTS APIs directly from your browser.
- Enter your **Sarvam API Key** directly in the settings panel (saved securely in your browser's local storage).
- Automatically deployed via GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) and backed by the `gh-pages` branch and `/docs` folder.

---

## 💻 Running Locally

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/Sivadogga007/sarvam-ai.git
   cd sarvam-ai
   pip install -r requirements.txt
   ```

2. Add your Sarvam API Key to `.env`:
   ```bash
   SARVAM_API_KEY="your-sarvam-api-key"
   ```

3. Start the server:
   ```bash
   python3 main.py
   ```

4. Open [http://localhost:8000](http://localhost:8000) in your browser!
