// MemeMarket AI Frontend Logic

let currentImageBase64 = null;
let analysisResult = null;
let synthesizedAudioData = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  loadSampleMemes();
  setupEventListeners();
});

// Check API health & configured keys
async function checkHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    const badge = document.getElementById("status-badge");
    if (data.sarvam_configured) {
      badge.innerHTML = `<span class="dot"></span> Sarvam AI Connected`;
      badge.style.display = "flex";
    } else {
      badge.innerHTML = `⚠️ Set API Key in Settings`;
      badge.style.background = "rgba(251, 191, 36, 0.15)";
      badge.style.color = "#fbbf24";
      badge.style.borderColor = "#fbbf24";
      document.getElementById("api-key-container").style.display = "block";
    }
  } catch (err) {
    console.error("Health check error:", err);
  }
}

// Load pre-loaded sample memes
async function loadSampleMemes() {
  try {
    const res = await fetch("/api/samples");
    const data = await res.json();
    const grid = document.getElementById("sample-grid");
    grid.innerHTML = "";

    data.samples.forEach((sample, idx) => {
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
  } catch (err) {
    console.error("Failed to load sample memes:", err);
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

  try {
    const res = await fetch("/api/fetch_image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Could not fetch image");
    }

    const data = await res.json();
    currentImageBase64 = data.data_url;

    document.getElementById("preview-img").src = currentImageBase64;
    document.getElementById("preview-container").style.display = "block";
    document.getElementById("btn-generate").disabled = false;
    document.querySelectorAll(".sample-thumb").forEach(el => el.classList.remove("active"));

    if (statusEl) {
      statusEl.style.color = "#34d399";
      if (data.source === "instagram") {
        statusEl.innerText = `✅ Instagram post resolved & loaded automatically! (${Math.round(data.size_bytes / 1024)} KB)`;
      } else {
        statusEl.innerText = `✅ Image loaded automatically (${Math.round(data.size_bytes / 1024)} KB)`;
      }
    }
  } catch (err) {
    console.error("Fetch link error:", err);
    if (statusEl) {
      statusEl.style.color = "#f87171";
      statusEl.innerText = `❌ Error: ${err.message}`;
    }
  } finally {
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
    // Step 1: Multimodal Product & Meme Marketing Analysis
    stepText.innerText = "👁️ Step 1/2: Sarvam Multimodal AI is analyzing the product, crafting audio ads & rendering memes...";
    const apiKey = document.getElementById("custom-api-key") ? document.getElementById("custom-api-key").value.trim() : "";
    const prodName = document.getElementById("product-name").value.trim();
    const prodDesc = document.getElementById("product-desc").value.trim();
    const targetAudience = document.getElementById("target-audience").value;
    const humorStyle = document.getElementById("humor-style").value;
    const language = document.getElementById("language-select").value;

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

    if (!analyzeRes.ok) {
      const err = await analyzeRes.json();
      throw new Error(err.detail || "Analysis failed");
    }

    analysisResult = await analyzeRes.json();
    console.log("Analysis Result:", analysisResult);

    // Step 2: Synthesize 'Talk the Meme' Voice Ad Skit & Stand-up Pitch
    stepText.innerText = "🎙️ Step 2/2: Synthesizing 'Talk the Meme' voice ad skit & stand-up pitch with Sarvam Bulbul...";
    const spk1Voice = document.getElementById("voice-spk1").value;
    const spk2Voice = document.getElementById("voice-spk2").value;
    const comedianVoice = document.getElementById("voice-comedian").value;
    const ttsLang = analysisResult.tts_language || "en-IN";

    const dialogue = (analysisResult.talk_the_meme && analysisResult.talk_the_meme.dialogue) ? 
      analysisResult.talk_the_meme.dialogue : (analysisResult.dialogue || []);
    const humorText = analysisResult.humor_standup_pitch || analysisResult.humor_speech || "";

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

    if (!synthRes.ok) {
      const err = await synthRes.json();
      throw new Error(err.detail || "TTS Synthesis failed");
    }

    synthesizedAudioData = await synthRes.json();

    // Render results
    renderResults();

  } catch (err) {
    console.error("Pipeline error:", err);
    alert("Error: " + err.message);
    emptyState.style.display = "block";
  } finally {
    spinner.style.display = "none";
    btn.disabled = false;
  }
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
  if (synthesizedAudioData && synthesizedAudioData.full_dialogue_audio_url) {
    act1MasterAudio.src = synthesizedAudioData.full_dialogue_audio_url;
    document.getElementById("act1-master-container").style.display = "block";
  } else {
    document.getElementById("act1-master-container").style.display = "none";
  }

  const act1Chat = document.getElementById("act1-chat-container");
  act1Chat.innerHTML = "";
  const turns = synthesizedAudioData ? synthesizedAudioData.dialogue_turns : (res.talk_the_meme ? res.talk_the_meme.dialogue : res.dialogue);

  turns.forEach(turn => {
    const isSpk1 = (turn.role === "speaker_1");
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${isSpk1 ? "bubble-spk1" : "bubble-spk2"}`;
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-name ${isSpk1 ? "spk1" : "spk2"}">
          ${isSpk1 ? "😫 Customer" : "🚀 Product Hero"} ${turn.speaker ? `(${turn.speaker})` : ""}
          <span class="bubble-emotion">[${turn.emotion || "speaking"}]</span>
        </span>
      </div>
      <div class="bubble-text">${turn.text}</div>
      ${turn.audio_url ? `<audio controls src="${turn.audio_url}"></audio>` : ''}
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
