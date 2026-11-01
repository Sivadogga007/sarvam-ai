// MemeMarket AI Frontend Logic
// Supports both Backend Server mode (/api) and Static GitHub Pages client mode

let currentImageBase64 = null;
let analysisResult = null;
let synthesizedAudioData = null;
let isStaticMode = false;
let activeDialogueAudio = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initApiKey();
  checkHealth();
  loadSampleMemes();
  setupEventListeners();
});

// Manage API Key in localStorage for GitHub Pages
function initApiKey() {
  const keyInput = document.getElementById("custom-api-key");
  const savedKey = localStorage.getItem("SARVAM_API_KEY");
  if (savedKey && keyInput) {
    keyInput.value = savedKey;
    updateKeySavedIndicator(true);
  }

  if (keyInput) {
    keyInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (val) {
        localStorage.setItem("SARVAM_API_KEY", val);
        updateKeySavedIndicator(true);
        updateBadgeConnected(true, "Client Key Set");
      } else {
        localStorage.removeItem("SARVAM_API_KEY");
        updateKeySavedIndicator(false);
      }
    });
  }

  const btnToggle = document.getElementById("btn-toggle-key");
  if (btnToggle && keyInput) {
    btnToggle.onclick = () => {
      keyInput.type = keyInput.type === "password" ? "text" : "password";
      btnToggle.innerText = keyInput.type === "password" ? "👁️" : "🔒";
    };
  }
}

function updateKeySavedIndicator(isSaved) {
  const ind = document.getElementById("key-saved-indicator");
  if (ind) {
    ind.style.display = isSaved ? "inline-block" : "none";
  }
}

function updateBadgeConnected(connected, label) {
  const badge = document.getElementById("status-badge");
  if (!badge) return;
  if (connected) {
    badge.innerHTML = `<span class="dot"></span> ${label || "Sarvam AI Connected"}`;
    badge.style.display = "flex";
    badge.style.background = "rgba(16, 185, 129, 0.15)";
    badge.style.color = "#34d399";
    badge.style.borderColor = "rgba(16, 185, 129, 0.3)";
  } else {
    badge.innerHTML = `🔑 Enter Sarvam Key Below`;
    badge.style.display = "flex";
    badge.style.background = "rgba(251, 191, 36, 0.15)";
    badge.style.color = "#fbbf24";
    badge.style.borderColor = "#fbbf24";
  }
}

// Check API health & configured keys
async function checkHealth() {
  const keyContainer = document.getElementById("api-key-container");
  const keyInput = document.getElementById("custom-api-key");
  const savedKey = (keyInput && keyInput.value.trim()) || localStorage.getItem("SARVAM_API_KEY");

  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("Backend not available");
    const data = await res.json();
    isStaticMode = false;

    if (data.sarvam_configured) {
      updateBadgeConnected(true, "Sarvam AI Server Connected");
      if (savedKey && keyContainer) keyContainer.style.display = "block";
    } else {
      if (keyContainer) keyContainer.style.display = "block";
      if (savedKey) {
        updateBadgeConnected(true, "Sarvam Key Set");
      } else {
        updateBadgeConnected(false);
      }
    }
  } catch (err) {
    // Running statically on GitHub Pages!
    isStaticMode = true;
    console.log("Running in static GitHub Pages client mode");
    if (keyContainer) keyContainer.style.display = "block";

    if (savedKey) {
      updateBadgeConnected(true, "Sarvam Key Set (GitHub Pages)");
    } else {
      updateBadgeConnected(false);
    }
  }
}

