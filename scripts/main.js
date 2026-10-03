// Nav bar and footer behaviour (toggle, smooth-scroll, scroll-spy theme,
// footer year) now live in scripts/site-chrome.js, since that's also what
// injects the nav/footer markup itself — see site-chrome.html.
// This file only handles page content that isn't part of the shared chrome.

const featureImg = document.querySelector('.feature__media img');

// subtle parallax on feature image
if (featureImg && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const updateParallax = () => {
    const rect = featureImg.getBoundingClientRect();
    const viewport = window.innerHeight || 1;
    const center = rect.top + rect.height * 0.5;
    const progress = Math.max(-0.5, Math.min(1.5, center / viewport));
    const offset = (0.5 - progress) * 18; // tweak strength
    featureImg.style.setProperty('--feature-parallax', `${offset}px`);
  };

  const onScroll = () => requestAnimationFrame(updateParallax);
  updateParallax();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
