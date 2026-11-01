import os
import io
import time
import base64
import streamlit as st
from PIL import Image
from dotenv import load_dotenv

from sarvam_service import (
    SarvamMemeService,
    SARVAM_SPEAKERS,
    SUPPORTED_LANGUAGES,
    render_extended_meme_card
)

load_dotenv()

# Page configuration
st.set_page_config(
    page_title="MemeSpeak AI | Sarvam Meme Speech & Humor Studio",
    page_icon="🎭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for rich aesthetics
st.markdown("""
<style>
    .main {
        background-color: #0d1117;
    }
    .stApp {
        background: radial-gradient(circle at top right, #1f1b2e, #0e1117);
        color: #f0f6fc;
    }
    .meme-card {
        background: rgba(22, 27, 34, 0.85);
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .humor-card {
        background: linear-gradient(135deg, rgba(35, 25, 45, 0.9), rgba(20, 25, 35, 0.9));
        border: 1px solid #8957e5;
        border-radius: 12px;
        padding: 18px;
        margin-bottom: 16px;
    }
    .chat-bubble-1 {
        background: #1f2937;
        border-left: 4px solid #38bdf8;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 12px;
    }
    .chat-bubble-2 {
        background: #272136;
        border-left: 4px solid #f472b6;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 12px;
    }
    .speaker-tag {
        font-weight: 700;
        font-size: 0.9rem;
        display: inline-block;
        margin-bottom: 4px;
    }
    .emotion-badge {
        background: #374151;
        color: #9ca3af;
        font-size: 0.75rem;
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 8px;
        font-style: italic;
    }
    .stButton>button {
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.2s ease-in-out;
    }
</style>
""", unsafe_allow_html=True)

# Initialize Session State
if "service" not in st.session_state:
    try:
        st.session_state.service = SarvamMemeService()
        st.session_state.sarvam_connected = True
    except Exception as e:
        st.session_state.service = None
        st.session_state.sarvam_connected = False
        st.session_state.error_msg = str(e)

if "analysis_result" not in st.session_state:
    st.session_state.analysis_result = None
if "current_image_bytes" not in st.session_state:
    st.session_state.current_image_bytes = None
if "current_image_name" not in st.session_state:
    st.session_state.current_image_name = ""
if "escalations" not in st.session_state:
    st.session_state.escalations = []

# Sidebar Controls
with st.sidebar:
    st.markdown("### 🎭 Sarvam Meme Studio")
    if st.session_state.sarvam_connected:
        st.success("⚡ Sarvam AI Connected", icon="✅")
    else:
        st.error(f"API Key Error: {st.session_state.get('error_msg', 'Check .env')}")
        custom_key = st.text_input("Enter Sarvam API Key", type="password")
        if custom_key:
            try:
                st.session_state.service = SarvamMemeService(api_key=custom_key)
                st.session_state.sarvam_connected = True
                st.rerun()
            except Exception as e:
                st.error(str(e))

    st.markdown("---")
    st.markdown("#### ⚙️ Settings & Casting")
    
    conv_mode = st.radio(
        "Conversation Mode",
        options=["meme_characters", "podcast_hosts"],
        format_func=lambda x: "🎭 Meme Characters Dialogue" if x == "meme_characters" else "🎙️ Comedy Roast Duo (Hosts)",
        help="Whether the dialogue is between the actual meme characters or two comedy hosts reacting to it."
    )
    
    selected_lang = st.selectbox(
        "Language & Accent",
        options=list(SUPPORTED_LANGUAGES.keys()),
        format_func=lambda x: SUPPORTED_LANGUAGES[x],
        index=0
    )
    
    humor_style = st.selectbox(
        "Humor Roast Style",
        options=["standup", "roast", "relatable"],
        format_func=lambda x: {
            "standup": "🎤 Stand-up Comedy Club",
            "roast": "🔥 Savage Roast",
            "relatable": "💡 Relatable Irony Breakdown"
        }[x]
    )
    
    st.markdown("##### 🎙️ Voice Casting (Sarvam Bulbul)")
    col_v1, col_v2 = st.columns(2)
    with col_v1:
        voice_spk1 = st.selectbox("Speaker 1", options=SARVAM_SPEAKERS, index=SARVAM_SPEAKERS.index("rohan"))
    with col_v2:
        voice_spk2 = st.selectbox("Speaker 2", options=SARVAM_SPEAKERS, index=SARVAM_SPEAKERS.index("simran"))
        
    voice_comedian = st.selectbox(
        "Stand-up Comedian Voice",
        options=SARVAM_SPEAKERS,
        index=SARVAM_SPEAKERS.index("aditya")
    )

# Header
st.markdown("""
<div style="text-align: center; margin-bottom: 24px;">
    <h1 style="font-size: 2.5rem; margin-bottom: 8px;">🎭 MemeSpeak AI</h1>
    <p style="font-size: 1.15rem; color: #a0aec0;">
        Give any meme image to <b>Sarvam AI</b>: It perceives the joke, creates a full <b>speech conversation</b>, delivers a <b>stand-up humor roast</b>, and <b>extends the meme</b> into hilarious sequels!
    </p>
</div>
""", unsafe_allow_html=True)

# Main Two Columns
col_left, col_right = st.columns([1, 1.25], gap="large")

with col_left:
    st.markdown("### 1. Provide Meme Image")
    input_choice = st.radio(
        "Choose Meme Source",
        ["🖼️ Sample Memes Gallery", "🔗 Paste Image URL", "📤 Upload Custom Meme"],
        horizontal=True
    )

    image_to_process = None
    image_bytes = None
    image_name = ""

    if input_choice == "🖼️ Sample Memes Gallery":
        sample_options = {
            "3am_bug_fix.png": "💻 Debugging at 3:00 AM (Delete entire file)",
            "client_budget.png": "💼 Client vs Budget ($25 & pizza)",
            "meeting_vs_email.png": "👔 Corporate Meeting vs 2-sentence Slack",
            "framework_hype.png": "⚡ Battle-tested vs New Framework hype"
        }
        selected_sample = st.selectbox(
            "Select a pre-loaded sample meme:",
            options=list(sample_options.keys()),
            format_func=lambda x: sample_options[x]
        )
        sample_path = os.path.join("sample_memes", selected_sample)
        if os.path.exists(sample_path):
            with open(sample_path, "rb") as f:
                image_bytes = f.read()
            image_name = selected_sample
            st.image(sample_path, caption=sample_options[selected_sample], use_container_width=True)
    elif input_choice == "🔗 Paste Image URL":
        import requests, re
        url_input = st.text_input(
            "Enter or paste direct image URL or Instagram post/reel link:",
            placeholder="https://.../meme.png or https://www.instagram.com/p/.../"
        )
        if url_input and url_input.strip().startswith(("http://", "https://")):
            clean_u = url_input.strip()
            try:
                with st.spinner("Fetching image / Instagram meme..."):
                    headers = {"User-Agent": "Mozilla/5.0"}
                    # Check Instagram
                    ig_m = re.search(r"instagram\.com/(?:p|reel|reels)/([A-Za-z0-9_-]+)", clean_u)
                    if ig_m:
                        import instaloader
                        L = instaloader.Instaloader()
                        post = instaloader.Post.from_shortcode(L.context, ig_m.group(1))
                        target_u = post.url
                    else:
                        target_u = clean_u
                        
                    resp = requests.get(target_u, headers=headers, timeout=15)
                    if resp.status_code == 200:
                        image_bytes = resp.content
                        image_name = clean_u.split("/")[-1].split("?")[0] or "meme_url.png"
                        st.image(image_bytes, caption=f"Loaded: {image_name}", use_container_width=True)
                    else:
                        st.error(f"Failed to fetch image: HTTP {resp.status_code}")
            except Exception as e:
                st.error(f"Could not load image: {e}")
    else:
        uploaded_file = st.file_uploader(
            "Upload any meme image (PNG, JPG, JPEG, WEBP)",
            type=["png", "jpg", "jpeg", "webp"]
        )
        if uploaded_file is not None:
            image_bytes = uploaded_file.read()
            image_name = uploaded_file.name
            st.image(image_bytes, caption=f"Uploaded: {image_name}", use_container_width=True)

    st.markdown("---")
    generate_clicked = st.button(
        "🚀 Generate Speech Conversation & Humor Roast",
        type="primary",
        use_container_width=True,
        disabled=image_bytes is None or not st.session_state.sarvam_connected
    )

    if generate_clicked and image_bytes:
        with st.spinner("🤖 Sarvam AI is perceiving the meme, scripting dialogue, and crafting humor speech..."):
            service: SarvamMemeService = st.session_state.service
            try:
                # 1. Analyze and script (original + extended sequel)
                analysis = service.analyze_meme_and_generate_scripts(
                    image_bytes=image_bytes,
                    mime_type="image/png" if not image_name.endswith((".jpg", ".jpeg")) else "image/jpeg",
                    conversation_mode=conv_mode,
                    humor_style=humor_style,
                    language=selected_lang
                )
                
                tts_lang = analysis.get("tts_language", "en-IN")
                
                # 2. Synthesize Original Dialogue Audio
                orig_dialogue = analysis.get("original", {}).get("dialogue", [])
                enriched_orig, full_orig_wav = service.synthesize_conversation_audio(
                    dialogue=orig_dialogue,
                    speaker_1_voice=voice_spk1,
                    speaker_2_voice=voice_spk2,
                    language_code=tts_lang
                )
                analysis["original"]["enriched_dialogue"] = enriched_orig
                analysis["original"]["full_audio"] = full_orig_wav

                # 3. Synthesize Original Humor Speech Audio
                humor_text = analysis.get("original", {}).get("humor_speech", "")
                humor_wav = service.synthesize_humor_speech(
                    humor_text=humor_text,
                    comedian_voice=voice_comedian,
                    language_code=tts_lang
                )
                analysis["original"]["humor_audio"] = humor_wav

                # 4. Synthesize Extended Sequel Dialogue Audio
                seq_dialogue = analysis.get("extended_sequel", {}).get("extended_dialogue", [])
                if seq_dialogue:
                    enriched_seq, full_seq_wav = service.synthesize_conversation_audio(
                        dialogue=seq_dialogue,
                        speaker_1_voice=voice_spk1,
                        speaker_2_voice=voice_spk2,
                        language_code=tts_lang
                    )
                    analysis["extended_sequel"]["enriched_dialogue"] = enriched_seq
                    analysis["extended_sequel"]["full_audio"] = full_seq_wav

                # 5. Synthesize Extended Sequel Humor Speech Audio
                seq_humor_text = analysis.get("extended_sequel", {}).get("extended_humor_speech", "")
                if seq_humor_text:
                    seq_humor_wav = service.synthesize_humor_speech(
                        humor_text=seq_humor_text,
                        comedian_voice=voice_comedian,
                        language_code=tts_lang
                    )
                    analysis["extended_sequel"]["humor_audio"] = seq_humor_wav

                st.session_state.analysis_result = analysis
                st.session_state.current_image_bytes = image_bytes
                st.session_state.current_image_name = image_name
                st.session_state.escalations = [] # reset prior escalations
                st.toast("🎉 Speech conversation & humor roast generated successfully!", icon="✨")

            except Exception as e:
                st.error(f"Error generating meme conversation: {e}")
                import traceback
                st.code(traceback.format_exc())

# Right Column: Displays
with col_right:
    res = st.session_state.analysis_result
    if not res:
        st.info("👈 Select or upload a meme on the left and click **Generate** to bring the meme to life with Sarvam AI!")
        st.markdown("""
        #### 🌟 What this application does:
        - **Takes Meme Images Directly**: Feeds the image directly to Sarvam AI's multimodal intelligence.
        - **Creates Speech Conversations**: Generates a witty dialogue between characters (or comedy hosts) with distinct Sarvam Bulbul voices.
        - **Delivers Humor Speeches**: Audio stand-up monologue explaining exactly what joke the meme is cracking and why it's funny.
        - **Extends the Humor (Sequels & Escalation)**: Generates the follow-up sequel meme image (Act 2: The Aftermath), continued conversation, and escalation tiers!
        """)
    else:
        orig = res.get("original", {})
        sequel = res.get("extended_sequel", {})

        # Overview Card
        st.markdown(f"""
        <div class="meme-card">
            <h3 style="margin-top: 0; color: #58a6ff;">💡 {orig.get('meme_title', 'Meme Breakdown')}</h3>
            <p><b>Template Archetype:</b> <span style="color: #f0883e;">{orig.get('meme_template', 'Classic Meme')}</span></p>
            <p><b>Detected Meme Text:</b> <i>"{orig.get('detected_text', '')}"</i></p>
            <p><b>The Joke it's Cracking:</b> <span style="color: #7ee787;">{orig.get('joke_punchline', '')}</span></p>
            <p style="color: #8b949e; font-size: 0.95rem; margin-bottom: 0;"><b>Why it's funny:</b> {orig.get('why_its_funny', '')}</p>
        </div>
        """, unsafe_allow_html=True)

        # Tabs for Act 1, Humor Speech, and Extended Sequel
        tab1, tab2, tab3 = st.tabs([
            "🎭 Speech Conversation (Act 1)",
            "🎙️ Stand-up Humor Speech",
            "🚀 Extended Meme Sequel (Act 2)"
        ])

        with tab1:
            st.markdown("#### 🗣️ Full Conversation Playback")
            if orig.get("full_audio"):
                st.audio(orig["full_audio"], format="audio/wav")
                st.caption("🎧 Continuous seamless dialogue generated by Sarvam AI Bulbul TTS")

            st.markdown("##### 💬 Dialogue Breakdown (Turn-by-Turn)")
            for i, turn in enumerate(orig.get("enriched_dialogue", [])):
                role = turn.get("role", "speaker_1")
                is_spk1 = (role == "speaker_1")
                border_color = "#38bdf8" if is_spk1 else "#f472b6"
                bubble_class = "chat-bubble-1" if is_spk1 else "chat-bubble-2"
                avatar = "🧑‍💻" if is_spk1 else "🤖"
                
                with st.container():
                    st.markdown(f"""
                    <div class="{bubble_class}">
                        <div class="speaker-tag" style="color: {border_color};">
                            {avatar} {turn.get('speaker', 'Speaker')}
                            <span class="emotion-badge">[{turn.get('emotion', 'speaking')}]</span>
                            <span style="font-size: 0.75rem; color: #6b7280; margin-left: 6px;">(Voice: {turn.get('voice_used', '')})</span>
                        </div>
                        <div style="font-size: 1.05rem; margin-top: 4px;">{turn.get('text', '')}</div>
                    </div>
                    """, unsafe_allow_html=True)
                    
                    if turn.get("audio_bytes"):
                        st.audio(turn["audio_bytes"], format="audio/wav")

        with tab2:
            st.markdown("#### 🎤 Stand-up Comedy Roast & Joke Breakdown")
            st.markdown(f"""
            <div class="humor-card">
                <div style="font-size: 0.85rem; color: #a78bfa; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                    🎙️ Stand-up Monologue | Performed by Sarvam Voice '{voice_comedian}'
                </div>
                <div style="font-size: 1.1rem; line-height: 1.6; margin-top: 10px; color: #f3f4f6;">
                    {orig.get('humor_speech', '').replace(chr(10), '<br>')}
                </div>
            </div>
            """, unsafe_allow_html=True)

            if orig.get("humor_audio"):
                st.markdown("##### 🔊 Listen to the Comedian Deliver the Roast:")
                st.audio(orig["humor_audio"], format="audio/wav")

        with tab3:
            st.markdown("### 🚀 Extended Humor: The Meme Sequel")
            st.markdown("Sarvam AI took the joke and escalated what happens next into Act 2!")
            
            # Show the generated sequel meme image
            if sequel.get("rendered_meme_image"):
                st.image(
                    sequel["rendered_meme_image"],
                    caption=f"Generated Sequel Meme: {sequel.get('sequel_title', '')}",
                    use_container_width=True
                )
                
            st.markdown(f"""
            <div class="meme-card" style="border-left: 4px solid #ef4444;">
                <h4 style="margin: 0; color: #f87171;">💥 {sequel.get('sequel_title', 'The Aftermath')}</h4>
                <p style="margin-top: 6px; font-size: 1rem; color: #e5e7eb;">{sequel.get('sequel_situation', '')}</p>
            </div>
            """, unsafe_allow_html=True)

            st.markdown("#### 🎧 Sequel Conversation Playback (Act 2)")
            if sequel.get("full_audio"):
                st.audio(sequel["full_audio"], format="audio/wav")

            st.markdown("##### 💬 Sequel Dialogue (The Consequences)")
            for turn in sequel.get("enriched_dialogue", []):
                role = turn.get("role", "speaker_1")
                is_spk1 = (role == "speaker_1")
                border_color = "#38bdf8" if is_spk1 else "#f472b6"
                bubble_class = "chat-bubble-1" if is_spk1 else "chat-bubble-2"
                avatar = "🧑‍💼" if is_spk1 else "😱"

                st.markdown(f"""
                <div class="{bubble_class}">
                    <div class="speaker-tag" style="color: {border_color};">
                        {avatar} {turn.get('speaker', 'Speaker')}
                        <span class="emotion-badge">[{turn.get('emotion', 'escalated')}]</span>
                    </div>
                    <div style="font-size: 1.05rem; margin-top: 4px;">{turn.get('text', '')}</div>
                </div>
                """, unsafe_allow_html=True)
                if turn.get("audio_bytes"):
                    st.audio(turn["audio_bytes"], format="audio/wav")

            st.markdown("---")
            st.markdown("#### 🎙️ Extended Humor Speech")
            if sequel.get("humor_audio"):
                st.audio(sequel["humor_audio"], format="audio/wav")
            st.markdown(f"""
            <div style="background: rgba(30, 41, 59, 0.7); padding: 14px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 8px;">
                <i>{sequel.get('extended_humor_speech', '')}</i>
            </div>
            """, unsafe_allow_html=True)

            # Escalation Button for Level 3
            st.markdown("---")
            next_level = len(st.session_state.escalations) + 3
            if st.button(f"🔥 Escalate Humor Further to Level {next_level} Chaos!", type="secondary"):
                with st.spinner(f"🚀 Sarvam AI is escalating the humor to Level {next_level}..."):
                    service: SarvamMemeService = st.session_state.service
                    tts_lang = res.get("tts_language", "en-IN")
                    curr_sit = sequel.get("sequel_situation", "")
                    if st.session_state.escalations:
                        curr_sit = st.session_state.escalations[-1].get("situation", curr_sit)

                    esc_data = service.escalate_humor_to_level(
                        base_title=orig.get("meme_title", ""),
                        current_situation=curr_sit,
                        level=next_level,
                        language=selected_lang,
                        speaker_1=orig.get("speaker_1_name", "Speaker 1"),
                        speaker_2=orig.get("speaker_2_name", "Speaker 2")
                    )

                    # Synthesize conversation & speech
                    enr_esc, full_esc_wav = service.synthesize_conversation_audio(
                        dialogue=esc_data.get("dialogue", []),
                        speaker_1_voice=voice_spk1,
                        speaker_2_voice=voice_spk2,
                        language_code=tts_lang
                    )
                    esc_data["enriched_dialogue"] = enr_esc
                    esc_data["full_audio"] = full_esc_wav

                    esc_humor_wav = service.synthesize_humor_speech(
                        humor_text=esc_data.get("humor_speech", ""),
                        comedian_voice=voice_comedian,
                        language_code=tts_lang
                    )
                    esc_data["humor_audio"] = esc_humor_wav

                    st.session_state.escalations.append(esc_data)
                    st.rerun()

            # Render any ongoing escalations
            for esc in st.session_state.escalations:
                lvl = esc.get("level", 3)
                st.markdown(f"### ⚡ Escalation Level {lvl}: {esc.get('level_title', '')}")
                if esc.get("rendered_meme_image"):
                    st.image(esc["rendered_meme_image"], caption=f"Level {lvl} Meme Card", use_container_width=True)
                if esc.get("full_audio"):
                    st.audio(esc["full_audio"], format="audio/wav")
                for t in esc.get("enriched_dialogue", []):
                    st.markdown(f"**[{t.get('emotion')}] {t.get('speaker')}**: {t.get('text')}")
                if esc.get("humor_audio"):
                    st.caption("Level Escalation Roast:")
                    st.audio(esc["humor_audio"], format="audio/wav")

