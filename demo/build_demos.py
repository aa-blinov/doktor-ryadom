"""Generate the doctor and patient demo videos for «Рядом» as Hyperframes compositions.

Usage: python3 build_demos.py <demo dir>
Writes <demo dir>/{doctor,patient}/composition/index.html and transcript.md.
Each video follows one patient through the weeks between two appointments: a chapter
timeline on top, product screens in the middle, the transcript as captions at the bottom.
"""
import sys
from pathlib import Path

BASE = Path(sys.argv[1])

# Palette and type follow DESIGN.md.
INK, MUTED, ACCENT, SOFT, LINE, CANVAS = "#23382f", "#5a6860", "#326950", "#e8efe7", "#dce3db", "#f5f6f2"
CHIP_INK, SOS, SOS_SOFT = "#3c614a", "#a85424", "#fbf3ee"

HEAD = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<script src="assets/vendor/gsap.min.js"></script>
<style>
@font-face {{ font-family: "Golos Text"; src: url("assets/fonts/golos-text-cyrillic-400-normal.woff2") format("woff2"); font-weight: 400; }}
@font-face {{ font-family: "Golos Text"; src: url("assets/fonts/golos-text-cyrillic-600-normal.woff2") format("woff2"); font-weight: 600; }}
@font-face {{ font-family: "Golos Text"; src: url("assets/fonts/golos-text-cyrillic-700-normal.woff2") format("woff2"); font-weight: 700; }}
@font-face {{ font-family: "Golos Text"; src: url("assets/fonts/golos-text-cyrillic-800-normal.woff2") format("woff2"); font-weight: 800; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: {CANVAS}; }}
#root {{ position: relative; width: 100%; height: 100%; overflow: hidden; background: {CANVAS}; color: {INK}; font-family: "Golos Text", system-ui, sans-serif; }}
.scene, .inner {{ position: absolute; inset: 0; }}
.muted {{ color: {MUTED}; }}
.h {{ position: absolute; font-weight: 750; letter-spacing: -1px; line-height: 1.2; }}
.t {{ position: absolute; line-height: 1.4; }}
.b {{ font-weight: 700; }}
.card {{ position: absolute; background: #ffffff; border: 1px solid {LINE}; border-radius: 16px; }}
.panel {{ position: absolute; left: 160px; top: 130px; width: 1600px; height: 690px; background: #ffffff; border: 1px solid {LINE}; border-radius: 20px; }}
.pill {{ position: absolute; width: 230px; height: 110px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1px solid {LINE}; border-radius: 13px; font-size: 26px; font-weight: 600; }}
.ans {{ position: absolute; left: 200px; width: 900px; height: 76px; display: flex; align-items: center; padding-left: 32px; background: #ffffff; border: 1px solid {LINE}; border-radius: 12px; font-size: 30px; }}
.chip {{ position: absolute; padding: 8px 18px; border-radius: 8px; font-size: 24px; font-weight: 600; white-space: nowrap; }}
.soft {{ background: {SOFT}; color: {CHIP_INK}; }}
.accent {{ background: {ACCENT}; color: #ffffff; }}
.sos {{ background: {SOS_SOFT}; color: {SOS}; }}
.row {{ position: absolute; left: 160px; width: 1600px; height: 120px; background: #ffffff; border: 1px solid {LINE}; border-radius: 16px; }}
.row .t {{ left: 56px; top: 38px; font-size: 34px; font-weight: 600; }}
.box {{ position: absolute; width: 36px; height: 36px; border: 2px solid {ACCENT}; border-radius: 8px; background: #ffffff; }}
.seg {{ position: absolute; height: 10px; border-radius: 5px; background: {LINE}; }}
.day {{ position: absolute; top: 330px; width: 60px; height: 60px; border: 1px solid {LINE}; border-radius: 12px; background: #ffffff; }}
.btn {{ position: absolute; height: 84px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 30px; font-weight: 600; }}
.center {{ position: absolute; left: 0; right: 0; text-align: center; }}
.chap {{ position: absolute; top: 26px; text-align: center; font-size: 22px; font-weight: 600; color: {MUTED}; }}
#capbar {{ position: absolute; left: 160px; top: 868px; width: 1600px; height: 160px; background: #ffffff; border: 1px solid {LINE}; border-radius: 20px; }}
.cap {{ position: absolute; left: 200px; top: 868px; width: 1520px; height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 36px; font-weight: 600; line-height: 1.35; opacity: 0; }}
.cap .l2 {{ font-weight: 400; color: {MUTED}; font-size: 32px; }}
</style>
</head>
<body>
"""

JS_HELPERS = f"""
const tl = gsap.timeline({{ paused: true }});
const fade = (sel, t, d = 0.4) => tl.fromTo(sel, {{ opacity: 0 }}, {{ opacity: 1, duration: d, ease: "power2.out" }}, t);
const out = (sel, t, d = 0.35) => tl.to(sel, {{ opacity: 0, duration: d }}, t);
const rise = (sel, t, d = 0.5) => tl.fromTo(sel, {{ opacity: 0, y: 14 }}, {{ opacity: 1, y: 0, duration: d, ease: "expo.out" }}, t);
const slide = (sel, t, d = 0.45) => tl.fromTo(sel, {{ opacity: 0, x: -18 }}, {{ opacity: 1, x: 0, duration: d, ease: "expo.out" }}, t);
const fill = (sel, t, bg = "{ACCENT}") => tl.to(sel, {{ backgroundColor: bg, color: "#ffffff", borderColor: bg, duration: 0.22 }}, t);
const unfill = (sel, t) => tl.to(sel, {{ backgroundColor: "{SOFT}", color: "{CHIP_INK}", duration: 0.22 }}, t);
const cap = (sel, a, b) => {{ tl.fromTo(sel, {{ opacity: 0, y: 8 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }}, a); tl.to(sel, {{ opacity: 0, duration: 0.3 }}, b - 0.3); }};
"""


# The app paints the dot #86a17c; the video uses a touch darker shade to pass 3:1 on the canvas.
LEAF_DARK, LEAF_LIGHT, DOT = ACCENT, "#a9c3a0", "#7c9573"


def mark(size):
    """The app's two-leaf mark, as in app/public/favicon.svg and Brand in ui.tsx."""
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 36 36" aria-hidden="true">'
            f'<path fill="{LEAF_DARK}" d="M5 6c13 0 20 9 20 24C12 30 5 21 5 6Z"/>'
            f'<path fill="{LEAF_LIGHT}" d="M30 4c-11 2-16 10-15 22C27 25 32 16 30 4Z"/></svg>')


def lockup(px):
    """Mark plus the lowercase wordmark «рядом.», sized by the wordmark's font size."""
    return (f'<div style="display:flex; align-items:center; gap:{px * 0.27:.0f}px; color:{ACCENT}; font-size:{px}px; font-weight:800; letter-spacing:{-px / 30:.1f}px; line-height:1;">'
            f'{mark(round(px * 1.17))}<span>рядом<span style="color:{DOT};">.</span></span></div>')


def brandmark(start, end):
    """After the hook reveals the logo, it stays in the top-left corner until the outro takes over."""
    return (f'<div id="brandmark" class="scene clip" data-start="{start}" data-duration="{end - start}" data-track-index="3">'
            f'<div class="inner" id="brandmark-in"><div style="position:absolute; left:160px; top:24px;">{lockup(30)}</div></div></div>\n')


def scene(sid, start, dur, body):
    return (f'<div id="{sid}" class="scene clip" data-start="{start}" data-duration="{dur}" data-track-index="0">'
            f'<div class="inner" id="{sid}-in">\n{body}\n</div></div>\n')


def captions(caps, end):
    """caps: list of (start, end, [line1, line2?]). Second line is quieter."""
    body = '<div id="capbar"></div>\n'
    js = ""
    for i, (a, b, lines) in enumerate(caps):
        inner = "".join(f'<div class="{"l2" if k else "l1"}">{line}</div>' for k, line in enumerate(lines))
        body += f'<div class="cap" id="cap{i}">{inner}</div>\n'
        js += f'cap("#cap{i}", {a}, {b});\n'
    js += f'fade("#capbar", 0.1, 0.4);\nout("#capbar", {end - 0.35});\n'
    return f'<div id="captions" class="scene clip" data-start="0" data-duration="{end}" data-track-index="1">\n{body}</div>\n', js


def chapters(chaps):
    """The one authored motion: a bar that walks along the weeks between the two appointments."""
    start, end = chaps[0][1], chaps[-1][2]
    n = len(chaps)
    w = 1280 / n
    labels = "".join(f'<div class="chap" id="ch{i}" style="left:{480 + i * w:.0f}px; width:{w:.0f}px;">{name}</div>' for i, (name, _, _) in enumerate(chaps))
    body = (f'<div style="position:absolute; left:480px; top:72px; width:1280px; height:4px; border-radius:2px; background:{LINE};"></div>'
            f'<div id="chbar" style="position:absolute; left:480px; top:72px; width:{w:.0f}px; height:4px; border-radius:2px; background:{ACCENT};"></div>{labels}')
    js = f'fade("#chapters-in", {start}, 0.4);\n'
    for i, (_, a, _) in enumerate(chaps):
        if i:
            js += f'tl.to("#chbar", {{ x: {i * w:.0f}, duration: 0.7, ease: "expo.out" }}, {a});\n'
            js += f'tl.to("#ch{i - 1}", {{ color: "{MUTED}", fontWeight: 600, duration: 0.2 }}, {a});\n'
        js += f'tl.to("#ch{i}", {{ color: "{INK}", fontWeight: 700, duration: 0.2 }}, {a});\n'
    js += f'out("#chapters-in", {end - 0.35});\n'
    return f'<div id="chapters" class="scene clip" data-start="{start}" data-duration="{end - start}" data-track-index="2"><div class="inner" id="chapters-in">{body}</div></div>\n', js


def audio(music_dur, sfx):
    files = {"click": ("click_001.ogg", 0.1, 0.7), "drop": ("drop_001.ogg", 0.11, 0.6), "bong": ("bong_001.ogg", 0.12, 0.7)}
    html = f'<audio id="music" data-start="0" data-duration="{music_dur}" data-track-index="10" data-volume="0.28" src="assets/music/bed.mp3"></audio>\n'
    for i, (kind, t) in enumerate(sfx):
        f, d, v = files[kind]
        html += f'<audio id="sfx-{i}" data-start="{t}" data-duration="{d}" data-track-index="{11 + i}" data-volume="{v}" src="assets/sfx/interface/{f}"></audio>\n'
    return html


def page(total, parts, js):
    return (HEAD + f'<div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="1920" data-height="1080">\n'
            + "".join(parts) + "</div>\n<script>" + JS_HELPERS + js
            + '\nwindow.__timelines["main"] = tl;\ntl.seek(0);\n</script>\n</body>\n</html>\n')


def outro(sid, start, dur):
    return scene(sid, start, dur, f"""
<div id="brand" style="position:absolute; left:0; right:0; top:330px; display:flex; justify-content:center;">{lockup(128)}</div>
<div class="center muted" id="brandsub" style="top:520px; font-size:40px;">Дневник состояния и связь с врачом</div>""")


def chart(pid, pts, left=200, top=250, w=1500, h=440):
    """Points, a thin grey connecting line and a dashed accent trend line, as in the app."""
    n = len(pts)
    mx = sum(x for x, _ in pts) / n
    my = sum(y for _, y in pts) / n
    k = sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)
    x0, x1 = pts[0][0], pts[-1][0]
    trend = f'<line id="{pid}-trend" x1="{x0}" y1="{my + k * (x0 - mx):.0f}" x2="{x1}" y2="{my + k * (x1 - mx):.0f}" stroke="{ACCENT}" stroke-width="4" stroke-dasharray="10 10" opacity="0" />'
    poly = f'<polyline id="{pid}-line" points="{" ".join(f"{x},{y}" for x, y in pts)}" stroke="#b8c7b9" stroke-width="2" fill="none" opacity="0" />'
    dots = "\n".join(f'<circle class="pt" cx="{x}" cy="{y}" r="11" fill="{ACCENT}" />' for x, y in pts)
    grid = f'<path d="M0 40H{w}M0 {h // 2}H{w}M0 {h - 40}H{w}" stroke="{LINE}" stroke-width="2" />'
    return f'<svg style="position:absolute; left:{left}px; top:{top}px;" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none">{grid}{poly}{trend}\n{dots}\n</svg>'


def chart_js(scope, pid, t0, step):
    return (f'document.querySelectorAll("#{scope} .pt").forEach((p, i) => tl.fromTo(p, {{ opacity: 0, scale: 0.4, transformOrigin: "50% 50%" }}, {{ opacity: 1, scale: 1, duration: 0.25, ease: "expo.out" }}, {t0} + i * {step}));\n'
            f'fade("#{pid}-line", {t0 + 0.2}, 0.6);\n'
            f'tl.to("#{pid}-trend", {{ opacity: 1, duration: 0.6 }}, "{{TREND}}");\n')


def write(role, total, parts, js, caps, rows, title):
    (BASE / role / "composition/index.html").write_text(page(total, parts, js), encoding="utf-8")
    md = [f"# Рядом: демо для {title} ({total} с)", "", "Видео: `video.mp4`, постер: `poster.jpg`.", "",
          "| Время | Субтитр | Что на экране |", "|---|---|---|"]
    for (a, b, lines), screen in zip(caps, rows):
        md.append(f"| {a:g}–{b:g} | {' / '.join(lines)} | {screen} |")
    md.append(f"| {caps[-1][1]:g}–{total} | (без субтитра) | «Рядом. Дневник состояния и связь с врачом» |")
    (BASE / role / "transcript.md").write_text("\n".join(md) + "\n", encoding="utf-8")


# ---------------- Doctor ----------------
def doctor():
    parts, js = [], ""

    dots = "\n".join(f'<div class="bd" style="position:absolute; left:{606 + i * 78}px; top:388px; width:20px; height:20px; border-radius:50%; background:{ACCENT}; opacity:0;"></div>' for i, _ in enumerate(range(10)))
    parts.append(scene("d-bridge", 0, 10, f"""
<div class="card" style="left:160px; top:300px; width:380px; height:200px;"></div>
<div class="t b" style="left:160px; width:380px; top:350px; font-size:40px; text-align:center;">Приём</div>
<div class="t muted" style="left:160px; width:380px; top:410px; font-size:26px; text-align:center;">сегодня</div>
<div class="card" style="left:1380px; top:300px; width:380px; height:200px;"></div>
<div class="t b" style="left:1380px; width:380px; top:350px; font-size:40px; text-align:center;">Приём</div>
<div class="t muted" style="left:1380px; width:380px; top:410px; font-size:26px; text-align:center;">через 3 недели</div>
<div style="position:absolute; left:560px; top:396px; width:800px; height:4px; background:{LINE};"></div>
<div class="t muted" id="d-q" style="left:930px; top:220px; font-size:80px; font-weight:700;">?</div>
{dots}
<div id="d-brand0" style="position:absolute; left:0; right:0; top:580px; display:flex; justify-content:center;">{lockup(72)}</div>"""))
    js += 'fade("#d-q", 1.2); out("#d-q", 5.8);\n'
    js += 'document.querySelectorAll(".bd").forEach((d, i) => fade(d, 6.2 + i * 0.12, 0.25));\n'
    js += 'rise("#d-brand0", 7.0); out("#d-bridge-in", 9.6);\n'

    parts.append(scene("d-invite", 10, 6, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:180px; font-size:48px;">Приглашение пациенту</div>
<div class="t muted" style="left:220px; top:280px; font-size:26px;">Одноразовая ссылка</div>
<div class="card" style="left:220px; top:325px; width:760px; height:90px; background:{CANVAS};"></div>
<div class="t" style="left:260px; top:349px; font-size:32px;">…/invite/7f3k9q2</div>
<div class="btn accent" style="left:1010px; top:328px; width:320px; height:84px;">Скопировать</div>
<div id="d-consent" style="opacity:0;">
<div class="box" id="d-box" style="left:220px; top:500px;"></div>
<div class="t" style="left:276px; top:494px; font-size:32px;">Разрешаю этому врачу доступ к моей истории</div>
</div>"""))
    js += 'fade("#d-invite-in", 10.0); fade("#d-consent", 12.0); fill("#d-box", 13.4); out("#d-invite-in", 15.65);\n'

    parts.append(scene("d-plan", 16, 6, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:180px; font-size:48px;">План наблюдения</div>
<div class="t muted" style="left:220px; top:280px; font-size:26px;">Отслеживаем</div>
<div class="box pb" style="left:220px; top:330px;"></div><div class="t" style="left:276px; top:324px; font-size:32px;">Сон</div>
<div class="box pb" style="left:220px; top:400px;"></div><div class="t" style="left:276px; top:394px; font-size:32px;">Тревога</div>
<div class="box pb" style="left:220px; top:470px;"></div><div class="t" style="left:276px; top:464px; font-size:32px;">Энергия</div>
<div class="t muted" style="left:1000px; top:280px; font-size:26px;">Частота</div>
<div style="position:absolute; left:1000px; top:326px; display:flex; gap:12px;"><div class="chip soft" id="d-f1" style="position:relative;">Каждый день</div><div class="chip soft" style="position:relative;">Три раза в неделю</div><div class="chip soft" style="position:relative;">Раз в неделю</div></div>
<div class="t muted" style="left:220px; top:560px; font-size:26px;">Практики</div>
<div id="d-pr" style="position:absolute; left:220px; top:606px; display:flex; gap:12px; opacity:0;"><div class="chip soft" style="position:relative;">Здесь и сейчас</div><div class="chip soft" style="position:relative;">Дыхание без спешки</div><div class="chip soft" style="position:relative;">Пять ориентиров</div></div>"""))
    js += 'fade("#d-plan-in", 16.0); document.querySelectorAll(".pb").forEach((b, i) => fill(b, 17.0 + i * 0.4)); fill("#d-f1", 18.6); fade("#d-pr", 19.4); out("#d-plan-in", 21.65);\n'

    parts.append(scene("d-quest", 22, 7, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:180px; font-size:48px;">Опросники</div>
<div class="t b" style="left:220px; top:300px; font-size:34px;">Настроение, PHQ-9</div>
<div class="chip soft" id="dq1b" style="left:1300px; top:302px; opacity:0;">Ожидает просмотра врачом</div>
<div style="position:absolute; left:220px; top:376px; width:1480px; height:1px; background:{LINE};"></div>
<div class="t b" style="left:220px; top:404px; font-size:34px;">Тревога, GAD-7</div>
<div class="chip soft" id="dq2b" style="left:1300px; top:406px; opacity:0;">Ожидает просмотра врачом</div>
<div class="t muted" id="dq-note" style="left:220px; top:540px; font-size:28px; opacity:0;">Результат помогает обсуждать состояние и не устанавливает диагноз</div>"""))
    js += 'fade("#d-quest-in", 22.0); fade("#dq1b", 24.8, 0.3); fade("#dq2b", 26.0, 0.3); fade("#dq-note", 26.6); out("#d-quest-in", 28.65);\n'

    parts.append(scene("d-list", 29, 7, f"""
<div class="h" style="left:160px; top:120px; font-size:52px;">Ваши пациенты</div>
<div style="position:absolute; left:1240px; top:132px; display:flex; gap:12px;"><div class="chip soft" style="position:relative;">Все пациенты</div><div class="chip soft" id="d-att" style="position:relative;">Требуют внимания</div></div>
<div class="row" id="dr1" style="top:230px;"><div class="t">Анна С.</div><div class="chip sos" id="df1" style="left:320px; top:38px; opacity:0;">Сигнал: «Мне сейчас плохо»</div></div>
<div class="row" id="dr2" style="top:370px;"><div class="t">Игорь М.</div><div class="chip soft" id="df2" style="left:320px; top:38px; opacity:0;">Нет отметок 3 дн.</div></div>
<div class="row" id="dr3" style="top:510px;"><div class="t">Ольга Н.</div><div class="chip soft" id="df3" style="left:320px; top:38px; opacity:0;">Низкое самочувствие</div></div>
<div class="card" id="d-push" style="left:1020px; top:660px; width:740px; height:150px; opacity:0;"></div>
<div class="t b" id="d-push-t" style="left:1056px; top:686px; font-size:26px; color:{SOS}; opacity:0;">Рядом: сигнал от пациента</div>
<div class="t muted" id="d-push-s" style="left:1056px; top:736px; font-size:26px; opacity:0;">Пациенту сейчас плохо. Откройте дашборд.</div>
<div class="card" id="d-contact" style="left:160px; top:660px; width:840px; height:150px; opacity:0;"></div>
<div id="d-contact-t" style="opacity:0;">
<div class="t muted" style="left:196px; top:686px; font-size:24px;">Как связаться при необходимости</div>
<div class="t b" style="left:196px; top:728px; font-size:30px;">Звонок, договорились на приёме</div>
</div>"""))
    js += ('fade("#d-list-in", 29.0); slide("#dr1", 29.4); slide("#dr2", 29.7); slide("#dr3", 30.0); fill("#d-att", 30.6);\n'
           f'fade("#df1", 31.2); tl.to("#dr1", {{ borderColor: "{SOS}", duration: 0.3 }}, 31.2); fade("#df2", 31.9); fade("#df3", 32.4);\n'
           'rise("#d-push", 32.8); fade("#d-push-t", 33.0); fade("#d-push-s", 33.2); rise("#d-contact", 34.0); fade("#d-contact-t", 34.2); out("#d-list-in", 35.65);\n')

    parts.append(scene("d-goals", 36, 7, """
<div class="h" style="left:160px; top:120px; font-size:52px;">Личные цели пациента</div>
<div class="row" id="dg1" style="top:230px;"><div class="t">Раз в неделю встречаться с друзьями</div><div class="chip soft" id="dgc1" style="left:1260px; top:38px; opacity:0;">Шаг сделан</div></div>
<div class="row" id="dg2" style="top:370px;"><div class="t">Гулять после работы хотя бы 15 минут</div><div class="chip soft" id="dgc2" style="left:1260px; top:38px; opacity:0;">Возникла трудность</div></div>
<div class="row" id="dg3" style="top:510px;"><div class="t">Ложиться до полуночи три дня в неделю</div><div class="chip accent" id="dgc3" style="left:1260px; top:38px; opacity:0;">Цель достигнута</div></div>"""))
    js += 'fade("#d-goals-in", 36.0); slide("#dg1", 36.4); slide("#dg2", 36.7); slide("#dg3", 37.0); fade("#dgc1", 38.2); fade("#dgc2", 39.2); fade("#dgc3", 40.2); out("#d-goals-in", 42.65);\n'

    pts = [(60, 370), (185, 350), (310, 360), (435, 320), (560, 330), (685, 290), (810, 270), (935, 280), (1060, 230), (1185, 210), (1310, 190), (1435, 160)]
    parts.append(scene("d-course", 43, 7, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:170px; font-size:44px;">Самочувствие по дням</div>
<div class="t muted" style="left:1100px; top:182px; width:600px; text-align:right; white-space:nowrap; font-size:24px;">От «очень тяжело» до «очень хорошо»</div>
{chart("dc", pts, left=220, top=250, w=1480, h=440)}"""))
    js += 'fade("#d-course-in", 43.0);\n' + chart_js("d-course", "dc", 43.6, 0.3).replace('"{TREND}"', "47.6") + 'out("#d-course-in", 49.65);\n'

    parts.append(scene("d-over", 50, 6, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:170px; font-size:44px;">Что хочет обсудить пациент</div>
<div class="t" id="dw1" style="left:220px; top:270px; font-size:36px; opacity:0;">Хочу обсудить сон на этой неделе.</div>
<div class="t" id="dw2" style="left:220px; top:340px; font-size:36px; opacity:0;">Тревога перед работой стала меньше.</div>
<div class="t muted" id="dw3" style="left:220px; top:440px; font-size:28px; opacity:0;">Новые ответы PHQ-9, GAD-7 и заметки за неделю</div>
<div class="btn" id="d-review" style="left:220px; top:540px; width:400px; border:2px solid {ACCENT}; color:{ACCENT}; background:#ffffff;">Подтвердить просмотр</div>"""))
    js += 'fade("#d-over-in", 50.0); fade("#dw1", 50.6); fade("#dw2", 51.2); fade("#dw3", 51.8); fill("#d-review", 53.6); out("#d-over-in", 55.65);\n'

    parts.append(scene("d-change", 56, 6, """
<div class="panel"></div>
<div class="t b" style="left:220px; top:180px; font-size:48px;">План наблюдения</div>
<div class="t muted" style="left:220px; top:280px; font-size:26px;">Частота</div>
<div style="position:absolute; left:220px; top:326px; display:flex; gap:12px;"><div class="chip accent" id="dc1" style="position:relative;">Каждый день</div><div class="chip soft" id="dc2" style="position:relative;">Три раза в неделю</div><div class="chip soft" style="position:relative;">Раз в неделю</div></div>
<div class="t muted" style="left:220px; top:430px; font-size:26px;">Рекомендации пациенту</div>
<div class="t" id="dc-rec" style="left:220px; top:474px; font-size:34px; opacity:0;">Прогулка 15 минут после работы, три раза в неделю.</div>"""))
    js += 'fade("#d-change-in", 56.0); unfill("#dc1", 57.4); fill("#dc2", 57.4); fade("#dc-rec", 58.4); out("#d-change-in", 61.65);\n'

    dots2 = "\n".join(f'<div style="position:absolute; left:{606 + i * 78}px; top:388px; width:20px; height:20px; border-radius:50%; background:{ACCENT};"></div>' for i in range(10))
    parts.append(scene("d-payoff", 62, 5, f"""
<div class="card" style="left:160px; top:300px; width:380px; height:200px;"></div>
<div class="t b" style="left:160px; width:380px; top:350px; font-size:40px; text-align:center;">Приём</div>
<div class="card" style="left:1380px; top:300px; width:380px; height:200px;"></div>
<div class="t b" style="left:1380px; width:380px; top:350px; font-size:40px; text-align:center;">Приём</div>
<div style="position:absolute; left:560px; top:396px; width:800px; height:4px; background:{ACCENT};"></div>
{dots2}"""))
    js += 'fade("#d-payoff-in", 62.0, 0.5); out("#d-payoff-in", 66.65);\n'

    parts.append(scene("d-limits", 67, 5, """
<div class="panel"></div>
<div class="t b" id="dl1" style="left:220px; top:420px; width:1480px; font-size:44px; opacity:0;">Назначать препараты в приложении может только подтверждённый врач-психиатр</div>"""))
    js += 'fade("#d-limits-in", 67.0); fade("#dl1", 67.3); out("#d-limits-in", 71.65);\n'

    parts.append(outro("d-outro", 72, 5))
    parts.append(brandmark(10, 72))
    js += 'fade("#brandmark-in", 10.0, 0.4); out("#brandmark-in", 71.65);\n'
    js += 'rise("#brand", 72.3, 0.6); fade("#brandsub", 73.0);\n'

    chap_html, chap_js = chapters([("День 1", 10, 22), ("Неделя 1", 22, 29), ("Неделя 2", 29, 36), ("Неделя 3", 36, 43), ("Приём", 43, 62)])
    parts.append(chap_html)
    js += chap_js

    caps = [
        (0.4, 5.9, ["Между приёмами три недели", "Что с пациентом в это время, вы почти не знаете"]),
        (6.1, 9.9, ["Пациент отмечает состояние в Рядом"]),
        (10.2, 15.9, ["В конце приёма дайте вашему пациенту ссылку-приглашение", "Доступ к своей истории он открывает сам"]),
        (16.2, 21.9, ["Вместе решите, что он отмечает, как часто и какие практики делает"]),
        (22.2, 28.9, ["Пациент проходит опросник дома", "Ответы приходят вам"]),
        (29.2, 35.9, ["Пациенту стало плохо, он отправил сигнал", "Вы видите его и связываетесь по согласованному каналу"]),
        (36.2, 42.9, ["Пациент сам ставит цели и отмечает шаги"]),
        (43.2, 49.9, ["Перед приёмом видно, как менялось самочувствие"]),
        (50.2, 55.9, ["К приёму вы уже знаете, что пациент хочет обсудить"]),
        (56.2, 61.9, ["После приёма поменяйте план", "Пациент увидит новый план у себя"]),
        (62.2, 66.9, ["Три недели позади"]),
        (67.2, 71.9, ["Рядом не ставит диагноз", "Медицинские решения принимает врач"]),
    ]
    rows = ["Два приёма и пустые три недели между ними", "Промежуток заполняется отметками, «Рядом»",
            "«Приглашение пациенту», одноразовая ссылка, согласие «Разрешаю этому врачу доступ к моей истории»",
            "«План наблюдения»: «Отслеживаем» сон, тревогу, энергию, частота «Каждый день», три практики",
            "«Опросники»: у PHQ-9 и GAD-7 появляется статус «Ожидает просмотра врачом»",
            "«Ваши пациенты», фильтр «Требуют внимания», сигнал у пациента, уведомление, «Как связаться при необходимости»",
            "«Личные цели пациента» со статусами шагов",
            "«Самочувствие по дням» за 3 недели, линия тренда",
            "«Что хочет обсудить пациент», «Подтвердить просмотр»",
            "Частота меняется на «Три раза в неделю», «Рекомендации пациенту»",
            "Те же два приёма, промежуток между ними заполнен",
            "«Назначать препараты в приложении может только подтверждённый врач-психиатр»"]
    cap_html, cap_js = captions(caps, 72)
    parts.append(cap_html)
    js += cap_js
    parts.append(audio(77, [("click", 13.4), ("click", 31.2), ("click", 53.6), ("click", 57.4), ("bong", 72.2)]))
    write("doctor", 77, parts, js, caps, rows, "врача")


# ---------------- Patient ----------------
def patient():
    parts, js = [], ""

    days = "\n".join(f'<div class="day pd" style="left:{160 + i * 76}px;"></div>' for i in range(21))
    parts.append(scene("p-weeks", 0, 10, f"""
<div class="t b" style="left:160px; top:250px; font-size:30px;">Три недели до следующего приёма</div>
{days}
<div class="t muted" style="left:160px; top:410px; font-size:24px;">сегодня</div>
<div class="t muted" style="left:1660px; top:410px; font-size:24px;">приём</div>
<div id="p-brand0" style="position:absolute; left:0; right:0; top:560px; display:flex; justify-content:center;">{lockup(72)}</div>"""))
    js += f'document.querySelectorAll(".pd").forEach((d, i) => tl.to(d, {{ backgroundColor: "{ACCENT}", borderColor: "{ACCENT}", duration: 0.2 }}, 6.0 + i * 0.09));\n'
    js += 'rise("#p-brand0", 7.0); out("#p-weeks-in", 9.6);\n'

    pills = "\n".join(f'<div class="pill" id="pm{i}" style="left:{220 + i * 254}px; top:290px;">{t}</div>' for i, t in enumerate(["Очень тяжело", "Тяжело", "Нейтрально", "Хорошо", "Очень хорошо"]))
    anx = ('<div style="position:absolute; left:600px; top:516px; display:flex; gap:12px;">'
           + "".join(f'<div class="chip soft" id="pa{i}" style="position:relative;">{t}</div>' for i, t in enumerate(["Очень сильная", "Сильная", "Умеренная", "Небольшая", "Без тревоги"])) + '</div>')
    parts.append(scene("p-check", 10, 7, f"""
<div class="panel"></div>
<div class="h" style="left:220px; top:175px; font-size:52px;">Как вы себя чувствуете?</div>
{pills}
<div id="p-more" style="opacity:0;">
<div class="t muted" style="left:220px; top:470px; font-size:26px;">Сон, часов</div>
<div class="card" style="left:220px; top:510px; width:160px; height:70px; border-radius:12px;"></div>
<div class="t b" style="left:284px; top:518px; font-size:36px;">7</div>
<div class="t muted" style="left:600px; top:470px; font-size:26px;">Тревога</div>
{anx}
</div>
<div class="t muted" id="p-skip" style="left:220px; top:680px; font-size:28px; opacity:0;">Дополнительные вопросы можно пропустить</div>"""))
    js += 'fade("#p-check-in", 10.0); fill("#pm2", 11.4); fade("#p-more", 12.6); fill("#pa3", 14.0); fade("#p-skip", 14.8); out("#p-check-in", 16.65);\n'

    answers = "\n".join(f'<div class="ans" id="pq{i}" style="left:220px; top:{360 + i * 92}px;">{t}</div>' for i, t in enumerate(["Ни разу", "Несколько дней", "Более недели", "Почти каждый день"]))
    parts.append(scene("p-quest", 17, 6, f"""
<div class="panel"></div>
<div class="t muted" style="left:220px; top:170px; font-size:28px; width:1400px;">Как часто за последние 2 недели Вас беспокоили следующие проблемы?</div>
<div class="t b" style="left:220px; top:240px; font-size:46px;">Вам не хотелось ничего делать</div>
{answers}
<div class="t muted" style="left:220px; top:740px; font-size:24px;">Опросник «Настроение, PHQ-9» назначил врач</div>"""))
    js += 'fade("#p-quest-in", 17.0); fill("#pq1", 19.8); out("#p-quest-in", 22.65);\n'

    parts.append(scene("p-goals", 23, 7, """
<div class="h" style="left:160px; top:120px; font-size:52px;">Мои цели</div>
<div class="row" id="pg1" style="top:230px;"><div class="t">Раз в неделю встречаться с друзьями</div><div class="chip accent" id="pgc1" style="left:1300px; top:38px; opacity:0;">Шаг сделан</div></div>
<div class="row" id="pg2" style="top:370px;"><div class="t">Гулять после работы хотя бы 15 минут</div><div class="chip soft" id="pgc2" style="left:1300px; top:38px; opacity:0;">Было трудно</div></div>"""))
    js += 'fade("#p-goals-in", 23.0); slide("#pg1", 23.4); slide("#pg2", 23.7); fade("#pgc1", 25.4); fade("#pgc2", 27.0); out("#p-goals-in", 29.65);\n'

    plan = [("Здесь и сейчас", "Почувствовать опору и заметить окружающее", "2 мин"),
            ("Дыхание без спешки", "Несколько мягких дыхательных циклов", "2 мин"),
            ("Пять ориентиров", "Найти опору в доступных ощущениях", "3 мин")]
    rows = "\n".join(f'<div class="row pr" id="pl{i}" style="top:{230 + i * 140}px;"><div class="t" style="top:22px;">{a}</div><div class="t muted" style="left:56px; top:70px; font-size:24px; font-weight:400;">{b}</div><div class="t muted" style="left:1440px; top:40px; font-size:26px; font-weight:400;">{c}</div></div>' for i, (a, b, c) in enumerate(plan))
    segs = "".join(f'<div class="seg ps" style="left:{520 + i * 296}px; top:170px; width:280px;"></div>' for i in range(3))
    parts.append(scene("p-practice", 30, 6, f"""
<div id="pp-list">
<div class="h" style="left:160px; top:120px; font-size:52px;">Практики из плана врача</div>
{rows}
</div>
<div id="pp-step" style="opacity:0;">
<div class="panel"></div>
{segs}
<div class="t muted" style="left:520px; top:240px; font-size:26px;">Шаг 1 из 3</div>
<div class="t b" style="left:520px; top:300px; font-size:56px;">Здесь и сейчас</div>
<div class="t" style="left:520px; top:420px; font-size:40px;">Почувствуйте опору</div>
<div class="t muted" style="left:520px; top:600px; font-size:28px;">Можно остановиться на любом шаге</div>
</div>"""))
    js += ('fade("#p-practice-in", 30.0); slide("#pl0", 30.2); slide("#pl1", 30.45); slide("#pl2", 30.7);\n'
           f'tl.to("#pl0", {{ borderColor: "{ACCENT}", backgroundColor: "#edf3e9", duration: 0.25 }}, 32.0);\n'
           'out("#pp-list", 32.6, 0.3); fade("#pp-step", 32.9, 0.4);\n'
           f'tl.to(document.querySelectorAll(".ps")[0], {{ backgroundColor: "{ACCENT}", duration: 0.3 }}, 33.4);\n'
           'out("#p-practice-in", 35.65);\n')

    parts.append(scene("p-sos", 36, 7, f"""
<div class="panel"></div>
<div id="ps-confirm">
<div class="t" style="left:220px; top:220px; font-size:44px; font-weight:600;">Отправить врачу сигнал «Мне сейчас плохо»?</div>
<div class="btn" id="ps-send" style="left:220px; top:360px; width:340px; background:{SOS}; color:#ffffff;">Да, отправить</div>
<div class="btn soft" style="left:600px; top:360px; width:200px;">Отмена</div>
</div>
<div id="ps-sent" style="opacity:0;">
<div class="t b" style="left:220px; top:220px; font-size:44px;">Сигнал отправлен</div>
<div class="t" style="left:220px; top:300px; font-size:32px;">Врач получит его на почту и в уведомления</div>
<div class="t" style="left:220px; top:360px; font-size:32px;">Если вы в опасности, не ждите ответа врача</div>
<div class="btn" style="left:220px; top:450px; width:340px; border:2px solid {SOS}; color:{SOS}; background:#ffffff;">Позвонить 112</div>
</div>"""))
    js += ('fade("#p-sos-in", 36.0); tl.to("#ps-send", { scale: 0.96, duration: 0.12 }, 38.4); tl.to("#ps-send", { scale: 1, duration: 0.14 }, 38.55);\n'
           'out("#ps-confirm", 38.9, 0.3); fade("#ps-sent", 39.2, 0.5); out("#p-sos-in", 42.65);\n')

    parts.append(scene("p-goals2", 43, 6, """
<div class="h" style="left:160px; top:120px; font-size:52px;">Мои цели</div>
<div class="row" id="pk1" style="top:230px;"><div class="t">Раз в неделю встречаться с друзьями</div><div class="chip accent" id="pkc1" style="left:1260px; top:38px; opacity:0;">Цель достигнута</div></div>
<div class="row" style="top:370px;"><div class="t">Гулять после работы хотя бы 15 минут</div></div>
<div class="row" id="pk3" style="top:510px; opacity:0;"><div class="t">Ложиться до полуночи три дня в неделю</div><div class="chip soft" style="left:1320px; top:38px;">Новая цель</div></div>
<div class="t muted" id="pk-note" style="left:160px; top:670px; font-size:28px; opacity:0;">Сразу можно вести три цели</div>"""))
    js += 'fade("#p-goals2-in", 43.0); fade("#pkc1", 43.6); tl.to("#pk1", { opacity: 0.5, duration: 0.4 }, 44.8); slide("#pk3", 45.4); fade("#pk-note", 46.2); out("#p-goals2-in", 48.65);\n'

    note = "Хочу обсудить сон на этой неделе."
    chars = "".join(f'<span class="ch" style="opacity:0;">{c}</span>' for c in note)
    parts.append(scene("p-note", 49, 6, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:180px; font-size:40px;">Что хотите рассказать</div>
<div class="card" style="left:220px; top:260px; width:1400px; height:200px; border-radius:12px;"></div>
<div class="t" style="left:256px; top:290px; font-size:36px;">{chars}</div>
<div class="btn soft" id="pn-save" style="left:220px; top:510px; width:260px;">Сохранить</div>"""))
    js += 'fade("#p-note-in", 49.0);\n'
    js += 'document.querySelectorAll("#p-note .ch").forEach((c, i) => tl.set(c, { opacity: 1 }, 49.6 + i * 0.06));\n'
    js += 'fill("#pn-save", 52.4); out("#p-note-in", 54.65);\n'

    pts = [(60, 360), (240, 340), (420, 350), (600, 300), (780, 290), (960, 250), (1140, 230), (1320, 190)]
    parts.append(scene("p-history", 55, 6, f"""
<div class="panel"></div>
<div class="t b" style="left:220px; top:170px; font-size:44px;">Самочувствие по дням</div>
<div class="t muted" style="left:1100px; top:182px; width:600px; text-align:right; white-space:nowrap; font-size:24px;">От «очень тяжело» до «очень хорошо»</div>
{chart("ph", pts, left=220, top=250, w=1480, h=440)}"""))
    js += 'fade("#p-history-in", 55.0);\n' + chart_js("p-history", "ph", 55.6, 0.3).replace('"{TREND}"', "58.4") + 'out("#p-history-in", 60.65);\n'

    parts.append(scene("p-plan", 61, 5, f"""
<div class="h" style="left:160px; top:120px; font-size:52px;">План врача</div>
<div class="card" style="left:160px; top:230px; width:780px; height:520px; border-radius:20px;"></div>
<div class="t muted" style="left:200px; top:270px; font-size:26px;">Рекомендации</div>
<div class="t" id="pp-rec" style="left:200px; top:320px; width:700px; font-size:34px; opacity:0;">Прогулка 15 минут после работы, три раза в неделю.</div>
<div class="card" style="left:1000px; top:230px; width:760px; height:520px; border-radius:20px;"></div>
<div class="t b" style="left:1040px; top:270px; font-size:32px;">Назначенные препараты</div>
<div class="t muted" style="left:1040px; top:330px; width:680px; font-size:28px;">Схему приёма указывает врач. Отметки помогают обсудить пропуски и ощущения на приёме.</div>"""))
    js += 'fade("#p-plan-in", 61.0); fade("#pp-rec", 61.6); out("#p-plan-in", 65.65);\n'

    days2 = "\n".join(f'<div class="day" style="left:{160 + i * 76}px; background:{ACCENT}; border-color:{ACCENT};"></div>' for i in range(21))
    parts.append(scene("p-payoff", 66, 5, f"""
<div class="t b" style="left:160px; top:250px; font-size:30px;">Три недели между приёмами</div>
{days2}
<div class="t muted" style="left:160px; top:410px; font-size:24px;">приём</div>
<div class="t muted" style="left:1660px; top:410px; font-size:24px;">приём</div>"""))
    js += 'fade("#p-payoff-in", 66.0, 0.5); out("#p-payoff-in", 70.65);\n'

    parts.append(outro("p-outro", 71, 5))
    parts.append(brandmark(10, 71))
    js += 'fade("#brandmark-in", 10.0, 0.4); out("#brandmark-in", 70.65);\n'
    js += 'rise("#brand", 71.3, 0.6); fade("#brandsub", 72.0);\n'

    chap_html, chap_js = chapters([("День 1", 10, 17), ("Неделя 1", 17, 30), ("Неделя 2", 30, 43), ("Неделя 3", 43, 55), ("Приём", 55, 61), ("После приёма", 61, 66)])
    parts.append(chap_html)
    js += chap_js

    caps = [
        (0.4, 5.9, ["Приём закончился, следующий через три недели", "Что делать всё это время?"]),
        (6.1, 9.9, ["Между приёмами вы на связи с врачом через Рядом"]),
        (10.2, 16.9, ["Каждый день коротко отмечайте самочувствие"]),
        (17.2, 22.9, ["Врач прислал опросник", "Ответьте дома, по одному вопросу"]),
        (23.2, 29.9, ["Ставьте свои цели и отмечайте шаги", "Если было трудно, так и отметьте"]),
        (30.2, 35.9, ["Когда тревожно, выберите практику из плана врача"]),
        (36.2, 42.9, ["Если совсем плохо, отправьте врачу сигнал", "В опасности звоните 112, не ждите ответа"]),
        (43.2, 48.9, ["Можно поставить новую цель"]),
        (49.2, 54.9, ["Запишите, что хотите обсудить на приёме", "Врач увидит это до встречи"]),
        (55.2, 60.9, ["Перед приёмом врач видит вашу историю"]),
        (61.2, 65.9, ["После приёма врач может обновить план", "Новые рекомендации вы увидите у себя"]),
        (66.2, 70.9, ["Три недели позади"]),
    ]
    rows = ["Три недели до приёма, пустые дни", "Дни заполняются, «Рядом»",
            "«Как вы себя чувствуете?», сон, тревога, «Дополнительные вопросы можно пропустить»",
            "Вопрос PHQ-9 «Вам не хотелось ничего делать» и варианты ответа",
            "«Мои цели»: «Шаг сделан», «Было трудно»",
            "Практики из плана врача, выбор «Здесь и сейчас», первый шаг",
            "«Отправить врачу сигнал «Мне сейчас плохо»?», «Сигнал отправлен», «Позвонить 112»",
            "Цель достигнута, новая цель, «Сразу можно вести три цели»",
            "Поле «Что хотите рассказать», текст печатается",
            "«Самочувствие по дням» за 3 недели, линия тренда",
            "«План врача»: обновлённые рекомендации, «Назначенные препараты»",
            "Те же три недели, все дни заполнены"]
    cap_html, cap_js = captions(caps, 71)
    parts.append(cap_html)
    js += cap_js
    parts.append(audio(76, [("click", 11.4), ("click", 19.8), ("drop", 25.4), ("click", 32.0), ("click", 38.4), ("click", 52.4), ("bong", 71.2)]))
    write("patient", 76, parts, js, caps, rows, "пациента")


def poster(role, chip, title):
    """A standalone poster in the brand identity, captured to poster.jpg by posters.mjs."""
    html = HEAD.split("<style>")[0] + f"""<style>
{HEAD.split("<style>")[1].split("</style>")[0]}
.poster {{ position: absolute; left: 160px; top: 120px; bottom: 120px; width: 1000px; display: flex; flex-direction: column; }}
.poster h1 {{ font-size: 104px; font-weight: 750; letter-spacing: -3px; line-height: 1.08; margin-top: 28px; text-wrap: balance; }}
.poster .sub {{ font-size: 36px; color: {MUTED}; margin-top: 32px; }}
.poster .chip {{ position: static; align-self: flex-start; font-size: 26px; }}
</style>
</head>
<body>
<div id="root">
<div class="poster">
{lockup(44)}
<div style="height:150px;"></div>
<div class="chip soft">{chip}</div>
<h1>{title}</h1>
<div class="sub">Дневник состояния и связь с врачом</div>
</div>
<div style="position:absolute; left:1150px; top:190px;">{mark(700)}</div>
</div>
</body>
</html>
"""
    (BASE / role / "composition/poster.html").write_text(html, encoding="utf-8")


doctor()
patient()
poster("doctor", "Для врача", "Что с пациентом между приёмами?")
poster("patient", "Для пациента", "Что делать между приёмами?")
print("written")
