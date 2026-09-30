"use strict";

const COLORS = [
  { id: "sand", name: "Sand", bg: "#F6E7C1", fg: "#3F3422", edge: "#C6A15B" },
  { id: "coral", name: "Koralle", bg: "#F7D1C6", fg: "#5C2E24", edge: "#E07A5F" },
  { id: "amber", name: "Amber", bg: "#F8D9A0", fg: "#4A3412", edge: "#E0A04A" },
  { id: "sage", name: "Salbei", bg: "#D5E6D2", fg: "#234033", edge: "#6FA37A" },
  { id: "teal", name: "Petrol", bg: "#C9E7E2", fg: "#123C38", edge: "#2A9D8F" },
  { id: "sky", name: "Himmel", bg: "#D3E6F6", fg: "#1A3348", edge: "#5B93C7" },
  { id: "iris", name: "Iris", bg: "#DDD7F6", fg: "#2C2754", edge: "#7A6BB5" },
  { id: "rose", name: "Rose", bg: "#F6D5E0", fg: "#532033", edge: "#D46A8A" },
  { id: "ink", name: "Tinte", bg: "#E6E3DC", fg: "#1C1B19", edge: "#5C5852" },
];

const MIN_FONT = 10;
const MAX_FONT = 96;
const FONT_FAMILIES = {
  sans: '"Segoe UI", ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  rounded: '"Trebuchet MS", "Arial Rounded MT Bold", ui-sans-serif, sans-serif',
};
const ROUTES = ["curve", "straight", "elbow"];
const DASHES = ["solid", "dashed", "dotted"];
const SAVE_KEY = "mindmap.autosave.v1";
const FLAG_KEY = "mindmap.autosave.enabled";
const FONT = '"Segoe UI", ui-sans-serif, system-ui, sans-serif';

const LEGEND = [
  {
    title: "legend.group.nodes",
    rows: [
      [["Tab"], "legend.tab"],
      [["shift", "Tab"], "legend.shiftTab"],
      [["shift", "Enter"], "legend.shiftEnter"],
      [["Enter"], "legend.enter"],
      [["Esc"], "legend.esc"],
      [["del"], "legend.del"],
      [["V"], "legend.v"],
      [["double"], "legend.double"],
      [["right", "drag"], "legend.rightDrag"],
    ],
  },
  {
    title: "legend.group.clip",
    rows: [
      [["ctrl", "C"], "legend.copy"],
      [["ctrl", "X"], "legend.cut"],
      [["ctrl", "V"], "legend.paste"],
      [["ctrl", "D"], "legend.dup"],
      [["ctrl", "A"], "legend.all"],
      [["ctrl", "click"], "legend.ctrlClick"],
      [["shift", "click"], "legend.shiftClick"],
    ],
  },
  {
    title: "legend.group.style",
    rows: [
      [["ctrl", "B"], "legend.bold"],
      [["ctrl", "I"], "legend.italic"],
      [["ctrl", "U"], "legend.underline"],
      [["ctrl", "K"], "legend.link"],
      [["ctrl", "shift", "8"], "legend.listBullet"],
      [["ctrl", "shift", "7"], "legend.listNumber"],
      [["ctrl", "+"], "legend.bigger"],
      [["ctrl", "−"], "legend.smaller"],
      [["1–9"], "legend.colors"],
    ],
  },
  {
    title: "legend.group.links",
    rows: [
      [["R"], "legend.route"],
      [["G"], "legend.dash"],
      [["P"], "legend.arrow"],
      [["port"], "legend.port"],
    ],
  },
  {
    title: "legend.group.view",
    rows: [
      [["ctrl", "N"], "legend.notes"],
      [["ctrl", "L"], "legend.legend"],
      [["?"], "legend.help"],
      [["ctrl", "0"], "legend.fit"],
      [["wheel"], "legend.wheel"],
      [["space", "drag"], "legend.spaceDrag"],
      [["arrows"], "legend.arrows"],
      [["alt", "arrows"], "legend.altArrows"],
    ],
  },
  {
    title: "legend.group.file",
    rows: [
      [["ctrl", "S"], "legend.save"],
      [["ctrl", "O"], "legend.open"],
      [["ctrl", "E"], "legend.svg"],
      [["ctrl", "P"], "legend.pdf"],
      [["ctrl", "Z"], "legend.undo"],
      [["ctrl", "Y"], "legend.redo"],
    ],
  },
];

const $ = (id) => document.getElementById(id);

const els = {};

const state = {
  title: "Brainstorming",
  nodes: {},
  edges: {},
  linkStyle: { route: "curve", dash: "solid", arrow: false },
  brush: { color: "sand", fontSize: 48, fontFamily: "sans", bold: true, italic: false, underline: false },
  view: { panX: 80, panY: 80, zoom: 1 },
  ui: { notesOpen: false },
  autoSave: true,
  sel: { nodes: [], edges: [] },
  editing: null,
  editOrigin: "",
  editPushed: false,
  editFuture: null,
  pendingEdit: null,
  connectFrom: null,
  linkDrag: null,
};

let history = [];
let future = [];
let dirty = false;
let saveTimer = 0;
let toastTimer = 0;
let spaceDown = false;
let richRange = null;
let nudgeBefore = null;
let clipboard = null;
let measureCtx = null;

function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 9);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function colorById(id) {
  return COLORS.find((c) => c.id === id) || COLORS[0];
}

function primaryNode() {
  return state.sel.nodes[state.sel.nodes.length - 1] || null;
}

function nodeEl(id) {
  return els.nodes.querySelector(`.node[data-id="${id}"]`);
}

function isTextField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function toast(message) {
  els.toast.hidden = false;
  els.toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2200);
}

function setStatus(key, vars) {
  state.ui.statusKey = key;
  state.ui.statusVars = vars || null;
  if (els.status) els.status.textContent = t(key, vars);
}

function keyLabel(token) {
  const key = `key.${token}`;
  const value = t(key);
  return value === key ? token : value;
}

function textToRichHtml(text) {
  return xml(String(text)).replaceAll("\n", "<br>");
}

function safeLink(href) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch (err) {
    return "";
  }
}

function sanitizeRichHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  for (const block of [...template.content.querySelectorAll("div, p")]) {
    if (block.previousSibling) block.before(document.createElement("br"));
    block.replaceWith(...block.childNodes);
  }
  const allowed = new Set(["BR", "B", "STRONG", "I", "EM", "U", "A", "SPAN", "UL", "OL", "LI"]);
  for (const el of [...template.content.querySelectorAll("*")].reverse()) {
    if (!allowed.has(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    if (el.tagName === "BR") {
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      continue;
    }
    if (el.tagName === "A") {
      const href = safeLink(el.getAttribute("href"));
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      if (!href) {
        el.replaceWith(...el.childNodes);
        continue;
      }
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
      continue;
    }
    if (el.tagName === "UL" || el.tagName === "OL") {
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      continue;
    }
    if (el.tagName === "LI") {
      const level = clamp(parseInt(el.dataset.level, 10) || 0, 0, MAX_LIST_INDENT);
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      el.dataset.level = String(level);
      continue;
    }
    if (el.tagName === "SPAN") {
      const size = parseInt(el.style.fontSize, 10);
      const fontWeight = el.style.fontWeight;
      const fontStyle = el.style.fontStyle;
      const decoration = el.style.textDecorationLine;
      const family = Object.entries(FONT_FAMILIES).find(([, value]) => {
        const probe = document.createElement("span");
        probe.style.fontFamily = value;
        return probe.style.fontFamily === el.style.fontFamily;
      });
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
      const styles = [];
      if (Number.isFinite(size)) styles.push(`font-size:${clamp(size, MIN_FONT, MAX_FONT)}px`);
      if (family) styles.push(`font-family:${family[1]}`);
      if (["normal", "bold", "700"].includes(fontWeight)) styles.push(`font-weight:${fontWeight}`);
      if (["normal", "italic"].includes(fontStyle)) styles.push(`font-style:${fontStyle}`);
      if (decoration === "underline") styles.push("text-decoration:underline");
      else if (decoration === "none") styles.push("text-decoration:none");
      if (!styles.length) {
        el.replaceWith(...el.childNodes);
        continue;
      }
      el.setAttribute("style", styles.join(";"));
      continue;
    }
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
  }
  normalizeLists(template.content);
  return template.innerHTML;
}

const MAX_LIST_INDENT = 2;

function normalizeLists(root) {
  for (const list of [...root.querySelectorAll("ul, ol")]) {
    for (const child of [...list.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent.trim()) child.remove();
        else {
          const li = document.createElement("li");
          li.dataset.level = "0";
          child.replaceWith(li);
          li.append(child);
        }
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.tagName !== "LI") {
        const li = document.createElement("li");
        li.dataset.level = "0";
        child.replaceWith(li);
        li.append(child);
      }
    }
    if (![...list.children].some((el) => el.tagName === "LI")) list.remove();
  }
  flattenLists(root);
  for (const li of root.querySelectorAll("li")) {
    if (!li.childNodes.length) li.append(document.createElement("br"));
    li.dataset.level = String(clamp(parseInt(li.dataset.level, 10) || 0, 0, MAX_LIST_INDENT));
  }
  renumberLists(root);
}

function flattenLists(root) {
  for (let guard = 0; guard < 8; guard += 1) {
    const nested = [...root.querySelectorAll("li > ul, li > ol")];
    if (!nested.length) break;
    for (const list of nested) {
      const parentLi = list.parentElement;
      const parentList = parentLi?.parentElement;
      const level = clamp((parseInt(parentLi?.dataset.level, 10) || 0) + 1, 0, MAX_LIST_INDENT);
      const items = [...list.children].filter((el) => el.tagName === "LI");
      if (parentList && parentList.tagName === list.tagName) {
        for (const li of items) li.dataset.level = String(level);
        parentLi.after(...items);
        list.remove();
      } else if (parentLi) {
        parentLi.after(list);
      }
    }
  }
}

function renumberLists(root) {
  if (!root) return;
  const lists = root.matches?.("ul, ol") ? [root] : [...root.querySelectorAll("ul, ol")];
  for (const list of lists) {
    if (list.parentElement?.closest?.("ul, ol")) continue;
    const counts = [0, 0, 0];
    for (const li of list.children) {
      if (li.tagName !== "LI") continue;
      const level = clamp(parseInt(li.dataset.level, 10) || 0, 0, MAX_LIST_INDENT);
      li.dataset.level = String(level);
      counts[level] += 1;
      for (let depth = level + 1; depth < counts.length; depth += 1) counts[depth] = 0;
      if (list.tagName === "UL") li.dataset.marker = "- ";
      else {
        const parts = [];
        for (let depth = 0; depth <= level; depth += 1) parts.push(counts[depth] || 1);
        li.dataset.marker = `${parts.join(".")}. `;
      }
    }
  }
}

function listItemIsEmpty(li) {
  if (li.querySelector("ul li, ol li")) return false;
  return !li.textContent.replace(/\u200b/g, "").trim();
}

function pruneRichHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = sanitizeRichHtml(html);
  for (let guard = 0; guard < 6; guard += 1) {
    let changed = false;
    for (const li of [...template.content.querySelectorAll("li")]) {
      if (!listItemIsEmpty(li)) continue;
      li.remove();
      changed = true;
    }
    for (const list of [...template.content.querySelectorAll("ul, ol")]) {
      if (list.querySelector("li")) continue;
      list.remove();
      changed = true;
    }
    if (!changed) break;
  }
  while (template.content.lastChild && (
    template.content.lastChild.nodeName === "BR"
    || (template.content.lastChild.nodeType === Node.TEXT_NODE && !template.content.lastChild.textContent.trim())
  )) {
    template.content.lastChild.remove();
  }
  return template.innerHTML;
}

function presentRichHtml(html) {
  const css = [
    "ul,ol{list-style:none;margin:0.12em 0;padding:0}",
    "li{display:block;padding-left:0.15em}",
    "li[data-level='1']{padding-left:1.35em}",
    "li[data-level='2']{padding-left:2.55em}",
    "li[data-marker]::before{content:attr(data-marker)}",
  ].join("");
  return `<style>${css}</style>${sanitizeRichHtml(html)}`;
}

function richHtmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = sanitizeRichHtml(html);
  return inlineToText(div).replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
}

function inlineToText(root) {
  let out = "";
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent;
    else if (node.nodeName === "BR") out += "\n";
    else if (node.nodeName === "UL" || node.nodeName === "OL") {
      if (out && !out.endsWith("\n")) out += "\n";
      out += listToText(node);
    } else out += inlineToText(node);
  }
  return out;
}

function listToText(list) {
  let out = "";
  for (const li of list.children) {
    if (li.tagName !== "LI") continue;
    const own = document.createElement("div");
    for (const child of li.childNodes) {
      if (child.nodeName === "UL" || child.nodeName === "OL") continue;
      own.append(child.cloneNode(true));
    }
    const item = inlineToText(own).replace(/^\n+|\n+$/g, "").trim();
    if (!item) continue;
    const level = clamp(parseInt(li.dataset.level, 10) || 0, 0, MAX_LIST_INDENT);
    const prefix = li.dataset.marker || (list.tagName === "OL" ? "1. " : "- ");
    const pad = "  ".repeat(level);
    out += `${pad}${prefix}${item.replaceAll("\n", `\n${pad}   `)}\n`;
  }
  return out;
}

function serializeContent() {
  const nodes = {};
  for (const id of Object.keys(state.nodes).sort()) {
    const n = state.nodes[id];
    nodes[id] = {
      id: n.id,
      text: n.text,
      richText: n.richText || textToRichHtml(n.text),
      x: n.x,
      y: n.y,
      color: n.color,
      fontSize: n.fontSize,
      fontFamily: n.fontFamily || "sans",
      bold: !!n.bold,
      italic: !!n.italic,
      underline: !!n.underline,
      note: n.note || "",
    };
  }
  const edges = {};
  for (const id of Object.keys(state.edges).sort()) {
    const e = state.edges[id];
    edges[id] = {
      id: e.id,
      from: e.from,
      to: e.to,
      route: e.route,
      dash: e.dash,
      arrow: !!e.arrow,
    };
  }
  return JSON.stringify({
    title: state.title,
    nodes,
    edges,
    linkStyle: { ...state.linkStyle },
    brush: { ...state.brush },
  });
}

function pushHistory(snapshot = serializeContent()) {
  if (history[history.length - 1] === snapshot) return;
  history.push(snapshot);
  if (history.length > 100) history.shift();
  future = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  els.undo.disabled = history.length === 0;
  els.redo.disabled = future.length === 0;
}

