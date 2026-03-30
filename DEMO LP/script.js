// ===== LOADING SCREEN =====
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('is-hidden');
  }, 2200);
});

// ===== CUSTOM CURSOR =====
const cursor = document.getElementById('cursor');
let cursorX = 0, cursorY = 0;
let dotX = 0, dotY = 0;
let ringX = 0, ringY = 0;

document.addEventListener('mousemove', (e) => {
  cursorX = e.clientX;
  cursorY = e.clientY;
});

function animateCursor() {
  // Dot follows immediately
  dotX += (cursorX - dotX) * 0.35;
  dotY += (cursorY - dotY) * 0.35;

  // Ring follows with delay
  ringX += (cursorX - ringX) * 0.12;
  ringY += (cursorY - ringY) * 0.12;

  if (cursor) {
    cursor.querySelector('.cursor__dot').style.transform = `translate(${dotX}px, ${dotY}px)`;
    cursor.querySelector('.cursor__ring').style.transform = `translate(${ringX}px, ${ringY}px)`;
  }

  requestAnimationFrame(animateCursor);
}
animateCursor();

// Hover effect on interactive elements
const hoverTargets = document.querySelectorAll('a, button, .product-card, .featured__item');
hoverTargets.forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

// ===== NAV SCROLL EFFECT =====
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
  if (window.scrollY > 80) {
    nav.classList.add('nav--scrolled');
  } else {
    nav.classList.remove('nav--scrolled');
  }
});

// ===== MOBILE MENU =====
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('is-active');
    mobileMenu.classList.toggle('is-active');
    document.body.style.overflow = mobileMenu.classList.contains('is-active') ? 'hidden' : '';
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('is-active');
      mobileMenu.classList.remove('is-active');
      document.body.style.overflow = '';
    });
  });
}

// ===== SCROLL ANIMATIONS (Intersection Observer) =====
const animateElements = document.querySelectorAll('[data-animate]');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.delay || 0;
        setTimeout(() => {
          entry.target.classList.add('is-visible');
        }, parseInt(delay));
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

animateElements.forEach((el) => observer.observe(el));

// ===== PARALLAX ON HERO TITLE =====
const heroSection = document.getElementById('hero');
const parallaxWords = document.querySelectorAll('[data-parallax]');

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;
  const heroHeight = heroSection ? heroSection.offsetHeight : 0;

  if (scrollY < heroHeight) {
    parallaxWords.forEach(word => {
      const speed = parseFloat(word.dataset.parallax);
      word.style.transform = `translateY(${scrollY * speed}px)`;
    });
  }
});

// ===== HERO MOUSE PARALLAX =====
if (heroSection) {
  heroSection.addEventListener('mousemove', (e) => {
    const rect = heroSection.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    const fallback = heroSection.querySelector('.hero__fallback');
    if (fallback) {
      fallback.style.transform = `translate(${x * -15}px, ${y * -15}px) scale(1.05)`;
    }
  });
}

// ===== PRODUCT FILTER =====
const filterButtons = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card');

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;

    productCards.forEach((card, i) => {
      if (filter === 'all' || card.dataset.category === filter) {
        setTimeout(() => {
          card.classList.remove('hidden');
        }, i * 50);
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

// ===== HERO PARTICLES =====
const canvas = document.getElementById('particles');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 1.5 + 0.3;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = -Math.random() * 0.4 - 0.1;
      this.opacity = Math.random() * 0.4 + 0.1;
      this.life = Math.random() * 200 + 100;
      this.maxLife = this.life;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.life--;

      if (this.life <= 0 || this.y < -10 || this.x < -10 || this.x > canvas.width + 10) {
        this.reset();
        this.y = canvas.height + 10;
      }
    }

    draw() {
      const fadeRatio = this.life / this.maxLife;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 242, 238, ${this.opacity * fadeRatio})`;
      ctx.fill();
    }
  }

  // Create particles
  for (let i = 0; i < 40; i++) {
    particles.push(new Particle());
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animateParticles);
  }
  animateParticles();
}

// ===== COUNTER ANIMATION =====
const counters = document.querySelectorAll('[data-count]');
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        const duration = 2000;
        const start = performance.now();

        function updateCounter(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(target * eased);

          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          }
        }

        requestAnimationFrame(updateCounter);
        counterObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.5 }
);

counters.forEach(c => counterObserver.observe(c));

// ===== FEATURED DRAG SCROLL =====
const carousel = document.getElementById('featuredCarousel');
if (carousel) {
  let isDown = false;
  let startX;
  let scrollLeft;

  carousel.addEventListener('mousedown', (e) => {
    isDown = true;
    startX = e.pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
    carousel.style.cursor = 'grabbing';
  });

  carousel.addEventListener('mouseleave', () => {
    isDown = false;
    carousel.style.cursor = '';
  });

  carousel.addEventListener('mouseup', () => {
    isDown = false;
    carousel.style.cursor = '';
  });

  carousel.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    carousel.scrollLeft = scrollLeft - walk;
  });
}

// ===== VIDEO FALLBACK =====
const heroVideo = document.querySelector('.hero__video');
const heroFallback = document.querySelector('.hero__fallback');

if (heroVideo) {
  heroVideo.addEventListener('canplay', () => {
    if (heroFallback) heroFallback.style.opacity = '0';
  });
  heroVideo.addEventListener('error', () => {
    heroVideo.style.display = 'none';
  });
}

// ===== SMOOTH ANCHOR SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ===== NEWSLETTER FORM =====
const form = document.querySelector('.newsletter__form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('.newsletter__input');
    if (input.value) {
      input.value = '';
      const btn = form.querySelector('.newsletter__btn span');
      btn.textContent = 'Thank you!';
      setTimeout(() => {
        btn.textContent = 'Subscribe';
      }, 2500);
    }
  });
}