// Load pre-loaded sample memes
async function loadSampleMemes() {
  let samples = [];
  try {
    // Try relative samples.json first (works on GitHub Pages and locally)
    const res = await fetch("./samples.json");
    if (res.ok) {
      const data = await res.json();
      samples = data.samples || [];
    }
  } catch (e) {
    console.warn("Could not load ./samples.json, trying /api/samples", e);
  }

  if (!samples.length) {
    try {
      const res = await fetch("/api/samples");
      if (res.ok) {
        const data = await res.json();
        samples = data.samples || [];
      }
    } catch (err) {
      console.error("Failed to load sample memes:", err);
    }
  }

  if (samples.length) {
    const grid = document.getElementById("sample-grid");
    grid.innerHTML = "";

    samples.forEach((sample, idx) => {
      const thumb = document.createElement("div");
      thumb.className = `sample-thumb ${idx === 0 ? "active" : ""}`;
      thumb.innerHTML = `
        <img src="${sample.data_url}" alt="${sample.title}">
        <span>${sample.title}</span>
      `;
      thumb.onclick = () => selectSample(sample, thumb);
      grid.appendChild(thumb);

      if (idx === 0) {
        selectSample(sample, thumb);
      }
    });
  }
}

function selectSample(sample, element) {
  document.querySelectorAll(".sample-thumb").forEach(el => el.classList.remove("active"));
  if (element) element.classList.add("active");

  currentImageBase64 = sample.data_url;
  document.getElementById("preview-img").src = sample.data_url;
  document.getElementById("preview-container").style.display = "block";
  document.getElementById("btn-generate").disabled = false;
}

// Event Listeners
function setupEventListeners() {
  // File Uploader
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");

  dropzone.onclick = () => fileInput.click();

  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#8b5cf6";
  };
  dropzone.ondragleave = () => {
    dropzone.style.borderColor = "";
  };
  dropzone.ondrop = (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "";
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  fileInput.onchange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // URL Input Handler (Auto-fetch on paste, Enter, or button click)
  const urlInput = document.getElementById("image-url-input");
  const btnLoadUrl = document.getElementById("btn-load-url");

  btnLoadUrl.onclick = () => fetchImageFromLink(urlInput.value);

  urlInput.addEventListener("paste", (e) => {
    setTimeout(() => {
      if (urlInput.value.trim().startsWith("http")) {
        fetchImageFromLink(urlInput.value);
      }
    }, 50);
  });

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchImageFromLink(urlInput.value);
    }
  });

  // Generate Button
  document.getElementById("btn-generate").onclick = runGeneratePipeline;

  // Tab Navigation
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.target);
      if (target) target.classList.add("active");
    };
  });
}

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageBase64 = e.target.result;
    document.getElementById("preview-img").src = currentImageBase64;
    document.getElementById("preview-container").style.display = "block";
    document.getElementById("btn-generate").disabled = false;
    document.querySelectorAll(".sample-thumb").forEach(el => el.classList.remove("active"));
    const status = document.getElementById("url-status");
    if (status) status.style.display = "none";
  };
  reader.readAsDataURL(file);
}