function captureBrush(node) {
  if (!node) return;
  state.brush = {
    color: node.color,
    fontSize: node.fontSize,
    fontFamily: node.fontFamily || "sans",
    bold: !!node.bold,
    italic: !!node.italic,
    underline: !!node.underline,
  };
}

function makeNode(id, text, x, y, style) {
  const src = style || state.brush;
  return {
    id,
    text,
    x,
    y,
    w: 160,
    h: 48,
    color: src.color || "sand",
    fontSize: clamp(src.fontSize ?? 16, MIN_FONT, MAX_FONT),
    fontFamily: FONT_FAMILIES[src.fontFamily] ? src.fontFamily : "sans",
    bold: !!src.bold,
    italic: !!src.italic,
    underline: !!src.underline,
    richText: textToRichHtml(text),
    note: "",
  };
}

function mutate(fn) {
  pushHistory();
  fn();
  commit();
}

function commit() {
  dirty = true;
  renderAll();
  if (state.pendingEdit && state.nodes[state.pendingEdit]) {
    const node = state.nodes[state.pendingEdit];
    avoidOverlap(node);
    const el = nodeEl(node.id);
    if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;
    drawEdges();
  }
  scheduleSave();
  updateHistoryButtons();
  if (state.pendingEdit) {
    const id = state.pendingEdit;
    state.pendingEdit = null;
    startEdit(id);
    const node = state.nodes[id];
    if (node) revealNode(node);
  }
}

function applyContent(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  state.title = data.title || t("node.untitled");
  state.nodes = data.nodes || {};
  state.edges = data.edges || {};
  state.linkStyle = data.linkStyle || { route: "curve", dash: "solid", arrow: false };
  state.brush = data.brush || state.brush;
  for (const n of Object.values(state.nodes)) {
    n.w = n.w || 160;
    n.h = n.h || 48;
    n.note = n.note || "";
    n.fontFamily = FONT_FAMILIES[n.fontFamily] ? n.fontFamily : "sans";
    n.richText = sanitizeRichHtml(n.richText || textToRichHtml(n.text || ""));
    n.text = richHtmlToText(n.richText);
  }
  state.editing = null;
  pruneSelection();
  els.title.value = state.title;
  document.title = `${state.title} · Nodora`;
  renderAll();
  updateHistoryButtons();
}

function pruneSelection() {
  state.sel.nodes = state.sel.nodes.filter((id) => state.nodes[id]);
  state.sel.edges = state.sel.edges.filter((id) => state.edges[id]);
  if (state.connectFrom && !state.nodes[state.connectFrom]) clearConnect();
}

function undo() {
  if (!history.length) return;
  future.push(serializeContent());
  applyContent(history.pop());
  scheduleSave();
}

function redo() {
  if (!future.length) return;
  history.push(serializeContent());
  applyContent(future.pop());
  scheduleSave();
}

function persistObject() {
  return {
    version: 1,
    title: state.title,
    nodes: state.nodes,
    edges: state.edges,
    linkStyle: state.linkStyle,
    brush: state.brush,
    view: state.view,
    notesOpen: state.ui.notesOpen,
  };
}

function saveLocal() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(persistObject()));
    localStorage.setItem(FLAG_KEY, state.autoSave ? "1" : "0");
    dirty = false;
    const now = new Date();
    const stamp = now.toLocaleTimeString(LANG_LOCALE[uiLang] || "en-GB", { hour: "2-digit", minute: "2-digit" });
    setStatus("status.saved", { time: stamp });
  } catch (err) {
    setStatus("status.storageFail");
  }
}

function scheduleSave() {
  if (!state.autoSave) {
    setStatus(dirty ? "status.unsaved" : "status.autosaveOff");
    return;
  }
  setStatus("status.saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 350);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.nodes || !data.edges) return null;
    return normalizeFile(data);
  } catch (err) {
    return null;
  }
}

function normalizeFile(data) {
  const nodes = {};
  for (const n of Object.values(data.nodes || {})) {
    if (!n || !n.id) continue;
    const node = makeNode(String(n.id), String(n.text ?? t("node.untitled")), Number(n.x) || 0, Number(n.y) || 0, n);
    node.note = String(n.note ?? "");
    node.fontFamily = FONT_FAMILIES[n.fontFamily] ? n.fontFamily : "sans";
    node.richText = pruneRichHtml(n.richText || textToRichHtml(node.text));
    node.text = richHtmlToText(node.richText);
    node.fontSize = clamp(Number(n.fontSize) || 16, MIN_FONT, MAX_FONT);
    node.color = COLORS.some((c) => c.id === n.color) ? n.color : "sand";
    nodes[node.id] = node;
  }
  const edges = {};
  for (const e of Object.values(data.edges || {})) {
    if (!e || !nodes[e.from] || !nodes[e.to] || e.from === e.to) continue;
    const id = String(e.id || uid("e"));
    edges[id] = {
      id,
      from: e.from,
      to: e.to,
      route: ROUTES.includes(e.route) ? e.route : "curve",
      dash: DASHES.includes(e.dash) ? e.dash : "solid",
      arrow: !!e.arrow,
    };
  }
  const link = data.linkStyle || {};
  return {
    version: 1,
    title: String(data.title || t("defaultTitle")),
    nodes,
    edges,
    linkStyle: {
      route: ROUTES.includes(link.route) ? link.route : "curve",
      dash: DASHES.includes(link.dash) ? link.dash : "solid",
      arrow: !!link.arrow,
    },
    brush: data.brush || { color: "sand", fontSize: 48, fontFamily: "sans", bold: false, italic: false, underline: false },
    view: data.view || { panX: 80, panY: 80, zoom: 1 },
    notesOpen: !!data.notesOpen,
  };
}

function applyPersist(data) {
  state.title = data.title;
  state.nodes = data.nodes;
  state.edges = data.edges;
  state.linkStyle = data.linkStyle;
  state.brush = data.brush;
  state.view = {
    panX: Number(data.view?.panX) || 0,
    panY: Number(data.view?.panY) || 0,
    zoom: clamp(Number(data.view?.zoom) || 1, 0.35, 2.2),
  };
  setNotesOpen(!!data.notesOpen, { focus: false, silent: true });
  const first = Object.keys(state.nodes)[0];
  state.sel = { nodes: first ? [first] : [], edges: [] };
  els.title.value = state.title;
  document.title = `${state.title} · Nodora`;
  renderAll();
}

function initDefault() {
  const id = uid("n");
  state.nodes = {};
  state.edges = {};
  state.nodes[id] = makeNode(id, t("node.root"), 0, 0, {
    color: "sand",
    fontSize: 48,
    bold: true,
    italic: false,
    underline: false,
  });
  state.title = t("defaultTitle");
  state.sel = { nodes: [id], edges: [] };
  captureBrush(state.nodes[id]);
  els.title.value = state.title;
  document.title = `${state.title} · Nodora`;
}

function fileSlug() {
  const s = (state.title || "nodora")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "nodora";
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function saveFile() {
  if (state.editing) finishEdit();
  saveLocal();
  download(`${fileSlug()}.nodora.json`, JSON.stringify(persistObject(), null, 2), "application/json");
  toast(t("toast.saved"));
}

function openFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = normalizeFile(JSON.parse(String(reader.result)));
      if (!Object.keys(data.nodes).length) throw new Error("leer");
      if (!confirm(t("confirm.open"))) return;
      history = [];
      future = [];
      applyPersist(data);
      dirty = true;
      scheduleSave();
      toast(t("toast.opened"));
    } catch (err) {
      toast(t("toast.badFile"));
    }
  };
  reader.readAsText(file);
}

function newMap() {
  if (!confirm(t("confirm.new"))) return;
  history = [];
  future = [];
  state.connectFrom = null;
  document.body.classList.remove("is-connecting");
  initDefault();
  renderAll();
  requestAnimationFrame(() => fit({ save: true }));
  toast(t("toast.newMap"));
}

function setNotesOpen(open, { focus = false, silent = false } = {}) {
  state.ui.notesOpen = open;
  els.workspace.classList.toggle("notes-open", open);
  els.notes.hidden = !open;
  els.btnNotes.setAttribute("aria-pressed", String(open));
  renderAll();
  if (!silent) scheduleSave();
  if (focus && open && primaryNode()) els.notesInput.focus();
}

function toggleLegend(force) {
  const open = force === undefined ? els.legend.hidden : force;
  els.legend.hidden = !open;
  if (open) els.legendClose.focus();
}

function clearConnect() {
  state.connectFrom = null;
  document.body.classList.remove("is-connecting");
  els.banner.hidden = true;
  renderAll();
}

function beginConnect() {
  const id = primaryNode();
  if (!id) {
    toast(t("toast.selectFirst"));
    return;
  }
  state.connectFrom = id;
  document.body.classList.add("is-connecting");
  els.banner.hidden = false;
  renderAll();
}

function selectedNodeList() {
  return state.sel.nodes.map((id) => state.nodes[id]).filter(Boolean);
}

function refreshSelection() {
  for (const el of els.nodes.children) {
    const id = el.dataset.id;
    el.classList.toggle("is-selected", state.sel.nodes.includes(id));
    el.classList.toggle("is-connect-source", state.connectFrom === id);
  }
  drawEdges();
  syncInspector();
  syncNotes();
}

function selectOnlyNode(id) {
  state.sel = { nodes: [id], edges: [] };
  captureBrush(state.nodes[id]);
  refreshSelection();
}

function clearSelection() {
  state.sel = { nodes: [], edges: [] };
  refreshSelection();
}

function renderAll() {
  syncNodes();
  measureAll();
  drawEdges();
  applyView();
  syncInspector();
  syncNotes();
  els.empty.hidden = Object.keys(state.nodes).length > 0;
}

function syncNodes() {
  const seen = new Set();
  for (const node of Object.values(state.nodes)) {
    seen.add(node.id);
    let el = nodeEl(node.id);
    if (!el) {
      el = createNodeElement(node.id);
      els.nodes.appendChild(el);
    }
    updateNodeElement(el, node);
  }
  for (const el of [...els.nodes.children]) {
    if (!seen.has(el.dataset.id)) el.remove();
  }
}

function createNodeElement(id) {
  const el = document.createElement("div");
  el.className = "node just-added";
  el.dataset.id = id;
  el.innerHTML = `
    <span class="accent"></span>
    <div class="label"></div>
    <button type="button" class="port" aria-label="${xml(t("aria.port"))}"></button>
    <button type="button" class="note-dot" aria-label="${xml(t("aria.note"))}" hidden></button>
    <div class="note-card" hidden></div>
  `;
  el.addEventListener("pointerdown", onNodePointerDown);
  el.addEventListener("click", (e) => {
    const link = e.target.closest(".label a");
    if (link && !e.target.closest(".editor")) {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, "_blank", "noopener,noreferrer");
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey) e.preventDefault();
  });
  el.addEventListener("dblclick", (e) => {
    if (typeof e.target?.closest === "function" && e.target.closest(".port, .note-dot, .note-card")) return;
    e.preventDefault();
    e.stopPropagation();
    startEdit(id);
  });
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!state.sel.nodes.includes(id)) selectOnlyNode(id);
    openNodeMenu(e.clientX, e.clientY, id);
  });
  el.querySelector(".port").addEventListener("pointerdown", (e) => startLinkDrag(e, id));
  el.querySelector(".note-dot").addEventListener("pointerdown", (e) => e.stopPropagation());
  el.querySelector(".note-dot").addEventListener("click", (e) => {
    e.stopPropagation();
    selectOnlyNode(id);
    setNotesOpen(true, { focus: true });
  });
  const card = el.querySelector(".note-card");
  card.addEventListener("pointerdown", (e) => e.stopPropagation());
  card.addEventListener("click", (e) => {
    e.stopPropagation();
    selectOnlyNode(id);
    setNotesOpen(true, { focus: true });
  });
  return el;
}

function updateNodeElement(el, node) {
  const color = colorById(node.color);
  el.style.setProperty("--fs", `${node.fontSize}px`);
  el.style.setProperty("--ff", FONT_FAMILIES[node.fontFamily] || FONT_FAMILIES.sans);
  el.style.setProperty("--edge", color.edge);
  el.style.background = color.bg;
  el.style.color = color.fg;
  el.style.transform = `translate(${node.x}px, ${node.y}px)`;
  el.classList.toggle("is-bold", !!node.bold);
  el.classList.toggle("is-italic", !!node.italic);
  el.classList.toggle("is-underline", !!node.underline);
  el.classList.toggle("is-selected", state.sel.nodes.includes(node.id));
  el.classList.toggle("is-connect-source", state.connectFrom === node.id);
  const label = el.querySelector(".label");
  if (!label.querySelector(".editor")) label.innerHTML = sanitizeRichHtml(node.richText || textToRichHtml(node.text));
  const card = el.querySelector(".note-card");
  const hasNote = !!node.note.trim();
  const showCard = state.ui.notesOpen && hasNote && state.sel.nodes.length === 1 && state.sel.nodes[0] === node.id;
  card.textContent = node.note;
  card.hidden = !showCard;
  el.querySelector(".note-dot").hidden = !hasNote || showCard;
}

function measureAll() {
  for (const node of Object.values(state.nodes)) measureNode(node.id);
}

function measureNode(id) {
  const node = state.nodes[id];
  const el = nodeEl(id);
  if (!node || !el) return;
  node.w = el.offsetWidth;
  node.h = el.offsetHeight;
}

function childPosition(parent) {
  const kids = Object.values(state.edges)
    .filter((e) => e.from === parent.id)
    .map((e) => state.nodes[e.to])
    .filter(Boolean);
  const x = parent.x + (parent.w || 160) + 78;
  if (!kids.length) return { x, y: parent.y };
  const lowest = kids.reduce((m, n) => Math.max(m, n.y + (n.h || 48)), -Infinity);
  return { x, y: lowest + 18 };
}

function avoidOverlap(node) {
  const others = Object.values(state.nodes).filter((n) => n.id !== node.id);
  for (let i = 0; i < 24; i += 1) {
    const hit = others.find((o) => boxesHit(node, o, 12));
    if (!hit) return;
    node.y = hit.y + hit.h + 16;
  }
}

function boxesHit(a, b, gap) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

function createChild(parentId, styleFrom) {
  const parent = state.nodes[parentId];
  if (!parent) return;
  const style = styleFrom || parent;
  mutate(() => {
    const id = uid("n");
    const pos = childPosition(parent);
    const node = makeNode(id, t("node.new"), pos.x, pos.y, style);
    if (!styleFrom) node.fontSize = clamp(parent.fontSize - 4, MIN_FONT, MAX_FONT);
    state.nodes[id] = node;
    const eid = uid("e");
    state.edges[eid] = {
      id: eid,
      from: parent.id,
      to: id,
      route: state.linkStyle.route,
      dash: state.linkStyle.dash,
      arrow: state.linkStyle.arrow,
    };
    state.sel = { nodes: [id], edges: [] };
    captureBrush(node);
    state.pendingEdit = id;
  });
}

