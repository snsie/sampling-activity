// Guide behaviour: menu, inline help, saved checklists, scenario choice, copy buttons, reset.
// Everything here is progressive enhancement: without JavaScript every page still reads in full.
import { TERMS } from "./terms.js";
import { SCENARIOS } from "./scenarios.js";

const PREFIX = "judge-the-sample:";
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(PREFIX + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; }
  },
  clear() {
    try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* storage blocked */ }
  },
};

// ---- menu (small screens)
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("site-nav");
if (toggle && nav) {
  const setOpen = (open) => { toggle.setAttribute("aria-expanded", String(open)); nav.classList.toggle("open", open); };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open") && getComputedStyle(toggle).display !== "none") { setOpen(false); toggle.focus(); }
  });
}

// ---- inline help: each "?" link to the glossary becomes a disclosure button
let helpCount = 0;
function closeHelp(btn, refocus = false) {
  const panel = document.getElementById(btn.getAttribute("aria-controls"));
  if (panel) panel.hidden = true;
  btn.setAttribute("aria-expanded", "false");
  if (refocus) btn.focus();
}
function buildHelp(btn) {
  const id = btn.dataset.help;
  const t = TERMS[id];
  const panel = document.createElement("div");
  panel.className = "help-panel";
  panel.id = btn.getAttribute("aria-controls");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", `About: ${t.term}`);
  panel.innerHTML = `<div class="help-head"><p class="help-term"></p><button type="button" class="help-close">Close</button></div>
    <p class="help-short"></p>${t.more ? '<p class="more"></p>' : ""}
    <p class="small"><a href="glossary.html#${id}">Open in the glossary</a></p>`;
  panel.querySelector(".help-term").textContent = t.term;
  panel.querySelector(".help-short").textContent = t.short;
  if (t.more) panel.querySelector(".more").textContent = t.more;
  panel.querySelector(".help-close").addEventListener("click", () => closeHelp(btn, true));
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") closeHelp(btn, true); });
  // Put the panel after the nearest block so it never breaks a sentence or a table cell's layout.
  const host = btn.closest("li, td, dd, .item-body") || btn.closest("p, h2, h3, dt, label") || btn;
  if (host.matches("li, td, dd, .item-body")) host.appendChild(panel);
  else host.insertAdjacentElement("afterend", panel);
  return panel;
}
document.querySelectorAll("a.help[data-help]").forEach((a) => {
  if (!TERMS[a.dataset.help]) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "help";
  btn.dataset.help = a.dataset.help;
  btn.setAttribute("aria-label", a.getAttribute("aria-label"));
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", `help-panel-${++helpCount}`);
  btn.innerHTML = '<span aria-hidden="true">?</span>';
  btn.addEventListener("click", () => {
    if (btn.getAttribute("aria-expanded") === "true") { closeHelp(btn); return; }
    document.querySelectorAll('button.help[aria-expanded="true"]').forEach((b) => closeHelp(b));
    const panel = document.getElementById(btn.getAttribute("aria-controls")) || buildHelp(btn);
    panel.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  });
  btn.addEventListener("keydown", (e) => { if (e.key === "Escape") closeHelp(btn); });
  a.replaceWith(btn);
});

// ---- checklists ("X of Y done", saved in this browser only)
let storageOk = true;
document.querySelectorAll("ul.checklist[data-store]").forEach((list) => {
  const key = `check:${list.dataset.store}`;
  const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
  const status = document.querySelector(`.checklist-status[data-for="${list.dataset.store}"]`);
  const saved = new Set(store.get(key, []));
  const update = () => {
    if (status) status.textContent = `${boxes.filter((b) => b.checked).length} of ${boxes.length} done${storageOk ? " · saved in this browser only" : " · this browser is not saving ticks"}`;
  };
  boxes.forEach((b) => {
    b.checked = saved.has(b.id);
    b.addEventListener("change", () => {
      storageOk = store.set(key, boxes.filter((x) => x.checked).map((x) => x.id));
      update();
    });
  });
  update();
});

// ---- reset all saved progress (ticks and scenario)
document.querySelectorAll("button[data-reset]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!window.confirm("Clear every saved tick and your scenario choice in this browser? Your files are not affected.")) return;
    store.clear();
    window.location.reload();
  });
});

// ---- scenario: header select, picker on Data & files, "Use this scenario" buttons
const select = document.querySelector("[data-scenario-select]");
const banner = document.querySelector(".scenario-banner");
function applyScenario(key) {
  const s = SCENARIOS[key];
  document.documentElement.dataset.scenario = s ? key : "";
  if (select) select.value = s ? key : "";
  document.querySelectorAll("[data-scenario-picker] input").forEach((i) => { i.checked = i.value === key; });
  document.querySelectorAll("button[data-choose]").forEach((b) => {
    const on = b.dataset.choose === key;
    b.setAttribute("aria-pressed", String(on));
    b.textContent = on ? "Your scenario" : "Use this scenario";
  });
  document.querySelectorAll("[data-sc]").forEach((el) => {
    if (!el.dataset.fallback) el.dataset.fallback = el.textContent;
    el.textContent = s ? s[el.dataset.sc] : el.dataset.fallback;
  });
  document.querySelectorAll("[data-sc-only]").forEach((el) => {
    el.hidden = Boolean(s) && !el.dataset.scOnly.split(" ").includes(key);
  });
  if (banner) {
    banner.hidden = false;
    banner.classList.toggle("unset", !s);
    banner.innerHTML = s
      ? `Showing instructions for <strong></strong> (<code></code>). Change it with the Scenario menu at the top.`
      : `No scenario chosen yet. <a href="data.html#choose">Choose one on Data &amp; files</a> or with the Scenario menu at the top; until then, prompts show placeholders and notes for all three scenarios.`;
    if (s) { banner.querySelector("strong").textContent = s.title; banner.querySelector("code").textContent = `data/${s.file}`; }
  }
}
function chooseScenario(key) { store.set("scenario", key); applyScenario(key); }
if (select) {
  select.closest("label").hidden = false;
  select.addEventListener("change", () => chooseScenario(select.value));
}
document.querySelectorAll("[data-scenario-picker] input").forEach((i) => i.addEventListener("change", () => chooseScenario(i.value)));
document.querySelectorAll("button[data-choose]").forEach((b) => b.addEventListener("click", () => chooseScenario(b.dataset.choose)));
applyScenario(store.get("scenario", ""));
if (document.body.dataset.page === "glossary" || document.body.dataset.page === "404") banner.hidden = true;

// ---- copy buttons for agent prompts (copies the scenario-adapted text)
document.querySelectorAll("pre.prompt").forEach((pre) => {
  const wrap = document.createElement("p");
  const btn = document.createElement("button");
  const status = document.createElement("span");
  btn.type = "button";
  btn.className = "copy";
  btn.textContent = "Copy prompt";
  status.className = "copy-status";
  status.setAttribute("aria-live", "polite");
  wrap.append(btn, status);
  pre.after(wrap);
  let timer;
  btn.addEventListener("click", async () => {
    const text = pre.innerText.trim();
    clearTimeout(timer);
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      status.textContent = "Copied. Paste it into your agent.";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      status.textContent = "Your browser blocked copying. The prompt is selected: press Ctrl+C (⌘C on a Mac).";
    }
    timer = setTimeout(() => { status.textContent = ""; }, 6000);
  });
});
