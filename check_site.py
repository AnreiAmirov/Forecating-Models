#!/usr/bin/env python3
"""
check_site.py — автоматическая проверка сайта перед отправкой.

Ловит именно те классы ошибок, которые уже случались:
  1. Битые якоря навигации (пункт ведёт на несуществующую секцию)
  2. Текст без data-i18n (страница не переводится)
  3. Ключи data-i18n, которых нет в словаре
  4. Нарушенный паритет EN/RU
  5. Иконки без жёстких размеров (раздуваются без CSS)
  6. Горизонтальное переполнение (desktop + mobile)
  7. Несбалансированный HTML
  8. Ошибки JavaScript

Запуск:  python3 check_site.py
Код возврата 0 — всё чисто, 1 — есть проблемы.
"""
import re, sys, json, pathlib, subprocess
from html.parser import HTMLParser

BASE = pathlib.Path(__file__).parent
PAGES = ['index.html', 'python.html', 'algorithms.html', 'sql.html', 'causal.html', 'ab-testing.html']
problems = []
notes = []


def fail(page, kind, detail):
    problems.append(f"[{page}] {kind}: {detail}")


def ok(msg):
    notes.append(f"  ok  {msg}")


# ── 1. Якоря навигации ────────────────────────────────────────────────
def check_anchors(page, html):
    hrefs = re.findall(r'class="toc-link[^"]*" href="#([^"]+)"', html)
    ids = re.findall(r'id="([^"]+)"', html)
    broken = [h for h in hrefs if h not in ids]
    if broken:
        fail(page, "битые якоря навигации", ", ".join(broken))
    else:
        if hrefs:
            ok(f"{page}: {len(hrefs)} якорей навигации, все существуют")
    # порядок пунктов должен совпадать с порядком секций в документе
    if hrefs:
        pos = {}
        for h in hrefs:
            m = re.search(r'id="' + re.escape(h) + r'"', html)
            if m:
                pos[h] = m.start()
        seq = [h for h in hrefs if h in pos]
        if seq != sorted(seq, key=lambda h: pos[h]):
            notes.append(f"  инфо {page}: оглавление упорядочено по темам, а не по документу — "
                         f"scroll-spy выбирает ближайшую секцию, это учтено")


# ── 2 и 3. Переводы ───────────────────────────────────────────────────
def load_dict():
    src = (BASE / 'i18n.js').read_text(encoding='utf-8')
    js = ("global.CanvasRenderingContext2D=function(){};"
          "global.CanvasRenderingContext2D.prototype={};"
          "global.document={documentElement:{},addEventListener(){},"
          "querySelectorAll(){return[]},getElementById(){return null}};"
          "global.window={};" + src + "\nconsole.log(JSON.stringify({en:Object.keys(T.en),ru:Object.keys(T.ru)}));")
    p = BASE / '.tmp_i18n.js'
    p.write_text(js, encoding='utf-8')
    out = subprocess.run(['node', str(p)], capture_output=True, text=True)
    p.unlink(missing_ok=True)
    if out.returncode != 0:
        fail('i18n.js', 'синтаксис', out.stderr.strip().split("\n")[-1][:120])
        return set(), set()
    d = json.loads(out.stdout)
    return set(d['en']), set(d['ru'])



def strip_no_translate(body):
    """Убирает блоки с translate="no" (код, трассировки) с учётом вложенных div."""
    out, i = [], 0
    while True:
        m = re.search(r'<div\b[^>]*translate="no"[^>]*>', body[i:])
        if not m:
            out.append(body[i:]); break
        start = i + m.start(); out.append(body[i:start])
        depth, j = 0, start
        for tag in re.finditer(r'<(/?)div\b[^>]*>', body[start:]):
            depth += -1 if tag.group(1) else 1
            if depth == 0:
                j = start + tag.end(); break
        i = j if j > start else start + m.end()
    return "".join(out)