async function fetchImageFromLink(url) {
  const cleanUrl = (url || "").trim();
  const statusEl = document.getElementById("url-status");
  const btnLoad = document.getElementById("btn-load-url");

  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.style.color = "#f87171";
      statusEl.innerText = "⚠️ Please enter a valid URL starting with http:// or https://";
    }
    return;
  }

  if (statusEl) {
    statusEl.style.display = "block";
    statusEl.style.color = "#38bdf8";
    statusEl.innerText = "⏳ Loading meme / product image...";
  }
  if (btnLoad) btnLoad.disabled = true;

  // Try backend first if available
  if (!isStaticMode) {
    try {
      const res = await fetch("/api/fetch_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl })
      });

      if (res.ok) {
        const data = await res.json();
        currentImageBase64 = data.data_url;
        document.getElementById("preview-img").src = currentImageBase64;
        document.getElementById("preview-container").style.display = "block";
        document.getElementById("btn-generate").disabled = false;
        document.querySelectorAll(".sample-thumb").forEach(el => el.classList.remove("active"));

        if (statusEl) {
          statusEl.style.color = "#34d399";
          statusEl.innerText = data.source === "instagram" ?
            `✅ Instagram post resolved & loaded (${Math.round(data.size_bytes / 1024)} KB)` :
            `✅ Image loaded (${Math.round(data.size_bytes / 1024)} KB)`;
        }
        if (btnLoad) btnLoad.disabled = false;
        return;
      }
    } catch (err) {
      console.warn("Backend fetch_image failed, falling back to direct load", err);
    }
  }

  // Client-side direct image loader (for GitHub Pages static mode)
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        currentImageBase64 = canvas.toDataURL("image/png");
      } catch (e) {
        // Fallback to direct src if canvas tainted
        currentImageBase64 = cleanUrl;
      }
      document.getElementById("preview-img").src = currentImageBase64;
      document.getElementById("preview-container").style.display = "block";
      document.getElementById("btn-generate").disabled = false;
      document.querySelectorAll(".sample-thumb").forEach(el => el.classList.remove("active"));
      if (statusEl) {
        statusEl.style.color = "#34d399";
        statusEl.innerText = "✅ Image loaded successfully!";
      }
      if (btnLoad) btnLoad.disabled = false;
    };
    img.onerror = () => {
      if (cleanUrl.includes("instagram.com")) {
        if (statusEl) {
          statusEl.style.color = "#fbbf24";
          statusEl.innerText = "⚠️ Instagram links require backend resolver or direct image link. You can also right-click copy image and upload.";
        }
      } else {
        if (statusEl) {
          statusEl.style.color = "#f87171";
          statusEl.innerText = "❌ Could not load image from URL. Please upload the image file directly.";
        }
      }
      if (btnLoad) btnLoad.disabled = false;
    };
    img.src = cleanUrl;
  } catch (err) {
    if (statusEl) {
      statusEl.style.color = "#f87171";
      statusEl.innerText = `❌ Error: ${err.message}`;
    }
    if (btnLoad) btnLoad.disabled = false;
  }
}

