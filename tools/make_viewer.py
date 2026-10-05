"""Rebuild reference/financial-guardian.html (the single-file version used for the Claude preview) from site/.
Run from the repo root: python tools/make_viewer.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
ref = root / 'reference' / 'financial-guardian.html'
src = ref.read_text(encoding='utf8')
css = (root / 'site' / 'app.css').read_text(encoding='utf8')
css = css.split('\n', 3)[3] if css.startswith('/* reset') else css      # the preview has its own reset
js = (root / 'site' / 'app.js').read_text(encoding='utf8')
body = (root / 'site' / 'index.html').read_text(encoding='utf8')
body = body[body.index('<body>') + 6: body.index('<noscript>')].strip()
out = re.sub(r'<style>.*?</style>', lambda m: '<style>\n' + css.strip() + '\n</style>', src, count=1, flags=re.S)
start, end = out.index('</style>') + len('</style>'), out.index('<script>')
out = out[:start] + '\n' + body + '\n' + out[end:]
out = re.sub(r'<script>.*?</script>', lambda m: '<script>\n' + js.strip() + '\n</script>', out, count=1, flags=re.S)
ref.write_text(out, encoding='utf8')
print('wrote', ref, len(out), 'bytes')
