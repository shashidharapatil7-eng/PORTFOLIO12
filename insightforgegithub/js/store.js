/**
 * InsightForge — store.js (Firestore-backed)
 * ---------------------------------------------------------------
 * Replaces the old localStorage + content.js draft/publish system.
 * Every collection is watched in real time with onSnapshot, so any
 * change made in the Admin Panel appears on the public site within
 * a second or two — no download, no redeploy.
 *
 * Shape of state.get() (unchanged from the old version, so main.js
 * barely had to change):
 * {
 *   meta, profile, social, settings,
 *   skillCategories: [{id,name,order,skills:[]}],
 *   projects: [...], certifications: [...],
 *   resources: { "Books": [...], "Courses": [...], ... },
 *   experience: [...], education: [...],
 *   inboxMessages: [...]   // admin-only, not rendered publicly
 * }
 * ---------------------------------------------------------------
 */
(function () {
  const RESOURCE_CATEGORIES = ["Books", "Courses", "Templates", "Dashboards", "Learning Notes", "Useful Websites"];

  const DEFAULT_STATE = {
    meta: {
      siteName: "InsightForge",
      logoMark: "IF",
      tagline: "Data • Decisions",
      seoDescription:
        "InsightForge — the personal brand and portfolio of Shashidhar A. Patil, focused on Business Analytics, Finance, Data Visualization and AI.",
      favicon: "",
      themeDefault: "dark",
    },
    profile: {
      name: "Shashidhar A. Patil",
      role: "Business Analytics · Finance · AI",
      photo: "",
      email: "",
      resumeFile: "",
      resumeFilePath: "",
      resumeUpdated: "",
      intro:
        "I am building practical solutions in Business Analytics, Finance, Data Visualization, and AI to solve real business problems through data-driven decision making.",
      bio: "",
    },
    social: { linkedin: "", github: "", twitter: "" },
    settings: { accent: "#3B82F6" },
    skillCategories: [],
    projects: [],
    certifications: [],
    resources: Object.fromEntries(RESOURCE_CATEGORIES.map((c) => [c, []])),
    experience: [],
    education: [],
    inboxMessages: [],
    _ready: { settings: false, skillCategories: false, projects: false, certifications: false, resources: false, experience: false, education: false },
  };

  let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  const listeners = new Set();
  function notify() {
    listeners.forEach((fn) => {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function groupResources(flatList) {
    const grouped = Object.fromEntries(RESOURCE_CATEGORIES.map((c) => [c, []]));
    flatList.forEach((r) => {
      const cat = RESOURCE_CATEGORIES.includes(r.category) ? r.category : RESOURCE_CATEGORIES[0];
      grouped[cat].push(r);
    });
    return grouped;
  }

  function startListeners() {
    const FB = window.FB;

    FB.watchDoc("settings", "site", (data) => {
      if (data) {
        state.meta = { ...state.meta, ...(data.meta || {}) };
        state.profile = { ...state.profile, ...(data.profile || {}) };
        state.social = { ...state.social, ...(data.social || {}) };
        state.settings = { ...state.settings, ...(data.settings || {}) };
      }
      state._ready.settings = true;
      notify();
    });

    FB.watchCollection("skillCategories", (items) => {
      state.skillCategories = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      state._ready.skillCategories = true;
      notify();
    });

    FB.watchCollection("projects", (items) => {
      state.projects = items;
      state._ready.projects = true;
      notify();
    });

    FB.watchCollection("certifications", (items) => {
      state.certifications = items;
      state._ready.certifications = true;
      notify();
    });

    FB.watchCollection("resources", (items) => {
      state.resources = groupResources(items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      state._ready.resources = true;
      notify();
    });

    FB.watchCollection("experience", (items) => {
      state.experience = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      state._ready.experience = true;
      notify();
    });

    FB.watchCollection("education", (items) => {
      state.education = items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      state._ready.education = true;
      notify();
    });
  }

  const Store = {
    get() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    isReady() { return Object.values(state._ready).every(Boolean); },
    RESOURCE_CATEGORIES,
  };

  window.IFStore = Store;

  function boot() {
    if (window.FB) startListeners();
    else window.addEventListener("firebase-ready", startListeners, { once: true });
  }
  boot();
})();
