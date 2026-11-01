// MemeSpeak AI Frontend Logic

let currentImageBase64 = null;
let currentImageData = null;
let analysisResult = null;
let synthesizedAudioData = null;
let sequelAudioData = null;
let escalations = [];

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
    // Read pasted text with a tiny timeout so input value is populated
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
    statusEl.innerText = "⏳ Loading meme image from link...";
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
        statusEl.innerText = `✅ Instagram meme post resolved & loaded automatically! (${Math.round(data.size_bytes / 1024)} KB)`;
      } else {
        statusEl.innerText = `✅ Meme image loaded automatically (${Math.round(data.size_bytes / 1024)} KB)`;
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

// Full Pipeline: Analyze -> Synthesize Act 1 & Sequel -> Display
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
    // Step 1: Multimodal Analysis via Sarvam AI (glm5.3-flash)
    stepText.innerText = "👁️ Step 1/3: Sarvam Multimodal AI is perceiving the meme & drafting scripts...";
    const apiKey = document.getElementById("custom-api-key") ? document.getElementById("custom-api-key").value.trim() : "";
    const convMode = document.getElementById("conv-mode").value;
    const humorStyle = document.getElementById("humor-style").value;
    const language = document.getElementById("language-select").value;

    const analyzeRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: currentImageBase64,
        conversation_mode: convMode,
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

    // Step 2: Synthesize Act 1 Speech Conversation & Humor Speech via Sarvam Bulbul TTS
    stepText.innerText = "🎙️ Step 2/3: Synthesizing Act 1 conversation & stand-up roast with Sarvam Bulbul...";
    const spk1Voice = document.getElementById("voice-spk1").value;
    const spk2Voice = document.getElementById("voice-spk2").value;
    const comedianVoice = document.getElementById("voice-comedian").value;
    const ttsLang = analysisResult.tts_language || "en-IN";

    const synthRes = await fetch("/api/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dialogue: analysisResult.original.dialogue || [],
        speaker_1_voice: spk1Voice,
        speaker_2_voice: spk2Voice,
        humor_speech: analysisResult.original.humor_speech || "",
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

    // Step 3: Synthesize Extended Sequel (Act 2) Audio
    if (analysisResult.extended_sequel && analysisResult.extended_sequel.extended_dialogue) {
      stepText.innerText = "🚀 Step 3/3: Synthesizing Extended Meme Sequel (Act 2) speech...";
      const seqSynthRes = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogue: analysisResult.extended_sequel.extended_dialogue,
          speaker_1_voice: spk1Voice,
          speaker_2_voice: spk2Voice,
          humor_speech: analysisResult.extended_sequel.extended_humor_speech || "",
          comedian_voice: comedianVoice,
          language_code: ttsLang,
          api_key: apiKey || undefined
        })
      });

      if (seqSynthRes.ok) {
        sequelAudioData = await seqSynthRes.json();
      }
    }

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
  const orig = analysisResult.original;
  const seq = analysisResult.extended_sequel;

  // 1. Intelligence Header
  document.getElementById("intel-template").innerText = orig.meme_template || "Classic Meme";
  document.getElementById("intel-title").innerText = orig.meme_title || "Meme Breakdown";
  document.getElementById("intel-text").innerText = `"${orig.detected_text || ''}"`;
  document.getElementById("intel-punchline").innerText = `💥 The Joke: ${orig.joke_punchline || ''}`;
  document.getElementById("intel-why").innerText = orig.why_its_funny || '';

  // 2. Act 1 Dialogue
  const act1MasterAudio = document.getElementById("act1-master-audio");
  if (synthesizedAudioData && synthesizedAudioData.full_dialogue_audio_url) {
    act1MasterAudio.src = synthesizedAudioData.full_dialogue_audio_url;
    document.getElementById("act1-master-container").style.display = "block";
  } else {
    document.getElementById("act1-master-container").style.display = "none";
  }

  const act1Chat = document.getElementById("act1-chat-container");
  act1Chat.innerHTML = "";
  const turns = synthesizedAudioData ? synthesizedAudioData.dialogue_turns : orig.dialogue;

  turns.forEach(turn => {
    const isSpk1 = (turn.role === "speaker_1");
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${isSpk1 ? "bubble-spk1" : "bubble-spk2"}`;
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-name ${isSpk1 ? "spk1" : "spk2"}">
          ${isSpk1 ? "🧑‍💻" : "🤖"} ${turn.speaker || "Speaker"}
          <span class="bubble-emotion">[${turn.emotion || "speaking"}]</span>
        </span>
      </div>
      <div class="bubble-text">${turn.text}</div>
      ${turn.audio_url ? `<audio controls src="${turn.audio_url}"></audio>` : ''}
    `;
    act1Chat.appendChild(bubble);
  });

  // 3. Stand-up Humor Speech
  document.getElementById("standup-text").innerText = orig.humor_speech || "";
  const standupAudio = document.getElementById("standup-audio");
  if (synthesizedAudioData && synthesizedAudioData.humor_audio_url) {
    standupAudio.src = synthesizedAudioData.humor_audio_url;
    standupAudio.style.display = "block";
  } else {
    standupAudio.style.display = "none";
  }

  // 4. Extended Sequel (Act 2)
  if (seq) {
    document.getElementById("sequel-title").innerText = seq.sequel_title || "Part 2: The Aftermath";
    document.getElementById("sequel-situation").innerText = seq.sequel_situation || "";

    const seqImg = document.getElementById("sequel-meme-img");
    if (seq.rendered_meme_image_url) {
      seqImg.src = seq.rendered_meme_image_url;
      seqImg.style.display = "block";
    } else {
      seqImg.style.display = "none";
    }

    const seqMasterAudio = document.getElementById("seq-master-audio");
    if (sequelAudioData && sequelAudioData.full_dialogue_audio_url) {
      seqMasterAudio.src = sequelAudioData.full_dialogue_audio_url;
      document.getElementById("seq-master-container").style.display = "block";
    }

    const seqChat = document.getElementById("seq-chat-container");
    seqChat.innerHTML = "";
    const seqTurns = sequelAudioData ? sequelAudioData.dialogue_turns : (seq.extended_dialogue || []);
    seqTurns.forEach(turn => {
      const isSpk1 = (turn.role === "speaker_1");
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${isSpk1 ? "bubble-spk1" : "bubble-spk2"}`;
      bubble.innerHTML = `
        <div class="bubble-header">
          <span class="bubble-name ${isSpk1 ? "spk1" : "spk2"}">
            ${isSpk1 ? "🧑‍💼" : "😱"} ${turn.speaker || "Speaker"}
            <span class="bubble-emotion">[${turn.emotion || "escalated"}]</span>
          </span>
        </div>
        <div class="bubble-text">${turn.text}</div>
        ${turn.audio_url ? `<audio controls src="${turn.audio_url}"></audio>` : ''}
      `;
      seqChat.appendChild(bubble);
    });

    document.getElementById("seq-humor-text").innerText = seq.extended_humor_speech || "";
    const seqHumorAudio = document.getElementById("seq-humor-audio");
    document.getElementById("seq-humor-text").innerText = seq.extended_humor_speech || "";
    const seqHumorAudio = document.getElementById("seq-humor-audio");
    if (sequelAudioData && sequelAudioData.humor_audio_url) {
      seqHumorAudio.src = sequelAudioData.humor_audio_url;
      seqHumorAudio.style.display = "block";
    } else {
      seqHumorAudio.style.display = "none";
    }
  }

  document.getElementById("results-container").style.display = "block";
}

