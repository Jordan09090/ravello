import { db, auth } from "./firebase-init.js";
import {
  ref, push, set, update, remove, onValue, get
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { fileToCompressedDataUrl, dataUrlSizeKb } from "./img-compress.js";
import { renderInline } from "./blog-data.js";

// ---------- Auth guard ----------
onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "admin-login.html";
  } else {
    document.getElementById("admin-user").textContent = user.email || "";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  signOut(auth).then(() => location.href = "admin-login.html");
});

// ---------- Tabs ----------
document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("is-active"));
    document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`.admin-panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
  });
});

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showStatus(el, message, ok) {
  el.textContent = message;
  el.className = "admin-status " + (ok ? "admin-status--ok" : "admin-status--error");
  if (ok) setTimeout(() => { el.textContent = ""; }, 3000);
}

// ================= SERVICES =================
const serviceForm = document.getElementById("service-form");
const serviceStatus = document.getElementById("service-status");
const serviceCancelBtn = document.getElementById("service-cancel");
let editingServiceId = null;

function resetServiceForm() {
  serviceForm.reset();
  document.getElementById("service-id").value = "";
  editingServiceId = null;
  document.getElementById("service-form-title").textContent = "Add a Service";
  serviceCancelBtn.hidden = true;
}

serviceCancelBtn.addEventListener("click", resetServiceForm);

serviceForm.addEventListener("submit", async event => {
  event.preventDefault();
  const data = {
    name: document.getElementById("service-name").value.trim(),
    meta: document.getElementById("service-meta").value.trim(),
    ctaLabel: document.getElementById("service-cta-label").value.trim() || "Book now",
    ctaHref: document.getElementById("service-cta-href").value.trim() || "https://book.squareup.com/appointments/0ktylsxk2qasvu/location/LJ00TF1GQ198E/services",
    description: document.getElementById("service-description").value.trim(),
    order: Date.now()
  };
  try {
    if (editingServiceId) {
      await update(ref(db, `services/${editingServiceId}`), data);
    } else {
      await push(ref(db, "services"), data);
    }
    showStatus(serviceStatus, "Saved.", true);
    resetServiceForm();
  } catch (err) {
    showStatus(serviceStatus, "Couldn't save: " + err.message, false);
  }
});

function editService(id, data) {
  editingServiceId = id;
  document.getElementById("service-id").value = id;
  document.getElementById("service-name").value = data.name || "";
  document.getElementById("service-meta").value = data.meta || "";
  document.getElementById("service-cta-label").value = data.ctaLabel || "";
  document.getElementById("service-cta-href").value = data.ctaHref || "";
  document.getElementById("service-description").value = data.description || "";
  document.getElementById("service-form-title").textContent = "Edit Service";
  serviceCancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onValue(ref(db, "services"), snapshot => {
  const val = snapshot.val() || {};
  const items = Object.entries(val).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const list = document.getElementById("service-list");
  list.innerHTML = items.length ? "" : '<p class="admin-empty">No services yet.</p>';
  items.forEach(([id, data]) => {
    const row = document.createElement("div");
    row.className = "admin-list-item";
    row.innerHTML = `
      <div class="admin-list-item__body">
        <p class="admin-list-item__title">${escapeHtml(data.name || "")}</p>
        <p class="admin-list-item__meta">${escapeHtml(data.meta || "")}</p>
      </div>
      <div class="admin-list-item__actions">
        <button class="admin-btn admin-btn--ghost admin-btn--small" data-edit>Edit</button>
        <button class="admin-btn admin-btn--danger admin-btn--small" data-delete>Delete</button>
      </div>`;
    row.querySelector("[data-edit]").addEventListener("click", () => editService(id, data));
    row.querySelector("[data-delete]").addEventListener("click", async () => {
      if (confirm(`Delete "${data.name}"?`)) await remove(ref(db, `services/${id}`));
    });
    list.appendChild(row);
  });
});

// ================= GALLERY (shared media library) =================
// Photos live here once, tagged with a name, and get reused by picking
// them in any blog post below instead of re-uploading the same photo.
let mediaItems = []; // [{id, name, src}], newest first

function renderMediaGrid() {
  const grid = document.getElementById("media-grid");
  grid.innerHTML = mediaItems.length ? "" : '<p class="admin-empty">No photos yet — upload some above.</p>';
  mediaItems.forEach(item => {
    const el = document.createElement("div");
    el.className = "admin-gallery-item";
    el.innerHTML = `
      <img src="${item.src}" alt="">
      <div class="admin-gallery-item__body">
        <input type="text" value="${escapeHtml(item.name || "")}" data-rename>
        <div class="admin-gallery-item__actions">
          <button type="button" class="admin-btn admin-btn--ghost admin-btn--small" data-save>Save</button>
          <button type="button" class="admin-btn admin-btn--danger admin-btn--small" data-delete>Delete</button>
        </div>
      </div>`;
    el.querySelector("[data-save]").addEventListener("click", async () => {
      const name = el.querySelector("[data-rename]").value.trim();
      await update(ref(db, `media/${item.id}`), { name });
    });
    el.querySelector("[data-delete]").addEventListener("click", async () => {
      if (confirm(`Delete "${item.name}"? Any post already using this photo keeps its own copy, so this won't remove it from posts.`)) {
        await remove(ref(db, `media/${item.id}`));
      }
    });
    grid.appendChild(el);
  });
}