def check_i18n(page, html, en, ru):
    keys = re.findall(r'data-i18n="([^"]+)"', html)
    missing = sorted({k for k in keys if k not in en or k not in ru})
    if missing:
        fail(page, "ключи отсутствуют в словаре", ", ".join(missing[:8]))
    else:
        ok(f"{page}: {len(keys)} ключей, все есть в EN и RU")

    # текст без data-i18n — страница не переведётся
    body = html[html.find('<body'):]
    body = re.sub(r'<pre>.*?</pre>', '', body, flags=re.S)          # код не переводим
    body = strip_no_translate(body)                                 # явно помеченный код
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)
    body = re.sub(r'<svg.*?</svg>', '', body, flags=re.S)
    PROPER = {'Difference-in-Differences', 'Regression Discontinuity',
              'Synthetic Control', 'Instrumental Variables', 'Propensity Score Matching',
              't (aggregated)', "Welch's t-test", 'Mann–Whitney U', 'Delta method',
              'Control vs B', 'Control vs C', 'Control vs D', '1 (smallest)'}
    untranslated = []
    for m in re.finditer(r'<(p|h1|h2|h3|li|td|th|span|div)\b([^>]*)>([^<>]{12,})<', body):
        attrs, text = m.group(2), m.group(3).strip()
        if 'data-i18n' in attrs:
            continue
        if text in PROPER:
            continue
        # имена таблиц и колонок из БД одинаковы в обоих языках
        if re.match(r'^[→ ]*[a-z_]+[.][a-z_]+$', text):
            continue
        # ячейки, состоящие в основном из чисел/формул, переводить нечего
        letters = len(re.findall(r'[А-Яа-яA-Za-z]', text))
        if letters < 8 or re.match(r'^[\d.,<>=→✓✗\s&;a-z]+$', text):
            continue
        if re.search(r'[А-Яа-яA-Za-z]{4,}', text):
            untranslated.append(text[:60])
    if untranslated:
        fail(page, f"текст без data-i18n ({len(untranslated)} фрагм.)", untranslated[0])
    else:
        ok(f"{page}: весь текст подключён к переводу")



# ── 9. Внутренние ссылки ведут на существующие страницы и якоря ──────
def check_links(page, html):
    # ссылки и в разметке, и внутри строк перевода (там они экранированы)
    src = html + (BASE / 'i18n.js').read_text(encoding='utf-8')
    own = re.findall(r'href=\\?"([^"#\\]*?\.html)(#[^"\\]*)?\\?"', html)
    for target, anchor in own:
        if target.startswith('http'):
            continue
        f = BASE / target
        if not f.exists():
            fail(page, "битая ссылка", f"{target} — такого файла нет")
            continue
        if anchor:
            if f'id="{anchor[1:]}"' not in f.read_text(encoding='utf-8'):
                fail(page, "битый якорь в ссылке", f"{target}{anchor}")
    global _I18N_LINKS_DONE
    if globals().get('_I18N_LINKS_DONE'):
        return
    _I18N_LINKS_DONE = True
    i18n_links = set(re.findall(r'href=\\?"([a-z0-9_-]+\.html)', (BASE / 'i18n.js').read_text(encoding='utf-8')))
    for target in i18n_links:
        if not (BASE / target).exists():
            fail('i18n.js', "битая ссылка в переводе", f"{target} — такого файла нет")


# ── 5. Размеры иконок ─────────────────────────────────────────────────
def check_icons(page, html):
    bad = re.findall(r'<span class="toc-(?:ic|g-ic)"><svg (?!width=)', html)
    if bad:
        fail(page, "иконки без width/height", f"{len(bad)} шт. — раздуются без CSS")
    elif '<span class="toc-ic">' in html or '<span class="toc-g-ic">' in html:
        ok(f"{page}: у всех иконок навигации жёсткие размеры")


# ── 7. Баланс HTML ────────────────────────────────────────────────────
VOID = {'br','img','input','meta','link','hr','col','area','path','circle','rect',
        'line','polyline','polygon','use','stop','svg','canvas','text','tspan',
        'g','defs','clippath','style','ellipse'}

class Balance(HTMLParser):
    def __init__(self):
        super().__init__(); self.stack = []
    def handle_starttag(self, tag, attrs):
        if tag not in VOID: self.stack.append(tag)
    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i] == tag:
                del self.stack[i]; return


def check_balance(page, html):
    b = Balance(); b.feed(html)
    if b.stack:
        fail(page, "несбалансированный HTML", f"{len(b.stack)} тегов: {b.stack[:5]}")
    else:
        ok(f"{page}: HTML сбалансирован")


