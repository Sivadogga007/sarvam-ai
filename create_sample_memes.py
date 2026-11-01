import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("sample_memes", exist_ok=True)

font_path = "/System/Library/Fonts/Supplemental/Impact.ttf"
if not os.path.exists(font_path):
    font_path = "/System/Library/Fonts/Helvetica.ttc"

def make_text_meme(filename, title, top_text, bottom_text, bg_color=(24, 27, 34), card_color=(38, 42, 54), text_color=(255, 255, 255), accent_color=(255, 107, 107)):
    width, height = 700, 500
    img = Image.new("RGB", (width, height), color=bg_color)
    draw = ImageDraw.Draw(img)
    
    # Outer border / card
    draw.rounded_rectangle([20, 20, width-20, height-20], radius=16, fill=card_color, outline=(60, 68, 85), width=3)
    
    try:
        font_title = ImageFont.truetype(font_path, 28)
        font_meme = ImageFont.truetype(font_path, 34)
        font_sub = ImageFont.truetype(font_path, 24)
    except:
        font_title = font_meme = font_sub = ImageFont.load_default()
        
    # Title badge
    draw.rectangle([40, 40, width-40, 90], fill=(20, 22, 28))
    draw.text((60, 50), title.upper(), fill=accent_color, font=font_title)
    
    # Top box
    draw.rounded_rectangle([50, 120, width-50, 270], radius=12, fill=(28, 32, 42), outline=(80, 90, 110), width=2)
    draw.text((70, 140), "EXPECTATION / PLAN:", fill=(100, 210, 255), font=font_sub)
    draw.text((70, 180), top_text, fill=text_color, font=font_meme)
    
    # Bottom box
    draw.rounded_rectangle([50, 300, width-50, 450], radius=12, fill=(28, 32, 42), outline=(80, 90, 110), width=2)
    draw.text((70, 320), "REALITY / WHAT ACTUALLY HAPPENED:", fill=(255, 140, 140), font=font_sub)
    draw.text((70, 360), bottom_text, fill=text_color, font=font_meme)
    
    img.save(os.path.join("sample_memes", filename))
    print(f"Created sample_memes/{filename}")

# Meme 1: 3 AM Bug Fix
make_text_meme(
    "3am_bug_fix.png",
    "Debugging at 3:00 AM",
    "Read 50 pages of documentation\nand write a clean unit-tested fix",
    "Delete the entire file.\nBug is gone. Zero errors. Goodnight.",
    accent_color=(255, 190, 50)
)

# Meme 2: Client vs Budget
make_text_meme(
    "client_budget.png",
    "Freelance Life",
    "Client: 'We need AI, real-time 3D, and blockchain,\nready by next Monday!'",
    "Budget: $25 gift card and a positive review\non LinkedIn.",
    accent_color=(255, 100, 150)
)

# Meme 3: Meeting vs Email
make_text_meme(
    "meeting_vs_email.png",
    "Corporate Culture",
    "Schedule a 90-minute all-hands sync\nwith 40 people listening to one slide",
    "Send a 2-sentence Slack message.\nSave 60 hours of company productivity.",
    accent_color=(120, 220, 120)
)

# Meme 4: Framework Hype
make_text_meme(
    "framework_hype.png",
    "Frontend Developers",
    "Stick with the battle-tested framework\nthat powers our entire profitable business",
    "Rewrite the whole app in a framework\nreleased 45 minutes ago on Twitter.",
    accent_color=(200, 120, 255)
)

print("All sample memes generated successfully!")

