import re

file_path = r'd:\Projects\Webprojects\Heropesa\pages\index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

images = [
    'indexpg.jpeg',
    'WhatsApp Image 2026-06-30 at 07.58.12 (1).jpeg',
    'WhatsApp Image 2026-06-30 at 07.58.12.jpeg',
    'WhatsApp Image 2026-06-30 at 07.58.13 (1).jpeg',
    'WhatsApp Image 2026-06-30 at 07.58.14 (1).jpeg',
    'WhatsApp Image 2026-06-30 at 07.58.14.jpeg',
]

logos = [
    'gsm.png', 'azam.png', 'metl.png', 'sbl.png', 'tra.png', 
    'ura.png', 'zra.png', 'zohobooks.png', 'odoo.png', 'castlelager.png', 
    'konyagi.png', 'safarilager.png'
]

# Replace hero image
content = re.sub(
    r'<div class="media-placeholder media-hero"[^>]*>[\s\S]*?</div>',
    f'<img src="../assets/images/{images[0]}" alt="Hero Image" style="margin-top: 40px; border-radius: var(--radius-lg); width: 100%; object-fit: cover; box-shadow: var(--shadow-lg);">',
    content
)

# Replace AI Dashboard
content = re.sub(
    r'<div class="media-placeholder" role="img" aria-label="AI Dashboard preview">[\s\S]*?</div>',
    f'<img src="../assets/images/{images[1]}" alt="AI Dashboard" style="border-radius: var(--radius-lg); width: 100%; object-fit: cover; box-shadow: var(--shadow-md);">',
    content
)

# Replace CRM Interface
content = re.sub(
    r'<div class="media-placeholder" role="img" aria-label="CRM Interface preview">[\s\S]*?</div>',
    f'<img src="../assets/images/{images[2]}" alt="CRM Interface" style="border-radius: var(--radius-lg); width: 100%; object-fit: cover; box-shadow: var(--shadow-md);">',
    content
)

# Replace Financial Platform
content = re.sub(
    r'<div class="media-placeholder" role="img" aria-label="Financial Platform preview">[\s\S]*?</div>',
    f'<img src="../assets/images/{images[3]}" alt="Financial Platform" style="border-radius: var(--radius-lg); width: 100%; object-fit: cover; box-shadow: var(--shadow-md);">',
    content
)

# Replace Education Portal
content = re.sub(
    r'<div class="media-placeholder" role="img" aria-label="Education Portal preview">[\s\S]*?</div>',
    f'<img src="../assets/images/{images[4]}" alt="Education Portal" style="border-radius: var(--radius-lg); width: 100%; object-fit: cover; box-shadow: var(--shadow-md);">',
    content
)

# Replace Trading Platform
content = re.sub(
    r'<div class="media-placeholder media-sm"[^>]*>[\s\S]*?</div>',
    f'<img src="../assets/images/{images[5]}" alt="Trading Platform" style="margin-top: 20px; border-radius: var(--radius-lg); width: 100%; object-fit: cover; box-shadow: var(--shadow-md);">',
    content
)

# Replace Marquee Track logos
marquee_html = '<div class="marquee-track">\n'
for logo in logos:
    marquee_html += f'      <div class="marquee-item"><img src="../assets/logos/{logo}" alt="Partner Logo" style="height: 50px; object-fit: contain; filter: grayscale(100%); opacity: 0.7; transition: all 0.3s;" onmouseover="this.style.filter=\'none\'; this.style.opacity=\'1\'" onmouseout="this.style.filter=\'grayscale(100%)\'; this.style.opacity=\'0.7\'"></div>\n'
# duplicate to ensure infinite scroll
for logo in logos:
    marquee_html += f'      <div class="marquee-item"><img src="../assets/logos/{logo}" alt="Partner Logo" style="height: 50px; object-fit: contain; filter: grayscale(100%); opacity: 0.7; transition: all 0.3s;" onmouseover="this.style.filter=\'none\'; this.style.opacity=\'1\'" onmouseout="this.style.filter=\'grayscale(100%)\'; this.style.opacity=\'0.7\'"></div>\n'
marquee_html += '    </div>'

content = re.sub(
    r'<div class="marquee-track">[\s\S]*?</div>\s*</div>',
    f'{marquee_html}\n  </div>',
    content
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced images and logos successfully!")
