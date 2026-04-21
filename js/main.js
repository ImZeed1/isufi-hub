// ============================================
// TOAST NOTIFICATION SYSTEM (global, safe)
// ============================================
window.Toast = {
  container: null,

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    try { this.init(); } catch(e) { return; }

    var icons = {
      success: 'check-circle',
      error: 'alert-circle',
      info: 'info',
      warning: 'alert-triangle'
    };

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML =
      '<i data-lucide="' + (icons[type] || 'info') + '" class="toast-icon"></i>' +
      '<span>' + message + '</span>' +
      '<button class="toast-close" onclick="this.parentElement.remove()">' +
      '<i data-lucide="x" style="width:16px;height:16px;"></i></button>';

    this.container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        toast.classList.add('show');
      });
    });

    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { if (toast.parentElement) toast.remove(); }, 400);
    }, duration);
  },

  success: function(msg, dur) { this.show(msg, 'success', dur); },
  error: function(msg, dur) { this.show(msg, 'error', dur); },
  info: function(msg, dur) { this.show(msg, 'info', dur); },
  warning: function(msg, dur) { this.show(msg, 'warning', dur); }
};

// ============================================
// MAIN INIT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  // 1. Navbar Scroll Effect
  var navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // 2. Mobile Menu Toggle
  var mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  var mobileNavOverlay = document.querySelector('.mobile-nav-overlay');

  if (mobileMenuBtn && mobileNavOverlay) {
    mobileMenuBtn.addEventListener('click', function() {
      var isOpen = mobileNavOverlay.classList.toggle('open');
      mobileMenuBtn.innerHTML = '<i data-lucide="' + (isOpen ? 'x' : 'menu') + '"></i>';
      document.body.style.overflow = isOpen ? 'hidden' : '';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    mobileNavOverlay.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        mobileNavOverlay.classList.remove('open');
        mobileMenuBtn.innerHTML = '<i data-lucide="menu"></i>';
        document.body.style.overflow = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
      });
    });
  }

  // 4. Intersection Observer for Fade-Up Animations
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { root: null, rootMargin: '0px 0px -40px 0px', threshold: 0.1 });

  document.querySelectorAll('.fade-up').forEach(function(el) {
    observer.observe(el);
  });

  // 5. Accordion Logic
  var accordions = document.querySelectorAll('.accordion');
  accordions.forEach(function(acc) {
    var header = acc.querySelector('.accordion-header');
    var content = acc.querySelector('.accordion-content');
    if (header && content) {
      header.addEventListener('click', function() {
        var isOpen = acc.classList.contains('open');
        accordions.forEach(function(otherAcc) {
          if (otherAcc !== acc) {
            otherAcc.classList.remove('open');
            otherAcc.querySelector('.accordion-content').style.maxHeight = null;
          }
        });
        if (isOpen) {
          acc.classList.remove('open');
          content.style.maxHeight = null;
        } else {
          acc.classList.add('open');
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    }
  });

  // 6. Animated Counters
  var counterElements = document.querySelectorAll('[data-count]');
  if (counterElements.length > 0) {
    var counterObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counterElements.forEach(function(el) { counterObserver.observe(el); });
  }

  // 5. PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }, function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
});

function animateCounter(el) {
  var target = parseInt(el.getAttribute('data-count'));
  var duration = 1500;
  var start = performance.now();

  function update(now) {
    var elapsed = now - start;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(target * eased);
    el.textContent = current.toLocaleString('it-IT');
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}
