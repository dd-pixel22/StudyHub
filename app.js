/* ===== Binary Search Tree (keyed on contact ID) ===== */
class Node {
  constructor(id, name, phone) {
    this.id = id; this.name = name; this.phone = phone;
    this.left = null; this.right = null;
  }
}

class BST {
  constructor() { this.root = null; this.size = 0; }

  // Insert: go left if smaller, right if larger. Returns false on duplicate ID.
  insert(id, name, phone) {
    const node = new Node(id, name, phone);
    if (!this.root) { this.root = node; this.size++; return true; }
    let cur = this.root;
    while (true) {
      if (id === cur.id) return false;
      const side = id < cur.id ? "left" : "right";
      if (!cur[side]) { cur[side] = node; this.size++; return true; }
      cur = cur[side];
    }
  }

  // Search: returns the node (or null) and how many nodes were compared.
  search(id) {
    let cur = this.root, steps = 0;
    while (cur) {
      steps++;
      if (id === cur.id) return { node: cur, steps };
      cur = id < cur.id ? cur.left : cur.right;
    }
    return { node: null, steps };
  }

  // Delete: leaf, one child, or two children (use inorder successor).
  delete(id) {
    let found = false;
    const rec = (n) => {
      if (!n) return null;
      if (id < n.id) { n.left = rec(n.left); return n; }
      if (id > n.id) { n.right = rec(n.right); return n; }
      found = true;
      if (!n.left) return n.right;
      if (!n.right) return n.left;
      let s = n.right;
      while (s.left) s = s.left;
      n.id = s.id; n.name = s.name; n.phone = s.phone;
      const target = s.id;
      const removeMin = (m) => {
        if (m.id === target && !m.left) return m.right;
        m.left = removeMin(m.left);
        return m;
      };
      n.right = removeMin(n.right);
      return n;
    };
    this.root = rec(this.root);
    if (found) this.size--;
    return found;
  }

  // Inorder traversal: left, node, right -> ascending by ID.
  inorder() {
    const out = [];
    const walk = (n) => { if (!n) return; walk(n.left); out.push(n); walk(n.right); };
    walk(this.root);
    return out;
  }

  preorder() {
    const out = [];
    const walk = (n) => { if (!n) return; out.push(n); walk(n.left); walk(n.right); };
    walk(this.root);
    return out;
  }

  height() {
    const h = (n) => (n ? 1 + Math.max(h(n.left), h(n.right)) : 0);
    return h(this.root);
  }

  clear() { this.root = null; this.size = 0; }
}

/* ===== App state ===== */
const tree = new BST();
let stats = { added: 0, searched: 0, deleted: 0 };
let log = [];
let history = [0];
let hitId = null;
const KEY = "contactbst-v1";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SAMPLE = [
  [50, "Aarav Sharma", "9876543210"], [30, "Diya Reddy", "9123456780"],
  [70, "Kabir Singh", "9988776655"], [20, "Ananya Rao", "9012345678"],
  [40, "Rohan Mehta", "9345678901"], [60, "Meera Nair", "9456123780"],
  [80, "Ishaan Gupta", "9567890123"], [35, "Sara Khan", "9678901234"]
];

/* ===== Persistence ===== */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      nodes: tree.preorder().map((n) => [n.id, n.name, n.phone]), stats, log, history
    }));
  } catch (e) { /* storage unavailable: app still works for this session */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d) return;
    d.nodes.forEach(([i, n, p]) => tree.insert(i, n, p)); // preorder keeps the same tree shape
    stats = d.stats || stats; log = d.log || []; history = d.history || [tree.size];
  } catch (e) { /* ignore corrupt data */ }
}

/* ===== Messages ===== */
function say(text, type = "") {
  const m = $("msg");
  m.textContent = text;
  m.className = "msg " + type;
}
let toastTimer;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
function record(text) {
  log.unshift({ text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) });
  log = log.slice(0, 5);
  history.push(tree.size);
  history = history.slice(-24);
}

/* ===== Input helpers ===== */
function readId(value) {
  const v = String(value).trim();
  if (!/^\d+$/.test(v) || Number(v) < 1) return null;
  return Number(v);
}
const cleanPhone = (p) => p.replace(/[\s-]/g, "");
const validPhone = (p) => /^\+?\d{7,15}$/.test(cleanPhone(p));

/* ===== Operations ===== */
function addContact() {
  const id = readId($("cid").value), name = $("cname").value.trim(), phone = $("cphone").value.trim();
  if (id === null) return say("Enter a contact ID using whole numbers, like 101.", "err");
  if (!name) return say("Enter the contact's name.", "err");
  if (!validPhone(phone)) return say("Enter a phone number with 7 to 15 digits. A leading + is allowed.", "err");
  if (!tree.insert(id, name, cleanPhone(phone))) return say(`ID ${id} already exists. Each contact needs a unique ID.`, "err");
  stats.added++; hitId = id;
  record(`Added ${name} (ID ${id})`);
  say(`${name} was added with ID ${id}.`, "ok");
  $("form").reset(); $("cid").focus();
  render();
}

function searchContact(raw) {
  const id = readId(raw);
  if (id === null) return say("Enter the contact ID you want to find.", "err");
  stats.searched++;
  const { node, steps } = tree.search(id);
  if (node) {
    hitId = id;
    record(`Found ID ${id}`);
    say(`Found: ${node.name}, ${node.phone}. Checked ${steps} node${steps > 1 ? "s" : ""}.`, "ok");
    render();
    const row = document.querySelector("tr.hit");
    if (row) row.scrollIntoView({ block: "center", behavior: "smooth" });
  } else {
    hitId = null;
    record(`No contact with ID ${id}`);
    say(`Contact not found. No contact has ID ${id}.`, "err");
    render();
  }
}