function renderGalleryPicker(containerId, onPick) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = mediaItems.length
    ? mediaItems.map(item => `
        <button type="button" class="admin-gallery-picker__item" data-id="${item.id}" title="${escapeHtml(item.name || "")}">
          <img src="${item.src}" alt="">
          <span>${escapeHtml(item.name || "")}</span>
        </button>`).join("")
    : '<p class="admin-gallery-picker__empty">No photos in the gallery yet — add some on the Gallery tab.</p>';
  el.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = mediaItems.find(m => m.id === btn.dataset.id);
      if (item) onPick(item);
    });
  });
}

onValue(ref(db, "media"), snapshot => {
  const val = snapshot.val() || {};
  mediaItems = Object.entries(val)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  renderMediaGrid();
  renderGalleryPicker("blog-primary-gallery-picker", item => pickPrimaryFromGallery(item));
  renderGalleryPicker("blog-gallery-gallery-picker", item => pickGalleryImageFromGallery(item));
});

document.getElementById("media-upload").addEventListener("change", async event => {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const statusEl = document.getElementById("media-upload-status");
  statusEl.textContent = `Uploading ${files.length} photo${files.length > 1 ? "s" : ""}…`;
  statusEl.className = "admin-status";
  try {
    for (const file of files) {
      const src = await fileToCompressedDataUrl(file, { maxDim: 1400, quality: 0.75 });
      const name = file.name.replace(/\.[^.]+$/, "");
      await push(ref(db, "media"), { name, src, createdAt: Date.now() });
    }
    showStatus(statusEl, "Done.", true);
  } catch (err) {
    showStatus(statusEl, "Couldn't upload: " + err.message, false);
  } finally {
    event.target.value = "";
  }
});

// ================= BLOG POSTS =================
const blogForm = document.getElementById("blog-form");
const blogStatus = document.getElementById("blog-status");
const blogCancelBtn = document.getElementById("blog-cancel");
const blogSaveBtn = document.getElementById("blog-save-btn");
const blogContentEl = document.getElementById("blog-content");
let editingBlogId = null;
let primaryImage = ""; // single data-URL or http(s) URL string, or ""
let galleryImages = []; // array of data-URL / http(s) URL strings

// ---- Content editor: WYSIWYG box <-> plain "**bold**"/"[text](url)" text ----
// The box shows real bold/blue-link formatting as you edit (no symbols
// visible), but what gets saved to Firebase is still plain text with those
// markers — the exact same format post.html already knows how to render,
// so nothing else needed to change and old posts still work.
try { document.execCommand("defaultParagraphSeparator", false, "br"); } catch (e) { /* unsupported: fine, Enter just falls back to browser default */ }

// The editor <-> storage rendering (bold/link/list markers) is shared with
// post.html via renderInline() in blog-data.js, imported above — so the
// preview here always matches what visitors actually see.
const markerTextToHtml = renderInline;