// Full Pipeline: Analyze Product & Generate Marketing Memes + Audio
async function runGeneratePipeline() {
  if (!currentImageBase64) return;

  const btn = document.getElementById("btn-generate");
  btn.disabled = true;

  const spinner = document.getElementById("spinner-container");
  const stepText = document.getElementById("step-text");
  const emptyState = document.getElementById("empty-state");
  const resultsContainer = document.getElementById("results-container");

  emptyState.style.display = "none";
  resultsContainer.style.display = "none";
  spinner.style.display = "block";

  try {
    const customKeyInput = document.getElementById("custom-api-key");
    const apiKey = (customKeyInput ? customKeyInput.value.trim() : "") || localStorage.getItem("SARVAM_API_KEY") || "";
    const prodName = document.getElementById("product-name").value.trim();
    const prodDesc = document.getElementById("product-desc").value.trim();
    const targetAudience = document.getElementById("target-audience").value;
    const humorStyle = document.getElementById("humor-style").value;
    const language = document.getElementById("language-select").value;

    let analysisSuccess = false;

    // STEP 1: Attempt backend /api/analyze if not in static mode
    if (!isStaticMode) {
      try {
        stepText.innerText = "👁️ Step 1/2: Sarvam Multimodal AI is analyzing the product, crafting audio ads & rendering memes...";
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: currentImageBase64,
            product_name: prodName,
            product_description: prodDesc,
            target_audience: targetAudience,
            humor_style: humorStyle,
            language: language,
            api_key: apiKey || undefined
          })
        });

        if (analyzeRes.ok) {
          analysisResult = await analyzeRes.json();
          analysisSuccess = true;
        }
      } catch (e) {
        console.warn("Backend /api/analyze failed, falling back to direct Sarvam call", e);
      }
    }

    // Step 1 Fallback: Call Sarvam API directly from client (for GitHub Pages static mode)
    if (!analysisSuccess) {
      if (!apiKey) {
        throw new Error("Sarvam API Key is required for GitHub Pages! Please enter your key in Section 3.");
      }
      stepText.innerText = "👁️ Step 1/2: Calling Sarvam Multimodal AI directly from browser...";
      analysisResult = await callSarvamMultimodalDirectly(
        currentImageBase64,
        prodName,
        prodDesc,
        targetAudience,
        humorStyle,
        language,
        apiKey
      );

      // Render comic meme panels locally via HTML5 canvas
      renderCanvasMemes(analysisResult, prodName);
    }

    // STEP 2: Synthesize 'Talk the Meme' Voice Ad Skit & Stand-up Pitch
    stepText.innerText = "🎙️ Step 2/2: Synthesizing 'Talk the Meme' voice ad skit & stand-up pitch with Sarvam Bulbul...";
    const spk1Voice = document.getElementById("voice-spk1").value;
    const spk2Voice = document.getElementById("voice-spk2").value;
    const comedianVoice = document.getElementById("voice-comedian").value;
    const ttsLang = analysisResult.tts_language || "en-IN";

    const dialogue = (analysisResult.talk_the_meme && analysisResult.talk_the_meme.dialogue) ? 
      analysisResult.talk_the_meme.dialogue : (analysisResult.dialogue || []);
    const humorText = analysisResult.humor_standup_pitch || analysisResult.humor_speech || "";

    let synthSuccess = false;

    // Try backend /api/synthesize first
    if (!isStaticMode) {
      try {
        const synthRes = await fetch("/api/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dialogue: dialogue,
            speaker_1_voice: spk1Voice,
            speaker_2_voice: spk2Voice,
            humor_speech: humorText,
            comedian_voice: comedianVoice,
            language_code: ttsLang,
            api_key: apiKey || undefined
          })
        });

        if (synthRes.ok) {
          synthesizedAudioData = await synthRes.json();
          synthSuccess = true;
        }
      } catch (e) {
        console.warn("Backend /api/synthesize failed, falling back to direct TTS", e);
      }
    }

    // Fallback: Direct Sarvam Bulbul TTS calls from browser
    if (!synthSuccess && apiKey) {
      stepText.innerText = "🎙️ Step 2/2: Synthesizing voice audio with Sarvam Bulbul directly...";
      synthesizedAudioData = await synthesizeDialogueDirectly(
        dialogue,
        spk1Voice,
        spk2Voice,
        humorText,
        comedianVoice,
        ttsLang,
        apiKey
      );
    }

    // Render all results into tabs
    renderResults();

  } catch (err) {
    console.error("Pipeline error:", err);
    alert("Error: " + err.message);
    emptyState.style.display = "block";
    const keyContainer = document.getElementById("api-key-container");
    if (keyContainer) {
      keyContainer.style.display = "block";
      keyContainer.scrollIntoView({ behavior: "smooth" });
    }
  } finally {
    spinner.style.display = "none";
    btn.disabled = false;
  }
}

