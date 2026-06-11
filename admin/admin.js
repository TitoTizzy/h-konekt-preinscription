const adminConfig = window.HKONEKT_SUPABASE || {};
const adminHasConfig =
  adminConfig.url &&
  adminConfig.anonKey &&
  !adminConfig.url.includes("YOUR_") &&
  !adminConfig.anonKey.includes("YOUR_");

const adminClient =
  adminHasConfig && window.supabase
    ? window.supabase.createClient(adminConfig.url, adminConfig.anonKey)
    : null;

const state = {
  leads: [],
  demoMode: false
};

const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const uploadMessage = document.querySelector("#upload-message");
const logoutButton = document.querySelector("#logout-button");
const demoButton = document.querySelector("#demo-button");
const demoBanner = document.querySelector("#demo-banner");
const leadSearch = document.querySelector("#lead-search");
const exportButton = document.querySelector("#export-button");
const leadsTableBody = document.querySelector("#leads-table-body");
const categoryList = document.querySelector("#category-list");
const uploadForm = document.querySelector("#hero-upload-form");
const heroPreview = document.querySelector("#hero-preview");

const kpis = {
  total: document.querySelector("#kpi-total-leads"),
  views: document.querySelector("#kpi-page-views"),
  professionnels: document.querySelector("#kpi-professionnels"),
  organisateurs: document.querySelector("#kpi-organisateurs")
};