function domToMarkerText(root) {
  let out = "";
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) { out += node.textContent; return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === "BR") { out += "\n"; return; }
    if (tag === "STRONG" || tag === "B") {
      const inner = Array.from(node.childNodes).map(nodeToMarkerText).join("");
      out += inner.trim() ? `**${inner}**` : inner;
      return;
    }
    if (tag === "A") {
      out += `[${node.textContent}](${node.getAttribute("href") || ""})`;
      return;
    }
    if (tag === "UL" || tag === "OL") {
      if (out && !out.endsWith("\n")) out += "\n";
      Array.from(node.children).forEach(li => {
        if (li.tagName !== "LI") return;
        const itemText = Array.from(li.childNodes).map(nodeToMarkerText).join("").trim();
        out += `- ${itemText}\n`;
      });
      return;
    }
    if (tag === "DIV" || tag === "P" || tag === "LI") {
      if (out && !out.endsWith("\n")) out += "\n";
      Array.from(node.childNodes).forEach(walk);
      if (!out.endsWith("\n")) out += "\n";
      return;
    }
    Array.from(node.childNodes).forEach(walk);
  }
  // helper so nested bold/link content inside <strong>/<a>/<li> is captured the same way
  function nodeToMarkerText(node) {
    const before = out;
    out = "";
    walk(node);
    const result = out;
    out = before;
    return result;
  }
  Array.from(root.childNodes).forEach(walk);
  return out.replace(/\n+$/, "").replace(/^\n+/, "");
}

function initContentEditor(editor) {
  // Tab should indent, not move focus away from the box.
  editor.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertText", false, "\t");
    }
  });

  // Paste as plain text only — keeps pasted content clean (no fonts/colors
  // carried in from Word, Google Docs, ChatGPT, etc.) so it looks exactly
  // like the rest of the post; use the Bold/Link buttons afterward if needed.
  editor.addEventListener("paste", event => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });
}
initContentEditor(blogContentEl);

function renderPrimaryPreview() {
  const el = document.getElementById("blog-primary-preview");
  el.innerHTML = primaryImage ? `
    <div class="admin-image-thumb">
      <img src="${primaryImage}" alt="">
      <button type="button" class="admin-image-thumb__remove" data-remove-primary title="Remove">×</button>
    </div>` : "";
  const removeBtn = el.querySelector("[data-remove-primary]");
  if (removeBtn) removeBtn.addEventListener("click", () => { primaryImage = ""; renderPrimaryPreview(); });
}

function renderGalleryPreview() {
  const el = document.getElementById("blog-gallery-preview");
  el.innerHTML = galleryImages.map((src, i) => `
    <div class="admin-image-thumb">
      <img src="${src}" alt="">
      <button type="button" class="admin-image-thumb__remove" data-remove-gallery="${i}" title="Remove">×</button>
    </div>`).join("");
  el.querySelectorAll("[data-remove-gallery]").forEach(btn => {
    btn.addEventListener("click", () => {
      galleryImages.splice(Number(btn.dataset.removeGallery), 1);
      renderGalleryPreview();
    });
  });
}

function resetBlogForm() {
  blogForm.reset();
  document.getElementById("blog-id").value = "";
  document.getElementById("blog-category").value = "Spray Tan Tips";
  document.getElementById("blog-primary-image-url").value = "";
  document.getElementById("blog-gallery-image-url").value = "";
  blogContentEl.innerHTML = ""; // not a real form control, so form.reset() won't clear it
  editingBlogId = null;
  primaryImage = "";
  galleryImages = [];
  document.getElementById("blog-form-title").textContent = "Add a Blog Post";
  renderPrimaryPreview();
  renderGalleryPreview();
  blogCancelBtn.hidden = true;
}

blogCancelBtn.addEventListener("click", resetBlogForm);

document.getElementById("blog-primary-image").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  primaryImage = await fileToCompressedDataUrl(file, { maxDim: 1600, quality: 0.75 });
  renderPrimaryPreview();
  event.target.value = "";
});

document.getElementById("blog-primary-image-url-add").addEventListener("click", () => {
  const input = document.getElementById("blog-primary-image-url");
  const url = input.value.trim();
  if (!url) return;
  primaryImage = url;
  input.value = "";
  renderPrimaryPreview();
});

document.getElementById("blog-gallery-images").addEventListener("change", async event => {
  const files = Array.from(event.target.files);
  const compressed = await Promise.all(files.map(f => fileToCompressedDataUrl(f, { maxDim: 1400, quality: 0.72 })));
  galleryImages.push(...compressed);
  renderGalleryPreview();
  event.target.value = "";
});

document.getElementById("blog-gallery-image-url-add").addEventListener("click", () => {
  const input = document.getElementById("blog-gallery-image-url");
  const url = input.value.trim();
  if (!url) return;
  galleryImages.push(url);
  input.value = "";
  renderGalleryPreview();
});

// ---- Picking photos from the shared Gallery instead of uploading fresh ----
function pickPrimaryFromGallery(item) {
  primaryImage = item.src;
  renderPrimaryPreview();
  document.getElementById("blog-primary-gallery-picker").hidden = true;
}