function createSibling(id) {
  const incoming = Object.values(state.edges).find((e) => e.to === id);
  if (!incoming) {
    createChild(id);
    return;
  }
  createChild(incoming.from, state.nodes[id]);
}

function eventOnMapItem(e) {
  if (typeof e.target?.closest === "function" && e.target.closest(".node")) return true;
  if (e.target?.dataset?.edge) return true;
  return e.composedPath().some((node) => node.classList?.contains("node") || node.dataset?.edge);
}

function createFree(clientX, clientY) {
  const p = clientToWorld(clientX, clientY);
  mutate(() => {
    const id = uid("n");
    state.nodes[id] = makeNode(id, t("node.new"), p.x - 40, p.y - 20, state.brush);
    state.sel = { nodes: [id], edges: [] };
    state.pendingEdit = id;
  });
}

function addEdge(from, to) {
  if (!from || !to || from === to) return;
  if (Object.values(state.edges).some((e) => e.from === from && e.to === to)) {
    toast(t("toast.edgeExists"));
    drawEdges();
    return;
  }
  mutate(() => {
    const id = uid("e");
    state.edges[id] = {
      id,
      from,
      to,
      route: state.linkStyle.route,
      dash: state.linkStyle.dash,
      arrow: state.linkStyle.arrow,
    };
    state.sel = { nodes: [], edges: [id] };
  });
}

function deleteSelection() {
  if (!state.sel.nodes.length && !state.sel.edges.length) return;
  mutate(() => {
    for (const id of state.sel.nodes) {
      delete state.nodes[id];
      for (const e of Object.values(state.edges)) {
        if (e.from === id || e.to === id) delete state.edges[e.id];
      }
    }
    for (const id of state.sel.edges) delete state.edges[id];
    state.sel = { nodes: [], edges: [] };
  });
}

function cloneNodes(ids, offset) {
  const map = {};
  const chosen = ids.filter((id) => state.nodes[id]);
  for (const id of chosen) {
    const n = state.nodes[id];
    const nid = uid("n");
    map[id] = nid;
    state.nodes[nid] = {
      ...n,
      id: nid,
      x: n.x + offset,
      y: n.y + offset,
      note: n.note,
    };
  }
  for (const e of Object.values(state.edges)) {
    if (map[e.from] && map[e.to]) {
      const id = uid("e");
      state.edges[id] = { ...e, id, from: map[e.from], to: map[e.to] };
    }
  }
  state.sel = { nodes: Object.values(map), edges: [] };
}

function copySelection() {
  const ids = state.sel.nodes.filter((id) => state.nodes[id]);
  if (!ids.length) return;
  const idSet = new Set(ids);
  clipboard = {
    nodes: ids.map((id) => ({ ...state.nodes[id] })),
    edges: Object.values(state.edges)
      .filter((e) => idSet.has(e.from) && idSet.has(e.to))
      .map((e) => ({ ...e })),
  };
  toast(ids.length === 1 ? t("toast.copied") : t("toast.copiedMany", { n: ids.length }));
}

function pasteSelection() {
  if (!clipboard?.nodes?.length) return;
  mutate(() => {
    const map = {};
    for (const n of clipboard.nodes) {
      const id = uid("n");
      map[n.id] = id;
      state.nodes[id] = { ...n, id, x: n.x + 36, y: n.y + 36 };
    }
    for (const e of clipboard.edges) {
      if (!map[e.from] || !map[e.to]) continue;
      const id = uid("e");
      state.edges[id] = { ...e, id, from: map[e.from], to: map[e.to] };
    }
    state.sel = { nodes: Object.values(map), edges: [] };
    clipboard = {
      nodes: clipboard.nodes.map((n) => ({ ...n, x: n.x + 36, y: n.y + 36 })),
      edges: clipboard.edges.map((e) => ({ ...e })),
    };
  });
}

function duplicateSelection() {
  if (!state.sel.nodes.length) return;
  const ids = [...state.sel.nodes];
  mutate(() => cloneNodes(ids, 36));
}

function cutSelection() {
  if (!state.sel.nodes.length) return;
  copySelection();
  deleteSelection();
}

function patchNodes(patch) {
  const ids = [...state.sel.nodes];
  if (!ids.length) return;
  mutate(() => {
    for (const id of ids) Object.assign(state.nodes[id], patch);
    captureBrush(state.nodes[ids[ids.length - 1]]);
  });
}

function toggleFlag(flag) {
  if (state.editing) {
    const command = flag === "bold" ? "bold" : flag === "italic" ? "italic" : "underline";
    if (applyInlineCommand(command)) return;
  }
  const ids = state.sel.nodes;
  if (!ids.length) return;
  const allOn = ids.every((id) => state.nodes[id][flag]);
  patchNodes({ [flag]: !allOn });
}

function bumpFont(delta) {
  if (state.editing) {
    const node = state.nodes[state.editing];
    const current = parseInt(getComputedStyle(activeEditor()).fontSize, 10) || node.fontSize;
    if (applyInlineFontSize(clamp(current + delta, MIN_FONT, MAX_FONT))) return;
  }
  const ids = state.sel.nodes;
  if (!ids.length) return;
  mutate(() => {
    for (const id of ids) {
      state.nodes[id].fontSize = clamp(state.nodes[id].fontSize + delta, MIN_FONT, MAX_FONT);
    }
    captureBrush(state.nodes[ids[ids.length - 1]]);
  });
}

function setColor(color) {
  if (!state.sel.nodes.length) return;
  patchNodes({ color });
}

function setFontFamily(family) {
  if (state.editing && applyInlineFontFamily(family)) return;
  if (!state.sel.nodes.length || !FONT_FAMILIES[family]) return;
  patchNodes({ fontFamily: family });
}

function activeLinkTarget() {
  if (state.sel.edges.length) {
    return state.sel.edges.map((id) => state.edges[id]).filter(Boolean);
  }
  return null;
}

function applyLinkPatch(patch) {
  const edges = activeLinkTarget();
  if (edges) {
    mutate(() => {
      for (const e of edges) Object.assign(e, patch);
    });
    return;
  }
  mutate(() => Object.assign(state.linkStyle, patch));
}

function cycleRoute() {
  const edges = activeLinkTarget();
  const current = edges ? edges[0].route : state.linkStyle.route;
  const next = ROUTES[(ROUTES.indexOf(current) + 1) % ROUTES.length];
  applyLinkPatch({ route: next });
}

function cycleDash() {
  const edges = activeLinkTarget();
  const current = edges ? edges[0].dash : state.linkStyle.dash;
  const next = DASHES[(DASHES.indexOf(current) + 1) % DASHES.length];
  applyLinkPatch({ dash: next });
}

function toggleArrow() {
  const edges = activeLinkTarget();
  const current = edges ? edges.every((e) => e.arrow) : state.linkStyle.arrow;
  applyLinkPatch({ arrow: !current });
}

function activeEditor() {
  if (!state.editing) return null;
  return nodeEl(state.editing)?.querySelector(".editor") || null;
}

function rememberRichRange() {
  const editor = activeEditor();
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) richRange = range.cloneRange();
}

function restoreRichRange() {
  const editor = activeEditor();
  if (!editor || !richRange || !editor.contains(richRange.commonAncestorContainer)) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(richRange);
  editor.focus();
  return true;
}

function selectedEditorRange() {
  const editor = activeEditor();
  if (!editor || !restoreRichRange()) return null;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range : null;
}

function wrapRichSelection(styles) {
  const editor = activeEditor();
  const range = selectedEditorRange();
  if (!editor || !range || range.collapsed) return false;
  const span = document.createElement("span");
  Object.assign(span.style, styles);
  span.append(range.extractContents());
  range.insertNode(span);
  const next = document.createRange();
  next.selectNodeContents(span);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(next);
  richRange = next.cloneRange();
  syncRichEditor(editor, true);
  return true;
}

const CARET_MARK = "\u2063";

function bookmarkCaret(editor) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  if (range.startContainer !== editor && !editor.contains(range.startContainer)) return false;
  range.insertNode(document.createTextNode(CARET_MARK));
  return true;
}

function restoreCaretBookmark(editor) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const at = node.textContent.indexOf(CARET_MARK);
    if (at >= 0) {
      const parent = node.parentNode;
      const index = [...parent.childNodes].indexOf(node);
      node.textContent = node.textContent.replace(CARET_MARK, "");
      const range = document.createRange();
      if (node.textContent) range.setStart(node, Math.min(at, node.textContent.length));
      else {
        node.remove();
        range.setStart(parent, Math.min(index, parent.childNodes.length));
      }
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      richRange = range.cloneRange();
      return;
    }
    node = walker.nextNode();
  }
}

function normalizeEditorMarkup(editor, preserveDom = false) {
  for (const font of [...editor.querySelectorAll("font")]) {
    const span = document.createElement("span");
    const size = font.getAttribute("size");
    if (size === "7") span.style.fontSize = `${editor.dataset.pendingSize || 16}px`;
    if (font.face) span.style.fontFamily = font.face;
    span.append(...font.childNodes);
    font.replaceWith(span);
  }
  const marked = bookmarkCaret(editor);
  const sanitized = sanitizeRichHtml(editor.innerHTML);
  const clean = sanitized.replaceAll(CARET_MARK, "");
  const live = editor.innerHTML.replaceAll(CARET_MARK, "");
  if (!preserveDom && live !== clean) editor.innerHTML = marked ? sanitized : clean;
  if (marked) restoreCaretBookmark(editor);
  return clean;
}

function syncRichEditor(editor, preserveDom = false) {
  const id = state.editing;
  const node = id ? state.nodes[id] : null;
  if (!node || !editor) return;
  node.richText = normalizeEditorMarkup(editor, preserveDom);
  renumberLists(editor);
  node.text = richHtmlToText(node.richText);
  measureNode(id);
  drawEdges();
  scheduleSave();
  syncNotes();
  rememberRichRange();
}

function applyInlineCommand(command, value = null) {
  const editor = activeEditor();
  if (!editor) return false;
  if (["bold", "italic", "underline"].includes(command)) {
    const enabled = document.queryCommandState(command);
    const styles = command === "bold"
      ? { fontWeight: enabled ? "normal" : "bold" }
      : command === "italic"
        ? { fontStyle: enabled ? "normal" : "italic" }
        : { textDecoration: enabled ? "none" : "underline" };
    if (wrapRichSelection(styles)) return true;
  }
  restoreRichRange();
  document.execCommand(command, false, value);
  syncRichEditor(editor, true);
  return true;
}

function applyInlineFontSize(size) {
  const editor = activeEditor();
  if (!editor) return false;
  if (wrapRichSelection({ fontSize: `${size}px` })) return true;
  editor.dataset.pendingSize = String(size);
  return applyInlineCommand("fontSize", "7");
}

function applyInlineFontFamily(id) {
  const editor = activeEditor();
  if (!editor || !FONT_FAMILIES[id]) return false;
  if (wrapRichSelection({ fontFamily: FONT_FAMILIES[id] })) return true;
  return applyInlineCommand("fontName", FONT_FAMILIES[id]);
}

function addHyperlink() {
  const editor = activeEditor();
  if (!editor) {
    toast(t("link.editFirst"));
    return;
  }
  restoreRichRange();
  const selection = window.getSelection();
  const selected = selection?.toString().trim() || "";
  const entered = prompt(t("link.prompt"), /^https?:\/\//i.test(selected) ? selected : "https://");
  if (entered === null) return;
  const href = safeLink(entered);
  if (!href) {
    toast(t("link.invalid"));
    return;
  }
  const range = selectedEditorRange();
  if (range && !range.collapsed) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.append(range.extractContents());
    range.insertNode(anchor);
    const next = document.createRange();
    next.selectNodeContents(anchor);
    selection.removeAllRanges();
    selection.addRange(next);
    richRange = next.cloneRange();
  } else {
    document.execCommand("insertHTML", false, `<a href="${xml(href)}" target="_blank" rel="noopener noreferrer">${xml(selected || href)}</a>`);
  }
  syncRichEditor(editor, true);
}

function closestItem(node, editor) {
  const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const li = el?.closest?.("li");
  return li && editor.contains(li) ? li : null;
}

function closestList(node, editor) {
  const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const list = el?.closest?.("ul, ol");
  return list && editor.contains(list) ? list : null;
}

function sharedList(editor, range) {
  const start = closestList(range.startContainer, editor);
  const end = closestList(range.endContainer, editor);
  if (start && start === end) return start;
  if (range.startContainer === editor && range.endContainer === editor) {
    const kids = [...editor.childNodes].filter((node) => node.nodeType !== Node.TEXT_NODE || node.textContent.trim());
    if (kids.length === 1 && (kids[0].nodeName === "UL" || kids[0].nodeName === "OL")) return kids[0];
  }
  return null;
}

function setEditorRange(range) {
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  richRange = range.cloneRange();
}

function placeCaretIn(el, atStart) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(atStart);
  setEditorRange(range);
  el.closest(".editor")?.focus();
}

function placeCaretAfterNode(node) {
  if (!node?.parentNode) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  setEditorRange(range);
}

function currentEditorRange() {
  const editor = activeEditor();
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range : null;
}

function atItemStart(li, range) {
  if (!range.collapsed || (range.startContainer !== li && !li.contains(range.startContainer))) return false;
  const probe = document.createRange();
  probe.setStart(li, 0);
  probe.setEnd(range.startContainer, range.startOffset);
  if (probe.toString().replace(/\u200b/g, "")) return false;
  for (const el of probe.cloneContents().querySelectorAll("*")) {
    if (el.tagName !== "BR") return false;
  }
  return true;
}

function fillList(list, nodes) {
  let li = document.createElement("li");
  const commit = () => {
    if (!li.childNodes.length) li.append(document.createElement("br"));
    li.dataset.level = li.dataset.level || "0";
    list.append(li);
    li = document.createElement("li");
  };
  for (const node of nodes) {
    if (node.nodeName === "BR") {
      commit();
      continue;
    }
    if (node.nodeName === "UL" || node.nodeName === "OL") {
      if (li.childNodes.length) commit();
      for (const child of [...node.children]) {
        if (child.tagName === "LI") list.append(child);
      }
      continue;
    }
    li.append(node);
  }
  if (li.childNodes.length || !list.children.length) commit();
}

