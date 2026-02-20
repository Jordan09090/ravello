const nav = document.querySelector('.nav');
const toggle = document.querySelector('.nav__toggle');
const navLinks = document.querySelector('.nav__links');
const links = document.querySelectorAll('.nav__links a');
const observedSections = document.querySelectorAll('[data-nav-theme]');
const featureImg = document.querySelector('.feature__media img');

const applyNavTheme = (theme = 'light') => {
  if (!nav) return;
  nav.classList.toggle('nav--on-dark', theme === 'dark');
  nav.classList.toggle('nav--on-light', theme !== 'dark');
};

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('is-open');
  });
}

const setActiveLink = id => {
  links.forEach(link => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
  });
};

links.forEach(link => {
  link.addEventListener('click', event => {
    const targetId = link.getAttribute('href');
    const section = document.querySelector(targetId);
    if (section) {
      event.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navLinks.classList.remove('is-open');
    }
  });
});

if (nav && observedSections.length) {
  const navLine = () => (nav.getBoundingClientRect().height || 80) + 10;

  const updateNavTheme = () => {
    const checkLine = navLine();
    let activeId = '';
    let theme = 'light';

    observedSections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const isInView = rect.top <= checkLine && rect.bottom >= checkLine;
      if (isInView) {
        theme = section.dataset.navTheme || 'light';
        activeId = section.id || '';
      }
    });

    applyNavTheme(theme);
    if (activeId) setActiveLink(activeId);
  };

  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateNavTheme();
      ticking = false;
    });
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  updateNavTheme();
}

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

const footerYear = document.querySelector('[data-year]');
if (footerYear) footerYear.textContent = new Date().getFullYear();