function pickGalleryImageFromGallery(item) {
  galleryImages.push(item.src);
  renderGalleryPreview();
  // left open so several photos can be added one after another
}

document.getElementById("blog-primary-gallery-toggle").addEventListener("click", () => {
  const picker = document.getElementById("blog-primary-gallery-picker");
  picker.hidden = !picker.hidden;
});

document.getElementById("blog-gallery-gallery-toggle").addEventListener("click", () => {
  const picker = document.getElementById("blog-gallery-gallery-picker");
  picker.hidden = !picker.hidden;
});

// ---- Bold / Link toolbar for the content editor ----
// Bound on "mousedown" + preventDefault (not "click") so the button never
// steals focus/selection from the editor in the first place.
document.getElementById("content-bold-btn").addEventListener("mousedown", event => {
  event.preventDefault();
  blogContentEl.focus();
  document.execCommand("bold");
});

document.getElementById("content-list-btn").addEventListener("mousedown", event => {
  event.preventDefault();
  blogContentEl.focus();
  document.execCommand("insertUnorderedList");
});

function getAnchorAtSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return null;
  const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
  return node ? node.closest("a") : null;
}

document.getElementById("content-link-btn").addEventListener("mousedown", event => {
  event.preventDefault();
  blogContentEl.focus();

  const sel = window.getSelection();
  const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed;

  const url = prompt("Link URL (starting with https://, mailto: or tel:):");
  if (!url) return;

  if (!hasSelection) {
    const linkText = prompt("Link text:", url) || url;
    document.execCommand("insertText", false, linkText);
    const range = document.getSelection().getRangeAt(0);
    range.setStart(range.endContainer, Math.max(0, range.endOffset - linkText.length));
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
  }

  document.execCommand("createLink", false, url);
  const anchor = getAnchorAtSelection();
  if (anchor) {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener");
  }
});

blogForm.addEventListener("submit", async event => {
  event.preventDefault();

  const content = domToMarkerText(blogContentEl);
  if (!content.trim()) {
    showStatus(blogStatus, "Please add some content before saving.", false);
    blogContentEl.focus();
    return;
  }

  blogSaveBtn.disabled = true;
  blogSaveBtn.textContent = "Saving…";

  const data = {
    title: document.getElementById("blog-title").value.trim(),
    category: document.getElementById("blog-category").value.trim() || "Spray Tan Tips",
    description: document.getElementById("blog-description").value.trim(),
    content,
    primaryImage,
    images: galleryImages
  };

  try {
    if (editingBlogId) {
      await update(ref(db, `blogs/${editingBlogId}`), data);
    } else {
      data.createdAt = Date.now();
      await push(ref(db, "blogs"), data);
    }
    showStatus(blogStatus, "Post saved.", true);
    resetBlogForm();
  } catch (err) {
    showStatus(blogStatus, "Couldn't save: " + err.message, false);
  } finally {
    blogSaveBtn.disabled = false;
    blogSaveBtn.textContent = "Save Post";
  }
});