# ── 6 и 8. Браузерные проверки ────────────────────────────────────────
BROWSER = r'''
from playwright.sync_api import sync_playwright
import pathlib, json, sys
base = pathlib.Path(sys.argv[1])
pages = sys.argv[2].split(',')
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for page in pages:
        entry = {"errors": [], "overflow": {}, "icons": {}, "spy": None}
        for w, label in [(1280, "desktop"), (390, "mobile")]:
            pg = b.new_page(viewport={"width": w, "height": 900})
            pg.on("pageerror", lambda e, E=entry: E["errors"].append(str(e)))
            pg.goto("file://" + str(base / page)); pg.wait_for_timeout(1000)
            entry["overflow"][label] = pg.evaluate(
                "()=>document.documentElement.scrollWidth-window.innerWidth")
            if label == "desktop":
                entry["icons"]["max"] = pg.evaluate(
                    "()=>{let m=0;document.querySelectorAll('.toc-ic svg,.toc-g-ic svg')"
                    ".forEach(e=>{const b=e.getBoundingClientRect();if(b.width>m)m=b.width});"
                    "return Math.round(m)}")
                # без CSS иконки тоже не должны раздуваться
                pg2 = b.new_page(viewport={"width": 1280, "height": 900})
                pg2.route("**/styles.css", lambda r: r.abort())
                pg2.goto("file://" + str(base / page)); pg2.wait_for_timeout(700)
                entry["icons"]["max_nocss"] = pg2.evaluate(
                    "()=>{let m=0;document.querySelectorAll('.toc-ic svg,.toc-g-ic svg')"
                    ".forEach(e=>{const b=e.getBoundingClientRect();if(b.width>m)m=b.width});"
                    "return Math.round(m)}")
                pg2.close()
                # scroll-spy: кликаем пункт и проверяем, что подсветился он же
                # На калькуляторе оглавление живёт во вкладке Learn — откроем её
                pg.evaluate("""()=>{const t=document.querySelector('[data-i18n=\"tab_reference\"]');
                  if(t && !document.getElementById('tab-reference').classList.contains('active')) t.click();}""")
                pg.wait_for_timeout(500)
                spy = pg.evaluate("""()=>{
                  const items=[...document.querySelectorAll('.toc-link')].filter(a=>a.offsetParent!==null);
                  if(items.length<3) return null;
                  const i=Math.min(4,items.length-1);
                  const target=document.querySelector(items[i].getAttribute('href'));
                  if(!target) return 'broken-anchor';
                  window.scrollTo(0, target.getBoundingClientRect().top+window.scrollY-20);
                  return i;
                }""")
                pg.wait_for_timeout(500)
                if isinstance(spy, int):
                    act = pg.evaluate("""()=>{const it=[...document.querySelectorAll('.toc-link')].filter(a=>a.offsetParent!==null);
                      return it.findIndex(a=>a.classList.contains('active'));}""")
                    entry["spy"] = {"clicked": spy, "active": act}
                else:
                    entry["spy"] = spy
            pg.close()
        res[page] = entry
    b.close()
print(json.dumps(res))
'''


def check_browser(pages):
    script = BASE / '.tmp_browser.py'
    script.write_text(BROWSER, encoding='utf-8')
    out = subprocess.run(['python3', str(script), str(BASE), ",".join(pages)],
                         capture_output=True, text=True, timeout=400)
    script.unlink(missing_ok=True)
    if out.returncode != 0:
        fail('browser', 'проверка не запустилась', out.stderr.strip()[-200:])
        return
    data = json.loads(out.stdout)
    for page, r in data.items():
        for label, ov in r["overflow"].items():
            if ov > 4:
                fail(page, f"переполнение {label}", f"{ov}px")
        if all(v <= 4 for v in r["overflow"].values()):
            ok(f"{page}: переполнения нет (desktop + mobile)")
        if r["errors"]:
            fail(page, "ошибки JS", r["errors"][0][:110])
        else:
            ok(f"{page}: ошибок JS нет")
        mx, mxn = r["icons"].get("max", 0), r["icons"].get("max_nocss", 0)
        if mx > 34:
            fail(page, "иконка раздута", f"{mx}px с CSS")
        if mxn > 34:
            fail(page, "иконка раздувается БЕЗ CSS", f"{mxn}px — нужны width/height в разметке")
        elif mx:
            ok(f"{page}: иконки {mx}px, без CSS {mxn}px")
        spy = r.get("spy")
        if spy == 'broken-anchor':
            fail(page, "scroll-spy", "якорь пункта не найден")
        elif isinstance(spy, dict) and spy["clicked"] != spy["active"]:
            fail(page, "scroll-spy подсвечивает не тот пункт",
                 f"перешли к {spy['clicked']}, подсветился {spy['active']}")
        elif isinstance(spy, dict):
            ok(f"{page}: scroll-spy подсвечивает верный пункт")


def main():
    en, ru = load_dict()
    only_en, only_ru = sorted(en - ru), sorted(ru - en)
    if only_en or only_ru:
        fail('i18n.js', 'нарушен паритет EN/RU', f"только EN: {only_en[:5]} | только RU: {only_ru[:5]}")
    else:
        ok(f"i18n: паритет {len(en)}/{len(ru)}")

    existing = []
    for page in PAGES:
        f = BASE / page
        if not f.exists():
            fail(page, 'файл отсутствует', str(f))
            continue
        existing.append(page)
        html = f.read_text(encoding='utf-8')
        check_anchors(page, html)
        check_i18n(page, html, en, ru)
        check_icons(page, html)
        check_balance(page, html)
        check_links(page, html)

    if existing:
        check_browser(existing)

    print("\n".join(notes))
    print()
    if problems:
        print(f"❌ ПРОБЛЕМ: {len(problems)}")
        for p in problems:
            print("   " + p)
        return 1
    print("✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ")
    return 0


if __name__ == '__main__':
    sys.exit(main())