function unwrapList(list) {
  const frag = document.createDocumentFragment();
  const items = [...list.children].filter((el) => el.tagName === "LI");
  items.forEach((li, index) => {
    if (index) frag.append(document.createElement("br"));
    if (!listItemIsEmpty(li)) frag.append(...li.childNodes);
  });
  if (!frag.childNodes.length) frag.append(document.createElement("br"));
  const anchor = frag.lastChild;
  list.replaceWith(frag);
  return anchor;
}

function coveredChildRange(editor, range) {
  const kids = [...editor.childNodes];
  if (!kids.length) return { from: 0, to: -1 };
  const indexOf = (container) => {
    if (container === editor) return null;
    let node = container.nodeType === Node.ELEMENT_NODE ? container : container.parentNode;
    while (node && node.parentNode !== editor) node = node.parentNode;
    return node ? kids.indexOf(node) : 0;
  };
  let from = indexOf(range.startContainer);
  let to = indexOf(range.endContainer);
  if (from === null) from = range.startOffset;
  if (to === null) to = range.collapsed ? range.endOffset : range.endOffset - 1;
  if (from >= kids.length) return { from: kids.length, to: kids.length - 1 };
  from = clamp(from, 0, kids.length - 1);
  to = clamp(to, from, kids.length - 1);
  if (range.collapsed && kids[from]?.nodeName === "BR" && from > 0 && !isListBreak(kids[from - 1])) {
    from -= 1;
    to = from;
  }
  while (from > 0 && !isListBreak(kids[from - 1]) && !isListBreak(kids[from])) from -= 1;
  while (to + 1 < kids.length && !isListBreak(kids[to]) && !isListBreak(kids[to + 1])) to += 1;
  return { from, to };
}

function isListBreak(node) {
  return !node || node.nodeName === "BR" || node.nodeName === "UL" || node.nodeName === "OL";
}

function listShortcutKind(e) {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return "";
  if (e.code === "Digit8" || e.code === "Numpad8") return "ul";
  if (e.code === "Digit7" || e.code === "Numpad7") return "ol";
  return "";
}

function applyList(kind) {
  if (!state.editing) {
    const id = primaryNode();
    if (!id) {
      toast(t("list.editFirst"));
      return;
    }
    startEdit(id);
  }
  const editor = activeEditor();
  const range = selectedEditorRange();
  if (!editor || !range) return;
  const existing = sharedList(editor, range);
  if (existing) {
    if (existing.tagName.toLowerCase() === kind) {
      const anchor = unwrapList(existing);
      placeCaretAfterNode(anchor);
    } else {
      const renamed = document.createElement(kind);
      const item = closestItem(range.startContainer, editor);
      renamed.append(...existing.childNodes);
      existing.replaceWith(renamed);
      if (item && renamed.contains(item)) placeCaretIn(item, false);
      else if (renamed.lastElementChild) placeCaretIn(renamed.lastElementChild, false);
    }
  } else {
    const kids = [...editor.childNodes];
    const bounds = coveredChildRange(editor, range);
    const list = document.createElement(kind);
    if (bounds.from >= kids.length) {
      editor.append(list);
      fillList(list, []);
    } else {
      const slice = kids.slice(bounds.from, bounds.to + 1);
      slice[0].before(list);
      fillList(list, slice);
      for (const node of slice) {
        if (!list.contains(node)) node.remove();
      }
    }
    const item = list.lastElementChild;
    if (item) placeCaretIn(item, false);
  }
  if (!editor.childNodes.length) editor.append(document.createElement("br"));
  renumberLists(editor);
  syncRichEditor(editor, true);
  syncListButtons();
}

function listLevel(li) {
  return clamp(parseInt(li?.dataset.level, 10) || 0, 0, MAX_LIST_INDENT);
}

function changeListLevel(li, next) {
  li.dataset.level = String(clamp(next, 0, MAX_LIST_INDENT));
  renumberLists(li.parentElement);
  return true;
}

function restoreListMarker(li) {
  const list = li.parentElement;
  if (!list) return false;
  renumberLists(list);
  const prefix = li.dataset.marker || (list.tagName === "OL" ? "1. " : "- ");
  const lead = document.createTextNode(prefix);
  const content = document.createDocumentFragment();
  if (!listItemIsEmpty(li)) content.append(...li.childNodes);
  const previous = [];
  const following = [];
  let seen = false;
  for (const child of [...list.children]) {
    if (child === li) {
      seen = true;
      continue;
    }
    if (child.tagName !== "LI") continue;
    (seen ? following : previous).push(child);
  }
  li.remove();
  const endNode = content.lastChild || lead;
  const line = document.createDocumentFragment();
  line.append(lead, content);
  const tail = previous.length && following.length ? document.createElement(list.tagName.toLowerCase()) : null;
  if (tail) tail.append(...following);
  if (!previous.length && !following.length) list.replaceWith(line);
  else if (!previous.length) list.before(line);
  else list.after(line);
  if (tail) endNode.after(tail);
  let beforeMarker = lead.previousSibling;
  while (beforeMarker?.nodeType === Node.TEXT_NODE && !beforeMarker.textContent.replace(/[\u200b\u00a0\s]/g, "")) {
    const prior = beforeMarker.previousSibling;
    beforeMarker.remove();
    beforeMarker = prior;
  }
  const hasBreak = !beforeMarker
    || beforeMarker.nodeName === "BR"
    || beforeMarker.nodeName === "UL"
    || beforeMarker.nodeName === "OL"
    || (beforeMarker.nodeType === Node.TEXT_NODE && /[\n\r]$/.test(beforeMarker.textContent));
  if (!hasBreak) lead.before(document.createElement("br"));
  if (list.isConnected) renumberLists(list);
  if (tail) renumberLists(tail);
  if (endNode.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.setStart(endNode, endNode.textContent.length);
    range.collapse(true);
    setEditorRange(range);
  } else placeCaretAfterNode(endNode);
  return true;
}

function exitListItem(li) {
  const list = li.parentElement;
  if (!list) return;
  const previous = [];
  const following = [];
  let seen = false;
  for (const child of [...list.children]) {
    if (child === li) {
      seen = true;
      continue;
    }
    if (child.tagName !== "LI") continue;
    (seen ? following : previous).push(child);
  }
  li.remove();
  const br = document.createElement("br");
  if (!previous.length && !following.length) list.replaceWith(br);
  else if (!previous.length) list.before(br);
  else if (!following.length) list.after(br);
  else {
    const tail = document.createElement(list.tagName.toLowerCase());
    tail.append(...following);
    list.after(br);
    br.after(tail);
    renumberLists(tail);
  }
  renumberLists(list);
  const range = document.createRange();
  range.setStartAfter(br);
  range.collapse(true);
  setEditorRange(range);
}

function handleListTab(shift) {
  const editor = activeEditor();
  const range = currentEditorRange();
  if (!editor || !range) return false;
  const li = closestItem(range.startContainer, editor);
  if (!li || closestItem(range.endContainer, editor) !== li) return false;
  const level = listLevel(li);
  if (shift) {
    if (level > 0) changeListLevel(li, level - 1);
    else restoreListMarker(li);
  } else if (level < MAX_LIST_INDENT) {
    changeListLevel(li, level + 1);
  }
  syncRichEditor(editor, true);
  syncListButtons();
  return true;
}

function liftOutOfInline(list, editor) {
  while (list.parentElement && list.parentElement !== editor && !["UL", "OL", "LI"].includes(list.parentElement.tagName)) {
    const parent = list.parentElement;
    parent.after(list);
    if (!parent.textContent.replace(/[\u200b\u00a0]/g, "").trim() && !parent.querySelector("br")) parent.remove();
  }
}

function promoteNewlineMarker(editor, caret) {
  const textNode = caret.startContainer;
  const before = markerText(textNode.textContent.slice(0, caret.startOffset));
  const cut = before.lastIndexOf("\n");
  if (cut < 0) return false;
  const line = before.slice(cut + 1);
  const kind = line === "- " ? "ul" : line === "1. " ? "ol" : "";
  if (!kind) return false;
  const afterLine = markerText(textNode.textContent.slice(caret.startOffset)).split("\n")[0];
  if (afterLine.trim()) return false;
  const originalCut = textNode.textContent.slice(0, caret.startOffset).replace(/\u00a0/g, " ").lastIndexOf("\n") + 1;
  textNode.textContent = textNode.textContent.slice(0, originalCut) + textNode.textContent.slice(caret.startOffset);
  if (textNode.textContent.endsWith("\n")) textNode.textContent = textNode.textContent.slice(0, -1);
  const li = document.createElement("li");
  li.dataset.level = "0";
  li.append(document.createElement("br"));
  const list = document.createElement(kind);
  list.append(li);
  textNode.after(list);
  if (!textNode.textContent) textNode.remove();
  liftOutOfInline(list, editor);
  renumberLists(list);
  placeCaretIn(li, true);
  syncRichEditor(editor, true);
  syncListButtons();
  return true;
}

function markerText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\u200b/g, "");
}

function collectLineNodes(editor) {
  const seq = [];
  const visit = (parent) => {
    for (const child of [...parent.childNodes]) {
      if (child.nodeName === "BR" || child.nodeName === "UL" || child.nodeName === "OL") seq.push(child);
      else if (child.nodeType === Node.TEXT_NODE) seq.push(child);
      else if (child.nodeType === Node.ELEMENT_NODE) visit(child);
    }
  };
  visit(editor);
  return seq;
}

function isBeforeRange(node, range) {
  const probe = document.createRange();
  probe.setStartAfter(node);
  probe.collapse(true);
  return probe.compareBoundaryPoints(Range.START_TO_START, range) <= 0;
}

function promoteTypedList(editor) {
  const caret = currentEditorRange();
  if (!caret?.collapsed || closestItem(caret.startContainer, editor)) return false;
  if (caret.startContainer.nodeType === Node.TEXT_NODE && promoteNewlineMarker(editor, caret)) return true;
  const seq = collectLineNodes(editor);
  let boundary = -1;
  let caretIndex = seq.indexOf(caret.startContainer);
  seq.forEach((node, index) => {
    if (node.nodeName !== "BR" && node.nodeName !== "UL" && node.nodeName !== "OL") return;
    if (node !== caret.startContainer && isBeforeRange(node, caret)) boundary = index;
  });
  if (caret.startContainer === editor) {
    const child = editor.childNodes[Math.max(0, caret.startOffset - 1)];
    caretIndex = child ? seq.indexOf(child) : seq.length;
  }
  const parts = [];
  let markerNode = null;
  let markerOffset = 0;
  for (let index = boundary + 1; index < seq.length; index += 1) {
    const node = seq[index];
    if (node.nodeName === "BR" || node.nodeName === "UL" || node.nodeName === "OL") break;
    if (node.nodeType !== Node.TEXT_NODE) {
      if (node === caret.startContainer) break;
      continue;
    }
    if (caretIndex !== -1 && index > caretIndex) break;
    const end = node === caret.startContainer ? caret.startOffset : node.textContent.length;
    const chunk = node.textContent.slice(0, end).replace(/\u00a0/g, " ");
    const cut = Math.max(chunk.lastIndexOf("\n"), chunk.lastIndexOf("\r"));
    if (cut >= 0) {
      parts.length = 0;
      markerNode = node;
      markerOffset = cut + 1;
      parts.push(chunk.slice(cut + 1).replace(/\u200b/g, ""));
    } else {
      if (!markerNode) {
        markerNode = node;
        markerOffset = 0;
      }
      parts.push(chunk.replace(/\u200b/g, ""));
    }
    if (node === caret.startContainer) break;
  }
  const kind = parts.join("") === "- " ? "ul" : parts.join("") === "1. " ? "ol" : "";
  if (!kind || !markerNode) return false;
  const rest = document.createRange();
  rest.setStart(caret.startContainer, caret.startOffset);
  const nextBoundary = seq.find((node, index) => index > boundary && index !== caretIndex && (node.nodeName === "BR" || node.nodeName === "UL" || node.nodeName === "OL") && !isBeforeRange(node, caret));
  if (nextBoundary) rest.setEndBefore(nextBoundary);
  else rest.setEnd(editor, editor.childNodes.length);
  if (markerText(rest.toString()).trim()) return false;
  const removal = document.createRange();
  removal.setStart(markerNode, markerOffset);
  removal.setEnd(caret.startContainer, caret.startOffset);
  const previous = seq[boundary];
  removal.deleteContents();
  if (markerNode.isConnected) markerNode.textContent = markerNode.textContent.replace(/[\n\r]+$/, "");
  const li = document.createElement("li");
  li.dataset.level = "0";
  li.append(document.createElement("br"));
  let list = previous?.nodeName === kind.toUpperCase() ? previous : null;
  if (!list && previous?.nodeName === "BR") {
    let probe = previous.previousSibling;
    while (probe?.nodeName === "BR") probe = probe.previousSibling;
    if (probe?.nodeName === kind.toUpperCase()) {
      list = probe;
      let extra = previous;
      while (extra && extra !== list) {
        const prior = extra.previousSibling;
        if (extra.nodeName === "BR") extra.remove();
        extra = prior;
      }
    }
  }
  if (!list) {
    list = document.createElement(kind);
    removal.insertNode(list);
    liftOutOfInline(list, editor);
  }
  list.append(li);
  renumberLists(list);
  placeCaretIn(li, true);
  syncRichEditor(editor, true);
  syncListButtons();
  return true;
}

