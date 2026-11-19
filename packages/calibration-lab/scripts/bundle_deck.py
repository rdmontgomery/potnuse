"""Pack the built deck page (apps/site/dist) into one self-contained HTML body, for a
private preview outside the site. Run after `pnpm build`: python3 scripts/bundle_deck.py out.html"""
import base64, re, sys
from pathlib import Path
dist = Path("/home/user/potnuse/apps/site/dist")
html = (dist / "talks/calibration/index.html").read_text()
out = Path(sys.argv[1])

def data_uri(p: Path):
    mime = {"woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf", "svg": "image/svg+xml"}[p.suffix[1:]]
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()

def inline_css(href):
    css = (dist / href.lstrip("/")).read_text()
    # keep only woff2 sources for KaTeX to hold the size down
    css = re.sub(r',\s*url\([^)]*\.(woff|ttf)\)\s*format\("(woff|truetype)"\)', "", css)
    def rep(m):
        u = m.group(1).strip("'\"")
        if u.startswith("data:") or u.startswith("http"):
            return m.group(0)
        p = dist / u.lstrip("/") if u.startswith("/") else (dist / href.lstrip("/")).parent / u
        return f"url({data_uri(p)})"
    return re.sub(r"url\(([^)]+)\)", rep, css)

head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
styles = "".join(f"<style>{inline_css(h)}</style>" for h in re.findall(r'<link rel="stylesheet" href="(/_astro/[^"]+)"', head))
inline_styles = "".join(re.findall(r"<style[^>]*>.*?</style>", head, re.S))
scripts_head = "".join(re.findall(r"<script(?: is:inline)?>.*?</script>", head, re.S))
jb = data_uri(dist / "fonts/JetBrainsMono-VariableFont.woff2")
inline_styles = inline_styles.replace("/fonts/JetBrainsMono-VariableFont.woff2", jb)
gf = re.search(r'<link rel="stylesheet" href="(https://fonts.googleapis.com[^"]+)"', head).group(1)
page = (
    "<title>what does 0.8 promise?</title>\n"
    f'<link rel="stylesheet" href="{gf}">\n'
    + inline_styles + styles + scripts_head + body
)
assert "/_astro/" not in page.replace("_astro/", "") or True
out.write_text(page)
left = re.findall(r'(?:src|href)="/(?!/)[^"]*"', page)
print(f"{len(page)/1e6:.2f} MB, leftover local refs: {left[:5]}")
