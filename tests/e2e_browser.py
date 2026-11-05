"""Optional browser end-to-end check of the built guide (needs Playwright + Chromium).

    npm run build && node scripts/serve.mjs 8765 --base /some-repo/ &
    python tests/e2e_browser.py http://localhost:8765/some-repo/ [screenshot-dir]

Not collected by `npm test` (file name does not start with test_), because it needs a browser.
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/some-repo/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
PATH = ["", "data.html", "setup.html", "design.html", "methods.html", "repeated.html", "sample-size.html", "challenge.html", "submit.html"]
errors = []


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        errors.append(msg)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    page = ctx.new_page()
    console = []
    page.on("console", lambda m: m.type == "error" and console.append(m.text))
    page.on("pageerror", lambda e: console.append(str(e)))

    # Previous/Next walk through the whole path, checking the current nav item on each page
    page.goto(BASE)
    for i, target in enumerate(PATH):
        cur = page.locator('.site-nav a[aria-current="page"]')
        check(cur.count() == 1, f"one current nav item on /{target}")
        if i < len(PATH) - 1:
            page.click('.pager a[rel="next"]')
            page.wait_for_load_state()
            check(page.url.endswith(PATH[i + 1]), f"Next goes to {PATH[i + 1]}")
    page.click('.pager a[rel="prev"]')
    check(page.url.endswith("challenge.html"), "Previous goes back")

    # Every download link answers 200
    page.goto(BASE + "data.html")
    hrefs = page.eval_on_selector_all("a[download]", "els => [...new Set(els.map(e => e.href))]")
    bad = [h for h in hrefs if page.request.get(h).status != 200]
    check(not bad and len(hrefs) >= 15, f"{len(hrefs)} download links all load {bad}")

    # Scenario: unset banner, choose via picker, persists across pages, fills prompts
    check("No scenario chosen" in page.inner_text(".scenario-banner"), "banner asks for a scenario")
    check(page.locator("#clinic").is_visible() and page.locator("#heart").is_visible(), "all cards visible before choosing")
    page.check('input[name="scenario-pick"][value="heart"]')
    check(page.locator("#clinic").is_hidden() and page.locator("#heart").is_visible(), "other cards hidden after choosing")
    page.goto(BASE + "design.html")
    check(page.input_value("[data-scenario-select]") == "heart", "scenario persists to another page")
    page.click(".plan-task .copy")
    clip = page.evaluate("navigator.clipboard.readText()")
    check("heart_rate_week.csv" in clip and "your CSV file" not in clip and "Stay in Plan mode" in clip, "copied Plan prompt is scenario-adapted")
    check("Copied" in page.inner_text(".plan-task .copy-status"), "copy success feedback")
    page.select_option("[data-scenario-select]", "costs")
    check("healthcare_costs.csv" in page.inner_text(".plan-task pre"), "header select switches scenario")

    # Copy fallback when the clipboard API is unavailable
    page.evaluate("Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true})")
    page.click(".agent-task .copy")
    check("blocked" in page.inner_text(".agent-task .copy-status"), "copy fallback message")
    check(len(page.evaluate("getSelection().toString()")) > 100, "copy fallback selects the prompt")

    # Checklists: tick, status, persistence
    page.check("#s2-req-1")
    status = page.inner_text('.checklist-status[data-for="s2-req"]')
    check(status.startswith("1 of 6 done"), f"checklist status: {status}")
    page.reload()
    check(page.is_checked("#s2-req-1"), "tick persists after reload")

    # Inline help: open, Escape closes and returns focus
    btn = page.locator("button.help").first
    btn.click()
    panel_id = btn.get_attribute("aria-controls")
    check(page.locator(f"#{panel_id}").is_visible(), "help panel opens")
    page.keyboard.press("Escape")
    check(page.locator(f"#{panel_id}").is_hidden(), "Escape closes help")
    check(page.evaluate("document.activeElement.classList.contains('help')"), "focus returns to help button")

    # Reset clears ticks and scenario
    page.goto(BASE + "submit.html")
    page.once("dialog", lambda d: d.accept())
    page.click("button[data-reset]")
    page.wait_for_load_state()
    page.goto(BASE + "design.html")
    check(not page.is_checked("#s2-req-1") and page.input_value("[data-scenario-select]") == "", "reset clears ticks and scenario")

    # Keyboard: first Tab reaches the skip link, which moves focus to main
    page.goto(BASE + "methods.html")
    page.keyboard.press("Tab")
    check(page.evaluate("document.activeElement.className") == "skip", "first Tab is the skip link")
    page.keyboard.press("Enter")
    check(page.evaluate("document.activeElement.id") == "main", "skip link moves focus to main")
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=SHOTS / "light-desktop.png", full_page=False)
    check(not console, f"no console errors {console}")

    # Mobile: menu hidden until toggled, no horizontal scroll
    m = browser.new_context(viewport={"width": 375, "height": 800}).new_page()
    for target in PATH + ["glossary.html"]:
        m.goto(BASE + target)
        check(m.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"no horizontal scroll at 375px: /{target}")
    m.goto(BASE + "challenge.html")
    check(m.locator("#site-nav").is_hidden(), "mobile nav starts closed")
    m.click(".menu-toggle")
    check(m.locator("#site-nav").is_visible() and m.get_attribute(".menu-toggle", "aria-expanded") == "true", "Menu opens nav")
    if SHOTS:
        m.screenshot(path=SHOTS / "mobile-menu.png")

    # Dark mode follows the system preference
    d = browser.new_context(color_scheme="dark", viewport={"width": 1280, "height": 900}).new_page()
    d.goto(BASE + "challenge.html")
    bg = d.evaluate("getComputedStyle(document.body).backgroundColor")
    check(bg == "rgb(20, 24, 25)", f"dark background {bg}")
    if SHOTS:
        d.screenshot(path=SHOTS / "dark-desktop.png")
    browser.close()

print(f"\n{len(errors)} failure(s)")
sys.exit(1 if errors else 0)