// Client-side Direct Sarvam Multimodal AI Call (for GitHub Pages static mode)
async function callSarvamMultimodalDirectly(imageBase64, prodName, prodDesc, targetAudience, humorStyle, language, apiKey) {
  let langInstruction = "Generate all text in witty, punchy English.";
  let ttsLang = language;
  if (language === "hinglish") {
    langInstruction = "Generate all text in entertaining Hinglish (blend of Hindi and English like urban Indian comedy, Latin script).";
    ttsLang = "hi-IN";
  } else if (language === "hi-IN") {
    langInstruction = "Generate all text in conversational Hindi (Devanagari script).";
  } else if (language !== "en-IN") {
    langInstruction = `Generate all text in conversational ${language}.`;
  }

  const prompt = `You are an elite creative director at a digital marketing agency specializing in high-converting viral meme marketing and audio advertising.
We are analyzing this product image and creating a complete meme marketing package to help this business get customers!

Product Information for Digital Marketing:
- Product Name: ${prodName || 'Our Solution'}
- Product Description & Value Proposition: ${prodDesc || 'Solves user pain points with smart automation'}
- Target Audience: ${targetAudience || 'General consumers / Professionals'}

Language:
${langInstruction}

Marketing Humor Tone:
${humorStyle}

You MUST return a JSON object with this exact structure:
{
  "campaign_title": "Catchy viral campaign headline for this product",
  "core_pain_point": "The exact frustrating customer problem or meme situation being attacked",
  "how_product_solves_it": "Punchy 1-2 sentence value proposition of how the product fixes this chaos",
  "product_hook": "One-line viral hook for ad campaigns",
  "talk_the_meme": {
    "speaker_1_name": "Customer or Skeptic (e.g. 'Stressed Dev')",
    "speaker_2_name": "Advocate or AI (e.g. '${prodName || 'Product Hero'}')",
    "dialogue": [
      {
        "speaker": "speaker_1_name or speaker_2_name",
        "role": "speaker_1 or speaker_2",
        "emotion": "comedic emotion tag e.g. exhausted / panicked / smug / relieved",
        "text": "Spoken line (natural, snappy, high-retention audio ad conversation)"
      }
    ]
  },
  "marketing_memes": [
    {
      "title": "Short Meme 1 Title (e.g. 'THE PAIN POINT')",
      "badge": "MEME 1: THE NIGHTMARE",
      "left_char": "Name of struggling person/competitor",
      "left_expr": "panicked",
      "left_bubble": "PUNCHY CAPITALIZED MEME LINE 1",
      "right_char": "Name of smart user / our product",
      "right_expr": "smug",
      "right_bubble": "PUNCHY CAPITALIZED MEME LINE 2"
    },
    {
      "title": "Short Meme 2 Title (e.g. 'THE PRODUCT UPGRADE')",
      "badge": "MEME 2: THE GAMECHANGER",
      "left_char": "Old Way / Skeptic",
      "left_expr": "panicked",
      "left_bubble": "PUNCHY CAPITALIZED MEME LINE 1",
      "right_char": "Product Advocate",
      "right_expr": "smug",
      "right_bubble": "PUNCHY CAPITALIZED MEME LINE 2"
    }
  ],
  "humor_standup_pitch": "A 120-160 word stand-up comedy routine roasting the nightmare customers face without this product and hailing the product as the obvious savior, ready for comedian voice synthesis.",
  "social_copy": {
    "instagram": "Viral Instagram caption with hook, pain point, product solution, emojis, and hashtags #startup #business #marketing",
    "linkedin": "Relatable B2B thought leadership post with meme takeaway and CTA",
    "twitter": "Short, punchy viral tweet under 240 chars"
  }
}

Make sure 'talk_the_meme.dialogue' has exactly 4 alternating turns.
Output ONLY the raw JSON object, without any surrounding markdown or explanation.`;

  const res = await fetch("https://api.sarvam.ai/v2/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey
    },
    body: JSON.stringify({
      model: "glm5.3-flash",
      input: [
        {
          "role": "user",
          "content": [
            { "type": "input_text", "text": prompt },
            { "type": "input_image", "image_url": imageBase64 }
          ]
        }
      ],
      store: false
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.detail || `Sarvam API error (${res.status})`);
  }

  const result = await res.json();
  let rawText = "";
  if (result.output && Array.isArray(result.output)) {
    result.output.forEach(item => {
      if (item.role === "assistant" && Array.isArray(item.content)) {
        item.content.forEach(p => {
          if (p.text) rawText += p.text;
        });
      }
    });
  }

  const parsed = robustJsonParse(rawText);
  parsed.tts_language = ttsLang;
  return parsed;
}

// Robust JSON parser for LLM outputs
function robustJsonParse(text) {
  let cleaned = (text || "").trim();
  if (cleaned.includes("```json")) {
    cleaned = cleaned.split("```json")[1].split("```")[0].trim();
  } else if (cleaned.includes("```")) {
    cleaned = cleaned.split("```")[1].split("```")[0].trim();
  }
  // Strip trailing commas before closing curly braces or brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      const sub = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(sub);
    }
    throw new Error("Could not parse AI response as JSON: " + text.slice(0, 100));
  }
}