function setMessage(element, message, type = "info") {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCategory(value) {
  const labels = {
    gastronomie: "Gastronomie",
    import_distribution: "Import & distribution",
    juridique_conseil_expertise: "Juridique, conseil & expertise",
    finance_gestion_investissement: "Finance, gestion & investissement",
    logistique_transferts_diaspora: "Logistique, transferts & diaspora",
    beaute_bien_etre: "Beauté & bien-être",
    evenementiel: "Événementiel",
    arts_vivants: "Arts vivants",
    arts_visuels: "Arts visuels",
    mode_design: "Mode & design",
    sante_soins: "Santé & soins",
    formation_education: "Formation & éducation",
    technologies: "Technologies",
    media_communication: "Média & communication",
    services_personne: "Services & accompagnement",
    batiment_techniques: "Bâtiment & techniques"
  };

  return labels[value] || value || "-";
}

function showLogin() {
  loginView.classList.remove("is-hidden");
  dashboardView.classList.add("is-hidden");
}

function showDashboard() {
  loginView.classList.add("is-hidden");
  dashboardView.classList.remove("is-hidden");
  demoBanner?.classList.toggle("is-hidden", !state.demoMode);
}

async function requireConfig() {
  if (adminClient) return true;
  setMessage(loginMessage, "Ajoutez vos clés Supabase dans supabase-config.js pour activer le back-office.", "error");
  return false;
}

function enterDemoMode() {
  state.demoMode = true;
  state.leads = getDemoLeads();
  kpis.views.textContent = new Intl.NumberFormat("fr-FR").format(12486);
  heroPreview.src = "../assets/images/hero-hkonekt.png";
  showDashboard();
  renderDashboard();
  setMessage(dashboardMessage, "Mode démo actif. Vous pouvez tester la recherche, les statuts et l'export CSV.", "success");
}

async function initAdmin() {
  if (!(await requireConfig())) return;

  try {
    const { data, error } = await adminClient.auth.getSession();
    if (error) throw error;

    if (data.session) {
      showDashboard();
      await loadDashboard();
    } else {
      showLogin();
    }
  } catch (error) {
    setMessage(loginMessage, error.message, "error");
    showLogin();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!(await requireConfig())) return;

  const submitButton = loginForm.querySelector("button");
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;

  submitButton.disabled = true;
  setMessage(loginMessage, "Connexion en cours...");

  try {
    const { error } = await adminClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    setMessage(loginMessage, "");
    showDashboard();
    await loadDashboard();
  } catch (error) {
    setMessage(loginMessage, "Identifiants invalides ou accès refusé.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function loadDashboard() {
  setMessage(dashboardMessage, "Chargement des données...");

  try {
    await Promise.all([loadLeads(), loadAnalytics(), loadHeroConfig()]);
    renderDashboard();
    setMessage(dashboardMessage, "");
  } catch (error) {
    setMessage(dashboardMessage, error.message, "error");
  }
}

async function loadLeads() {
  const { data, error } = await adminClient
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.leads = data || [];
}

async function loadAnalytics() {
  const { data, error } = await adminClient
    .from("analytics")
    .select("page_views")
    .eq("id", 1)
    .single();

  if (error) throw error;
  kpis.views.textContent = new Intl.NumberFormat("fr-FR").format(data?.page_views || 0);
}

async function loadHeroConfig() {
  const { data, error } = await adminClient
    .from("site_config")
    .select("hero_image_url")
    .eq("id", 1)
    .single();

  if (error) throw error;
  if (data?.hero_image_url) heroPreview.src = data.hero_image_url;
}

function renderDashboard() {
  renderKpis();
  renderCategoryList();
  renderLeadsTable();
}

function renderKpis() {
  const total = state.leads.length;
  const professionnels = state.leads.filter((lead) => lead.user_type === "professionnel").length;
  const organisateurs = state.leads.filter((lead) => lead.user_type === "organisateur").length;

  kpis.total.textContent = new Intl.NumberFormat("fr-FR").format(total);
  kpis.professionnels.textContent = new Intl.NumberFormat("fr-FR").format(professionnels);
  kpis.organisateurs.textContent = new Intl.NumberFormat("fr-FR").format(organisateurs);
}

function renderCategoryList() {
  const counts = state.leads.reduce((acc, lead) => {
    const label = formatCategory(lead.category);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `
      <div class="category-row">
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </div>
    `)
    .join("");

  categoryList.innerHTML = rows || '<p class="muted">Aucune donnée pour le moment.</p>';
}

function getFilteredLeads() {
  const query = leadSearch.value.trim().toLowerCase();
  if (!query) return state.leads;

  return state.leads.filter((lead) => {
    const searchable = [
      lead.full_name,
      lead.email,
      lead.phone,
      lead.city,
      lead.user_type,
      formatCategory(lead.category),
      lead.organization_name,
      lead.message
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

function renderLeadsTable() {
  const leads = getFilteredLeads();

  if (!leads.length) {
    leadsTableBody.innerHTML = '<tr><td colspan="6">Aucune préinscription trouvée.</td></tr>';
    return;
  }

  leadsTableBody.innerHTML = leads.map((lead) => `
    <tr>
      <td>
        <span class="lead-name">${escapeHtml(lead.full_name || "Sans nom")}</span>
        <span class="lead-sub">${escapeHtml(lead.email || "-")}</span>
        <span class="lead-sub">${escapeHtml(lead.phone || "")}</span>
      </td>
      <td>
        ${escapeHtml(lead.user_type || "-")}
        <span class="lead-sub">${escapeHtml(lead.organization_name || "")}</span>
      </td>
      <td>${escapeHtml(formatCategory(lead.category))}</td>
      <td>${escapeHtml(lead.city || "-")}</td>
      <td>
        <select class="status-select" data-lead-id="${lead.id}" aria-label="Statut de ${escapeHtml(lead.email || "ce lead")}">
          ${renderStatusOptions(lead.status)}
        </select>
      </td>
      <td>${formatDate(lead.created_at)}</td>
    </tr>
  `).join("");
}

function renderStatusOptions(current = "nouveau") {
  const statuses = ["nouveau", "contacte", "qualifie", "valide", "refuse"];
  return statuses.map((status) => `
    <option value="${status}" ${status === current ? "selected" : ""}>${status}</option>
  `).join("");
}

async function updateLeadStatus(select) {
  const leadId = select.dataset.leadId;
  const status = select.value;

  if (state.demoMode) {
    const lead = state.leads.find((item) => item.id === leadId);
    if (lead) lead.status = status;
    setMessage(dashboardMessage, "Statut mis à jour localement en mode démo.", "success");
    return;
  }

  try {
    const { error } = await adminClient
      .from("leads")
      .update({ status })
      .eq("id", leadId);

    if (error) throw error;

    const lead = state.leads.find((item) => item.id === leadId);
    if (lead) lead.status = status;
    setMessage(dashboardMessage, "Statut mis à jour.", "success");
  } catch (error) {
    setMessage(dashboardMessage, "Impossible de mettre à jour le statut.", "error");
  }
}

function exportCsv() {
  const leads = getFilteredLeads();
  const headers = [
    "full_name",
    "email",
    "phone",
    "city",
    "user_type",
    "category",
    "organization_name",
    "website",
    "message",
    "status",
    "created_at"
  ];

  const rows = leads.map((lead) => headers.map((header) => csvCell(lead[header])).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hkonekt-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const clean = String(value ?? "").replaceAll('"', '""');
  return `"${clean}"`;
}

async function handleHeroUpload(event) {
  event.preventDefault();

  if (state.demoMode) {
    const file = uploadForm.elements.hero_file.files[0];
    if (!file) {
      setMessage(uploadMessage, "Sélectionnez une image pour prévisualiser le changement.", "error");
      return;
    }

    heroPreview.src = URL.createObjectURL(file);
    uploadForm.reset();
    setMessage(uploadMessage, "Image prévisualisée en mode démo. Elle ne sera pas sauvegardée.", "success");
    return;
  }

  const file = uploadForm.elements.hero_file.files[0];
  const submitButton = uploadForm.querySelector("button");

  if (!file) {
    setMessage(uploadMessage, "Sélectionnez une image.", "error");
    return;
  }

  if (!file.type.startsWith("image/")) {
    setMessage(uploadMessage, "Le fichier doit être une image.", "error");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setMessage(uploadMessage, "L'image ne doit pas dépasser 5 MB.", "error");
    return;
  }

  submitButton.disabled = true;
  setMessage(uploadMessage, "Upload en cours...");

  try {
    const extension = file.name.split(".").pop() || "png";
    const path = `hero/hero-${Date.now()}.${extension}`;

    const { error: uploadError } = await adminClient.storage
      .from("site_images")
      .upload(path, file, { cacheControl: "3600", upsert: true });

    if (uploadError) throw uploadError;

    const { data } = adminClient.storage.from("site_images").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    const { error: updateError } = await adminClient
      .from("site_config")
      .update({ hero_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (updateError) throw updateError;

    heroPreview.src = publicUrl;
    uploadForm.reset();
    setMessage(uploadMessage, "Image hero mise à jour.", "success");
  } catch (error) {
    setMessage(uploadMessage, error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function logout() {
  if (state.demoMode) {
    state.demoMode = false;
    state.leads = [];
    setMessage(loginMessage, "Mode démo fermé.");
    showLogin();
    return;
  }

  await adminClient.auth.signOut();
  showLogin();
}

function getDemoLeads() {
  return [
    {
      id: "demo-1",
      full_name: "Marlène Joseph",
      email: "marlene.joseph@example.com",
      phone: "+33 6 21 45 78 10",
      city: "Paris",
      user_type: "professionnel",
      organization_name: "Maison Lakay Traiteur",
      category: "gastronomie",
      status: "qualifie",
      created_at: "2026-06-08T14:20:00.000Z",
      message: "Traiteur haïtien pour mariages et événements privés."
    },
    {
      id: "demo-2",
      full_name: "Kervens Louis",
      email: "kervens.dj@example.com",
      phone: "+33 7 18 64 91 33",
      city: "Créteil",
      user_type: "organisateur",
      organization_name: "KL Events",
      category: "evenementiel",
      status: "contacte",
      created_at: "2026-06-07T09:45:00.000Z",
      message: "DJ et animateur micro pour soirées communautaires."
    },
    {
      id: "demo-3",
      full_name: "Nadine Pierre",
      email: "nadine.pierre@example.com",
      phone: "+33 6 43 11 09 72",
      city: "Lyon",
      user_type: "professionnel",
      organization_name: "NP Conseil",
      category: "juridique_conseil_expertise",
      status: "nouveau",
      created_at: "2026-06-06T18:05:00.000Z",
      message: "Accompagnement administratif et conseil aux entrepreneurs."
    },
    {
      id: "demo-4",
      full_name: "Sophia Jean-Baptiste",
      email: "sophia.beauty@example.com",
      phone: "+33 7 52 98 34 12",
      city: "Montreuil",
      user_type: "professionnel",
      organization_name: "SJB Beauty Studio",
      category: "beaute_bien_etre",
      status: "valide",
      created_at: "2026-06-05T11:30:00.000Z",
      message: "Coiffure, maquillage et soins pour événements."
    },
    {
      id: "demo-5",
      full_name: "Junior Étienne",
      email: "junior.tech@example.com",
      phone: "+33 6 89 22 57 41",
      city: "Marseille",
      user_type: "professionnel",
      organization_name: "Étienne Services",
      category: "batiment_techniques",
      status: "nouveau",
      created_at: "2026-06-04T16:10:00.000Z",
      message: "Électricité, petites réparations et maintenance."
    },
    {
      id: "demo-6",
      full_name: "Jean-Marc Augustin",
      email: "jm.augustin@example.com",
      phone: "+33 6 74 19 02 66",
      city: "Bordeaux",
      user_type: "professionnel",
      organization_name: "Augustin Patrimoine",
      category: "finance_gestion_investissement",
      status: "refuse",
      created_at: "2026-06-03T08:55:00.000Z",
      message: "Conseil financier et accompagnement création d'entreprise."
    }
  ];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loginForm?.addEventListener("submit", handleLogin);
demoButton?.addEventListener("click", enterDemoMode);
logoutButton?.addEventListener("click", logout);
leadSearch?.addEventListener("input", renderLeadsTable);
exportButton?.addEventListener("click", exportCsv);
uploadForm?.addEventListener("submit", handleHeroUpload);
leadsTableBody?.addEventListener("change", (event) => {
  if (event.target.matches(".status-select")) {
    updateLeadStatus(event.target);
  }
});

initAdmin();
