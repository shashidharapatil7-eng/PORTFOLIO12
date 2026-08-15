(function () {
  const store = window.IFStore;

  /* ---------------- helpers ---------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const countOrDash = (n) => (n > 0 ? n : "—");
  const fmtRange = (start, end) => {
    if (!start && !end) return "";
    return `${start || "—"} – ${end || "Present"}`;
  };

  /* ---------------- theme ---------------- */
  function initTheme() {
    const saved = localStorage.getItem("insightforge:theme");
    const theme = saved || store.get().meta.themeDefault || "dark";
    document.documentElement.setAttribute("data-theme", theme);
    updateThemeIcon(theme);
  }
  function updateThemeIcon(theme) {
    $("#themeIconMoon").classList.toggle("hidden", theme === "light");
    $("#themeIconSun").classList.toggle("hidden", theme !== "light");
  }
  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("insightforge:theme", next);
    updateThemeIcon(next);
  });

  /* ---------------- mobile nav ---------------- */
  $("#navToggle").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => $("#navLinks").classList.remove("open")));

  /* ---------------- routing ---------------- */
  const ROUTES = ["home", "about", "projects", "skills", "certifications", "resources", "resume", "contact"];
  function navigate(route) {
    if (!ROUTES.includes(route)) route = "home";
    $$(".page").forEach((p) => p.classList.remove("active"));
    $(`#page-${route}`)?.classList.add("active");
    $$("[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = route === "home" ? "InsightForge — Shashidhar A. Patil" : `${route[0].toUpperCase()}${route.slice(1)} · InsightForge`;
  }
  window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "") || "home"));
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-route]");
    if (el) setTimeout(() => navigate(el.dataset.route), 0);
  });

  /* ---------------- render: nav / meta ---------------- */
  function renderMeta(data) {
    document.title = "InsightForge — " + (data.profile.name || "Portfolio");
    $("#navTagline").textContent = data.meta.tagline;
    $("meta[name='description']").setAttribute("content", data.meta.seoDescription);
    if (data.meta.favicon) $("#favicon").setAttribute("href", data.meta.favicon);
    if (data.settings?.accent) document.documentElement.style.setProperty("--accent", data.settings.accent);
  }

  /* ---------------- render: hero / stats ---------------- */
  function renderHome(data) {
    $("#heroIntro").textContent = data.profile.intro;
    const stats = [
      { label: "Projects", n: data.projects.filter((p) => p.published !== false).length },
      { label: "Skills", n: data.skillCategories.reduce((a, c) => a + (c.skills?.length || 0), 0) },
      { label: "Certifications", n: data.certifications.length },
      { label: "Resources", n: Object.values(data.resources).reduce((a, arr) => a + arr.length, 0) },
    ];
    $("#statGrid").innerHTML = stats
      .map(
        (s) => `
      <div class="card stat-card reveal in">
        <div class="stat-num">${countOrDash(s.n)}</div>
        <div class="stat-label">${esc(s.label)}${s.n === 0 ? " · Coming Soon" : ""}</div>
      </div>`
      )
      .join("");
  }

  /* ---------------- render: about (+ experience + education) ---------------- */
  function renderAbout(data) {
    $("#aboutPhoto").innerHTML = data.profile.photo
      ? `<img src="${esc(data.profile.photo)}" alt="${esc(data.profile.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />`
      : "Photo — to be added";
    const bio = (data.profile.bio || "").trim();
    $("#aboutBody").innerHTML = bio
      ? bio.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join("")
      : `<div class="about-placeholder">Biography — work in progress. This section will be written and published from the Admin Panel → About Editor.</div>`;

    const expWrap = $("#experienceList");
    if (expWrap) {
      expWrap.innerHTML = data.experience.length
        ? data.experience
            .map(
              (e) => `
        <div class="card timeline-card reveal in">
          <div class="timeline-head"><h4>${esc(e.title || "Untitled role")}</h4><span class="mono timeline-range">${esc(fmtRange(e.start, e.end))}</span></div>
          <p class="timeline-org">${esc(e.company || "")}</p>
          ${e.description ? `<p>${esc(e.description)}</p>` : ""}
        </div>`
            )
            .join("")
        : `<div class="about-placeholder">Experience — coming soon.</div>`;
    }
    const eduWrap = $("#educationList");
    if (eduWrap) {
      eduWrap.innerHTML = data.education.length
        ? data.education
            .map(
              (e) => `
        <div class="card timeline-card reveal in">
          <div class="timeline-head"><h4>${esc(e.institution || "Untitled")}</h4><span class="mono timeline-range">${esc(fmtRange(e.start, e.end))}</span></div>
          <p class="timeline-org">${esc([e.degree, e.field].filter(Boolean).join(" · "))}</p>
          ${e.description ? `<p>${esc(e.description)}</p>` : ""}
        </div>`
            )
            .join("")
        : `<div class="about-placeholder">Education — coming soon.</div>`;
    }
  }

  /* ---------------- render: skills ---------------- */
  function renderSkills(data) {
    $("#skillsGrid").innerHTML = data.skillCategories.length
      ? data.skillCategories
          .map(
            (cat) => `
      <div class="card skill-card reveal in">
        <h3>${esc(cat.name)}</h3>
        <div class="skill-tags">
          ${(cat.skills || []).map((s) => `<span class="skill-tag">${esc(s)}</span>`).join("") || `<span class="skill-tag">Coming Soon</span>`}
        </div>
      </div>`
          )
          .join("")
      : `<div class="empty-state"><h3>Coming Soon</h3><p>Skill categories will appear here once added from the Admin Panel.</p></div>`;
  }

  /* ---------------- render: projects ---------------- */
  let projectFilter = "All";
  let projectQuery = "";
  function statusBadgeClass(status) {
    if (!status) return "status-planned";
    const s = status.toLowerCase();
    if (s.includes("live") || s.includes("complete")) return "status-live";
    if (s.includes("progress")) return "status-progress";
    return "status-planned";
  }
  function renderProjects(data) {
    const published = data.projects.filter((p) => p.published !== false);
    const categories = ["All", ...new Set(published.map((p) => p.category).filter(Boolean))];
    $("#projectFilters").innerHTML = categories
      .map((c) => `<button class="chip ${c === projectFilter ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
    $$("#projectFilters .chip").forEach((btn) =>
      btn.addEventListener("click", () => { projectFilter = btn.dataset.cat; renderProjects(store.get()); })
    );

    let list = published;
    if (projectFilter !== "All") list = list.filter((p) => p.category === projectFilter);
    if (projectQuery) {
      const q = projectQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q) ||
          (p.tools || []).join(" ").toLowerCase().includes(q) ||
          (p.tags || []).join(" ").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

    if (list.length === 0) {
      $("#projectGrid").innerHTML = `
        <div class="empty-state">
          <h3>Coming Soon</h3>
          <p>Projects are added here as they're completed. Check back soon, or explore the other sections in the meantime.</p>
        </div>`;
      return;
    }

    $("#projectGrid").innerHTML = list
      .map((p) => {
        const shots = (p.screenshots || []).slice(0, 3);
        return `
      <div class="card project-card reveal in" data-project-id="${esc(p.id)}">
        <div class="project-cover">
          ${p.coverImage ? `<img src="${esc(p.coverImage)}" alt="${esc(p.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />` : "Cover image — to be added"}
          ${p.featured ? `<span class="badge featured">Featured</span>` : ""}
          <span class="badge ${statusBadgeClass(p.status)}">${esc(p.status || "Planned")}</span>
        </div>
        <div class="project-body">
          <h3>${esc(p.title || "Untitled Project")}</h3>
          ${p.subtitle ? `<p class="project-subtitle">${esc(p.subtitle)}</p>` : ""}
          <p>${esc(p.description || "Description to be added.")}</p>
          ${(p.start || p.end) ? `<p class="mono" style="font-size:.76rem;color:var(--text-tertiary);">${esc(fmtRange(p.start, p.end))}</p>` : ""}
          <div class="tool-tags">${(p.tools || []).map((t) => `<span>${esc(t)}</span>`).join("")}</div>
          ${shots.length ? `<div class="shot-strip">${shots.map((s) => `<img src="${esc(s)}" alt="" loading="lazy" />`).join("")}</div>` : ""}
          <div class="project-links">
            <button class="btn btn-secondary btn-sm" data-view-details="${esc(p.id)}" type="button">View Details</button>
            ${p.github ? `<a class="btn btn-secondary btn-sm" href="${esc(p.github)}" target="_blank" rel="noopener">GitHub</a>` : ""}
            ${p.demo ? `<a class="btn btn-secondary btn-sm" href="${esc(p.demo)}" target="_blank" rel="noopener">Live Demo</a>` : ""}
            ${p.dashboard ? `<a class="btn btn-secondary btn-sm" href="${esc(p.dashboard)}" target="_blank" rel="noopener">Dashboard</a>` : ""}
            ${p.resourceFolder ? `<a class="btn btn-secondary btn-sm" href="${esc(p.resourceFolder)}" target="_blank" rel="noopener">Resources</a>` : ""}
          </div>
        </div>
      </div>`;
      })
      .join("");

    $$("#projectGrid [data-view-details]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openProjectModal(btn.dataset.viewDetails);
      })
    );
    $$("#projectGrid .project-card").forEach((card) =>
      card.addEventListener("click", () => openProjectModal(card.dataset.projectId))
    );
  }
  $("#projectSearch").addEventListener("input", (e) => { projectQuery = e.target.value; renderProjects(store.get()); });

  /* ---------------- project details modal ---------------- */
  function openProjectModal(id) {
    const p = store.get().projects.find((x) => x.id === id);
    if (!p) return;
    const shots = p.screenshots || [];
    $("#projectModalBody").innerHTML = `
      <div class="modal-title-row">
        <div>
          <h2 id="projectModalTitle">${esc(p.title || "Untitled Project")}</h2>
          ${p.subtitle ? `<div class="modal-subtitle">${esc(p.subtitle)}</div>` : ""}
        </div>
      </div>
      <div class="modal-meta-row">
        ${p.category ? `<span class="pill">${esc(p.category)}</span>` : ""}
        <span class="badge ${statusBadgeClass(p.status)}" style="position:static;">${esc(p.status || "Planned")}</span>
        ${(p.start || p.end) ? `<span class="pill mono">${esc(fmtRange(p.start, p.end))}</span>` : ""}
      </div>
      <p class="modal-desc">${esc(p.description || "Description to be added.")}</p>
      ${p.tools?.length ? `<div class="tool-tags" style="margin-bottom:18px;">${p.tools.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      ${shots.length ? `<div class="modal-shots">${shots.map((s) => `<img src="${esc(s)}" alt="" loading="lazy" />`).join("")}</div>` : ""}
      <div class="project-links">
        ${p.github ? `<a class="btn btn-secondary btn-sm" href="${esc(p.github)}" target="_blank" rel="noopener">GitHub</a>` : ""}
        ${p.demo ? `<a class="btn btn-secondary btn-sm" href="${esc(p.demo)}" target="_blank" rel="noopener">Live Demo</a>` : ""}
        ${p.dashboard ? `<a class="btn btn-secondary btn-sm" href="${esc(p.dashboard)}" target="_blank" rel="noopener">Dashboard</a>` : ""}
        ${p.resourceFolder ? `<a class="btn btn-secondary btn-sm" href="${esc(p.resourceFolder)}" target="_blank" rel="noopener">Resource Folder</a>` : ""}
      </div>
    `;
    $("#projectModalOverlay").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function closeProjectModal() {
    $("#projectModalOverlay").classList.add("hidden");
    document.body.style.overflow = "";
  }
  $("#projectModalClose").addEventListener("click", closeProjectModal);
  $("#projectModalOverlay").addEventListener("click", (e) => { if (e.target.id === "projectModalOverlay") closeProjectModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeProjectModal(); });

  /* ---------------- render: certifications ---------------- */
  function renderCertifications(data) {
    if (!data.certifications.length) {
      $("#certGrid").innerHTML = `<div class="empty-state"><h3>Coming Soon</h3><p>Certifications will appear here once added through the Admin Panel.</p></div>`;
      return;
    }
    $("#certGrid").innerHTML = data.certifications
      .map(
        (c) => `
      <div class="card cert-card reveal in">
        <div class="cert-icon">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />` : esc((c.issuer || "IF").slice(0, 2).toUpperCase())}</div>
        <div>
          <h3 style="font-size:0.98rem;">${esc(c.title || "Untitled Certification")}</h3>
          <div class="cert-meta">
            <div>${esc(c.issuer || "Issuer to be added")}</div>
            <div>${esc(c.date || "Date to be added")}</div>
            ${c.credentialId ? `<div>ID: ${esc(c.credentialId)}</div>` : ""}
          </div>
          <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            ${c.verifyLink ? `<a class="btn btn-secondary btn-sm" href="${esc(c.verifyLink)}" target="_blank" rel="noopener">Verify</a>` : ""}
            ${c.pdf ? `<a class="btn btn-secondary btn-sm" href="${esc(c.pdf)}" target="_blank" rel="noopener">View PDF</a>` : ""}
          </div>
        </div>
      </div>`
      )
      .join("");
  }

  /* ---------------- render: resources ---------------- */
  let resourceTab = null;
  function renderResources(data) {
    const cats = Object.keys(data.resources);
    if (!resourceTab || !cats.includes(resourceTab)) resourceTab = cats[0];
    $("#resourceTabs").innerHTML = cats
      .map((c) => `<button class="chip ${c === resourceTab ? "active" : ""}" data-tab="${esc(c)}">${esc(c)} <span class="mono" style="opacity:.6">(${data.resources[c].length})</span></button>`)
      .join("");
    $$("#resourceTabs .chip").forEach((btn) =>
      btn.addEventListener("click", () => { resourceTab = btn.dataset.tab; renderResources(store.get()); })
    );
    const items = data.resources[resourceTab] || [];
    if (!items.length) {
      $("#resourceList").innerHTML = `<div class="empty-state"><h3>Coming Soon</h3><p>${esc(resourceTab)} will be added here over time — this list can grow without limit from the Admin Panel.</p></div>`;
      return;
    }
    $("#resourceList").innerHTML = items
      .map(
        (r) => `
      <div class="card resource-card reveal in">
        <h4>${esc(r.title || "Untitled")}</h4>
        <p>${esc(r.description || "")}</p>
        ${r.link ? `<a class="link" href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.link)}</a>` : ""}
      </div>`
      )
      .join("");
  }

  /* ---------------- render: resume ---------------- */
  function renderResume(data) {
    const has = !!data.profile.resumeFile;
    $("#resumePanel").innerHTML = has
      ? `
      <div class="doc-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
      <h3>Resume</h3>
      <p>${data.profile.resumeUpdated ? `Last updated ${esc(data.profile.resumeUpdated)}` : "Always the latest version — updated from the Admin Panel."}</p>
      <a class="btn btn-primary" href="${esc(data.profile.resumeFile)}" download target="_blank" rel="noopener">Download Resume</a>
    `
      : `
      <div class="doc-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
      <h3>Resume — Coming Soon</h3>
      <p>The resume will be available here once uploaded from the Admin Panel.</p>
      <button class="btn btn-secondary" disabled>Download Resume</button>
    `;
  }

  /* ---------------- render: contact / footer ---------------- */
  const ICONS = {
    linkedin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 5a2 2 0 1 1-4-.02 2 2 0 0 1 4 .02zM7 8.48H3V21h4zM13.5 8.48h-3.8V21h3.8v-6.3c0-1.66.32-3.27 2.37-3.27 2.02 0 2.05 1.9 2.05 3.38V21H22v-7.93c0-3.5-.75-6.2-4.85-6.2-1.97 0-3.29 1.08-3.83 2.1h-.05z"/></svg>',
    github: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.1.39-1.99 1.03-2.69-.1-.26-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.9-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.66.64.7 1.03 1.6 1.03 2.69 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>',
    email: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
    twitter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.9c-.7.3-1.5.6-2.3.7a4 4 0 0 0 1.8-2.2c-.8.5-1.7.8-2.6 1a4 4 0 0 0-6.9 3.6A11.4 11.4 0 0 1 3.7 4.6a4 4 0 0 0 1.3 5.3c-.7 0-1.3-.2-1.9-.5v.1a4 4 0 0 0 3.2 3.9c-.6.2-1.2.2-1.9.1a4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18.4a11.4 11.4 0 0 0 6.2 1.8c7.4 0 11.5-6.2 11.5-11.5v-.5c.8-.6 1.5-1.3 2-2.1z"/></svg>',
    location: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z"/></svg>',
  };
  function renderContact(data) {
    const rows = [
      { key: "email", label: data.profile.email || "Email — to be added", href: data.profile.email ? `mailto:${data.profile.email}` : null },
      { key: "phone", label: data.profile.phone || "Phone — to be added", href: data.profile.phone ? `tel:${data.profile.phone}` : null },
      { key: "location", label: data.profile.location || "Location — to be added", href: null },
      { key: "linkedin", label: data.social.linkedin ? "LinkedIn" : "LinkedIn — to be added", href: data.social.linkedin || null },
      { key: "github", label: data.social.github ? "GitHub" : "GitHub — to be added", href: data.social.github || null },
    ];
    $("#contactLinks").innerHTML = rows
      .map(
        (r) => `
      <div class="card" ${r.href ? "" : 'style="opacity:.6;"'}>
        <a href="${r.href ? esc(r.href) : "#contact"}" ${r.href ? 'target="_blank" rel="noopener"' : ""} style="display:flex;align-items:center;gap:14px;">
          <span class="contact-icon">${ICONS[r.key]}</span>
          <span>${esc(r.label)}</span>
        </a>
      </div>`
      )
      .join("");

    const social = [
      data.social.linkedin && { key: "linkedin", href: data.social.linkedin },
      data.social.github && { key: "github", href: data.social.github },
      data.social.twitter && { key: "twitter", href: data.social.twitter },
    ].filter(Boolean);
    $("#footerSocial").innerHTML = social.length
      ? social.map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${s.key}">${ICONS[s.key]}</a>`).join("")
      : `<span class="admin-bar-link">Social links — to be added</span>`;
  }

  $("#contactForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();
    // Basic input validation / sanity limits before writing to Firestore.
    if (!name || !email || !message || message.length > 4000) return;
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    try {
      await window.FB.addDoc("messages", { name, email, message, read: false });
      form.reset();
      $("#contactFormNote").textContent = "Message sent — thank you. I'll get back to you soon.";
      $("#contactFormNote").style.color = "var(--success)";
    } catch (err) {
      $("#contactFormNote").textContent = "Something went wrong sending that — please try again.";
      $("#contactFormNote").style.color = "var(--danger)";
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ---------------- hero signal canvas ---------------- */
  function initSignalCanvas() {
    const canvas = $("#signalCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, dpr;
    const nodes = [];
    const NODE_COUNT = 26;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      nodes.length = 0;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, r: Math.random() * 1.6 + 1, pulse: Math.random() * Math.PI * 2 });
      }
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(125,180,255,${0.16 * (1 - d / 130)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        n.pulse += 0.02;
        const glow = 0.5 + Math.sin(n.pulse) * 0.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + glow * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(125,180,255,${0.5 + glow * 0.5})`; ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    resize(); seed();
    window.addEventListener("resize", () => { resize(); seed(); });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(frame);
  }

  /* ---------------- reveal on scroll ---------------- */
  function initReveal() {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
      { threshold: 0.15 }
    );
    $$(".card, .section-head, .timeline-card").forEach((el) => {
      if (!el.classList.contains("reveal")) el.classList.add("reveal");
      io.observe(el);
    });
  }

  /* ---------------- render all ---------------- */
  function renderAll(data) {
    renderMeta(data);
    renderHome(data);
    renderAbout(data);
    renderSkills(data);
    renderProjects(data);
    renderCertifications(data);
    renderResources(data);
    renderResume(data);
    renderContact(data);
    requestAnimationFrame(initReveal);
  }

  store.subscribe(renderAll);
  initTheme();
  renderAll(store.get());
  initSignalCanvas();
  navigate(location.hash.replace("#", "") || "home");
})();