function deleteContact(raw) {
  const id = readId(raw);
  if (id === null) return say("Enter the contact ID you want to delete.", "err");
  const existing = tree.search(id).node;
  const name = existing ? existing.name : "";
  if (tree.delete(id)) {
    stats.deleted++; hitId = null;
    record(`Deleted ${name} (ID ${id})`);
    say(`${name} (ID ${id}) was deleted.`, "ok");
    render();
  } else {
    say(`Contact not found. No contact has ID ${id}, so nothing was deleted.`, "err");
  }
}

function showAll() {
  hitId = null; render();
  const n = tree.size;
  say(n ? `Showing ${n} contact${n > 1 ? "s" : ""} in ascending ID order (inorder traversal).` : "There are no contacts to display yet.", n ? "ok" : "err");
  $("contacts").scrollIntoView({ behavior: "smooth" });
}

/* ===== Rendering ===== */
function render() {
  const list = tree.inorder();

  $("rows").innerHTML = list.length
    ? list.map((n) => `<tr class="${n.id === hitId ? "hit" : ""}"><td class="id">${n.id}</td><td>${esc(n.name)}</td><td>${esc(n.phone)}</td><td class="act"><button class="del" data-id="${n.id}" aria-label="Delete ${esc(n.name)}"><svg class="i"><use href="#i-trash"/></svg></button></td></tr>`).join("")
    : `<tr class="empty-row"><td colspan="4">No contacts yet. Add one above, or load the sample data.</td></tr>`;

  $("sN").textContent = tree.size;
  $("sH").textContent = tree.height();
  $("sR").textContent = tree.root ? tree.root.id : "-";
  $("aA").textContent = stats.added;
  $("aS").textContent = stats.searched;
  $("aD").textContent = stats.deleted;

  $("log").innerHTML = log.length
    ? log.map((l) => `<li>${esc(l.text)}<small>${l.time}</small></li>`).join("")
    : `<li class="empty">Nothing yet</li>`;

  drawTree(list);
  drawSpark();
  save();
}

function drawTree(list) {
  const svg = $("treeSvg");
  if (!tree.root) {
    svg.setAttribute("width", 300); svg.setAttribute("height", 60); svg.setAttribute("viewBox", "0 0 300 60");
    svg.innerHTML = `<text x="150" y="30" style="fill:#a79fc9;font-weight:400;font-size:13px">The tree is empty.</text>`;
    return;
  }
  const GX = 46, GY = 62, R = 18, pos = new Map();
  list.forEach((n, i) => pos.set(n, { x: 30 + i * GX }));
  const setY = (n, d) => { if (!n) return; pos.get(n).y = 30 + d * GY; setY(n.left, d + 1); setY(n.right, d + 1); };
  setY(tree.root, 0);
  const W = Math.max(300, 60 + (list.length - 1) * GX), H = 60 + (tree.height() - 1) * GY;
  let edges = "", nodes = "";
  pos.forEach((p, n) => {
    [n.left, n.right].forEach((c) => {
      if (c) { const q = pos.get(c); edges += `<line class="edge" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/>`; }
    });
    nodes += `<g class="${n.id === hitId ? "hit" : ""}"><circle cx="${p.x}" cy="${p.y}" r="${R}"/><text x="${p.x}" y="${p.y}" ${String(n.id).length > 3 ? 'style="font-size:9px"' : ""}>${n.id}</text></g>`;
  });
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `<defs><radialGradient id="ng" cx="30%" cy="30%"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#4b2fd6"/></radialGradient></defs>${edges}${nodes}`;
}

function drawSpark() {
  const h = history.length > 1 ? history : [0, history[0] || 0];
  const max = Math.max(1, ...h), step = 200 / (h.length - 1);
  const pts = h.map((v, i) => `${(i * step).toFixed(1)},${(40 - (v / max) * 34).toFixed(1)}`);
  $("spark").innerHTML = `<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity=".5"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient></defs><polygon points="0,44 ${pts.join(" ")} 200,44" fill="url(#sg)"/><polyline points="${pts.join(" ")}" fill="none" stroke="#a78bfa" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
}

/* ===== Events ===== */
$("form").addEventListener("submit", (e) => { e.preventDefault(); addContact(); });
$("bSearch").addEventListener("click", () => searchContact($("cid").value));
$("bDelete").addEventListener("click", () => deleteContact($("cid").value));
$("bShow").addEventListener("click", showAll);
$("bClear").addEventListener("click", () => {
  if (!tree.size) return say("There are no contacts to clear.", "err");
  if (!confirm("Delete all contacts? This cannot be undone.")) return;
  tree.clear(); hitId = null;
  record("Cleared all contacts");
  say("All contacts were cleared.", "ok");
  render();
});
$("quick").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { $("cid").value = $("quick").value; searchContact($("quick").value); }
});
$("sample").addEventListener("click", () => {
  let added = 0;
  SAMPLE.forEach(([i, n, p]) => { if (tree.insert(i, n, p)) added++; });
  if (added) { stats.added += added; record(`Loaded ${added} sample contacts`); }
  say(added ? `Loaded ${added} sample contacts.` : "Sample contacts are already loaded.", added ? "ok" : "err");
  render();
});
$("rows").addEventListener("click", (e) => {
  const b = e.target.closest(".del");
  if (b) deleteContact(b.dataset.id);
});
document.querySelectorAll(".nav a").forEach((a) =>
  a.addEventListener("click", () => {
    document.querySelectorAll(".nav a").forEach((x) => x.classList.remove("active"));
    a.classList.add("active");
  })
);

load();
render();