function inlineFormatChain(fragment) {
  let outer = null;
  let inner = null;
  let source = fragment;
  for (;;) {
    const el = [...source.childNodes].find((child) => child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR");
    if (!el) break;
    if (el.tagName !== "A" && el.tagName !== "UL" && el.tagName !== "OL") {
      const clone = el.cloneNode(false);
      if (inner) inner.append(clone);
      else outer = clone;
      inner = clone;
    }
    source = el;
  }
  return { outer, inner };
}

function placeCaretAtItemStart(li) {
  const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode();
  if (!first) {
    placeCaretIn(li, true);
    return;
  }
  const range = document.createRange();
  range.setStart(first, 0);
  range.collapse(true);
  setEditorRange(range);
}

function handleListEnter() {
  const editor = activeEditor();
  const range = currentEditorRange();
  if (!editor || !range) return false;
  const li = closestItem(range.startContainer, editor);
  if (!li || closestItem(range.endContainer, editor) !== li) return false;
  if (!range.collapsed) range.deleteContents();
  if (listItemIsEmpty(li)) {
    if (listLevel(li) > 0) changeListLevel(li, listLevel(li) - 1);
    else exitListItem(li);
  } else {
    const nested = [...li.children].filter((el) => el.tagName === "UL" || el.tagName === "OL");
    const insideNested = nested.some((list) => list.contains(range.startContainer));
    if (!insideNested) nested.forEach((list) => list.remove());
    const tail = document.createRange();
    tail.selectNodeContents(li);
    tail.setStart(range.startContainer, range.startOffset);
    const content = tail.extractContents();
    const next = document.createElement("li");
    next.dataset.level = li.dataset.level || "0";
    let caretHost = null;
    if (!content.textContent.replace(/\u200b/g, "").trim()) {
      const { outer, inner } = inlineFormatChain(content);
      const br = document.createElement("br");
      if (outer) {
        inner.append(br);
        next.append(outer);
        caretHost = inner;
      } else next.append(br);
    } else next.append(content);
    if (!li.textContent.replace(/\u200b/g, "").trim() && !li.querySelector("br")) li.replaceChildren(document.createElement("br"));
    if (!insideNested) li.append(...nested);
    li.after(next);
    renumberLists(li.parentElement);
    if (caretHost) {
      const at = document.createRange();
      at.setStart(caretHost, 0);
      at.collapse(true);
      setEditorRange(at);
    } else placeCaretAtItemStart(next);
  }
  syncRichEditor(editor, true);
  syncListButtons();
  return true;
}

function handleListBackspace() {
  const editor = activeEditor();
  const range = currentEditorRange();
  if (!editor || !range) return false;
  const li = closestItem(range.startContainer, editor);
  if (!li || !atItemStart(li, range)) return false;
  const list = li.parentElement;
  const prev = li.previousElementSibling;
  if (prev?.tagName === "LI") {
    if (listItemIsEmpty(li)) {
      li.remove();
      placeCaretIn(prev, false);
    } else {
      if (listItemIsEmpty(prev)) prev.replaceChildren();
      const offset = prev.childNodes.length;
      prev.append(...li.childNodes);
      li.remove();
      const next = document.createRange();
      next.setStart(prev, Math.min(offset, prev.childNodes.length));
      next.collapse(true);
      setEditorRange(next);
    }
  } else {
    const br = document.createElement("br");
    const chunk = document.createDocumentFragment();
    if (!listItemIsEmpty(li)) chunk.append(...li.childNodes);
    chunk.append(br);
    li.remove();
    if (!list?.querySelector("li")) list?.replaceWith(chunk);
    else list.before(chunk);
    const next = document.createRange();
    next.setStartBefore(br);
    next.collapse(true);
    setEditorRange(next);
  }
  if (!editor.childNodes.length) editor.append(document.createElement("br"));
  syncRichEditor(editor, true);
  syncListButtons();
  return true;
}

function currentListKind() {
  const editor = activeEditor();
  const sel = window.getSelection();
  if (!editor || !sel?.rangeCount || !sel.anchorNode || !editor.contains(sel.anchorNode)) return "";
  const list = sharedList(editor, sel.getRangeAt(0)) || closestList(sel.anchorNode, editor);
  return list ? list.tagName.toLowerCase() : "";
}

function syncListButtons() {
  if (!els.listBullet || !els.listNumber) return;
  const kind = currentListKind();
  els.listBullet.setAttribute("aria-pressed", String(kind === "ul"));
  els.listNumber.setAttribute("aria-pressed", String(kind === "ol"));
}

function startEdit(id) {
  if (!state.nodes[id]) return;
  if (state.editing === id) {
    nodeEl(id)?.querySelector(".editor")?.focus();
    return;
  }
  if (state.editing) finishEdit();
  const futureCopy = future.slice();
  const before = history.length;
  pushHistory();
  state.editPushed = history.length > before;
  state.editFuture = futureCopy;
  state.editOrigin = {
    text: state.nodes[id].text,
    richText: state.nodes[id].richText || textToRichHtml(state.nodes[id].text),
  };
  state.editing = id;
  selectOnlyNode(id);
  const label = nodeEl(id).querySelector(".label");
  const editor = document.createElement("div");
  editor.className = "editor";
  editor.contentEditable = "true";
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-multiline", "true");
  editor.setAttribute("aria-label", t("aria.nodeText"));
  editor.spellcheck = true;
  editor.innerHTML = sanitizeRichHtml(state.nodes[id].richText || textToRichHtml(state.nodes[id].text));
  label.replaceChildren(editor);
  editor.addEventListener("input", (e) => {
    if (e.isComposing) {
      syncRichEditor(editor, true);
      return;
    }
    if (!promoteTypedList(editor)) syncRichEditor(editor);
  });
  editor.addEventListener("blur", (e) => {
    if (e.relatedTarget?.closest?.("#node-style")) return;
    if (state.editing === id) finishEdit();
  });
  editor.addEventListener("paste", () => requestAnimationFrame(() => syncRichEditor(editor)));
  editor.addEventListener("click", (e) => {
    if (e.target.closest("a")) e.preventDefault();
  });
  measureNode(id);
  drawEdges();
  editor.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  selection.removeAllRanges();
  selection.addRange(range);
  richRange = range.cloneRange();
}

function finishEdit(cancel = false) {
  const id = state.editing;
  if (!id) return;
  const node = state.nodes[id];
  state.editing = null;
  richRange = null;
  if (node) {
    if (cancel) {
      node.text = state.editOrigin.text;
      node.richText = state.editOrigin.richText;
    } else {
      node.richText = pruneRichHtml(node.richText);
      node.text = richHtmlToText(node.richText);
      if (!String(node.text).trim()) {
        node.text = t("node.untitled");
        node.richText = textToRichHtml(node.text);
      }
    }
    const el = nodeEl(id);
    if (el) el.querySelector(".label").innerHTML = sanitizeRichHtml(node.richText);
  }
  if (state.editPushed && history.at(-1) === serializeContent()) {
    history.pop();
    future = state.editFuture || [];
  }
  state.editPushed = false;
  state.editFuture = null;
  updateHistoryButtons();
  measureAll();
  drawEdges();
  syncInspector();
  syncListButtons();
  syncNotes();
  scheduleSave();
}

function syncInspector() {
  const nodes = selectedNodeList();
  const edges = state.sel.edges.map((id) => state.edges[id]).filter(Boolean);
  const nodeMode = nodes.length > 0;
  els.nodeStyle.disabled = !nodeMode;
  els.deleteBtn.disabled = !nodeMode && !edges.length;
  if (nodeMode && edges.length === 0) {
    els.selection.textContent = nodes.length === 1 ? t("selection.node") : t("selection.nodes", { n: nodes.length });
  } else if (edges.length && !nodeMode) {
    els.selection.textContent = edges.length === 1 ? t("selection.edge") : t("selection.edges", { n: edges.length });
  } else if (!nodeMode) {
    els.selection.textContent = t("selection.none");
  }
  els.linkHeading.textContent = edges.length && !nodeMode ? t("link.selected") : t("link.new");
  els.connectBtn.disabled = nodes.length !== 1;

  const styleSource = edges.length && !nodeMode ? edges[0] : state.linkStyle;
  const same = (prop) => (edges.length && !nodeMode ? edges.every((e) => e[prop] === edges[0][prop]) : true);
  for (const btn of els.routes) {
    const on = same("route") && styleSource.route === btn.dataset.route;
    btn.setAttribute("aria-pressed", String(on));
  }
  for (const btn of els.dashes) {
    const on = same("dash") && styleSource.dash === btn.dataset.dash;
    btn.setAttribute("aria-pressed", String(on));
  }
  const arrowsOn = edges.length && !nodeMode ? edges.every((e) => e.arrow) : state.linkStyle.arrow;
  els.arrow.setAttribute("aria-pressed", String(!!arrowsOn));

  if (!nodeMode) return;
  const colors = new Set(nodes.map((n) => n.color));
  for (const btn of els.colors.querySelectorAll(".swatch")) {
    btn.setAttribute("aria-pressed", String(colors.size === 1 && btn.dataset.color === nodes[0].color));
  }
  const flags = ["bold", "italic", "underline"];
  const buttons = [els.bold, els.italic, els.underline];
  flags.forEach((flag, i) => {
    buttons[i].setAttribute("aria-pressed", String(nodes.every((n) => n[flag])));
  });
  const sizes = new Set(nodes.map((n) => n.fontSize));
  const families = new Set(nodes.map((n) => n.fontFamily || "sans"));
  if (document.activeElement !== els.fontFamily) {
    els.fontFamily.value = families.size === 1 ? (nodes[0].fontFamily || "sans") : "";
  }
  const shown = nodes[nodes.length - 1].fontSize;
  if (document.activeElement !== els.fontSize) els.fontSize.value = String(shown);
  if (document.activeElement !== els.fontValue) {
    els.fontValue.value = sizes.size > 1 ? "" : String(shown);
    els.fontValue.placeholder = sizes.size > 1 ? t("mix") : "";
  }
}

function syncNotes() {
  const id = primaryNode();
  const node = id ? state.nodes[id] : null;
  els.notesHeading.textContent = node ? clip(node.text, 64) : t("notes.none");
  els.notesInput.disabled = !node;
  if (document.activeElement === els.notesInput) return;
  els.notesInput.value = node ? node.note : "";
}

function clip(text, n) {
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function updateNoteBits(id) {
  const node = state.nodes[id];
  const el = nodeEl(id);
  if (!node || !el) return;
  const hasNote = !!node.note.trim();
  const showCard = state.ui.notesOpen && hasNote && state.sel.nodes.length === 1 && state.sel.nodes[0] === id;
  const card = el.querySelector(".note-card");
  card.textContent = node.note;
  card.hidden = !showCard;
  el.querySelector(".note-dot").hidden = !hasNote || showCard;
}

function applyView() {
  const { panX, panY, zoom } = state.view;
  els.world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const size = 22 * zoom;
  els.viewport.style.backgroundSize = `${size}px ${size}px`;
  els.viewport.style.backgroundPosition = `${panX}px ${panY}px`;
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function clientToWorld(cx, cy) {
  const r = els.viewport.getBoundingClientRect();
  return {
    x: (cx - r.left - state.view.panX) / state.view.zoom,
    y: (cy - r.top - state.view.panY) / state.view.zoom,
  };
}

function zoomAt(cx, cy, factor) {
  const r = els.viewport.getBoundingClientRect();
  const z = state.view.zoom;
  const wx = (cx - r.left - state.view.panX) / z;
  const wy = (cy - r.top - state.view.panY) / z;
  const next = clamp(z * factor, 0.35, 2.2);
  state.view.zoom = next;
  state.view.panX = cx - r.left - wx * next;
  state.view.panY = cy - r.top - wy * next;
  applyView();
  scheduleSave();
}

function zoomCenter(factor) {
  const r = els.viewport.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
}

function setZoom(next) {
  const r = els.viewport.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const z = state.view.zoom || 1;
  zoomAt(cx, cy, next / z);
}

function contentBounds() {
  const list = Object.values(state.nodes);
  if (!list.length) return { minX: 0, minY: 0, maxX: 420, maxY: 220, w: 420, h: 220 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of list) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + (n.w || 10));
    maxY = Math.max(maxY, n.y + (n.h || 10));
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function fit({ save = true } = {}) {
  measureAll();
  const b = contentBounds();
  const pad = 110;
  const vw = els.viewport.clientWidth || 800;
  const vh = els.viewport.clientHeight || 600;
  state.view.zoom = clamp(Math.min(vw / (b.w + pad * 2), vh / (b.h + pad * 2)), 0.35, 1.25);
  state.view.panX = (vw - b.w * state.view.zoom) / 2 - b.minX * state.view.zoom;
  state.view.panY = (vh - b.h * state.view.zoom) / 2 - b.minY * state.view.zoom;
  applyView();
  if (save) scheduleSave();
}

function revealNode(node) {
  const pad = 48;
  const z = state.view.zoom;
  const vx = state.view.panX + node.x * z;
  const vy = state.view.panY + node.y * z;
  const right = vx + (node.w || 160) * z;
  const bottom = vy + (node.h || 48) * z;
  const vw = els.viewport.clientWidth;
  const vh = els.viewport.clientHeight;
  if (vx < pad) state.view.panX += pad - vx;
  else if (right > vw - pad) state.view.panX -= right - (vw - pad);
  if (vy < pad) state.view.panY += pad - vy;
  else if (bottom > vh - pad) state.view.panY -= bottom - (vh - pad);
  applyView();
}

function num(n) {
  return (Math.round(n * 10) / 10).toString();
}

function facingSides(a, b) {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["right", "left"] : ["left", "right"];
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

function sidePoint(n, side) {
  if (side === "left") return { x: n.x, y: n.y + n.h / 2 };
  if (side === "right") return { x: n.x + n.w, y: n.y + n.h / 2 };
  if (side === "top") return { x: n.x + n.w / 2, y: n.y };
  return { x: n.x + n.w / 2, y: n.y + n.h };
}

function shift(p, side, d) {
  if (side === "left") return { x: p.x - d, y: p.y };
  if (side === "right") return { x: p.x + d, y: p.y };
  if (side === "top") return { x: p.x, y: p.y - d };
  return { x: p.x, y: p.y + d };
}

function norm(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function approachDir(route, p1, p2, s2) {
  if (route === "straight") return norm(p2.x - p1.x, p2.y - p1.y);
  if (route === "curve") {
    const dist = Math.max(48, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.45);
    const c2 = shift(p2, s2, dist);
    return norm(p2.x - c2.x, p2.y - c2.y);
  }
  if (s2 === "left") return { x: 1, y: 0 };
  if (s2 === "right") return { x: -1, y: 0 };
  if (s2 === "top") return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function pathData(route, p1, end, s1, s2) {
  if (route === "straight") return `M ${num(p1.x)} ${num(p1.y)} L ${num(end.x)} ${num(end.y)}`;
  if (route === "elbow") {
    if (s1 === "left" || s1 === "right") {
      const midX = (p1.x + end.x) / 2;
      return `M ${num(p1.x)} ${num(p1.y)} H ${num(midX)} V ${num(end.y)} H ${num(end.x)}`;
    }
    const midY = (p1.y + end.y) / 2;
    return `M ${num(p1.x)} ${num(p1.y)} V ${num(midY)} H ${num(end.x)} V ${num(end.y)}`;
  }
  const dist = Math.max(48, Math.hypot(end.x - p1.x, end.y - p1.y) * 0.45);
  const c1 = shift(p1, s1, dist);
  const c2 = shift(end, s2, dist);
  return `M ${num(p1.x)} ${num(p1.y)} C ${num(c1.x)} ${num(c1.y)}, ${num(c2.x)} ${num(c2.y)}, ${num(end.x)} ${num(end.y)}`;
}

function arrowPoints(tip, dir, length, half) {
  const base = { x: tip.x - dir.x * length, y: tip.y - dir.y * length };
  const px = -dir.y;
  const py = dir.x;
  return [
    tip,
    { x: base.x + px * half, y: base.y + py * half },
    { x: base.x - px * half, y: base.y - py * half },
  ];
}

function edgeFigure(edge) {
  const a = state.nodes[edge.from];
  const b = state.nodes[edge.to];
  if (!a || !b) return null;
  const [s1, s2] = facingSides(a, b);
  const p1 = sidePoint(a, s1);
  const p2 = sidePoint(b, s2);
  const dir = approachDir(edge.route, p1, p2, s2);
  const trim = edge.arrow ? 12 : 1.5;
  const end = { x: p2.x - dir.x * trim, y: p2.y - dir.y * trim };
  return {
    id: edge.id,
    d: pathData(edge.route, p1, end, s1, s2),
    color: colorById(a.color).edge,
    dash: edge.dash,
    head: edge.arrow ? arrowPoints(p2, dir, 12, 4.4) : null,
    selected: state.sel.edges.includes(edge.id),
  };
}

function dashAttr(dash) {
  if (dash === "dashed") return "8 7";
  if (dash === "dotted") return "1.6 7";
  return "";
}

function drawEdges() {
  const parts = [];
  for (const edge of Object.values(state.edges)) {
    const fig = edgeFigure(edge);
    if (!fig) continue;
    const width = fig.selected ? 3.4 : 2.25;
    const dash = dashAttr(fig.dash);
    parts.push(
      `<path class="edge" d="${fig.d}" fill="none" stroke="${fig.color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    );
    if (fig.head) {
      const pts = fig.head.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");
      parts.push(`<polygon points="${pts}" fill="${fig.color}"/>`);
    }
    parts.push(
      `<path class="hit" data-edge="${fig.id}" d="${fig.d}" fill="none" stroke="transparent" stroke-width="16"/>`
    );
  }
  if (state.linkDrag) {
    const from = state.nodes[state.linkDrag.from];
    if (from) {
      const fake = { x: state.linkDrag.x, y: state.linkDrag.y, w: 1, h: 1 };
      const [s1, s2] = facingSides(from, fake);
      const p1 = sidePoint(from, s1);
      const p2 = { x: state.linkDrag.x, y: state.linkDrag.y };
      const d = pathData(state.linkStyle.route, p1, p2, s1, s2);
      parts.push(
        `<path d="${d}" fill="none" stroke="${colorById(from.color).edge}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="5 5" opacity="0.85"/>`
      );
    }
  }
  els.wires.innerHTML = parts.join("");
}

function onNodePointerDown(e) {
  if (e.button !== 0) return;
  if (e.target.closest(".port, .note-dot, .note-card, .editor")) return;
  if (spaceDown) return;
  const id = e.currentTarget.dataset.id;
  if (state.connectFrom) {
    e.stopPropagation();
    const from = state.connectFrom;
    clearConnect();
    if (from !== id) addEdge(from, id);
    return;
  }
  if (state.editing && state.editing !== id) finishEdit();
  e.preventDefault();
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    const start = { x: e.clientX, y: e.clientY };
    const up = (ev) => {
      window.removeEventListener("pointerup", up);
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) return;
      if (state.sel.nodes.includes(id)) state.sel.nodes = state.sel.nodes.filter((n) => n !== id);
      else state.sel.nodes = [...state.sel.nodes, id];
      state.sel.edges = [];
      if (state.nodes[id]) captureBrush(state.nodes[id]);
      refreshSelection();
    };
    window.addEventListener("pointerup", up);
    return;
  }
  if (!state.sel.nodes.includes(id)) selectOnlyNode(id);
  startNodeDrag(e, state.sel.nodes.filter((n) => state.nodes[n]));
}

function startNodeDrag(e, ids) {
  const origin = { x: e.clientX, y: e.clientY };
  const before = serializeContent();
  const starts = {};
  for (const id of ids) starts[id] = { x: state.nodes[id].x, y: state.nodes[id].y };
  let moved = false;
  const move = (ev) => {
    const dx = (ev.clientX - origin.x) / state.view.zoom;
    const dy = (ev.clientY - origin.y) / state.view.zoom;
    if (!moved && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < 4) return;
    moved = true;
    document.body.classList.add("is-dragging");
    for (const id of ids) {
      state.nodes[id].x = Math.round(starts[id].x + dx);
      state.nodes[id].y = Math.round(starts[id].y + dy);
      const el = nodeEl(id);
      if (el) el.style.transform = `translate(${state.nodes[id].x}px, ${state.nodes[id].y}px)`;
    }
    drawEdges();
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    document.body.classList.remove("is-dragging");
    if (moved) {
      if (history.at(-1) !== before) history.push(before);
      future = [];
      updateHistoryButtons();
      dirty = true;
      scheduleSave();
    }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function startLinkDrag(e, id) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const pt = clientToWorld(e.clientX, e.clientY);
  state.linkDrag = { from: id, x: pt.x, y: pt.y };
  drawEdges();
  const move = (ev) => {
    const p = clientToWorld(ev.clientX, ev.clientY);
    state.linkDrag = { from: id, x: p.x, y: p.y };
    drawEdges();
  };
  const up = (ev) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    state.linkDrag = null;
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".node")?.dataset.id;
    if (target && target !== id) addEdge(id, target);
    else drawEdges();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

function navigate(key) {
  const id = primaryNode();
  const node = state.nodes[id];
  if (!node) return;
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const linked = new Set();
  for (const e of Object.values(state.edges)) {
    if (e.from === id) linked.add(e.to);
    if (e.to === id) linked.add(e.from);
  }
  const pool = [...linked].map((n) => state.nodes[n]).filter(Boolean);
  const candidates = pool.length ? pool : Object.values(state.nodes);
  let best = null;
  let bestScore = Infinity;
  for (const other of candidates) {
    if (other.id === id) continue;
    const ox = other.x + other.w / 2 - cx;
    const oy = other.y + other.h / 2 - cy;
    let ok = false;
    if (key === "ArrowRight") ok = ox > 8 && Math.abs(oy) <= Math.abs(ox) * 1.25;
    if (key === "ArrowLeft") ok = ox < -8 && Math.abs(oy) <= Math.abs(ox) * 1.25;
    if (key === "ArrowDown") ok = oy > 8 && Math.abs(ox) <= Math.abs(oy) * 1.25;
    if (key === "ArrowUp") ok = oy < -8 && Math.abs(ox) <= Math.abs(oy) * 1.25;
    if (!ok) continue;
    const score = ox * ox + oy * oy;
    if (score < bestScore) {
      bestScore = score;
      best = other;
    }
  }
  if (best) selectOnlyNode(best.id);
}

function nudge(dx, dy) {
  if (!state.sel.nodes.length) return;
  if (!nudgeBefore) nudgeBefore = serializeContent();
  for (const id of state.sel.nodes) {
    const node = state.nodes[id];
    node.x += dx;
    node.y += dy;
    const el = nodeEl(id);
    if (el) el.style.transform = `translate(${node.x}px, ${node.y}px)`;
  }
  drawEdges();
  scheduleSave();
}

function isPlus(e) {
  return e.key === "+" || e.key === "=" || e.code === "NumpadAdd";
}

function isMinus(e) {
  return e.key === "-" || e.key === "_" || e.code === "NumpadSubtract";
}

function onKey(e) {
  if (e.isComposing) return;
  const key = e.key;
  const low = key.toLowerCase();
  const cmd = e.ctrlKey || e.metaKey;

  if (key === "Escape") {
    if (!els.legend.hidden) {
      e.preventDefault();
      toggleLegend(false);
      return;
    }
    if (!els.menu.hidden) {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (state.connectFrom) {
      e.preventDefault();
      clearConnect();
      return;
    }
    if (state.editing) {
      e.preventDefault();
      finishEdit();
      return;
    }
    if (isTextField(document.activeElement)) {
      e.preventDefault();
      document.activeElement.blur();
      return;
    }
    if (state.sel.nodes.length || state.sel.edges.length) {
      e.preventDefault();
      clearSelection();
    }
    return;
  }

  if (cmd && !e.altKey && low === "l") {
    e.preventDefault();
    toggleLegend();
    return;
  }
  if (cmd && !e.altKey && low === "s") {
    e.preventDefault();
    saveFile();
    return;
  }
  if (cmd && !e.altKey && low === "o") {
    e.preventDefault();
    els.file.click();
    return;
  }
  if (cmd && !e.altKey && low === "p" && !e.shiftKey) {
    e.preventDefault();
    exportPdf();
    return;
  }
  if (cmd && !e.altKey && low === "e" && !e.shiftKey) {
    e.preventDefault();
    exportSvg();
    return;
  }
  if (cmd && !e.altKey && low === "n" && !e.shiftKey) {
    e.preventDefault();
    setNotesOpen(!state.ui.notesOpen, { focus: !state.ui.notesOpen });
    return;
  }
  if (cmd && !e.altKey && low === "k") {
    e.preventDefault();
    if (!state.editing && primaryNode()) startEdit(primaryNode());
    addHyperlink();
    return;
  }

  const field = document.activeElement;
  const editing = field?.classList?.contains("editor");
  if (editing) {
    const listKind = listShortcutKind(e);
    if (listKind) {
      e.preventDefault();
      applyList(listKind);
      return;
    }
    if (key === "Backspace" && !cmd && !e.altKey && !e.shiftKey && handleListBackspace()) {
      e.preventDefault();
      return;
    }
    if (key === "Tab") {
      e.preventDefault();
      if (e.repeat) return;
      if (handleListTab(e.shiftKey)) return;
      const id = state.editing;
      const shift = e.shiftKey;
      finishEdit();
      if (shift) createSibling(id);
      else createChild(id);
      return;
    }
    if (key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!handleListEnter()) finishEdit();
      return;
    }
    if (cmd && !e.altKey && !e.shiftKey && low === "b") {
      e.preventDefault();
      toggleFlag("bold");
      return;
    }
    if (cmd && !e.altKey && !e.shiftKey && low === "i") {
      e.preventDefault();
      toggleFlag("italic");
      return;
    }
    if (cmd && !e.altKey && !e.shiftKey && low === "u") {
      e.preventDefault();
      toggleFlag("underline");
      return;
    }
    if (cmd && isPlus(e)) {
      e.preventDefault();
      bumpFont(2);
      return;
    }
    if (cmd && isMinus(e)) {
      e.preventDefault();
      bumpFont(-2);
      return;
    }
    return;
  }

  if (isTextField(field)) return;
  if (!els.legend.hidden) return;

  const listKind = listShortcutKind(e);
  if (listKind) {
    e.preventDefault();
    applyList(listKind);
    return;
  }

  if (cmd && !e.altKey && low === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (cmd && !e.altKey && (low === "y" || (low === "z" && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if (cmd && !e.altKey && low === "c") {
    e.preventDefault();
    copySelection();
    return;
  }
  if (cmd && !e.altKey && low === "x") {
    e.preventDefault();
    cutSelection();
    return;
  }
  if (cmd && !e.altKey && low === "v") {
    e.preventDefault();
    pasteSelection();
    return;
  }
  if (cmd && !e.altKey && low === "d") {
    e.preventDefault();
    duplicateSelection();
    return;
  }
  if (cmd && !e.altKey && low === "a") {
    e.preventDefault();
    state.sel = { nodes: Object.keys(state.nodes), edges: [] };
    refreshSelection();
    return;
  }
  if (cmd && !e.altKey && low === "b") {
    e.preventDefault();
    toggleFlag("bold");
    return;
  }
  if (cmd && !e.altKey && low === "i") {
    e.preventDefault();
    toggleFlag("italic");
    return;
  }
  if (cmd && !e.altKey && low === "u") {
    e.preventDefault();
    toggleFlag("underline");
    return;
  }
  if (cmd && (key === "0" || e.code === "Digit0" || e.code === "Numpad0")) {
    e.preventDefault();
    fit();
    return;
  }
  if (cmd && isPlus(e)) {
    e.preventDefault();
    if (state.sel.nodes.length) bumpFont(2);
    else zoomCenter(1.1);
    return;
  }
  if (cmd && isMinus(e)) {
    e.preventDefault();
    if (state.sel.nodes.length) bumpFont(-2);
    else zoomCenter(1 / 1.1);
    return;
  }

  if (key === "Tab") {
    e.preventDefault();
    if (e.repeat) return;
    const id = primaryNode();
    if (!id) return;
    if (e.shiftKey) createSibling(id);
    else createChild(id);
    return;
  }
  if (key === "Enter" && !e.repeat) {
    e.preventDefault();
    const id = primaryNode();
    if (!id) return;
    if (e.shiftKey) createSibling(id);
    else startEdit(id);
    return;
  }
  if ((key === "Delete" || key === "Backspace") && !e.repeat) {
    if (state.sel.nodes.length || state.sel.edges.length) {
      e.preventDefault();
      deleteSelection();
    }
    return;
  }
  if (key === "F2" && primaryNode()) {
    e.preventDefault();
    startEdit(primaryNode());
    return;
  }
  if (key === "?" || (e.shiftKey && key === "/")) {
    e.preventDefault();
    toggleLegend(true);
    return;
  }
  if (!cmd && !e.altKey && low === "v" && !e.repeat) {
    beginConnect();
    return;
  }
  if (!cmd && !e.altKey && low === "r" && !e.repeat) {
    cycleRoute();
    return;
  }
  if (!cmd && !e.altKey && low === "g" && !e.repeat) {
    cycleDash();
    return;
  }
  if (!cmd && !e.altKey && low === "p" && !e.repeat) {
    toggleArrow();
    return;
  }
  if (!cmd && !e.altKey && e.code.startsWith("Digit")) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= COLORS.length) setColor(COLORS[n - 1].id);
    return;
  }
  if (key.startsWith("Arrow") && state.sel.nodes.length) {
    if (e.altKey) {
      e.preventDefault();
      if (state.sel.nodes.length === 1) navigate(key);
      return;
    }
    e.preventDefault();
    const step = e.shiftKey ? 24 : 8;
    const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
    const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
    nudge(dx, dy);
    return;
  }
  if (e.code === "Space" && !e.repeat) {
    e.preventDefault();
    spaceDown = true;
    els.viewport.classList.add("is-space");
  }
}

function onKeyUp(e) {
  if (e.code === "Space") {
    spaceDown = false;
    els.viewport.classList.remove("is-space");
  }
  if (nudgeBefore && e.key.startsWith("Arrow")) {
    if (history.at(-1) !== nudgeBefore) history.push(nudgeBefore);
    future = [];
    nudgeBefore = null;
    updateHistoryButtons();
  }
}

function openMenu(x, y, items) {
  els.menu.innerHTML = "";
  for (const item of items) {
    if (!item) {
      els.menu.appendChild(document.createElement("hr"));
      continue;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label;
    btn.addEventListener("click", () => {
      closeMenu();
      item.run();
    });
    els.menu.appendChild(btn);
  }
  els.menu.hidden = false;
  els.menu.style.left = `${x}px`;
  els.menu.style.top = `${y}px`;
  requestAnimationFrame(() => {
    const r = els.menu.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) els.menu.style.left = `${x - r.width}px`;
    if (r.bottom > window.innerHeight - 8) els.menu.style.top = `${y - r.height}px`;
  });
}

function openNodeMenu(x, y, id) {
  openMenu(x, y, [
    { label: t("menu.edit"), run: () => startEdit(id) },
    { label: t("menu.note"), run: () => { selectOnlyNode(id); setNotesOpen(true, { focus: true }); } },
    { label: t("menu.connect"), run: () => { selectOnlyNode(id); beginConnect(); } },
    { label: t("menu.duplicate"), run: () => { state.sel = { nodes: [id], edges: [] }; duplicateSelection(); } },
    null,
    { label: t("menu.delete"), run: () => { state.sel = { nodes: [id], edges: [] }; deleteSelection(); } },
  ]);
}

function closeMenu() {
  els.menu.hidden = true;
}

function xml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function exportSvg() {
  if (state.editing) finishEdit();
  measureAll();
  const svg = buildSvg();
  download(`${fileSlug()}.svg`, svg, "image/svg+xml");
  toast(t("toast.svg"));
}

function buildSvg() {
  const b = contentBounds();
  const padX = 56;
  const padTop = 78;
  const padBottom = 56;
  const x = b.minX - padX;
  const y = b.minY - padTop;
  const w = b.w + padX * 2;
  const h = b.h + padTop + padBottom;
  const edges = [];
  for (const edge of Object.values(state.edges)) {
    const fig = edgeFigure(edge);
    if (!fig) continue;
    const dash = dashAttr(fig.dash);
    edges.push(
      `<path d="${fig.d}" fill="none" stroke="${fig.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    );
    if (fig.head) {
      const pts = fig.head.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");
      edges.push(`<polygon points="${pts}" fill="${fig.color}"/>`);
    }
  }
  const nodes = Object.values(state.nodes).map((node) => nodeSvg(node)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(h)}" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}">
  <rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="#f3efe6"/>
  <text x="${num(x + 28)}" y="${num(y + 40)}" fill="#243028" font-family="${FONT}" font-size="22" font-weight="700">${xml(state.title)}</text>
  ${edges.join("\n  ")}
  ${nodes}
</svg>`;
}

function nodeSvg(node) {
  const color = colorById(node.color);
  const el = nodeEl(node.id);
  const cs = el ? getComputedStyle(el) : null;
  const pad = cs
    ? `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`
    : "8px 14px 8px 18px";
  const weight = node.bold ? 700 : 520;
  const style = [
    "box-sizing:border-box",
    "width:100%",
    "height:100%",
    `font-family:${FONT_FAMILIES[node.fontFamily] || FONT_FAMILIES.sans}`,
    `font-size:${node.fontSize}px`,
    "line-height:1.35",
    `padding:${pad}`,
    `font-weight:${weight}`,
    `font-style:${node.italic ? "italic" : "normal"}`,
    `text-decoration:${node.underline ? "underline" : "none"}`,
    "text-underline-offset:0.12em",
    `color:${color.fg}`,
    "white-space:pre-wrap",
    "overflow-wrap:anywhere",
    "overflow:hidden",
  ].join(";");
  return `<g>
    <rect x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(node.h)}" rx="14" fill="${color.bg}" stroke="rgba(36,48,40,0.08)"/>
    <rect x="${num(node.x + 8)}" y="${num(node.y + 8)}" width="4" height="${num(Math.max(8, node.h - 16))}" rx="2" fill="${color.edge}"/>
    <foreignObject x="${num(node.x)}" y="${num(node.y)}" width="${num(node.w)}" height="${num(node.h)}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="${style}">${presentRichHtml(node.richText || textToRichHtml(node.text))}</div>
    </foreignObject>
  </g>`;
}

function canvasFont(size, bold, italic) {
  return `${italic ? "italic " : ""}${bold ? "700 " : "500 "}${size}px Helvetica, Arial, sans-serif`;
}

function wrapText(text, font, maxWidth) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  const lines = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter((w, i, arr) => w || arr.length === 1);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && measureCtx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function textWidth(text, font) {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

const WIN_EXTRA = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x2122, 0x99],
]);

function pdfString(text) {
  let out = "(";
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    let byte = null;
    if (cp >= 32 && cp <= 126) byte = cp;
    else if (WIN_EXTRA.has(cp)) byte = WIN_EXTRA.get(cp);
    else if (cp >= 0xa0 && cp <= 0xff) byte = cp;
    if (byte == null) continue;
    if (byte === 40 || byte === 41 || byte === 92) out += `\\${String.fromCharCode(byte)}`;
    else if (byte >= 32 && byte <= 126) out += String.fromCharCode(byte);
    else out += `\\${byte.toString(8).padStart(3, "0")}`;
  }
  return `${out})`;
}

function pdfNum(n) {
  return (Math.round(n * 100) / 100).toString();
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function pdfColor(hex) {
  return hexRgb(hex).map(pdfNum).join(" ");
}

function roundedRect(x, y, w, h, r) {
  const k = 0.5522847498;
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `${pdfNum(x)} ${pdfNum(y + rr)} m`,
    `${pdfNum(x)} ${pdfNum(y + h - rr)} l`,
    `${pdfNum(x)} ${pdfNum(y + h - rr + k * rr)} ${pdfNum(x + rr - k * rr)} ${pdfNum(y + h)} ${pdfNum(x + rr)} ${pdfNum(y + h)} c`,
    `${pdfNum(x + w - rr)} ${pdfNum(y + h)} l`,
    `${pdfNum(x + w - rr + k * rr)} ${pdfNum(y + h)} ${pdfNum(x + w)} ${pdfNum(y + h - rr + k * rr)} ${pdfNum(x + w)} ${pdfNum(y + h - rr)} c`,
    `${pdfNum(x + w)} ${pdfNum(y + rr)} l`,
    `${pdfNum(x + w)} ${pdfNum(y + rr - k * rr)} ${pdfNum(x + w - rr + k * rr)} ${pdfNum(y)} ${pdfNum(x + w - rr)} ${pdfNum(y)} c`,
    `${pdfNum(x + rr)} ${pdfNum(y)} l`,
    `${pdfNum(x + rr - k * rr)} ${pdfNum(y)} ${pdfNum(x)} ${pdfNum(y + rr - k * rr)} ${pdfNum(x)} ${pdfNum(y + rr)} c`,
  ].join("\n");
}

function exportPdf() {
  if (state.editing) finishEdit();
  measureAll();
  const bytes = buildPdf();
  download(`${fileSlug()}.pdf`, bytes, "application/pdf");
  toast(t("toast.pdf"));
}

function buildPdf() {
  const b = contentBounds();
  const padX = 48;
  const padTop = 72;
  const padBottom = 48;
  const pageW = b.w + padX * 2;
  const pageH = b.h + padTop + padBottom;
  const X = (x) => x - b.minX + padX;
  const Y = (y) => pageH - (y - b.minY + padTop);
  const ops = [];
  ops.push(`${pdfColor("#f3efe6")} rg`);
  ops.push(`0 0 ${pdfNum(pageW)} ${pdfNum(pageH)} re f`);
  ops.push("BT");
  ops.push(`/F2 18 Tf`);
  ops.push(`${pdfColor("#243028")} rg`);
  ops.push(`1 0 0 1 ${pdfNum(padX)} ${pdfNum(pageH - 36)} Tm`);
  ops.push(`${pdfString(state.title)} Tj`);
  ops.push("ET");

  for (const edge of Object.values(state.edges)) {
    const fig = edgeFigure(edge);
    if (!fig) continue;
    ops.push("q");
    ops.push(`${pdfColor(fig.color)} RG`);
    ops.push("2.3 w 1 J 1 j");
    if (fig.dash === "dashed") ops.push("[8 7] 0 d");
    else if (fig.dash === "dotted") ops.push("[0.1 7] 0 d");
    else ops.push("[] 0 d");
    ops.push(pdfPath(fig.d, X, Y));
    ops.push("S");
    ops.push("Q");
    if (fig.head) {
      const [a, c, d] = fig.head;
      ops.push(`${pdfColor(fig.color)} rg`);
      ops.push(`${pdfNum(X(a.x))} ${pdfNum(Y(a.y))} m`);
      ops.push(`${pdfNum(X(c.x))} ${pdfNum(Y(c.y))} l`);
      ops.push(`${pdfNum(X(d.x))} ${pdfNum(Y(d.y))} l`);
      ops.push("h f");
    }
  }

  for (const node of Object.values(state.nodes)) {
    const color = colorById(node.color);
    const x = X(node.x);
    const y = Y(node.y + node.h);
    ops.push("q");
    ops.push(`${pdfColor(color.bg)} rg`);
    ops.push(roundedRect(x, y, node.w, node.h, 14));
    ops.push("f");
    ops.push("Q");
    const barH = Math.max(8, node.h - 16);
    const barY = Y(node.y + 8 + barH);
    ops.push(`${pdfColor(color.edge)} rg`);
    ops.push(`${pdfNum(x + 8)} ${pdfNum(barY)} 4 ${pdfNum(barH)} re f`);

    const fontName = node.bold && node.italic ? "F4" : node.bold ? "F2" : node.italic ? "F3" : "F1";
    const font = canvasFont(node.fontSize, node.bold, node.italic);
    const padL = node.fontSize * 1.15;
    const padR = node.fontSize * 0.9;
    const padT = node.fontSize * 0.62;
    const inner = Math.max(20, node.w - padL - padR);
    const lines = wrapText(node.text, font, inner);
    const lineH = node.fontSize * 1.35;
    ops.push(`${pdfColor(color.fg)} rg`);
    lines.forEach((line, i) => {
      const baseline = Y(node.y + padT + node.fontSize * 0.82 + i * lineH);
      ops.push("BT");
      ops.push(`/${fontName} ${pdfNum(node.fontSize)} Tf`);
      ops.push(`1 0 0 1 ${pdfNum(x + padL)} ${pdfNum(baseline)} Tm`);
      ops.push(`${pdfString(line)} Tj`);
      ops.push("ET");
      if (node.underline && line) {
        const w = textWidth(line, font);
        const uy = baseline - node.fontSize * 0.15;
        ops.push(`${pdfNum(node.fontSize / 18)} w`);
        ops.push(`${pdfNum(x + padL)} ${pdfNum(uy)} m ${pdfNum(x + padL + w)} ${pdfNum(uy)} l S`);
      }
    });
  }

  const stream = ops.join("\n");
  return assemblePdf(pageW, pageH, stream);
}

function pdfPath(d, X, Y) {
  const tokens = d.replace(/([MLHVCS])/g, " $1 ").trim().split(/[\s,]+/);
  const out = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  const cmd = () => tokens[i];
  while (i < tokens.length) {
    const op = tokens[i++];
    if (op === "M" || op === "L") {
      cx = Number(tokens[i++]);
      cy = Number(tokens[i++]);
      out.push(`${pdfNum(X(cx))} ${pdfNum(Y(cy))} ${op === "M" ? "m" : "l"}`);
    } else if (op === "H") {
      cx = Number(tokens[i++]);
      out.push(`${pdfNum(X(cx))} ${pdfNum(Y(cy))} l`);
    } else if (op === "V") {
      cy = Number(tokens[i++]);
      out.push(`${pdfNum(X(cx))} ${pdfNum(Y(cy))} l`);
    } else if (op === "C") {
      const x1 = Number(tokens[i++]);
      const y1 = Number(tokens[i++]);
      const x2 = Number(tokens[i++]);
      const y2 = Number(tokens[i++]);
      cx = Number(tokens[i++]);
      cy = Number(tokens[i++]);
      out.push(
        `${pdfNum(X(x1))} ${pdfNum(Y(y1))} ${pdfNum(X(x2))} ${pdfNum(Y(y2))} ${pdfNum(X(cx))} ${pdfNum(Y(cy))} c`
      );
    } else if (!op) {
      break;
    }
  }
  return out.join("\n");
}

function assemblePdf(pageW, pageH, stream) {
  const objects = [
    null,
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNum(pageW)} ${pdfNum(pageH)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>",
    `<< /Title ${pdfString(state.title)} /Creator (Nodora) >>`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i < objects.length; i += 1) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 9 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
}

function buildLegend() {
  const groups = LEGEND.map((group) => {
    const rows = group.rows
      .map(([keys, label]) => {
        const ks = keys.map((k) => `<kbd>${xml(keyLabel(k))}</kbd>`).join("");
        return `<div class="legend-row"><div class="keys">${ks}</div><div>${xml(t(label))}</div></div>`;
      })
      .join("");
    return `<section class="legend-group"><h3>${xml(t(group.title))}</h3>${rows}</section>`;
  }).join("");
  els.legendBody.innerHTML = `${groups}<p class="legend-foot">${xml(t("legend.foot"))}</p>`;
}

function buildSwatches() {
  els.colors.innerHTML = COLORS.map((color, i) => {
    const name = t(`color.${color.id}`);
    return `<button type="button" class="swatch" data-color="${color.id}" title="${xml(name)} (${i + 1})" aria-label="${xml(name)}" style="background:${color.bg};color:${color.fg}"><span>${i + 1}</span></button>`;
  }).join("");
}

function bind() {
  els.world = $("world");
  els.wires = $("wires");
  els.nodes = $("nodes");
  els.viewport = $("viewport");
  els.selectionBox = $("selection-box");
  els.workspace = $("workspace");
  els.title = $("map-title");
  els.status = $("status");
  els.legend = $("legend");
  els.legendBody = $("legend-body");
  els.legendClose = $("btn-legend-close");
  els.menu = $("menu");
  els.toast = $("toast");
  els.file = $("file-input");
  els.undo = $("btn-undo");
  els.redo = $("btn-redo");
  els.btnNotes = $("btn-notes");
  els.notes = $("notes");
  els.notesInput = $("notes-input");
  els.notesHeading = $("notes-heading");
  els.selection = $("selection-label");
  els.nodeStyle = $("node-style");
  els.colors = $("colors");
  els.fontSize = $("font-size");
  els.fontValue = $("font-size-value");
  els.fontFamily = $("font-family");
  els.bold = $("btn-bold");
  els.italic = $("btn-italic");
  els.underline = $("btn-underline");
  els.link = $("btn-link");
  els.listBullet = $("btn-list-ul");
  els.listNumber = $("btn-list-ol");
  els.linkHeading = $("link-heading");
  els.arrow = $("btn-arrow");
  els.connectBtn = $("btn-connect");
  els.deleteBtn = $("btn-delete");
  els.banner = $("connect-banner");
  els.empty = $("empty");
  els.zoomLabel = $("btn-zoom-label");
  els.routes = [...document.querySelectorAll("[data-route]")];
  els.dashes = [...document.querySelectorAll("[data-dash]")];

  buildSwatches();
  buildLegend();
  els.colors.addEventListener("click", (e) => {
    const btn = e.target.closest(".swatch");
    if (!btn || els.nodeStyle.disabled) return;
    setColor(btn.dataset.color);
  });
  $("btn-lang").addEventListener("click", () => setLangMenuOpen($("lang-switch").hidden));
  $("lang-switch").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;
    setLanguage(btn.dataset.lang);
    setLangMenuOpen(false);
    $("btn-lang").focus();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!$("lang-switch").hidden && !e.target.closest(".lang-picker")) setLangMenuOpen(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("lang-switch").hidden) {
      e.stopImmediatePropagation();
      setLangMenuOpen(false);
      $("btn-lang").focus();
    }
  }, true);

  $("btn-add").addEventListener("click", () => {
    const id = primaryNode();
    if (id) createChild(id);
    else {
      const rect = els.viewport.getBoundingClientRect();
      createFree(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  });
  $("btn-new").addEventListener("click", newMap);
  $("btn-open").addEventListener("click", () => els.file.click());
  $("btn-save").addEventListener("click", saveFile);
  els.undo.addEventListener("click", undo);
  els.redo.addEventListener("click", redo);
  $("btn-svg").addEventListener("click", exportSvg);
  $("btn-pdf").addEventListener("click", exportPdf);
  $("btn-zoom-in").addEventListener("click", () => zoomCenter(1.1));
  $("btn-zoom-out").addEventListener("click", () => zoomCenter(1 / 1.1));
  els.zoomLabel.addEventListener("click", () => setZoom(1));
  $("btn-fit").addEventListener("click", () => fit());
  els.btnNotes.addEventListener("click", () => setNotesOpen(!state.ui.notesOpen, { focus: !state.ui.notesOpen }));
  $("btn-notes-close").addEventListener("click", () => setNotesOpen(false));
  $("btn-legend").addEventListener("click", () => toggleLegend());
  els.legendClose.addEventListener("click", () => toggleLegend(false));
  els.legend.addEventListener("click", (e) => {
    if (e.target === els.legend) toggleLegend(false);
  });
  document.addEventListener("selectionchange", () => {
    rememberRichRange();
    syncListButtons();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!state.editing) return;
    if (e.target.closest(".editor, #node-style")) return;
    finishEdit();
  }, true);
  for (const control of [els.bold, els.italic, els.underline, els.link, els.listBullet, els.listNumber]) {
    control.addEventListener("pointerdown", (e) => {
      if (!state.editing) return;
      rememberRichRange();
      e.preventDefault();
    });
  }
  els.bold.addEventListener("click", () => toggleFlag("bold"));
  els.italic.addEventListener("click", () => toggleFlag("italic"));
  els.underline.addEventListener("click", () => toggleFlag("underline"));
  els.link.addEventListener("click", addHyperlink);
  els.listBullet.addEventListener("click", () => applyList("ul"));
  els.listNumber.addEventListener("click", () => applyList("ol"));
  els.fontFamily.addEventListener("change", () => setFontFamily(els.fontFamily.value));
  els.connectBtn.addEventListener("click", beginConnect);
  els.deleteBtn.addEventListener("click", deleteSelection);
  els.arrow.addEventListener("click", toggleArrow);
  for (const btn of els.routes) {
    btn.addEventListener("click", () => applyLinkPatch({ route: btn.dataset.route }));
  }
  for (const btn of els.dashes) {
    btn.addEventListener("click", () => applyLinkPatch({ dash: btn.dataset.dash }));
  }

  let sliderBefore = null;
  const armSlider = () => {
    if (!sliderBefore) sliderBefore = serializeContent();
  };
  els.fontSize.addEventListener("pointerdown", armSlider);
  els.fontSize.addEventListener("focus", armSlider);
  const applyTypedFont = (raw) => {
    if (!state.sel.nodes.length || raw === "") return;
    const size = clamp(Math.round(Number(raw)), MIN_FONT, MAX_FONT);
    if (!Number.isFinite(size)) return;
    if (state.editing && applyInlineFontSize(size)) {
      els.fontSize.value = String(size);
      els.fontValue.value = String(size);
      return;
    }
    for (const id of state.sel.nodes) state.nodes[id].fontSize = size;
    if (primaryNode()) captureBrush(state.nodes[primaryNode()]);
    els.fontSize.value = String(size);
    renderAll();
    scheduleSave();
  };
  els.fontSize.addEventListener("input", () => applyTypedFont(els.fontSize.value));
  els.fontValue.addEventListener("focus", armSlider);
  els.fontValue.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.fontValue.blur();
    }
  });
  els.fontValue.addEventListener("change", () => applyTypedFont(els.fontValue.value));
  const commitFontHistory = () => {
    if (sliderBefore && sliderBefore !== serializeContent() && history.at(-1) !== sliderBefore) {
      history.push(sliderBefore);
      future = [];
      updateHistoryButtons();
    }
    sliderBefore = null;
  };
  els.fontSize.addEventListener("change", commitFontHistory);
  els.fontValue.addEventListener("change", commitFontHistory);

  let titleBefore = null;
  els.title.addEventListener("focus", () => {
    titleBefore = serializeContent();
  });
  els.title.addEventListener("input", () => {
    state.title = els.title.value;
    document.title = `${state.title || "Nodora"} · Nodora`;
    scheduleSave();
  });
  els.title.addEventListener("blur", () => {
    if (!state.title.trim()) {
      state.title = t("node.untitled");
      els.title.value = state.title;
    }
    if (titleBefore && titleBefore !== serializeContent() && history.at(-1) !== titleBefore) {
      history.push(titleBefore);
      future = [];
      updateHistoryButtons();
    }
    titleBefore = null;
    scheduleSave();
  });
  els.title.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.title.blur();
    }
  });

  let noteBefore = null;
  els.notesInput.addEventListener("focus", () => {
    noteBefore = serializeContent();
  });
  els.notesInput.addEventListener("input", () => {
    const id = primaryNode();
    if (!id) return;
    state.nodes[id].note = els.notesInput.value;
    updateNoteBits(id);
    dirty = true;
    scheduleSave();
  });
  els.notesInput.addEventListener("blur", () => {
    if (noteBefore && noteBefore !== serializeContent() && history.at(-1) !== noteBefore) {
      history.push(noteBefore);
      future = [];
      updateHistoryButtons();
    }
    noteBefore = null;
  });

  $("autosave").addEventListener("change", (e) => {
    state.autoSave = e.target.checked;
    localStorage.setItem(FLAG_KEY, state.autoSave ? "1" : "0");
    if (state.autoSave) saveLocal();
    else setStatus("status.autosaveOff");
  });

  els.file.addEventListener("change", () => {
    const file = els.file.files?.[0];
    els.file.value = "";
    if (file) openFile(file);
  });

  els.wires.addEventListener("pointerdown", (e) => {
    const id = e.target?.dataset?.edge;
    if (!id) return;
    e.stopPropagation();
    if (e.shiftKey) {
      state.sel.edges = state.sel.edges.includes(id)
        ? state.sel.edges.filter((n) => n !== id)
        : [...state.sel.edges, id];
    } else {
      state.sel = { nodes: [], edges: [id] };
    }
    refreshSelection();
  });
  els.wires.addEventListener("dblclick", (e) => e.stopPropagation());
  els.wires.addEventListener("contextmenu", (e) => {
    const id = e.target?.dataset?.edge;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    state.sel = { nodes: [], edges: [id] };
    refreshSelection();
    openMenu(e.clientX, e.clientY, [
      { label: t("route.curve"), run: () => applyLinkPatch({ route: "curve" }) },
      { label: t("route.straight"), run: () => applyLinkPatch({ route: "straight" }) },
      { label: t("route.elbow"), run: () => applyLinkPatch({ route: "elbow" }) },
      null,
      { label: t("link.arrow"), run: () => toggleArrow() },
      { label: t("menu.delete"), run: () => deleteSelection() },
    ]);
  });

  let pan = null;
  let marquee = null;
  let ignoreClick = false;
  els.viewport.addEventListener("pointerdown", (e) => {
    const onNode = e.target.closest(".node");
    const onEdge = e.target?.dataset?.edge;
    if (e.button === 2) {
      if (onNode || onEdge) return;
      e.preventDefault();
      if (state.editing) finishEdit();
      const rect = els.viewport.getBoundingClientRect();
      marquee = {
        startX: clamp(e.clientX, rect.left, rect.right),
        startY: clamp(e.clientY, rect.top, rect.bottom),
        x: e.clientX,
        y: e.clientY,
        moved: false,
        additive: e.ctrlKey || e.metaKey || e.shiftKey,
        previous: [...state.sel.nodes],
      };
      document.body.classList.add("is-marquee");
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    if (!onNode && !onEdge && state.editing) finishEdit();
    if ((onNode || onEdge) && !spaceDown && e.button !== 1) return;
    pan = {
      x: e.clientX,
      y: e.clientY,
      panX: state.view.panX,
      panY: state.view.panY,
      moved: false,
    };
    els.viewport.classList.add("is-panning");
  });
  window.addEventListener("pointermove", (e) => {
    if (marquee) {
      const rect = els.viewport.getBoundingClientRect();
      marquee.x = clamp(e.clientX, rect.left, rect.right);
      marquee.y = clamp(e.clientY, rect.top, rect.bottom);
      const left = Math.min(marquee.startX, marquee.x);
      const top = Math.min(marquee.startY, marquee.y);
      const width = Math.abs(marquee.x - marquee.startX);
      const height = Math.abs(marquee.y - marquee.startY);
      if (!marquee.moved && Math.hypot(width, height) >= 4) marquee.moved = true;
      if (marquee.moved) {
        els.selectionBox.hidden = false;
        els.selectionBox.style.left = `${left - rect.left}px`;
        els.selectionBox.style.top = `${top - rect.top}px`;
        els.selectionBox.style.width = `${width}px`;
        els.selectionBox.style.height = `${height}px`;
      }
      return;
    }
    if (!pan) return;
    const dx = e.clientX - pan.x;
    const dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 4) return;
    pan.moved = true;
    state.view.panX = pan.panX + dx;
    state.view.panY = pan.panY + dy;
    applyView();
  });
  window.addEventListener("pointerup", () => {
    if (marquee) {
      const current = marquee;
      marquee = null;
      els.selectionBox.hidden = true;
      document.body.classList.remove("is-marquee");
      if (current.moved) {
        const a = clientToWorld(current.startX, current.startY);
        const b = clientToWorld(current.x, current.y);
        const box = {
          left: Math.min(a.x, b.x),
          right: Math.max(a.x, b.x),
          top: Math.min(a.y, b.y),
          bottom: Math.max(a.y, b.y),
        };
        const enclosed = Object.values(state.nodes)
          .filter((node) =>
            node.x < box.right &&
            node.x + node.w > box.left &&
            node.y < box.bottom &&
            node.y + node.h > box.top
          )
          .map((node) => node.id);
        state.sel = {
          nodes: current.additive ? [...new Set([...current.previous, ...enclosed])] : enclosed,
          edges: [],
        };
        if (primaryNode()) captureBrush(state.nodes[primaryNode()]);
        refreshSelection();
      }
      return;
    }
    if (!pan) return;
    const moved = pan.moved;
    pan = null;
    els.viewport.classList.remove("is-panning");
    if (moved) {
      ignoreClick = true;
      scheduleSave();
    }
  });
  els.viewport.addEventListener("click", (e) => {
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    if (e.target.closest(".node") || e.target?.dataset?.edge) return;
    if (state.connectFrom) {
      clearConnect();
      return;
    }
    clearSelection();
  });
  els.viewport.addEventListener("dblclick", (e) => {
    if (eventOnMapItem(e)) return;
    createFree(e.clientX, e.clientY);
  });
  els.viewport.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomAt(e.clientX, e.clientY, factor);
    },
    { passive: false }
  );
  els.viewport.addEventListener("contextmenu", (e) => {
    if (!e.target.closest(".node") && !e.target?.dataset?.edge) e.preventDefault();
  });

  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#menu")) closeMenu();
  }, true);
  window.addEventListener("beforeunload", (e) => {
    if (!state.autoSave && dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("blur", () => {
    spaceDown = false;
    els.viewport.classList.remove("is-space");
  });
}

function setLangMenuOpen(open) {
  const menu = $("lang-switch");
  menu.hidden = !open;
  $("btn-lang").setAttribute("aria-expanded", String(open));
  if (open) (menu.querySelector('[aria-checked="true"]') || menu.querySelector(".lang-btn"))?.focus();
}

function setLanguage(code) {
  if (!LANGS.includes(code) || code === uiLang) return;
  uiLang = code;
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch (err) {
    /* private mode */
  }
  applyStaticI18n();
  renderLangSwitch();
  buildLegend();
  buildSwatches();
  document.querySelectorAll(".port").forEach((el) => el.setAttribute("aria-label", t("aria.port")));
  document.querySelectorAll(".note-dot").forEach((el) => el.setAttribute("aria-label", t("aria.note")));
  const editor = document.querySelector(".editor");
  if (editor) editor.setAttribute("aria-label", t("aria.nodeText"));
  if (els.nodes) refreshSelection();
  if (state.ui.statusKey) setStatus(state.ui.statusKey, state.ui.statusVars);
}

function boot() {
  try {
  uiLang = detectLanguage();
  applyStaticI18n();
  renderLangSwitch();
  bind();
  const flag = localStorage.getItem(FLAG_KEY);
  state.autoSave = flag === null ? true : flag === "1";
  $("autosave").checked = state.autoSave;
  const saved = loadLocal();
  if (saved) {
    applyPersist(saved);
    setStatus(state.autoSave ? "status.resumed" : "status.autosaveOff");
  } else {
    initDefault();
    renderAll();
    requestAnimationFrame(() => fit({ save: true }));
    setStatus("status.autosaveOn");
  }
  updateHistoryButtons();
  } catch (err) {
    console.error(err);
    const status = document.getElementById("status");
    if (status) status.textContent = t("status.bootFail");
  }
}

boot();
