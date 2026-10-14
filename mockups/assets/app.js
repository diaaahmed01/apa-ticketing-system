/* Shared shell, icons and ticket rendering for the mockups. */
(function () {
  const D = window.PITS;

  /* ---------------- Icons (authored, 24px grid, 1.75 stroke) ---------------- */
  const I = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M14 5v2M14 11v2M14 17v2"/>',
    mine: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4"/><path d="m15 19 2 2 4-4"/>',
    create: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    layers: '<path d="M12 3 3 7.5l9 4.5 9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    chevRight: '<path d="m9 18 6-6-6-6"/>',
    collapse: '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18M9 9.5V20"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
    clip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bug: '<path d="m8 2 1.9 1.9M14.1 3.9 16 2"/><path d="M9 7.1v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.5 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M21 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
    change: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    server: '<rect x="3" y="3" width="18" height="7.5" rx="2"/><rect x="3" y="13.5" width="18" height="7.5" rx="2"/><path d="M7 6.75h.01M7 17.25h.01"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    patch: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    flask: '<path d="M9 3h6M10 3v6.5L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7 15h10"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    blocked: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    skip: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    branch: '<circle cx="6" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="9" r="2.5"/><path d="M6 7.5v9M18 11.5c0 3-3 4-6 4.5-2 .3-4 .8-6 2"/>',
    mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'
  };
  function icon(name, cls) {
    return '<svg class="icon ' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[name] || "") + "</svg>";
  }
  function hydrateIcons(root) {
    (root || document).querySelectorAll("i[data-icon]").forEach(function (el) {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  /* ---------------- Formatting helpers ---------------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso, withTime) {
    if (!iso) return "—";
    const d = new Date(iso);
    let s = MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
    if (withTime) s += " · " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return s;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function user(id) { return D.users[id] || null; }
  function avatar(id, size) {
    const u = user(id);
    if (!u) return '<span class="avatar unassigned ' + (size || "") + '" title="Unassigned">' + icon("user", "xs") + "</span>";
    return '<span class="avatar ' + (size || "") + '" style="--av:' + u.color + '" title="' + esc(u.name) + '">' + u.initials + "</span>";
  }
  function person(id, opts) {
    opts = opts || {};
    const u = user(id);
    if (!u) return '<div class="person">' + avatar(null, opts.size) + '<span class="name" style="color:var(--muted);font-weight:500">' + (opts.empty || "Unassigned") + "</span></div>";
    return '<div class="person">' + avatar(id, opts.size) + '<div style="min-width:0"><div class="name">' + esc(u.name) + "</div>" + (opts.org ? '<div class="org">' + esc(opts.org === true ? u.org : opts.org) + "</div>" : "") + "</div></div>";
  }

  function statusBadge(t) {
    if (t.status === "closed") {
      const lbl = { resolved: "Closed · Resolved", unresolved: "Closed · Unresolved", cancelled: "Cancelled" }[t.closure] || "Closed";
      const cls = t.closure === "cancelled" ? "s-cancelled" : t.closure === "unresolved" ? "s-blocked" : "s-closed";
      return '<span class="status ' + cls + '">' + lbl + "</span>";
    }
    return '<span class="status s-' + t.status + '">' + D.statuses[t.status] + "</span>";
  }
  function statusBadgeKey(key) { return '<span class="status s-' + key + '">' + D.statuses[key] + "</span>"; }

  function prioBars(level) {
    const n = { low: 1, medium: 2, high: 3, critical: 3 }[level] || 0;
    let bars = "";
    [4, 7.5, 11].forEach(function (h, i) {
      bars += '<rect x="' + (i * 4.5 + .5) + '" y="' + (12 - h) + '" width="3" height="' + h + '" rx="1" fill="currentColor" opacity="' + (i < n ? 1 : .25) + '"/>';
    });
    return '<svg viewBox="0 0 14 12" aria-hidden="true">' + bars + "</svg>";
  }
  function prioBadge(level) {
    return '<span class="prio ' + level + '">' + prioBars(level) + D.priorities[level] + "</span>";
  }
  function typeLabel(type) {
    return (type === "bug" ? icon("bug", "xs") : icon("change", "xs")) + "<span>" + D.types[type] + "</span>";
  }
  function envLabel(env) {
    return '<span class="env-dot ' + (env === "prod" ? "prod" : "") + '"></span><span>' + D.envs[env] + "</span>";
  }

  /* Barcode: deterministic bar pattern from the ticket id */
  function barcode(seed, w, h) {
    w = w || 64; h = h || 22;
    let x = 0, out = "", s = Number(String(seed).replace(/\D/g, "")) * 9301 + 49297;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    while (x < w - 2) {
      const bw = rnd() > .62 ? 2.2 : 1;
      out += '<rect x="' + x.toFixed(1) + '" y="0" width="' + bw + '" height="' + h + '" fill="currentColor"/>';
      x += bw + (rnd() > .55 ? 2.4 : 1.4);
    }
    return '<svg class="barcode" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' + out + "</svg>";
  }

  /* ---------------- Ticket card ---------------- */
  function ticketCard(t, opts) {
    opts = opts || {};
    const tag = opts.static ? "div" : "a";
    const href = opts.static ? "" : ' href="' + (opts.href || "ticket.html?id=" + t.id) + '"';
    const closed = t.status === "closed";
    const stamp = closed ? '<div class="stamp ' + (t.closure || "") + '">' + (t.closure === "cancelled" ? "Cancelled" : t.closure === "unresolved" ? "Unresolved" : "Resolved") + "</div>" : "";
    const dirAttr = t.ar ? ' dir="rtl" lang="ar"' : ' dir="auto"';
    return (
      "<" + tag + href + ' class="tk p-' + t.priority + (closed ? " is-closed" : "") + '" data-id="' + t.id + '">' +
      '<div class="tk-paper">' + stamp +
        '<div class="tk-head">' +
          '<div class="tk-id"><small>' + (t.type === "bug" ? icon("bug", "xs") + "Bug" : icon("change", "xs") + "Change request") + "</small><b><span>#TKT-</span>" + t.id + "</b></div>" +
          '<div class="tk-badges">' + prioBadge(t.priority) + statusBadge(t) + "</div>" +
        "</div>" +
        '<div class="tk-body">' +
          '<h3 class="tk-title' + (t.ar ? " ar" : "") + '"' + dirAttr + ">" + esc(t.title) + "</h3>" +
          '<p class="tk-desc' + (t.ar ? " ar" : "") + '"' + dirAttr + ">" + esc(t.desc) + "</p>" +
          '<dl class="tk-fields">' +
            '<div class="tk-f"><dt>Module</dt><dd>' + icon("box", "xs") + "<span>" + esc(t.module) + "</span></dd></div>" +
            '<div class="tk-f"><dt>Environment</dt><dd>' + envLabel(t.env) + "</dd></div>" +
          "</dl>" +
        "</div>" +
        '<div class="perf"></div>' +
        '<div class="tk-crew">' +
          '<div class="crew lead"><div class="tk-k">Assignee</div>' + person(t.assignee, { size: "xs" }) + "</div>" +
          '<div class="crew"><div class="tk-k">Reviewer</div>' + person(t.reviewer, { size: "xs", empty: "—" }) + "</div>" +
          '<div class="crew"><div class="tk-k">Tester</div>' + person(t.tester, { size: "xs", empty: "—" }) + "</div>" +
        "</div>" +
        '<div class="tk-foot">' + barcode(t.id) +
          '<div class="meta"><b>' + esc((user(t.creator) || {}).name || "—") + "</b><br>" + fmtDate(t.created) + "</div>" +
          (opts.static ? "" : '<span class="go">View details ' + icon("arrowRight", "xs") + "</span>") +
        "</div>" +
      "</div></" + tag + ">"
    );
  }

  /* ---------------- Notches: cut the paper at every perforation ---------------- */
  function offsetWithin(el, ancestor) {
    let x = 0, y = 0, n = el;
    while (n && n !== ancestor) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y };
  }
  function cutNotches(paper) {
    const tk = paper.closest(".tk");
    const r = parseFloat(getComputedStyle(tk || paper).getPropertyValue("--notch")) || 10;
    const layers = [];
    paper.querySelectorAll(".perf, .vperf").forEach(function (p) {
      if (p.closest(".tk-paper") !== paper || p.offsetParent === null) return;
      const o = offsetWithin(p, paper);
      if (p.classList.contains("perf")) {
        const y = (o.y + 0.75).toFixed(1) + "px";
        const rtl = getComputedStyle(paper).direction === "rtl";
        const side = p.dataset.notch; // "start" | "end" | undefined (both)
        const sx = rtl ? "100%" : "0", ex = rtl ? "0" : "100%";
        if (side !== "end") layers.push("radial-gradient(circle " + r + "px at " + sx + " " + y + ", #0000 " + (r - .5) + "px, #000 " + r + "px)");
        if (side !== "start") layers.push("radial-gradient(circle " + r + "px at " + ex + " " + y + ", #0000 " + (r - .5) + "px, #000 " + r + "px)");
      } else {
        const x = (o.x + p.offsetWidth / 2).toFixed(1) + "px";
        layers.push("radial-gradient(circle " + r + "px at " + x + " 0, #0000 " + (r - .5) + "px, #000 " + r + "px)");
        layers.push("radial-gradient(circle " + r + "px at " + x + " 100%, #0000 " + (r - .5) + "px, #000 " + r + "px)");
      }
    });
    paper.style.setProperty("--tk-mask", layers.length ? layers.join(",") : "none");
  }
  const ro = "ResizeObserver" in window ? new ResizeObserver(function (entries) { entries.forEach(function (e) { cutNotches(e.target); }); }) : null;
  function notchAll(root) {
    (root || document).querySelectorAll(".tk-paper").forEach(function (p) {
      cutNotches(p);
      if (ro && !p.__observed) { ro.observe(p); p.__observed = true; }
    });
  }

  /* ---------------- Shell ---------------- */
  const NAV = [
    { key: "dashboard", label: "Dashboard", ar: "لوحة التحكم", icon: "dashboard", href: "#" },
    { key: "tickets", label: "All Tickets", ar: "كل التذاكر", icon: "ticket", href: "tickets.html", count: 128 },
    { key: "mine", label: "My Tickets", ar: "تذاكري", icon: "mine", href: "tickets.html", count: 7 },
    { key: "create", label: "Create Ticket", ar: "تذكرة جديدة", icon: "create", href: "create.html" },
    { key: "notifications", label: "Notifications", ar: "الإشعارات", icon: "bell", href: "#", count: 4, hot: true },
    { section: "Administration", ar: "الإدارة" },
    { key: "users", label: "User Management", ar: "إدارة المستخدمين", icon: "users", href: "#" },
    { key: "permissions", label: "Roles & Permissions", ar: "الأدوار والصلاحيات", icon: "shield", href: "permissions.html" },
    { key: "modules", label: "Module Management", ar: "إدارة الموديولات", icon: "layers", href: "#" },
    { key: "settings", label: "Settings", ar: "الإعدادات", icon: "settings", href: "#" }
  ];

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function mount(cfg) {
    const app = document.getElementById("app");
    const isAr = store("pits-dir") === "rtl";
    if (isAr) { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; }
    if (store("pits-collapsed") === "1") app.classList.add("collapsed");

    const me = user(D.me);
    if (!document.querySelector("link[rel=icon]")) { const fl = document.createElement("link"); fl.rel = "icon"; fl.href = "assets/favicon.png"; document.head.appendChild(fl); }
    let nav = "";
    NAV.forEach(function (n) {
      if (n.section) { nav += '<div class="nav-label" data-en="' + n.section + '" data-ar="' + n.ar + '">' + (isAr ? n.ar : n.section) + "</div>"; return; }
      const soon = n.href === "#";
      nav += '<a href="' + n.href + '"' + (n.key === cfg.active ? ' class="active" aria-current="page"' : "") + (soon ? ' data-soon="1"' : "") + ' title="' + n.label + '">' +
        icon(n.icon) + '<span data-en="' + n.label + '" data-ar="' + n.ar + '">' + (isAr ? n.ar : n.label) + "</span>" +
        (n.count ? '<em class="count' + (n.hot ? " hot" : "") + '" style="font-style:normal">' + n.count + "</em>" : "") + "</a>";
    });

    document.getElementById("sidebar").innerHTML =
      '<a class="brand" href="tickets.html"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5a2.5 2.5 0 0 1 0 5V17a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3.5a2.5 2.5 0 0 1 0-5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z"/><path d="M8 10h5M8 14h8"/></svg></span>' +
        '<span class="brand-text"><strong>APA Ticketing System</strong><span>Port of Alexandria</span></span></a>' +
      '<nav class="nav" aria-label="Main">' + nav + "</nav>" +
      '<div class="sidebar-foot"><button class="collapse-btn" id="collapseBtn" type="button">' + icon("collapse") + "<span>Collapse</span></button></div>";

    const crumbs = (cfg.crumbs || []).map(function (c, i, a) {
      const last = i === a.length - 1;
      return (i ? '<span class="sep hide-sm">/</span>' : "") + (last ? "<strong>" + c.label + "</strong>" : '<a class="hide-sm" href="' + (c.href || "#") + '">' + c.label + "</a>");
    }).join("");

    document.getElementById("topbar").innerHTML =
      '<button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Open navigation">' + icon("menu") + "</button>" +
      '<div class="crumbs">' + crumbs + "</div>" +
      '<label class="global-search">' + icon("search", "sm") + '<input type="search" placeholder="Search tickets, people, patches…" aria-label="Global search"><kbd>Ctrl K</kbd></label>' +
      '<div class="top-actions">' +
        '<button class="lang-btn" id="langBtn" type="button" title="Switch interface direction">' + (isAr ? "EN" : "عربي") + "</button>" +
        '<button class="icon-btn" type="button" aria-label="Notifications, 4 unread" data-soon="1">' + icon("bell") + '<span class="dot"></span></button>' +
        '<div class="profile">' + avatar(D.me, "") + '<div class="who"><strong>' + me.name + "</strong><span>" + me.roles[0] + "</span></div>" + icon("chevDown", "sm") + "</div>" +
      "</div>";

    if (!document.querySelector(".scrim")) { const s = document.createElement("div"); s.className = "scrim"; app.appendChild(s); }

    document.getElementById("collapseBtn").addEventListener("click", function () {
      app.classList.toggle("collapsed");
      store("pits-collapsed", app.classList.contains("collapsed") ? "1" : "0");
      setTimeout(function () { notchAll(); }, 260);
    });
    document.getElementById("menuBtn").addEventListener("click", function () { app.classList.add("drawer-open"); });
    app.querySelector(".scrim").addEventListener("click", function () { app.classList.remove("drawer-open"); });
    document.getElementById("langBtn").addEventListener("click", function () {
      const rtl = document.documentElement.dir !== "rtl";
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.documentElement.lang = rtl ? "ar" : "en";
      store("pits-dir", rtl ? "rtl" : "ltr");
      this.textContent = rtl ? "EN" : "عربي";
      document.querySelectorAll("[data-en][data-ar]").forEach(function (el) { el.textContent = rtl ? el.dataset.ar : el.dataset.en; });
      notchAll();
    });
    document.addEventListener("click", function (e) {
      const soon = e.target.closest("[data-soon]");
      if (soon) { e.preventDefault(); toast("That screen is part of the next design round."); }
    });

    hydrateIcons();
    notchAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { notchAll(); });
  }

  let toastTimer;
  function toast(msg, ic) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = icon(ic || "info") + "<span>" + msg + "</span>";
    requestAnimationFrame(function () { t.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  window.UI = { icon: icon, hydrateIcons: hydrateIcons, fmtDate: fmtDate, esc: esc, user: user, avatar: avatar, person: person, statusBadge: statusBadge, statusBadgeKey: statusBadgeKey, prioBadge: prioBadge, prioBars: prioBars, typeLabel: typeLabel, envLabel: envLabel, barcode: barcode, ticketCard: ticketCard, notchAll: notchAll, cutNotches: cutNotches, mount: mount, toast: toast };
})();
