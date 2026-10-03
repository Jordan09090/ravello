/*
 * Blog engine: a tiny image carousel + a forgiving text-to-HTML renderer.
 *
 * Content is pasted as plain text into a <script type="text/plain" class="blog-source">
 * tag (see blog/post-template.html). This file turns that text into headings,
 * bullet/numbered lists, bold text and buttons automatically, so posts can be
 * written and edited without touching any HTML.
 *
 * Formatting cheatsheet (used inside the pasted text):
 *   ## Heading            -> section heading
 *   - list item           -> bullet list (put "- " in front of each line)
 *   1. list item           -> numbered list (only when 2+ lines in a row are numbered)
 *   A lone "1. Some short line" on its own -> treated as a sub-heading
 *   **bold text**          -> bold
 *   [Button text](url.html) on its own line -> becomes a rounded button
 *   Blank line             -> starts a new paragraph
 */
(function () {
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inline(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    return out;
  }

  function renderMarkdownLite(source) {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let current = [];

    const flush = () => {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
    };

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (line === '') {
        flush();
      } else {
        current.push(line);
      }
    });
    flush();

    let html = '';

    blocks.forEach(block => {
      const linkOnly = block.length === 1 && block[0].match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const isBulletList = block.every(l => /^[-*]\s+/.test(l));
      const isNumberedList = block.length > 1 && block.every(l => /^\d+[.)]\s+/.test(l));
      const isSingleNumberedHeading = block.length === 1 && /^\d+[.)]\s+/.test(block[0]);
      const isHeading3 = block.length === 1 && /^###\s+/.test(block[0]);
      const isHeading2 = block.length === 1 && /^##\s+/.test(block[0]);
      const isHeading1 = block.length === 1 && /^#\s+/.test(block[0]);

      if (linkOnly) {
        html += `<p class="blog-cta"><a class="btn btn--primary" href="${escapeHtml(linkOnly[2])}">${inline(linkOnly[1])}</a></p>`;
      } else if (isHeading1 || isHeading2) {
        html += `<h2>${inline(block[0].replace(/^#{1,2}\s+/, ''))}</h2>`;
      } else if (isHeading3) {
        html += `<h3>${inline(block[0].replace(/^###\s+/, ''))}</h3>`;
      } else if (isSingleNumberedHeading) {
        html += `<h3>${inline(block[0].replace(/^\d+[.)]\s+/, ''))}</h3>`;
      } else if (isBulletList) {
        html += '<ul>' + block.map(l => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('') + '</ul>';
      } else if (isNumberedList) {
        html += '<ol>' + block.map(l => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('') + '</ol>';
      } else {
        html += '<p>' + block.map(inline).join('<br>') + '</p>';
      }
    });

    return html;
  }

  function renderPostContent() {
    document.querySelectorAll('script.blog-source').forEach(source => {
      const target = document.getElementById(source.dataset.target);
      if (!target) return;
      target.innerHTML = renderMarkdownLite(source.textContent);
    });
  }

  function initCarousels() {
    document.querySelectorAll('.carousel').forEach(carousel => {
      const track = carousel.querySelector('.carousel__track');
      const slides = Array.from(carousel.querySelectorAll('.carousel__slide'));
      if (!track || !slides.length) return;

      const isSingle = slides.length === 1;
      if (isSingle) carousel.classList.add('carousel--single');

      const dotsWrap = carousel.querySelector('.carousel__dots');
      let index = 0;

      const dots = isSingle ? [] : slides.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel__dot';
        dot.setAttribute('aria-label', `Go to image ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        if (dotsWrap) dotsWrap.appendChild(dot);
        return dot;
      });

      // Size the track to match the active photo's own aspect ratio (capped
      // to a sensible range), so a square photo reads as a neat box, a
      // portrait photo shows taller, and a landscape photo shows shorter —
      // instead of every photo being force-cropped into one wide shape.
      function fitHeightToSlide(slide) {
        const img = slide.querySelector('img');
        if (!img) return;
        const apply = () => {
          if (!img.naturalWidth) return;
          const ratio = img.naturalHeight / img.naturalWidth;
          const rawHeight = carousel.clientWidth * ratio;
          // Bounded mainly by viewport height (not a small fixed number) so
          // a tall portrait photo can actually end up taller than a square
          // or landscape one — only reined in once it'd be taller than the
          // screen is useful for.
          const maxHeight = Math.min(760, window.innerHeight * 0.72);
          track.style.height = Math.round(Math.min(maxHeight, Math.max(200, rawHeight))) + 'px';
        };
        if (img.complete) apply();
        else img.addEventListener('load', apply, { once: true });
      }

      function update() {
        track.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
        fitHeightToSlide(slides[index]);
      }

      function goTo(i) {
        index = (i + slides.length) % slides.length;
        update();
      }

      if (!isSingle) {
        const prevBtn = carousel.querySelector('.carousel__btn--prev');
        const nextBtn = carousel.querySelector('.carousel__btn--next');
        if (prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1));

        let startX = null;
        track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
        track.addEventListener('touchend', e => {
          if (startX === null) return;
          const diff = e.changedTouches[0].clientX - startX;
          if (Math.abs(diff) > 40) goTo(diff > 0 ? index - 1 : index + 1);
          startX = null;
        });
      }

      window.addEventListener('resize', () => fitHeightToSlide(slides[index]));

      update();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderPostContent();
    initCarousels();
  });

  // Exposed so pages that build their carousel HTML dynamically (after
  // fetching data from Firebase, e.g. post.html) can (re)initialise it
  // once the slides actually exist in the DOM.
  window.RavelloBlog = { initCarousels };
})();