function editBlog(id, data) {
  editingBlogId = id;
  primaryImage = data.primaryImage || "";
  galleryImages = (data.images || []).slice();
  document.getElementById("blog-id").value = id;
  document.getElementById("blog-title").value = data.title || "";
  document.getElementById("blog-category").value = data.category || "Spray Tan Tips";
  document.getElementById("blog-description").value = data.description || "";
  blogContentEl.innerHTML = markerTextToHtml(data.content || "");
  renderPrimaryPreview();
  renderGalleryPreview();
  document.getElementById("blog-form-title").textContent = "Edit Blog Post";
  blogCancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onValue(ref(db, "blogs"), snapshot => {
  const val = snapshot.val() || {};
  const items = Object.entries(val).sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  const list = document.getElementById("blog-list");
  list.innerHTML = items.length ? "" : '<p class="admin-empty">No posts yet.</p>';
  items.forEach(([id, data]) => {
    const row = document.createElement("div");
    row.className = "admin-list-item";
    const thumb = data.primaryImage || (data.images && data.images[0]) || "";
    row.innerHTML = `
      ${thumb ? `<img src="${thumb}" alt="">` : ""}
      <div class="admin-list-item__body">
        <p class="admin-list-item__title">${escapeHtml(data.title || "")}</p>
        <p class="admin-list-item__meta">${escapeHtml(data.category || "")}</p>
      </div>
      <div class="admin-list-item__actions">
        <a class="admin-btn admin-btn--ghost admin-btn--small" href="post.html?id=${encodeURIComponent(id)}" target="_blank" rel="noopener">View</a>
        <button class="admin-btn admin-btn--ghost admin-btn--small" data-edit>Edit</button>
        <button class="admin-btn admin-btn--danger admin-btn--small" data-delete>Delete</button>
      </div>`;
    row.querySelector("[data-edit]").addEventListener("click", () => editBlog(id, data));
    row.querySelector("[data-delete]").addEventListener("click", async () => {
      if (confirm(`Delete "${data.title}"? This can't be undone.`)) await remove(ref(db, `blogs/${id}`));
    });
    list.appendChild(row);
  });
});

// ================= FAQ =================
const faqForm = document.getElementById("faq-form");
const faqStatus = document.getElementById("faq-status");
const faqCancelBtn = document.getElementById("faq-cancel");
let editingFaqId = null;

function resetFaqForm() {
  faqForm.reset();
  document.getElementById("faq-id").value = "";
  editingFaqId = null;
  document.getElementById("faq-form-title").textContent = "Add a Question";
  faqCancelBtn.hidden = true;
}

faqCancelBtn.addEventListener("click", resetFaqForm);

faqForm.addEventListener("submit", async event => {
  event.preventDefault();
  const data = {
    question: document.getElementById("faq-question").value.trim(),
    answer: document.getElementById("faq-answer").value.trim(),
    order: Date.now()
  };
  try {
    if (editingFaqId) {
      const existing = await get(ref(db, `faq/${editingFaqId}/order`));
      data.order = existing.exists() ? existing.val() : data.order;
      await update(ref(db, `faq/${editingFaqId}`), data);
    } else {
      await push(ref(db, "faq"), data);
    }
    showStatus(faqStatus, "Saved.", true);
    resetFaqForm();
  } catch (err) {
    showStatus(faqStatus, "Couldn't save: " + err.message, false);
  }
});

function editFaq(id, data) {
  editingFaqId = id;
  document.getElementById("faq-id").value = id;
  document.getElementById("faq-question").value = data.question || "";
  document.getElementById("faq-answer").value = data.answer || "";
  document.getElementById("faq-form-title").textContent = "Edit Question";
  faqCancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

onValue(ref(db, "faq"), snapshot => {
  const val = snapshot.val() || {};
  const items = Object.entries(val).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
  const list = document.getElementById("faq-list-admin");
  list.innerHTML = items.length ? "" : '<p class="admin-empty">No questions yet.</p>';
  items.forEach(([id, data]) => {
    const row = document.createElement("div");
    row.className = "admin-list-item";
    row.innerHTML = `
      <div class="admin-list-item__body">
        <p class="admin-list-item__title">${escapeHtml(data.question || "")}</p>
      </div>
      <div class="admin-list-item__actions">
        <button class="admin-btn admin-btn--ghost admin-btn--small" data-edit>Edit</button>
        <button class="admin-btn admin-btn--danger admin-btn--small" data-delete>Delete</button>
      </div>`;
    row.querySelector("[data-edit]").addEventListener("click", () => editFaq(id, data));
    row.querySelector("[data-delete]").addEventListener("click", async () => {
      if (confirm("Delete this question?")) await remove(ref(db, `faq/${id}`));
    });
    list.appendChild(row);
  });
});

// ================= SITE INFO: NAV =================
const navRowsEl = document.getElementById("nav-rows");
let navRows = [];

function renderNavRows() {
  navRowsEl.innerHTML = "";
  navRows.forEach((link, i) => {
    const row = document.createElement("div");
    row.className = "admin-nav-row";
    row.innerHTML = `
      <input type="text" placeholder="Label" value="${escapeHtml(link.label || "")}" data-field="label">
      <input type="text" placeholder="Link (e.g. index.html#services or a full https:// URL)" value="${escapeHtml(link.href || "")}" data-field="href">
      <button type="button" class="admin-btn admin-btn--danger admin-btn--small">Remove</button>`;
    row.querySelector('[data-field="label"]').addEventListener("input", e => navRows[i].label = e.target.value);
    row.querySelector('[data-field="href"]').addEventListener("input", e => navRows[i].href = e.target.value);
    row.querySelector("button").addEventListener("click", () => {
      navRows.splice(i, 1);
      renderNavRows();
    });
    navRowsEl.appendChild(row);
  });
}

document.getElementById("nav-add-row").addEventListener("click", () => {
  navRows.push({ label: "", href: "" });
  renderNavRows();
});

document.getElementById("nav-save").addEventListener("click", async () => {
  const clean = navRows.filter(l => l.label && l.href);
  try {
    await set(ref(db, "site/nav"), clean);
    showStatus(document.getElementById("nav-status"), "Menu saved.", true);
  } catch (err) {
    showStatus(document.getElementById("nav-status"), "Couldn't save: " + err.message, false);
  }
});

get(ref(db, "site/nav")).then(snapshot => {
  navRows = snapshot.exists() && Array.isArray(snapshot.val()) ? snapshot.val() : [
    { label: "Services", href: "index.html#services" },
    { label: "Blog", href: "blog.html" },
    { label: "FAQ", href: "faq.html" },
    { label: "Contact", href: "index.html#contact" },
    { label: "Book Now", href: "https://book.squareup.com/appointments/0ktylsxk2qasvu/location/LJ00TF1GQ198E/services" }
  ];
  renderNavRows();
});

// ================= SITE INFO: FOOTER =================
const footerForm = document.getElementById("footer-form");

get(ref(db, "site/footer")).then(snapshot => {
  const footer = snapshot.exists() ? snapshot.val() : {
    tagline: "The Custom Spray Tan Specialist",
    addressHtml: "Lathlain<br>Perth, WA 6100",
    phone: "+61 413 268 335",
    email: "ravellotans@gmail.com",
    instagram: "https://www.instagram.com/ravellotans"
  };
  document.getElementById("footer-tagline-input").value = footer.tagline || "";
  document.getElementById("footer-address-input").value = (footer.addressHtml || "").replace(/<br\s*\/?>/gi, "\n");
  document.getElementById("footer-phone-input").value = footer.phone || "";
  document.getElementById("footer-email-input").value = footer.email || "";
  document.getElementById("footer-instagram-input").value = footer.instagram || "";
});

footerForm.addEventListener("submit", async event => {
  event.preventDefault();
  const data = {
    tagline: document.getElementById("footer-tagline-input").value.trim(),
    addressHtml: escapeHtml(document.getElementById("footer-address-input").value.trim()).replace(/\n/g, "<br>"),
    phone: document.getElementById("footer-phone-input").value.trim(),
    email: document.getElementById("footer-email-input").value.trim(),
    instagram: document.getElementById("footer-instagram-input").value.trim()
  };
  try {
    await set(ref(db, "site/footer"), data);
    showStatus(document.getElementById("footer-status"), "Footer saved.", true);
  } catch (err) {
    showStatus(document.getElementById("footer-status"), "Couldn't save: " + err.message, false);
  }
});

// ================= SETUP / IMPORT STARTER CONTENT =================
document.getElementById("seed-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("seed-status");
  const btn = document.getElementById("seed-btn");
  btn.disabled = true;
  showStatus(statusEl, "Importing…", true);

  try {
    const [servicesSnap, faqSnap, navSnap, footerSnap, blogsSnap] = await Promise.all([
      get(ref(db, "services")), get(ref(db, "faq")), get(ref(db, "site/nav")),
      get(ref(db, "site/footer")), get(ref(db, "blogs"))
    ]);

    if (!servicesSnap.exists()) {
      await set(ref(db, "services"), {
        s1: { name: "Bridal Spray Tans", meta: "POA", ctaLabel: "Contact now", ctaHref: "mailto:ravellotans@gmail.com", description: "Your wedding tan deserves time, care, and precision. Includes a bridal trial to perfect shade, development time, and finish well before the big day. Please contact us directly to enquire.", order: 1 },
        s2: { name: "Custom Spray Tan", meta: "15 mins • $35", ctaLabel: "Book now", ctaHref: "https://book.squareup.com/appointments/0ktylsxk2qasvu/location/LJ00TF1GQ198E/services", description: "A fully customised spray tan tailored to your skin type, natural tone, and desired depth. Whether you're after a soft glow or a deep bronze for a special event, your tan is blended specifically for you.", order: 2 },
        s3: { name: "Mobile Spray Tans", meta: "From $50", ctaLabel: "Contact now", ctaHref: "mailto:ravellotans@gmail.com", description: "Planning a girls' night, event, or tanning party? We offer mobile tanning for groups of four or more, with better pricing for larger groups. Mobile bookings are not available online; please contact us directly.", order: 3 }
      });
    }

    if (!faqSnap.exists()) {
      await set(ref(db, "faq"), {
        f1: { question: "How long does a spray tan last?", answer: "With proper aftercare, a spray tan typically lasts up to around 10 days, depending on your skin, lifestyle and how well you maintain it.", order: 1 },
        f2: { question: "How long before I can shower after my spray tan?", answer: "Your spray tan artist will advise a rinse time based on the solution used and your desired result — this is usually a few hours, up to overnight for a deeper colour.", order: 2 },
        f3: { question: "Do I need to prepare my skin beforehand?", answer: "Yes — exfoliating the night before, shaving at least 24 hours prior, and arriving with clean, product-free skin all help your tan develop evenly.", order: 3 },
        f4: { question: "Do you offer mobile spray tans?", answer: "Yes, for groups of four or more. Mobile bookings aren't available online — please contact us directly to arrange one.", order: 4 },
        f5: { question: "Is your studio private?", answer: "Yes — only one client is in the studio at a time, with a buffer between appointments so you always have the space to yourself.", order: 5 }
      });
    }

    if (!navSnap.exists()) {
      await set(ref(db, "site/nav"), [
        { label: "Services", href: "index.html#services" },
        { label: "Blog", href: "blog.html" },
        { label: "FAQ", href: "faq.html" },
        { label: "Contact", href: "index.html#contact" },
        { label: "Book Now", href: "https://book.squareup.com/appointments/0ktylsxk2qasvu/location/LJ00TF1GQ198E/services" }
      ]);
    }

    if (!footerSnap.exists()) {
      await set(ref(db, "site/footer"), {
        tagline: "The Custom Spray Tan Specialist",
        addressHtml: "Lathlain<br>Perth, WA 6100",
        phone: "+61 413 268 335",
        email: "ravellotans@gmail.com",
        instagram: "https://www.instagram.com/ravellotans"
      });
    }

    if (!blogsSnap.exists()) {
      const [primary1, primary2] = await Promise.all([
        imageUrlToDataUrl("img/IMG_0902-web.jpg").catch(() => ""),
        imageUrlToDataUrl("img/showerback.jpg").catch(() => "")
      ]);
      await set(ref(db, "blogs"), {
        b1: {
          title: "Spray Tan Beforecare: How to Prepare for Your Spray Tan",
          category: "Spray Tan Tips",
          description: "Learn exactly how to prepare for a spray tan: exfoliating, shaving, skincare and what to wear.",
          primaryImage: primary1,
          images: primary1 ? [primary1] : [],
          content: BEFORECARE_TEXT,
          createdAt: Date.now() - 1000
        },
        b2: {
          title: "Spray Tan Aftercare: How to Make Your Spray Tan Last Longer",
          category: "Spray Tan Tips",
          description: "First rinse timing, what to avoid in the first 24 hours, and how to keep your glow going longer.",
          primaryImage: primary2,
          images: primary2 ? [primary2] : [],
          content: AFTERCARE_TEXT,
          createdAt: Date.now()
        }
      });
    }

    showStatus(statusEl, "Done — starter content imported.", true);
  } catch (err) {
    showStatus(statusEl, "Something went wrong: " + err.message, false);
  } finally {
    btn.disabled = false;
  }
});

function imageUrlToDataUrl(url) {
  return fetch(url).then(r => r.blob()).then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }));
}

