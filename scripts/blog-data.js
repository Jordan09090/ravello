// Shared helpers for reading blog posts from Firebase — used by blog.html
// (the listing page) and post.html (a single post).
import { db } from "./firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Calls back with every post as an array (newest first) any time the data changes.
export function watchAllPosts(callback) {
  onValue(ref(db, "blogs"), snapshot => {
    const val = snapshot.val() || {};
    const posts = Object.keys(val).map(id => ({ id, ...val[id] }));
    posts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(posts);
  });
}

export function watchPost(id, callback) {
  onValue(ref(db, `blogs/${id}`), snapshot => callback(snapshot.exists() ? { id, ...snapshot.val() } : null));
}

// Turns **bold** and [link text](url) into real <strong>/<a> tags, and any
// run of lines starting with "- " into a real bulleted list — while leaving
// every other character (spacing, tabs, blank lines) exactly as typed.
// Shared by post.html (the live site) and admin.js (the editor preview),
// so both always render content identically.
function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function renderInline(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  while (i < lines.length) {
    if (/^-\s+/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s+/, ""));
        i++;
      }
      html += "<ul>" + items.map(item => `<li>${inlineFormat(item)}</li>`).join("") + "</ul>";
    } else {
      html += inlineFormat(lines[i]);
      i++;
      if (i < lines.length && !/^-\s+/.test(lines[i])) html += "<br>";
    }
  }
  return html;
}