// Client-side HTML5 Canvas Comic Meme Renderer
function renderCanvasMemes(res, prodName) {
  if (!res.marketing_memes || !Array.isArray(res.marketing_memes)) return;

  const colors = ["#ef4444", "#a855f7", "#3b82f6"];

  res.marketing_memes.forEach((m, idx) => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");

    const themeColor = colors[idx % colors.length];

    // Background
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, 800, 540);

    // Subtle Grid pattern
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // Top Badge Pill
    const badgeText = (m.badge || `MEME ${idx + 1}`).toUpperCase();
    ctx.fillStyle = themeColor;
    drawRoundedRect(ctx, 35, 25, 220, 36, 8, true, false);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillText(badgeText, 50, 48);

    // Title
    ctx.fillStyle = "#f3f4f6";
    ctx.font = "bold 18px system-ui, sans-serif";
    const titleText = (m.title || "MARKETING MOMENT").toUpperCase();
    ctx.fillText(titleText, 275, 48);

    // Card 1: Top Problem / Situation
    ctx.fillStyle = "#141822";
    ctx.strokeStyle = "rgba(70, 85, 110, 0.8)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 35, 80, 730, 205, 12, true, true);

    // Card 1 Header: Left Character
    ctx.fillStyle = "#67e8f9";
    ctx.font = "bold 14px system-ui, sans-serif";
    const leftChar = `${m.left_char || 'Skeptic'} (${m.left_expr || 'panicked'})`.toUpperCase();
    ctx.fillText(`😫 ${leftChar}`, 55, 112);

    // Card 1 Speech Bubble Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 19px system-ui, sans-serif";
    wrapCanvasText(ctx, (m.left_bubble || "").toUpperCase(), 55, 155, 680, 28);

    // Card 2: Bottom Product Hero Solution
    ctx.fillStyle = "#141822";
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    drawRoundedRect(ctx, 35, 305, 730, 205, 12, true, true);

    // Card 2 Header: Right Character
    ctx.fillStyle = "#f472b6";
    ctx.font = "bold 14px system-ui, sans-serif";
    const rightChar = `${m.right_char || prodName || 'Product Hero'} (${m.right_expr || 'smug'})`.toUpperCase();
    ctx.fillText(`🚀 ${rightChar}`, 55, 337);

    // Card 2 Speech Bubble Text
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 19px system-ui, sans-serif";
    wrapCanvasText(ctx, (m.right_bubble || "").toUpperCase(), 55, 380, 680, 28);

    m.rendered_image_url = canvas.toDataURL("image/png");
  });
}

function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, curY);
      line = words[n] + " ";
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, curY);
}

// Client-side Direct Sarvam Bulbul TTS Call
async function synthesizeDialogueDirectly(dialogue, spk1Voice, spk2Voice, humorText, comedianVoice, ttsLang, apiKey) {
  const turns = [];

  for (let i = 0; i < dialogue.length; i++) {
    const turn = dialogue[i];
    const speakerVoice = (turn.role === "speaker_1") ? spk1Voice : spk2Voice;
    const cleanText = cleanSpeechText(turn.text);

    let audioUrl = null;
    try {
      audioUrl = await callSarvamTTS(cleanText, speakerVoice, ttsLang, apiKey);
    } catch (e) {
      console.warn(`TTS error for line ${i}:`, e);
    }

    turns.push({
      ...turn,
      audio_url: audioUrl
    });
  }

  let humorAudioUrl = null;
  if (humorText) {
    try {
      const cleanHumor = cleanSpeechText(humorText);
      humorAudioUrl = await callSarvamTTS(cleanHumor, comedianVoice, ttsLang, apiKey);
    } catch (e) {
      console.warn("Comedian TTS error:", e);
    }
  }

  return {
    dialogue_turns: turns,
    humor_audio_url: humorAudioUrl,
    full_dialogue_audio_url: null // Handled via interactive playlist in client
  };
}