const BEFORECARE_TEXT = `Getting the best possible spray tan starts before you even arrive at your appointment. Proper spray tan preparation helps create a smoother, more even colour, improves the longevity of your tan and helps your spray tan fade beautifully.

Whether you're booking a regular spray tan, a bridal spray tan in Perth, or preparing for a special event, following these spray tan beforecare instructions will help you get the most out of your appointment.

How to Prepare for a Spray Tan

1. Remove Hair 24 Hours Before Your Spray Tan
If you shave or wax, aim to do this at least 24 hours before your spray tan appointment. Shaving and waxing can temporarily irritate the skin and leave pores more open. Avoid shaving immediately before your appointment.

2. Exfoliate the Night Before
Exfoliate the night before your appointment using a non-oil-based exfoliating scrub or exfoliating mitt. Pay particular attention to areas where tan can build up:
    - Elbows
    - Knees
    - Ankles
    - Hands
    - Feet

3. Pause Active Skincare Before Your Spray Tan
Avoid retinol, AHAs, BHAs, glycolic acid and other exfoliating treatments for 24–48 hours before your spray tan.

4. Shower 4–5 Hours Before Your Appointment
Shower using a gentle, product-free wash. After your shower, avoid applying moisturiser, body oils, body butter, perfume or body sprays. Do not wash your hair on the day of your spray tan.

5. Arrive Without Deodorant, Perfume or Body Spray
Residue from these products can act as a barrier between your skin and the tanning solution.

6. Arrive Makeup-Free
Particularly across your face, neck and décolletage.

7. Book Your Manicure and Pedicure Before Your Spray Tan
Try to schedule it the day before your spray tan.

8. Schedule Facials and Beauty Treatments in Advance
Complete facials, skin needling, HydraFacials, chemical peels, brow tinting or lash lifts at least 48 hours before your spray tan.

9. Make Sure Cosmetic Tattoos Are Fully Healed
Avoid spray tanning over fresh or healing cosmetic tattoos.

10. Wear Loose, Dark Clothing
Wear loose, dark and comfortable clothing to your appointment to minimise rubbing while your tan develops.

Spray Tan Preparation Checklist
    - Exfoliated the night before
    - Removed any old spray tan
    - Shaved or waxed at least 24 hours beforehand
    - Paused retinol and exfoliating skincare for 24–48 hours
    - Showered 4–5 hours before your appointment
    - Avoided moisturiser and body oils after your shower
    - Avoided washing your hair on the day
    - Removed deodorant, perfume and body spray
    - Arrived makeup-free
    - Completed manicure/pedicure and facials beforehand
    - Ensured any cosmetic tattoos are fully healed
    - Prepared loose, dark clothing for after your appointment

Book Your Spray Tan in Perth
Ready for your next glow? Ravello Tans provides professional spray tanning in Perth, helping you achieve an even, natural-looking tan for everyday confidence, holidays, events, weddings and special occasions.`;

