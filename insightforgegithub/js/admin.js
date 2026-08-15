(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  /* ================= AUTH ================= */
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#loginEmail").value.trim();
    const pass = $("#loginPassword").value;
    const errEl = $("#loginError");
    errEl.textContent = "";
    $("#loginBtn").disabled = true;
    try {
      await window.FB.signIn(email, pass);
    } catch (err) {
      errEl.textContent = "Sign in failed — check your email and password.";
    } finally {
      $("#loginBtn").disabled = false;
    }
  });
  $("#logoutBtn").addEventListener("click", () => window.FB.signOut());

  function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.FB) resolve();
      else window.addEventListener("firebase-ready", () => resolve(), { once: true });
    });
  }
  waitForFirebase().then(() => {
    window.FB.onAuthChange((user) => {
      if (user) {
        $("#loginWrap").classList.add("hidden");
        $("#adminShell").classList.remove("hidden");
        bootAdmin();
      } else {
        $("#adminShell").classList.add("hidden");
        $("#loginWrap").classList.remove("hidden");
      }
    });
  });

  let booted = false;
  function bootAdmin() {
    if (booted) return;
    booted = true;
    renderAll();
    window.IFStore.subscribe(renderAll);
    renderMedia();
  }

  /* ================= SIDEBAR NAV ================= */
  $("#adminNav").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-panel]");
    if (!btn) return;
    $$("#adminNav button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".panel").forEach((p) => p.classList.remove("active"));
    $(`#panel-${btn.dataset.panel}`).classList.add("active");
  });

  /* ================= FILE UPLOAD (drag & drop + progress) ================= */
  function wireUpload({ inputId, dropId, prevId, labelId, folder, progressId, onDone }) {
    const input = $(`#${inputId}`);
    if (!input) return;
    const dropEl = dropId ? $(`#${dropId}`) : input.closest(".file-drop");

    async function handleFiles(files) {
      const file = files[0];
      if (!file) return;
      const progWrap = progressId ? $(`#${progressId}`) : null;
      const fill = progressId ? $(`#${progressId}-fill`) : null;
      const plabel = progressId ? $(`#${progressId}-label`) : null;
      if (progWrap) progWrap.classList.remove("hidden");
      try {
        const { url, path } = await window.FB.uploadFile(folder, file, (pct) => {
          if (fill) fill.style.width = pct + "%";
          if (plabel) plabel.textContent = `Uploading… ${pct}%`;
        });
        const prev = prevId ? $(`#${prevId}`) : null;
        if (prev) prev.innerHTML = /\.(pdf)$/i.test(file.name) ? "📄" : `<img src="${url}" alt="" />`;
        const label = labelId ? $(`#${labelId}`) : null;
        if (label) label.textContent = file.name + " — uploaded";
        if (progWrap) setTimeout(() => progWrap.classList.add("hidden"), 600);
        onDone(url, path, file);
      } catch (err) {
        toast("Upload failed — check your connection and Storage rules.");
        if (progWrap) progWrap.classList.add("hidden");
        console.error(err);
      }
    }

    input.addEventListener("change", () => handleFiles(input.files));
    if (dropEl) {
      ["dragover", "dragenter"].forEach((ev) => dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.style.borderColor = "var(--accent)"; }));
      ["dragleave", "drop"].forEach((ev) => dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.style.borderColor = ""; }));
      dropEl.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
    }
  }

  /* ================= OVERVIEW ================= */
  function renderOverview() {
    const data = window.IFStore.get();
    const totalResources = Object.values(data.resources).reduce((a, arr) => a + arr.length, 0);
    const stats = [
      ["Projects", data.projects.length],
      ["Skills", data.skillCategories.reduce((a, c) => a + (c.skills?.length || 0), 0)],
      ["Certifications", data.certifications.length],
      ["Resources", totalResources],
    ];
    $("#overviewStats").innerHTML = stats
      .map(([label, n]) => `<div class="card stat-card"><div class="stat-num">${n}</div><div class="stat-label">${esc(label)}</div></div>`)
      .join("");
  }

  /* ================= PROJECTS ================= */
  let currentTools = [];
  let currentTags = [];
  let currentShots = [];
  const projectDraft = { cover: "", coverPath: "" };

  function renderProjectList() {
    const data = window.IFStore.get();
    const wrap = $("#projectList");
    if (!data.projects.length) {
      wrap.innerHTML = `<div class="empty-hint">No projects yet. Click "New Project" to add real work.</div>`;
      return;
    }
    wrap.innerHTML = data.projects
      .map(
        (p) => `
      <div class="card data-row">
        <div class="thumb">${p.coverImage ? `<img src="${p.coverImage}" alt="" />` : "IMG"}</div>
        <div class="main"><h4>${esc(p.title || "Untitled")}</h4><p>${esc(p.category || "Uncategorized")} · ${esc(p.status || "Planned")}</p></div>
        <div class="flags">
          ${p.featured ? `<span class="flag on">Featured</span>` : ""}
          <span class="flag ${p.published !== false ? "on" : ""}">${p.published !== false ? "Published" : "Draft"}</span>
        </div>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
        </div>
      </div>`
      )
      .join("");
    wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openProjectForm(b.dataset.edit)));
    wrap.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this project?")) return;
        await window.FB.deleteDoc("projects", b.dataset.del);
        toast("Project deleted");
      })
    );
  }
  function renderToolChips() {
    $("#pf-tools-list").innerHTML = currentTools.map((t, i) => `<span class="chip-remove">${esc(t)}<button type="button" data-i="${i}">×</button></span>`).join("");
    $$("#pf-tools-list button").forEach((b) => b.addEventListener("click", () => { currentTools.splice(+b.dataset.i, 1); renderToolChips(); }));
  }
  function renderTagChips() {
    $("#pf-tags-list").innerHTML = currentTags.map((t, i) => `<span class="chip-remove">${esc(t)}<button type="button" data-i="${i}">×</button></span>`).join("");
    $$("#pf-tags-list button").forEach((b) => b.addEventListener("click", () => { currentTags.splice(+b.dataset.i, 1); renderTagChips(); }));
  }
  function renderShotsGrid() {
    $("#pf-shots-grid").innerHTML = currentShots
      .map((s, i) => `<div class="media-item"><img src="${s.url}" alt="" /><button class="rm" type="button" data-i="${i}">×</button></div>`)
      .join("");
    $$("#pf-shots-grid .rm").forEach((b) => b.addEventListener("click", () => { currentShots.splice(+b.dataset.i, 1); renderShotsGrid(); }));
  }
  $("#pf-tool-add").addEventListener("click", () => addChip("pf-tool-input", currentTools, renderToolChips));
  $("#pf-tool-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChip("pf-tool-input", currentTools, renderToolChips); } });
  $("#pf-tag-add").addEventListener("click", () => addChip("pf-tag-input", currentTags, renderTagChips));
  $("#pf-tag-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChip("pf-tag-input", currentTags, renderTagChips); } });
  function addChip(inputId, arr, renderFn) {
    const input = $(`#${inputId}`);
    const v = input.value.trim();
    if (v) { arr.push(v); input.value = ""; renderFn(); }
  }

  wireUpload({
    inputId: "pf-cover-file", dropId: "pf-cover-drop", prevId: "pf-cover-prev", labelId: "pf-cover-label",
    folder: "covers",
    onDone: (url, path) => { projectDraft.cover = url; projectDraft.coverPath = path; },
  });
  $("#pf-shots-file").addEventListener("change", async () => {
    const files = Array.from($("#pf-shots-file").files);
    $("#pf-shots-label").textContent = `Uploading ${files.length} image(s)…`;
    for (const file of files) {
      try {
        const { url, path } = await window.FB.uploadFile("screenshots", file);
        currentShots.push({ url, path });
        renderShotsGrid();
      } catch (e) { toast("A screenshot failed to upload."); }
    }
    $("#pf-shots-label").textContent = "Click or drag images here — adds to the gallery";
    $("#pf-shots-file").value = "";
  });

  function openProjectForm(id) {
    const data = window.IFStore.get();
    const p = id ? data.projects.find((x) => x.id === id) : null;
    $("#projectFormTitle").textContent = p ? "Edit Project" : "New Project";
    $("#pf-id").value = p?.id || "";
    $("#pf-title").value = p?.title || "";
    $("#pf-subtitle").value = p?.subtitle || "";
    $("#pf-description").value = p?.description || "";
    $("#pf-category").value = p?.category || "";
    $("#pf-status").value = p?.status || "Planned";
    $("#pf-start").value = p?.start || "";
    $("#pf-end").value = p?.end || "";
    $("#pf-github").value = p?.github || "";
    $("#pf-demo").value = p?.demo || "";
    $("#pf-dashboard").value = p?.dashboard || "";
    $("#pf-resourceFolder").value = p?.resourceFolder || "";
    $("#pf-featured").checked = !!p?.featured;
    $("#pf-published").checked = p?.published !== false;
    $("#pf-cover-prev").innerHTML = p?.coverImage ? `<img src="${p.coverImage}" alt="" />` : "";
    $("#pf-cover-label").textContent = p?.coverImage ? "Cover image set — click or drag to replace" : "Click or drag an image here";
    projectDraft.cover = p?.coverImage || "";
    projectDraft.coverPath = p?.coverImagePath || "";
    currentTools = [...(p?.tools || [])];
    currentTags = [...(p?.tags || [])];
    currentShots = (p?.screenshots || []).map((url, i) => ({ url, path: (p?.screenshotsPaths || [])[i] || "" }));
    renderToolChips(); renderTagChips(); renderShotsGrid();
    $("#projectForm").classList.remove("hidden");
    $("#projectForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#newProjectBtn").addEventListener("click", () => openProjectForm(null));
  $("#pf-cancel").addEventListener("click", () => $("#projectForm").classList.add("hidden"));
  $("#pf-save").addEventListener("click", async () => {
    const title = $("#pf-title").value.trim();
    if (!title) { toast("Give the project a title first."); return; }
    const id = $("#pf-id").value;
    const record = {
      title,
      subtitle: $("#pf-subtitle").value.trim(),
      description: $("#pf-description").value.trim(),
      category: $("#pf-category").value.trim(),
      status: $("#pf-status").value,
      start: $("#pf-start").value.trim(),
      end: $("#pf-end").value.trim(),
      tools: [...currentTools],
      tags: [...currentTags],
      github: $("#pf-github").value.trim(),
      demo: $("#pf-demo").value.trim(),
      dashboard: $("#pf-dashboard").value.trim(),
      resourceFolder: $("#pf-resourceFolder").value.trim(),
      coverImage: projectDraft.cover || "",
      coverImagePath: projectDraft.coverPath || "",
      screenshots: currentShots.map((s) => s.url),
      screenshotsPaths: currentShots.map((s) => s.path),
      featured: $("#pf-featured").checked,
      published: $("#pf-published").checked,
    };
    try {
      if (id) await window.FB.updateDoc("projects", id, record);
      else await window.FB.addDoc("projects", record);
      $("#projectForm").classList.add("hidden");
      toast("Project saved");
    } catch (e) { toast("Could not save — check your connection."); console.error(e); }
  });

  /* ================= SKILLS ================= */
  function renderSkillCategories() {
    const data = window.IFStore.get();
    const wrap = $("#skillCategories");
    if (!data.skillCategories.length) { wrap.innerHTML = `<div class="empty-hint">No categories yet.</div>`; return; }
    wrap.innerHTML = data.skillCategories
      .map(
        (cat, idx) => `
      <div class="card form-card" data-cat="${cat.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <h3 style="margin:0;">${esc(cat.name)}</h3>
          <div class="row-actions">
            <button class="btn btn-secondary btn-sm" data-up="${cat.id}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="btn btn-secondary btn-sm" data-down="${cat.id}" ${idx === data.skillCategories.length - 1 ? "disabled" : ""}>↓</button>
            <button class="btn btn-secondary btn-sm" data-editcat="${cat.id}">Rename</button>
            <button class="btn btn-danger btn-sm" data-delcat="${cat.id}">Delete</button>
          </div>
        </div>
        <div class="chip-list" style="margin-top:14px;">
          ${(cat.skills || []).map((s, i) => `<span class="chip-remove">${esc(s)}<button type="button" data-catid="${cat.id}" data-i="${i}" class="skill-rm">×</button></span>`).join("") || `<span class="mono" style="color:var(--text-tertiary); font-size:0.8rem;">No skills yet</span>`}
        </div>
        <div class="tag-input-row" style="margin-top:12px;">
          <input placeholder="Add a skill and press Enter" class="skill-add-input" data-catid="${cat.id}" />
          <button class="btn btn-secondary btn-sm skill-add-btn" data-catid="${cat.id}" type="button">Add</button>
        </div>
      </div>`
      )
      .join("");

    wrap.querySelectorAll(".skill-rm").forEach((b) =>
      b.addEventListener("click", () => {
        const cat = data.skillCategories.find((c) => c.id === b.dataset.catid);
        const skills = [...(cat.skills || [])];
        skills.splice(+b.dataset.i, 1);
        window.FB.updateDoc("skillCategories", cat.id, { skills });
      })
    );
    wrap.querySelectorAll(".skill-add-btn").forEach((b) => b.addEventListener("click", () => addSkill(b.dataset.catid)));
    wrap.querySelectorAll(".skill-add-input").forEach((inp) =>
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(inp.dataset.catid); } })
    );
    wrap.querySelectorAll("[data-delcat]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!confirm("Delete this whole category and its skills?")) return;
        window.FB.deleteDoc("skillCategories", b.dataset.delcat);
      })
    );
    wrap.querySelectorAll("[data-editcat]").forEach((b) => b.addEventListener("click", () => openSkillCatForm(b.dataset.editcat)));
    wrap.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => reorderSkillCat(b.dataset.up, -1)));
    wrap.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => reorderSkillCat(b.dataset.down, 1)));
  }
  function reorderSkillCat(id, dir) {
    const data = window.IFStore.get();
    const list = data.skillCategories;
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    const aOrder = a.order ?? i, bOrder = b.order ?? j;
    window.FB.updateDoc("skillCategories", a.id, { order: bOrder });
    window.FB.updateDoc("skillCategories", b.id, { order: aOrder });
  }
  function addSkill(catId) {
    const input = document.querySelector(`.skill-add-input[data-catid="${catId}"]`);
    const v = input.value.trim();
    if (!v) return;
    const cat = window.IFStore.get().skillCategories.find((c) => c.id === catId);
    window.FB.updateDoc("skillCategories", catId, { skills: [...(cat.skills || []), v] });
  }
  function openSkillCatForm(id) {
    const data = window.IFStore.get();
    const cat = id ? data.skillCategories.find((c) => c.id === id) : null;
    $("#skillCatFormTitle").textContent = cat ? "Rename Category" : "New Category";
    $("#sc-id").value = cat?.id || "";
    $("#sc-name").value = cat?.name || "";
    $("#skillCatForm").classList.remove("hidden");
    $("#skillCatForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#newSkillCatBtn").addEventListener("click", () => openSkillCatForm(null));
  $("#sc-cancel").addEventListener("click", () => $("#skillCatForm").classList.add("hidden"));
  $("#sc-save").addEventListener("click", async () => {
    const name = $("#sc-name").value.trim();
    if (!name) { toast("Name the category first."); return; }
    const id = $("#sc-id").value;
    if (id) await window.FB.updateDoc("skillCategories", id, { name });
    else await window.FB.addDoc("skillCategories", { name, skills: [], order: window.IFStore.get().skillCategories.length });
    $("#skillCatForm").classList.add("hidden");
    toast("Category saved");
  });

  /* ================= CERTIFICATIONS ================= */
  const certDraft = { image: "", imagePath: "", pdf: "", pdfPath: "" };
  function renderCertList() {
    const data = window.IFStore.get();
    const wrap = $("#certList");
    if (!data.certifications.length) { wrap.innerHTML = `<div class="empty-hint">No certifications yet.</div>`; return; }
    wrap.innerHTML = data.certifications
      .map(
        (c) => `
      <div class="card data-row">
        <div class="thumb">${c.image ? `<img src="${c.image}" alt="" />` : "IMG"}</div>
        <div class="main"><h4>${esc(c.title || "Untitled")}</h4><p>${esc(c.issuer || "Issuer TBD")} · ${esc(c.date || "Date TBD")}</p></div>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${c.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${c.id}">Delete</button>
        </div>
      </div>`
      )
      .join("");
    wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openCertForm(b.dataset.edit)));
    wrap.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this certification?")) return;
        await window.FB.deleteDoc("certifications", b.dataset.del);
      })
    );
  }
  wireUpload({ inputId: "cf-image-file", prevId: "cf-image-prev", labelId: "cf-image-label", folder: "certificates", onDone: (url, path) => { certDraft.image = url; certDraft.imagePath = path; } });
  wireUpload({ inputId: "cf-pdf-file", labelId: "cf-pdf-label", folder: "certificates_pdf", onDone: (url, path) => { certDraft.pdf = url; certDraft.pdfPath = path; } });
  function openCertForm(id) {
    const data = window.IFStore.get();
    const c = id ? data.certifications.find((x) => x.id === id) : null;
    $("#certFormTitle").textContent = c ? "Edit Certification" : "New Certification";
    $("#cf-id").value = c?.id || "";
    $("#cf-title").value = c?.title || "";
    $("#cf-issuer").value = c?.issuer || "";
    $("#cf-date").value = c?.date || "";
    $("#cf-credentialId").value = c?.credentialId || "";
    $("#cf-verifyLink").value = c?.verifyLink || "";
    $("#cf-image-prev").innerHTML = c?.image ? `<img src="${c.image}" alt="" />` : "";
    $("#cf-image-label").textContent = c?.image ? "Image set — click to replace" : "Click to upload";
    $("#cf-pdf-label").textContent = c?.pdf ? "PDF set — click to replace" : "Click to upload";
    certDraft.image = c?.image || ""; certDraft.imagePath = c?.imagePath || "";
    certDraft.pdf = c?.pdf || ""; certDraft.pdfPath = c?.pdfPath || "";
    $("#certForm").classList.remove("hidden");
    $("#certForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#newCertBtn").addEventListener("click", () => openCertForm(null));
  $("#cf-cancel").addEventListener("click", () => $("#certForm").classList.add("hidden"));
  $("#cf-save").addEventListener("click", async () => {
    const title = $("#cf-title").value.trim();
    if (!title) { toast("Give the certification a title first."); return; }
    const id = $("#cf-id").value;
    const record = {
      title,
      issuer: $("#cf-issuer").value.trim(),
      date: $("#cf-date").value.trim(),
      credentialId: $("#cf-credentialId").value.trim(),
      verifyLink: $("#cf-verifyLink").value.trim(),
      image: certDraft.image || "", imagePath: certDraft.imagePath || "",
      pdf: certDraft.pdf || "", pdfPath: certDraft.pdfPath || "",
    };
    if (id) await window.FB.updateDoc("certifications", id, record);
    else await window.FB.addDoc("certifications", record);
    $("#certForm").classList.add("hidden");
    toast("Certification saved");
  });

  /* ================= RESOURCES ================= */
  let activeResourceCat = null;
  function renderResourceTabs() {
    const data = window.IFStore.get();
    const cats = window.IFStore.RESOURCE_CATEGORIES;
    if (!activeResourceCat) activeResourceCat = cats[0];
    $("#adminResourceTabs").innerHTML = cats
      .map((c) => `<button class="chip ${c === activeResourceCat ? "active" : ""}" data-tab="${esc(c)}">${esc(c)} (${data.resources[c].length})</button>`)
      .join("");
    $$("#adminResourceTabs .chip").forEach((b) => b.addEventListener("click", () => { activeResourceCat = b.dataset.tab; renderResourceTabs(); }));
    renderResourceAdminList();
  }
  function renderResourceAdminList() {
    const data = window.IFStore.get();
    const items = data.resources[activeResourceCat] || [];
    const wrap = $("#resourceAdminList");
    if (!items.length) { wrap.innerHTML = `<div class="empty-hint">No ${esc(activeResourceCat)} yet.</div>`; return; }
    wrap.innerHTML = items
      .map(
        (r) => `
      <div class="card data-row">
        <div class="main"><h4>${esc(r.title || "Untitled")}</h4><p>${esc(r.description || r.link || "")}</p></div>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" data-edit="${r.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button>
        </div>
      </div>`
      )
      .join("");
    wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openResourceForm(b.dataset.edit)));
    wrap.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { if (confirm("Delete this resource?")) await window.FB.deleteDoc("resources", b.dataset.del); }));
  }
  function openResourceForm(id) {
    const data = window.IFStore.get();
    const r = id ? data.resources[activeResourceCat].find((x) => x.id === id) : null;
    $("#resourceFormTitle").textContent = r ? "Edit Resource" : "New Resource";
    $("#rf-id").value = r?.id || "";
    $("#rf-category").value = activeResourceCat;
    $("#rf-title").value = r?.title || "";
    $("#rf-description").value = r?.description || "";
    $("#rf-link").value = r?.link || "";
    $("#resourceForm").classList.remove("hidden");
    $("#resourceForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#newResourceBtn").addEventListener("click", () => openResourceForm(null));
  $("#rf-cancel").addEventListener("click", () => $("#resourceForm").classList.add("hidden"));
  $("#rf-save").addEventListener("click", async () => {
    const title = $("#rf-title").value.trim();
    if (!title) { toast("Give it a title first."); return; }
    const cat = $("#rf-category").value;
    const id = $("#rf-id").value;
    const record = { title, description: $("#rf-description").value.trim(), link: $("#rf-link").value.trim(), category: cat };
    if (id) await window.FB.updateDoc("resources", id, record);
    else await window.FB.addDoc("resources", { ...record, order: (window.IFStore.get().resources[cat] || []).length });
    $("#resourceForm").classList.add("hidden");
    toast("Resource saved");
  });

  /* ================= EXPERIENCE ================= */
  function renderExpList() {
    const data = window.IFStore.get();
    const wrap = $("#expList");
    if (!data.experience.length) { wrap.innerHTML = `<div class="empty-hint">No experience entries yet.</div>`; return; }
    wrap.innerHTML = data.experience
      .map((e) => `
      <div class="card data-row">
        <div class="main"><h4>${esc(e.title || "Untitled")}</h4><p>${esc(e.company || "")}</p></div>
        <div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit="${e.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${e.id}">Delete</button></div>
      </div>`).join("");
    wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openExpForm(b.dataset.edit)));
    wrap.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { if (confirm("Delete this entry?")) await window.FB.deleteDoc("experience", b.dataset.del); }));
  }
  function openExpForm(id) {
    const e = id ? window.IFStore.get().experience.find((x) => x.id === id) : null;
    $("#expFormTitle").textContent = e ? "Edit Experience" : "New Experience";
    $("#ef-id").value = e?.id || "";
    $("#ef-title").value = e?.title || "";
    $("#ef-company").value = e?.company || "";
    $("#ef-start").value = e?.start || "";
    $("#ef-end").value = e?.end || "";
    $("#ef-description").value = e?.description || "";
    $("#expForm").classList.remove("hidden");
    $("#expForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#newExpBtn").addEventListener("click", () => openExpForm(null));
  $("#ef-cancel").addEventListener("click", () => $("#expForm").classList.add("hidden"));
  $("#ef-save").addEventListener("click", async () => {
    const title = $("#ef-title").value.trim();
    if (!title) { toast("Add a role title first."); return; }
    const id = $("#ef-id").value;
    const record = { title, company: $("#ef-company").value.trim(), start: $("#ef-start").value.trim(), end: $("#ef-end").value.trim(), description: $("#ef-description").value.trim() };
    if (id) await window.FB.updateDoc("experience", id, record);
    else await window.FB.addDoc("experience", { ...record, order: window.IFStore.get().experience.length });
    $("#expForm").classList.add("hidden");
    toast("Saved");
  });

  /* ================= EDUCATION ================= */
  function renderEduList() {
    const data = window.IFStore.get();
    const wrap = $("#eduList");
    if (!data.education.length) { wrap.innerHTML = `<div class="empty-hint">No education entries yet.</div>`; return; }
    wrap.innerHTML = data.education
      .map((e) => `
      <div class="card data-row">
        <div class="main"><h4>${esc(e.institution || "Untitled")}</h4><p>${esc(e.degree || "")}</p></div>
        <div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit="${e.id}">Edit</button><button class="btn btn-danger btn-sm" data-del="${e.id}">Delete</button></div>
      </div>`).join("");
    wrap.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEduForm(b.dataset.edit)));
    wrap.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { if (confirm("Delete this entry?")) await window.FB.deleteDoc("education", b.dataset.del); }));
  }
  function openEduForm(id) {
    const e = id ? window.IFStore.get().education.find((x) => x.id === id) : null;
    $("#eduFormTitle").textContent = e ? "Edit Education" : "New Education";
    $("#edf-id").value = e?.id || "";
    $("#edf-institution").value = e?.institution || "";
    $("#edf-degree").value = e?.degree || "";
    $("#edf-field").value = e?.field || "";
    $("#edf-start").value = e?.start || "";
    $("#edf-end").value = e?.end || "";
    $("#edf-description").value = e?.description || "";
    $("#eduForm").classList.remove("hidden");
    $("#eduForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  $("#newEduBtn").addEventListener("click", () => openEduForm(null));
  $("#edf-cancel").addEventListener("click", () => $("#eduForm").classList.add("hidden"));
  $("#edf-save").addEventListener("click", async () => {
    const institution = $("#edf-institution").value.trim();
    if (!institution) { toast("Add an institution first."); return; }
    const id = $("#edf-id").value;
    const record = { institution, degree: $("#edf-degree").value.trim(), field: $("#edf-field").value.trim(), start: $("#edf-start").value.trim(), end: $("#edf-end").value.trim(), description: $("#edf-description").value.trim() };
    if (id) await window.FB.updateDoc("education", id, record);
    else await window.FB.addDoc("education", { ...record, order: window.IFStore.get().education.length });
    $("#eduForm").classList.add("hidden");
    toast("Saved");
  });

  /* ================= RESUME ================= */
  const resumeDraft = { url: "", path: "" };
  wireUpload({ inputId: "resume-file", prevId: "resume-prev", labelId: "resume-label", folder: "resume", progressId: "resume-progress", onDone: (url, path) => { resumeDraft.url = url; resumeDraft.path = path; } });
  function renderResumePanel() {
    const data = window.IFStore.get();
    $("#resume-updated").value = data.profile.resumeUpdated || "";
    $("#resume-label").textContent = data.profile.resumeFile ? "Resume on file — click or drag to replace" : "Click to upload resume PDF";
    resumeDraft.url = data.profile.resumeFile || "";
    resumeDraft.path = data.profile.resumeFilePath || "";
  }
  $("#resume-save").addEventListener("click", async () => {
    // NOTE: Firestore's {merge:true} replaces nested map fields wholesale rather than
    // deep-merging them — so we spread the current profile first to avoid wiping
    // bio/contact/name/etc. that live in the same "profile" map.
    await window.FB.setDoc("settings", "site", {
      profile: {
        ...window.IFStore.get().profile,
        resumeFile: resumeDraft.url,
        resumeFilePath: resumeDraft.path,
        resumeUpdated: $("#resume-updated").value.trim(),
      },
    });
    toast("Resume saved");
  });

  /* ================= ABOUT ================= */
  function renderAboutPanel() { $("#about-bio").value = window.IFStore.get().profile.bio || ""; }
  $("#about-save").addEventListener("click", async () => {
    await window.FB.setDoc("settings", "site", {
      profile: { ...window.IFStore.get().profile, bio: $("#about-bio").value },
    });
    toast("Bio saved");
  });

  /* ================= SETTINGS ================= */
  const settingsDraft = { photo: "", photoPath: "", favicon: "", faviconPath: "" };
  wireUpload({ inputId: "set-photo-file", prevId: "set-photo-prev", labelId: "set-photo-label", folder: "profile", onDone: (url, path) => { settingsDraft.photo = url; settingsDraft.photoPath = path; } });
  wireUpload({ inputId: "set-favicon-file", prevId: "set-favicon-prev", labelId: "set-favicon-label", folder: "favicon", onDone: (url, path) => { settingsDraft.favicon = url; settingsDraft.faviconPath = path; } });
  function renderSettingsPanel() {
    const data = window.IFStore.get();
    $("#set-siteName").value = data.meta.siteName || "";
    $("#set-logoMark").value = data.meta.logoMark || "";
    $("#set-tagline").value = data.meta.tagline || "";
    $("#set-accent").value = data.settings.accent || "#3B82F6";
    $("#set-name").value = data.profile.name || "";
    $("#set-role").value = data.profile.role || "";
    $("#set-intro").value = data.profile.intro || "";
    $("#set-email").value = data.profile.email || "";
    $("#set-phone").value = data.profile.phone || "";
    $("#set-location").value = data.profile.location || "";
    $("#set-linkedin").value = data.social.linkedin || "";
    $("#set-github").value = data.social.github || "";
    $("#set-twitter").value = data.social.twitter || "";
    $("#set-seo").value = data.meta.seoDescription || "";
    $("#set-photo-prev").innerHTML = data.profile.photo ? `<img src="${data.profile.photo}" alt="" />` : "";
    $("#set-favicon-prev").innerHTML = data.meta.favicon ? `<img src="${data.meta.favicon}" alt="" />` : "";
    settingsDraft.photo = data.profile.photo || ""; settingsDraft.photoPath = data.profile.photoPath || "";
    settingsDraft.favicon = data.meta.favicon || ""; settingsDraft.faviconPath = data.meta.faviconPath || "";
  }
  $("#settings-save").addEventListener("click", async () => {
    // Same nested-map-replacement caveat as above: spread the current cached
    // meta/profile/settings before writing so fields owned by other panels
    // (bio, resumeFile, themeDefault, ...) survive this save.
    const current = window.IFStore.get();
    await window.FB.setDoc("settings", "site", {
      meta: {
        ...current.meta,
        siteName: $("#set-siteName").value.trim(),
        logoMark: $("#set-logoMark").value.trim().toUpperCase(),
        tagline: $("#set-tagline").value.trim(),
        seoDescription: $("#set-seo").value.trim(),
        favicon: settingsDraft.favicon || "",
        faviconPath: settingsDraft.faviconPath || "",
      },
      profile: {
        ...current.profile,
        name: $("#set-name").value.trim(),
        role: $("#set-role").value.trim(),
        intro: $("#set-intro").value.trim(),
        email: $("#set-email").value.trim(),
        phone: $("#set-phone").value.trim(),
        location: $("#set-location").value.trim(),
        photo: settingsDraft.photo || "",
        photoPath: settingsDraft.photoPath || "",
      },
      social: { linkedin: $("#set-linkedin").value.trim(), github: $("#set-github").value.trim(), twitter: $("#set-twitter").value.trim() },
      settings: { ...current.settings, accent: $("#set-accent").value },
    });
    toast("Settings saved");
  });
  $("#set-pass-save").addEventListener("click", async () => {
    const cur = $("#set-curpass").value, next = $("#set-newpass").value;
    if (next.length < 6) { toast("New password should be at least 6 characters."); return; }
    try {
      await window.FB.changePassword(cur, next);
      $("#set-curpass").value = ""; $("#set-newpass").value = "";
      toast("Password updated");
    } catch (e) { toast("Could not update — check your current password."); }
  });

  /* ================= MEDIA LIBRARY ================= */
  $("#refreshMediaBtn").addEventListener("click", renderMedia);
  async function renderMedia() {
    const grid = $("#mediaGrid");
    grid.innerHTML = `<div class="empty-hint">Loading…</div>`;
    const files = await window.FB.listFiles(["covers", "screenshots", "certificates", "profile", "favicon"]);
    if (!files.length) { grid.innerHTML = `<div class="empty-hint">No images uploaded yet.</div>`; return; }
    grid.innerHTML = files.map((f) => `<div class="media-item"><img src="${f.url}" alt="${esc(f.name)}" loading="lazy" /></div>`).join("");
  }

  /* ================= MESSAGES ================= */
  function renderMessages() {
    const data = window.IFStore.get();
    const msgs = data.inboxMessages || [];
    const wrap = $("#messagesList");
    if (!msgs.length) { wrap.innerHTML = `<div class="empty-hint">No messages yet.</div>`; return; }
    wrap.innerHTML = msgs
      .map((m) => `
      <div class="card msg-row ${m.read ? "" : "unread"}">
        <div class="msg-head"><strong>${esc(m.name)} · ${esc(m.email)}</strong><span class="msg-date mono">${m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : ""}</span></div>
        <p style="font-size:0.88rem;">${esc(m.message)}</p>
        <div class="row-actions" style="margin-top:10px;">
          ${m.read ? "" : `<button class="btn btn-secondary btn-sm" data-read="${m.id}">Mark Read</button>`}
          <button class="btn btn-danger btn-sm" data-delmsg="${m.id}">Delete</button>
        </div>
      </div>`).join("");
    wrap.querySelectorAll("[data-read]").forEach((b) => b.addEventListener("click", () => window.FB.updateDoc("messages", b.dataset.read, { read: true })));
    wrap.querySelectorAll("[data-delmsg]").forEach((b) => b.addEventListener("click", () => window.FB.deleteDoc("messages", b.dataset.delmsg)));
  }
  // Messages aren't part of the public store shape by default — watch them separately for the admin panel.
  waitForFirebase().then(() => {
    window.FB.onAuthChange((user) => {
      if (!user) return;
      window.FB.watchCollection("messages", (items) => {
        window.IFStore.get().inboxMessages = items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        renderMessages();
      });
    });
  });

  /* ================= RENDER ALL ================= */
  function renderAll() {
    renderOverview();
    renderProjectList();
    renderSkillCategories();
    renderCertList();
    renderResourceTabs();
    renderExpList();
    renderEduList();
    renderResumePanel();
    renderAboutPanel();
    renderSettingsPanel();
  }
})();