async function callSarvamTTS(text, speaker, languageCode, apiKey) {
  if (!text) return null;

  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: languageCode,
      speaker: speaker,
      model: "bulbul:v3"
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn("TTS failed for speaker " + speaker + ":", errText);
    return null;
  }

  const data = await res.json();
  if (data.audios && data.audios.length > 0) {
    return `data:audio/wav;base64,${data.audios[0]}`;
  }
  return null;
}

function cleanSpeechText(text) {
  if (!text) return "";
  return text
    .replace(/\*[^*]*\*/g, "")
    .replace(/\[[^\[\]]*\]/g, "")
    .replace(/\([A-Za-z0-9\s,\.!?-]{1,35}\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Render Results into UI
function renderResults() {
  const res = analysisResult;

  // 1. Marketing Campaign Intelligence Header
  document.getElementById("intel-template").innerText = "VIRAL MEME CAMPAIGN";
  document.getElementById("intel-title").innerText = res.campaign_title || "Product Meme Campaign";
  document.getElementById("intel-hook").innerText = res.product_hook ? `🎯 Hook: "${res.product_hook}"` : "";
  document.getElementById("intel-punchline").innerText = `💥 The Pain Point: ${res.core_pain_point || ''}`;
  document.getElementById("intel-why").innerText = `💡 How It Solves It: ${res.how_product_solves_it || ''}`;

  // 2. Tab 1: "Talk the Meme" (Voice Ad Skit)
  const act1MasterAudio = document.getElementById("act1-master-audio");
  const act1MasterContainer = document.getElementById("act1-master-container");
  
  const turns = synthesizedAudioData ? synthesizedAudioData.dialogue_turns : (res.talk_the_meme ? res.talk_the_meme.dialogue : res.dialogue);

  if (synthesizedAudioData && synthesizedAudioData.full_dialogue_audio_url) {
    act1MasterAudio.src = synthesizedAudioData.full_dialogue_audio_url;
    act1MasterContainer.style.display = "block";
  } else if (turns && turns.some(t => t.audio_url)) {
    // Client-side master player
    act1MasterContainer.style.display = "block";
    setupClientMasterPlayer(turns);
  } else {
    act1MasterContainer.style.display = "none";
  }

  const act1Chat = document.getElementById("act1-chat-container");
  act1Chat.innerHTML = "";

  turns.forEach((turn, idx) => {
    const isSpk1 = (turn.role === "speaker_1");
    const bubble = document.createElement("div");
    bubble.id = `chat-bubble-${idx}`;
    bubble.className = `chat-bubble ${isSpk1 ? "bubble-spk1" : "bubble-spk2"}`;
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-name ${isSpk1 ? "spk1" : "spk2"}">
          ${isSpk1 ? "😫 Customer" : "🚀 Product Hero"} ${turn.speaker ? `(${turn.speaker})` : ""}
          <span class="bubble-emotion">[${turn.emotion || "speaking"}]</span>
        </span>
      </div>
      <div class="bubble-text">${turn.text}</div>
      ${turn.audio_url ? `<audio id="bubble-audio-${idx}" controls src="${turn.audio_url}"></audio>` : ''}
    `;
    act1Chat.appendChild(bubble);
  });

  // 3. Tab 2: Generated Marketing Memes (Visual Images)
  const memesGallery = document.getElementById("memes-gallery-container");
  memesGallery.innerHTML = "";

  const marketingMemes = res.marketing_memes || [];
  marketingMemes.forEach((m, idx) => {
    const card = document.createElement("div");
    card.className = "meme-card";
    card.style.border = "1px solid #3b82f640";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="background: #3b82f6; color: #fff; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 6px;">
          ${m.badge || `MEME ${idx + 1}`}
        </span>
        <h4 style="margin: 0; color: #fff; font-size: 1.15rem;">${m.title || ''}</h4>
      </div>
      ${m.rendered_image_url ? `
        <img src="${m.rendered_image_url}" alt="${m.title}" style="width: 100%; max-height: 440px; object-fit: contain; border-radius: 10px; margin: 12px 0; border: 1px solid #232936;">
        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <a href="${m.rendered_image_url}" download="marketing_meme_${idx+1}.png" class="btn-secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            📥 Download Meme Image
          </a>
        </div>
      ` : ''}
    `;
    memesGallery.appendChild(card);
  });

  // 4. Tab 3: Stand-up Product Roast & Pitch
  document.getElementById("standup-text").innerText = res.humor_standup_pitch || res.humor_speech || "";
  const standupAudio = document.getElementById("standup-audio");
  if (synthesizedAudioData && synthesizedAudioData.humor_audio_url) {
    standupAudio.src = synthesizedAudioData.humor_audio_url;
    standupAudio.style.display = "block";
  } else {
    standupAudio.style.display = "none";
  }

  // 5. Tab 4: Viral Social Media Copy
  if (res.social_copy) {
    document.getElementById("social-ig").innerText = res.social_copy.instagram || "Ready to conquer chaos? Check the link in bio!";
    document.getElementById("social-li").innerText = res.social_copy.linkedin || "B2B leaders: Stop solving problems manually.";
    document.getElementById("social-tw").innerText = res.social_copy.twitter || "Life before our product: 😭 Life after: 😎";
  }

  document.getElementById("results-container").style.display = "block";
}

// Client-side sequential master dialogue audio player
function setupClientMasterPlayer(turns) {
  const masterContainer = document.getElementById("act1-master-container");
  masterContainer.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div>
        <h4 style="margin: 0; color: #a855f7; display: flex; align-items: center; gap: 8px;">
          ▶️ Full 30-Second Voice Ad Dialogue
        </h4>
        <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
          Plays both characters sequentially with live dialogue bubble highlighting.
        </p>
      </div>
      <button id="btn-play-sequence" class="btn-primary" style="padding: 10px 20px; font-size: 0.95rem;">
        ▶️ Play Full Audio Ad
      </button>
    </div>
  `;

  let isPlaying = false;
  let currentIndex = 0;

  const btnPlay = document.getElementById("btn-play-sequence");
  btnPlay.onclick = () => {
    if (isPlaying) {
      if (activeDialogueAudio) {
        activeDialogueAudio.pause();
        activeDialogueAudio = null;
      }
      isPlaying = false;
      btnPlay.innerText = "▶️ Play Full Audio Ad";
      document.querySelectorAll(".chat-bubble").forEach(b => b.style.transform = "");
      return;
    }

    isPlaying = true;
    currentIndex = 0;
    btnPlay.innerText = "⏹️ Stop Playback";
    playNextTurn();
  };

  function playNextTurn() {
    if (!isPlaying || currentIndex >= turns.length) {
      isPlaying = false;
      btnPlay.innerText = "▶️ Play Full Audio Ad";
      document.querySelectorAll(".chat-bubble").forEach(b => b.style.transform = "");
      return;
    }

    const turn = turns[currentIndex];
    const bubble = document.getElementById(`chat-bubble-${currentIndex}`);

    document.querySelectorAll(".chat-bubble").forEach(b => {
      b.style.transform = "";
      b.style.boxShadow = "";
    });

    if (bubble) {
      bubble.style.transform = "scale(1.02)";
      bubble.style.boxShadow = "0 0 15px rgba(168, 85, 247, 0.4)";
      bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (turn.audio_url) {
      activeDialogueAudio = new Audio(turn.audio_url);
      activeDialogueAudio.onended = () => {
        currentIndex++;
        setTimeout(playNextTurn, 300);
      };
      activeDialogueAudio.onerror = () => {
        currentIndex++;
        setTimeout(playNextTurn, 200);
      };
      activeDialogueAudio.play();
    } else {
      currentIndex++;
      setTimeout(playNextTurn, 1500);
    }
  }
}