const AFTERCARE_TEXT = `You've had your spray tan — now it's time to let it develop. Following the correct spray tan aftercare is essential for achieving an even, long-lasting colour. What you do during the first 24 hours can make a big difference to how your tan develops, how long it lasts and how evenly it fades.

Your First Shower After a Spray Tan
Your spray tan artist will advise you when to have your first shower based on the solution used. When it's time to rinse:
    - Use lukewarm water
    - Rinse for approximately 30 seconds
    - Use only your hands
    - Do not use soap, body wash, scrubs or exfoliating products
    - Pat your skin dry with a towel
    - Do not moisturise immediately after your first rinse

Don't panic if you look pale afterwards — that's just the cosmetic bronzer washing away. Your actual tan continues developing for 16–24 hours.

What to Avoid During the First 16–24 Hours
    - Unnecessary water exposure
    - Swimming, baths, spas, saunas
    - Sweating / intense exercise
    - Skin-to-skin contact
    - Tight clothing

Your Second Shower: 24 Hours After Your Tan
You can return to your normal shower routine and begin using tan-safe body wash and moisturiser. Apply moisturiser to slightly damp skin for the best absorption.

When Should You Use a Tan Extender?
Wait until day three, then apply every second day rather than daily.

Exercise, Swimming and Saunas After Your Spray Tan
Avoid these for the first 16–24 hours. Once you resume, moisturise afterwards — chlorine, salt water, sweat and heat can all fade your tan more quickly.

Moisturise and Stay Hydrated
Hydration is key to a long-lasting spray tan. With proper aftercare, your tan can last up to around 10 days.

Remember: Your Spray Tan Does Not Contain SPF
Always apply a broad-spectrum sunscreen when you're exposed to the sun.

How to Make Your Spray Tan Last Longer
Avoid long hot showers, hot baths, spas, harsh soaps, scrubs and picking at your skin. Focus on gentle cleansing and regular moisturising instead.

Spray Tan Aftercare Checklist
    - Follow your recommended first rinse time
    - Rinse with lukewarm water, hands only
    - Pat skin dry, don't moisturise immediately after
    - Avoid swimming, exercise, spas and saunas for 16–24 hours
    - Begin tan-safe body wash/moisturiser after ~24 hours
    - Moisturise regularly and drink plenty of water
    - Start a tan extender from day three if using one
    - Wear sunscreen when exposed to the sun

Book Your Next Spray Tan in Perth
Looking for a spray tan in Perth? Ravello Tans offers professional spray tanning for everyday glow, holidays, events, weddings, bridal parties and special occasions.`;
