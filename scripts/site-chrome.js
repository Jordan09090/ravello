// Loads the ONE shared nav/footer markup (site-chrome.html) into every
// page that includes this script, then keeps its text content (menu
// links, phone number, etc.) in sync with Firebase so it can all be
// edited in one place (admin.html) and update everywhere at once.
import { db } from "./firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- Inject the shared markup ----------
async function injectChrome() {
  const res = await fetch("site-chrome.html");
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, "text/html");

  const navTemplate = doc.getElementById("site-nav-template");
  const footerTemplate = doc.getElementById("site-footer-template");

  document.querySelectorAll("[data-site-nav]").forEach(mount => {
    mount.appendChild(navTemplate.content.cloneNode(true));
  });
  document.querySelectorAll("[data-site-footer]").forEach(mount => {
    mount.appendChild(footerTemplate.content.cloneNode(true));
  });
}

// ---------- Nav interactivity (toggle, smooth-scroll, scroll-spy theme) ----------
function initNavBehavior() {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");
  const navLinks = document.querySelector(".nav__links");
  const observedSections = document.querySelectorAll("[data-nav-theme]");
  const currentFile = location.pathname.split("/").pop() || "index.html";

  if (!nav || !navLinks) return;

  const applyNavTheme = (theme = "light") => {
    nav.classList.toggle("nav--on-dark", theme === "dark");
    nav.classList.toggle("nav--on-light", theme !== "dark");
  };

  if (toggle) {
    toggle.addEventListener("click", () => navLinks.classList.toggle("is-open"));
  }

  const setActiveLink = id => {
    navLinks.querySelectorAll("a").forEach(link => {
      link.classList.toggle("is-active", (link.getAttribute("href") || "").endsWith(`#${id}`));
    });
  };

  navLinks.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link) return;
    navLinks.classList.remove("is-open");

    const href = link.getAttribute("href") || "";
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;

    const filePart = href.slice(0, hashIndex);
    if (filePart && filePart !== currentFile) return;

    const section = document.querySelector(href.slice(hashIndex));
    if (section) {
      event.preventDefault();
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  if (observedSections.length) {
    const navLine = () => (nav.getBoundingClientRect().height || 80) + 10;

    const updateNavTheme = () => {
      const checkLine = navLine();
      let activeId = "";
      let theme = "light";

      observedSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= checkLine && rect.bottom >= checkLine) {
          theme = section.dataset.navTheme || "light";
          activeId = section.id || "";
        }
      });

      applyNavTheme(theme);
      if (activeId) setActiveLink(activeId);
    };

    let ticking = false;
    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateNavTheme(); ticking = false; });
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    updateNavTheme();
  }
}

function initFooterYear() {
  const el = document.querySelector("[data-year]");
  if (el) el.textContent = new Date().getFullYear();
}

// ---------- Keep nav links + footer details in sync with Firebase ----------
function bindLiveData() {
  const navList = document.querySelector(".nav__links[data-dynamic-nav]");
  if (navList) {
    onValue(ref(db, "site/nav"), snapshot => {
      const links = snapshot.val();
      if (!Array.isArray(links) || !links.length) return; // keep defaults from the template
      navList.innerHTML = links.map(link => {
        const external = /^https?:\/\//.test(link.href);
        const attrs = external ? ' target="_blank" rel="noopener"' : "";
        return `<li><a href="${escapeHtml(link.href)}"${attrs}>${escapeHtml(link.label)}</a></li>`;
      }).join("");
    });
  }

  onValue(ref(db, "site/footer"), snapshot => {
    const footer = snapshot.val();
    if (!footer) return;

    const setText = (id, value) => {
      if (!value) return;
      document.querySelectorAll(`#${id}`).forEach(el => { el.textContent = value; });
    };
    const setHtml = (id, value) => {
      if (!value) return;
      document.querySelectorAll(`#${id}`).forEach(el => { el.innerHTML = value; });
    };
    const setLink = (id, hrefBuilder, value) => {
      if (!value) return;
      document.querySelectorAll(`#${id}`).forEach(el => {
        el.textContent = value;
        el.setAttribute("href", hrefBuilder(value));
      });
    };

    setText("footer-tagline", footer.tagline);
    setHtml("footer-address", footer.addressHtml);
    setLink("footer-phone", v => `tel:${v.replace(/[^\d+]/g, "")}`, footer.phone);
    setLink("footer-email", v => `mailto:${v}`, footer.email);
    if (footer.instagram) {
      document.querySelectorAll("#footer-instagram").forEach(el => el.setAttribute("href", footer.instagram));
    }
  });
}

injectChrome()
  .then(() => {
    initNavBehavior();
    initFooterYear();
    bindLiveData();
  })
  .catch(err => {
    console.error("Could not load site-chrome.html — nav/footer will be missing on this page.", err);
  });
