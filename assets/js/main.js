(() => {
  'use strict';

  /* YEAR + CLOCK */
  document.getElementById('year').textContent = new Date().getFullYear();
  const clockEl = document.getElementById('clock');
  const tick = () => {
    clockEl.textContent = new Date().toLocaleTimeString('en-GB', {
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  };
  tick(); setInterval(tick, 1000);

  /* REVEAL */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold:.12, rootMargin:'0px 0px -6% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

  /* LAB EXPAND */
  document.querySelectorAll('[data-lab]').forEach(lab => {
    const head = lab.querySelector('[data-toggle]');
    head.addEventListener('click', () => lab.classList.toggle('open'));
  });

  /* CURSOR GLOW (desktop only) */
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.glass, .cap-card, .repo').forEach(el => {
      el.classList.add('glow');
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* ============================================================
     INFINITE CAROUSEL — Pointer Events
     ============================================================ */
  function initCarousel({ viewportId, trackId, hintId, isProvider, dragThreshold = 10 }) {
    const viewport = document.getElementById(viewportId);
    const track = document.getElementById(trackId);
    const hint = document.getElementById(hintId);
    if (!viewport || !track) return null;

    const originals = Array.from(track.children);
    const N = originals.length;
    if (!N) return null;

    /* clone for seamless loop */
    originals.forEach(item => {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('tabindex', '-1');
      c.classList.add('clone');
      track.appendChild(c);
    });
    originals.slice().reverse().forEach(item => {
      const c = item.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('tabindex', '-1');
      c.classList.add('clone');
      track.insertBefore(c, track.firstChild);
    });

    let setWidth = 0, target = 0, current = 0, velocity = 0;
    let ready = false, hintFaded = false;

    const measure = () => {
      const first = track.children[0];
      if (!first) return;
      const cs = getComputedStyle(track);
      const gap = parseFloat(cs.columnGap || cs.gap) || 16;
      const itemWidth = first.getBoundingClientRect().width;
      setWidth = (itemWidth + gap) * N;
      track.style.transform = `translate3d(${-setWidth}px, 0, 0)`;
      target = 0; current = 0; ready = true;
    };

    requestAnimationFrame(() => requestAnimationFrame(measure));
    window.addEventListener('resize', measure);

    /* WHEEL */
    viewport.addEventListener('wheel', (e) => {
      if (!ready) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      velocity += delta * 0.5;
      if (!hintFaded && Math.abs(delta) > 2) {
        hintFaded = true;
        hint && hint.classList.add('fade');
      }
    }, { passive: false });

    /* ANIMATE */
    const animate = () => {
      if (ready) {
        target += velocity;
        velocity *= 0.85;
        if (Math.abs(velocity) < 0.05) velocity = 0;
        if (target > setWidth) { target -= setWidth; current -= setWidth; }
        else if (target < 0)  { target += setWidth; current += setWidth; }
        current += (target - current) * 0.14;
        track.style.transform = `translate3d(${-(setWidth + current)}px, 0, 0)`;
      }
      requestAnimationFrame(animate);
    };
    animate();

    /* POINTER EVENTS */
    let pointerDown = false;
    let dragStarted = false;
    let startX = 0;
    let startY = 0;
    let startTarget = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocityTracker = [];
    let pointerId = null;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!ready) return;

      pointerDown = true;
      dragStarted = false;
      startX = e.clientX;
      startY = e.clientY;
      startTarget = target;
      lastX = e.clientX;
      lastTime = Date.now();
      velocityTracker = [];
      pointerId = e.pointerId;
    });

    viewport.addEventListener('pointermove', (e) => {
      if (!pointerDown || !ready) return;
      if (e.pointerId !== pointerId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragStarted) {
        if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
          pointerDown = false;
          pointerId = null;
          return;
        }
        if (Math.abs(dx) > dragThreshold) {
          dragStarted = true;
          try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
        } else {
          return;
        }
      }

      target = startTarget - dx * 1.2;

      const now = Date.now();
      const dt = now - lastTime;
      if (dt > 0) {
        velocityTracker.push((e.clientX - lastX) / dt);
        if (velocityTracker.length > 5) velocityTracker.shift();
      }
      lastTime = now;
      lastX = e.clientX;
    });

    const endPointer = (e) => {
      if (!pointerDown) return;
      if (pointerId !== null && e.pointerId !== pointerId) return;

      pointerDown = false;

      if (dragStarted && velocityTracker.length) {
        const avgV = velocityTracker.reduce((s, v) => s + v, 0) / velocityTracker.length;
        velocity += -avgV * 8;
      }

      pointerId = null;
    };

    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);

    /* Block click only when a real drag happened */
    viewport.addEventListener('click', (e) => {
      if (dragStarted) {
        e.preventDefault();
        e.stopPropagation();
        dragStarted = false;
      }
    }, true);

    return {
      isProvider,
      viewport,
      track,
      shouldBlockClick: () => dragStarted
    };
  }

  /* Designs carousel */
  const designsCarousel = initCarousel({
    viewportId: 'carousel-viewport',
    trackId: 'carousel',
    hintId: 'carousel-hint',
    isProvider: false
  });

  /* Providers carousel */
  const provCarousel = initCarousel({
    viewportId: 'providers-viewport',
    trackId: 'providers-track',
    hintId: 'providers-hint',
    isProvider: true
  });

  /* ============================================================
     PROVIDER DETAIL TOGGLE — event delegation (works for clones)
     ============================================================ */
  if (provCarousel) {
    const track = provCarousel.track;
    const panels = document.querySelectorAll('.detail-panel');

    const closeAll = () => {
      track.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
      panels.forEach(p => p.classList.remove('open'));
    };

    const openProvider = (id) => {
      /* active state applied to ALL cards (originals + clones) with same provider */
      track.querySelectorAll('.provider-card').forEach(c => {
        c.classList.toggle('active', c.dataset.provider === id);
      });
      panels.forEach(p => p.classList.toggle('open', p.dataset.detail === id));
      const targetPanel = document.querySelector(`.detail-panel[data-detail="${id}"]`);
      if (targetPanel) {
        setTimeout(() => {
          targetPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 250);
      }
    };

    /* single delegated listener on the track */
    track.addEventListener('click', (e) => {
      if (provCarousel.shouldBlockClick()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const card = e.target.closest('.provider-card');
      if (!card) return;
      const id = card.dataset.provider;
      const isOpen = card.classList.contains('active');
      if (isOpen) closeAll();
      else openProvider(id);
    });

    document.querySelectorAll('.detail-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAll();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  }

  /* ============================================================
     GITHUB REPOS
     ============================================================ */
  const GH_USER = 'R4B1DS';
  const MAX_REPOS = 6;
  const EXCLUDE = ['R4B1DS'];
  const reposEl = document.getElementById('repos-list');

  if (reposEl) {
    const relTime = (iso) => {
      const d = new Date(iso);
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${m[d.getMonth()]} ${d.getFullYear()}`;
    };
    const pretty = (n) => n.replace(/[-_]/g,' ').replace(/\b\w/g, c => c.toUpperCase());
    const tagFor = (r) => {
      if (/soc|siem|splunk|incident|forensic|threat|malware/i.test(r.name)) return 'Security';
      if (/lab|bootcamp|study/i.test(r.name)) return 'Lab';
      if (r.language) return r.language;
      return 'Repo';
    };

    fetch(`https://api.github.com/users/${GH_USER}/repos?sort=updated&per_page=100`)
      .then(r => {
        if (!r.ok) throw new Error('GitHub API ' + r.status);
        return r.json();
      })
      .then(repos => {
        const list = repos
          .filter(r => !r.fork && !EXCLUDE.includes(r.name))
          .sort((a,b) => {
            const aS = /soc|siem|splunk|incident|forensic|threat|lab/i.test(a.name) ? 1 : 0;
            const bS = /soc|siem|splunk|incident|forensic|threat|lab/i.test(b.name) ? 1 : 0;
            if (aS !== bS) return bS - aS;
            return new Date(b.updated_at) - new Date(a.updated_at);
          })
          .slice(0, MAX_REPOS);

        if (!list.length) {
          reposEl.innerHTML = `<div class="repo"><span class="repo-tag">—</span><div><span class="repo-name">No public repositories found</span></div><span class="repo-meta">—</span></div>`;
          return;
        }

        reposEl.innerHTML = list.map(r => `
          <a class="repo" href="${r.html_url}" target="_blank" rel="noopener">
            <span class="repo-tag">${tagFor(r)}</span>
            <div>
              <div class="repo-name">${pretty(r.name)}</div>
              <div class="repo-desc">${r.description || 'No description provided.'}</div>
            </div>
            <span class="repo-meta">${r.language || '—'} · ${relTime(r.updated_at)}</span>
          </a>
        `).join('');

        if (window.matchMedia('(hover: hover)').matches) {
          reposEl.querySelectorAll('.repo').forEach(el => {
            el.classList.add('glow');
            el.addEventListener('mousemove', e => {
              const r = el.getBoundingClientRect();
              el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
              el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
            });
          });
        }
      })
      .catch(err => {
        console.error(err);
        reposEl.innerHTML = `
          <div class="repo">
            <span class="repo-tag">!</span>
            <div><div class="repo-name">Unable to load repositories</div><div class="repo-desc">View directly on GitHub.</div></div>
            <a class="repo-meta" href="https://github.com/${GH_USER}" target="_blank" rel="noopener" style="color:var(--cyan)">→ GitHub</a>
          </div>`;
      });
  }

})();