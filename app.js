const config = window.HKONEKT_SUPABASE || {};
const hasSupabaseConfig =
  config.url &&
  config.anonKey &&
  !config.url.includes("YOUR_") &&
  !config.anonKey.includes("YOUR_");

const supabaseClient =
  hasSupabaseConfig && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

const leadForm = document.querySelector("#lead-form");
const formMessage = document.querySelector("#form-message");
const heroImage = document.querySelector("#hero-image");
const socialCounter = document.querySelector("#social-counter");
const siteHeader = document.querySelector(".site-header");

function setFormMessage(message, type = "info") {
  if (!formMessage) return;
  formMessage.textContent = message;
  formMessage.dataset.type = type;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function loadHeroImage() {
  if (!supabaseClient || !heroImage) return;

  try {
    const { data, error } = await supabaseClient
      .from("site_config")
      .select("hero_image_url")
      .eq("id", 1)
      .single();

    if (error) throw error;
    if (data?.hero_image_url) {
      heroImage.src = data.hero_image_url;
    }
  } catch (error) {
    console.warn("Image dynamique indisponible:", error.message);
  }
}

async function trackPageView() {
  if (!supabaseClient) return;

  const storageKey = "hkonekt_view_counted";
  if (localStorage.getItem(storageKey)) return;

  try {
    const { error } = await supabaseClient.rpc("increment_page_views");
    if (error) throw error;
    localStorage.setItem(storageKey, new Date().toISOString());
  } catch (error) {
    console.warn("Tracking indisponible:", error.message);
  }
}

async function submitLead(event) {
  event.preventDefault();

  const submitButton = leadForm.querySelector(".submit-button");
  const emailInput = leadForm.elements.email;
  const fullNameInput = leadForm.elements.full_name;
  const cityInput = leadForm.elements.city;
  const categoryInput = leadForm.elements.category;
  const consentInput = leadForm.elements.consent_news;
  const email = emailInput.value.trim().toLowerCase();

  if (!isValidEmail(email)) {
    setFormMessage("Entrez une adresse email valide.", "error");
    emailInput.focus();
    return;
  }

  if (fullNameInput && !fullNameInput.value.trim()) {
    setFormMessage("Ajoutez votre nom complet pour valider la préinscription.", "error");
    fullNameInput.focus();
    return;
  }

  if (cityInput && !cityInput.value.trim()) {
    setFormMessage("Indiquez votre ville ou votre région.", "error");
    cityInput.focus();
    return;
  }

  if (categoryInput && !categoryInput.value) {
    setFormMessage("Sélectionnez votre catégorie principale.", "error");
    categoryInput.focus();
    return;
  }

  if (consentInput && !consentInput.checked) {
    setFormMessage("Vous devez accepter d'être contacté concernant le lancement.", "error");
    consentInput.focus();
    return;
  }

  if (!supabaseClient) {
    setFormMessage("Mode démo actif : ajoutez vos clés Supabase pour enregistrer les préinscriptions.", "info");
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Envoi en cours...";
  setFormMessage("", "info");

  try {
    const payload = buildLeadPayload(leadForm);
    const { error } = await supabaseClient.from("leads").insert(payload);

    if (error) throw error;

    leadForm.innerHTML = `
      <div class="success-state">
        <span>Merci.</span>
        <strong>Votre préinscription est confirmée.</strong>
        <p>Vous serez informé en priorité du lancement de H.KONEKT.</p>
      </div>
    `;
  } catch (error) {
    const alreadyExists = error.code === "23505" || /duplicate|unique/i.test(error.message);
    setFormMessage(
      alreadyExists ? "Cet email est déjà inscrit à la liste d'attente." : "Impossible d'envoyer la préinscription pour le moment.",
      "error"
    );
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Rejoindre la liste";
  }
}

function buildLeadPayload(form) {
  const formData = new FormData(form);
  const payload = {};

  formData.forEach((value, key) => {
    const cleanValue = typeof value === "string" ? value.trim() : value;
    if (cleanValue !== "") {
      payload[key] = cleanValue;
    }
  });

  payload.email = payload.email?.toLowerCase();
  payload.consent_news = Boolean(form.elements.consent_news?.checked);

  return payload;
}

function initScrollAnimations() {
  const animatedElements = document.querySelectorAll("[data-animate]");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
  );

  animatedElements.forEach((element) => observer.observe(element));
}

function animateCounter() {
  if (!socialCounter) return;

  const target = Number(socialCounter.dataset.target || 0);
  const duration = 1500;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.floor(target * eased);
    socialCounter.textContent = new Intl.NumberFormat("fr-FR").format(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function initCounterObserver() {
  if (!socialCounter) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        animateCounter();
        observer.disconnect();
      }
    },
    { threshold: 0.4 }
  );

  observer.observe(socialCounter);
}

function initHeaderTransparency() {
  if (!siteHeader) return;

  function updateHeaderState() {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });
}

leadForm?.addEventListener("submit", submitLead);
initHeaderTransparency();
initScrollAnimations();
initCounterObserver();
loadHeroImage();
trackPageView();
