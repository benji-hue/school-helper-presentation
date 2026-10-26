(() => {
  const stage = document.getElementById('stage');
  const scenes = [...stage.querySelectorAll('.scene')];
  const items = [...stage.querySelectorAll('.witem')];
  const hudCur = document.getElementById('hudCur');
  const hudTot = document.getElementById('hudTot');
  const hudBar = document.getElementById('hudBar');

  const STEP = 6.6;                 // угол между пунктами колеса, градусы
  const FADE = [1, .42, .24, .13];  // яркость пунктов по удалённости от активного
  let cur = -1;

  // Сцена 1920×1080 вписывается в любое окно
  function fit() {
    const gutter = innerWidth < 720 ? 32 : 0;  // на телефоне поля по 16px
    stage.style.setProperty('--scale', Math.min((innerWidth - gutter) / 1920, (innerHeight - gutter) / 1080));
  }
  addEventListener('resize', fit);
  fit();

  // Через сколько появляется текст: ждём, пока «перетекут» сквозные объекты
  function baseDelay(from, to) {
    if (from === 'intro' && to === 'title') return 1250;
    if (to === 'outline' && from === 'title') return 950;
    if (to === 'title' && from === 'outline') return 900;
    if (to === 'final' && from === 'section') return 950;
    return from ? 380 : 300;
  }

  function layoutWheel(mode, k, stagger) {
    const mid = (items.length - 1) / 2;
    items.forEach((el, i) => {
      let a, o, sc = 1;
      if (mode === 'section') {
        const d = i - k;
        a = d * STEP;
        o = FADE[Math.abs(d)] ?? .06;
        if (d === 0) sc = 1.12;
      } else if (mode === 'outline') {
        a = (i - mid) * STEP;
        o = 1;
      } else {
        a = (i - mid) * STEP + 46;  // спрятаны «под» дугой
        o = 0;
      }
      el.style.setProperty('--a', a);
      el.style.setProperty('--o', o);
      el.style.setProperty('--sc', sc);
      el.style.setProperty('--wd', stagger ? 500 + i * 70 + 'ms' : '0ms');
      el.classList.toggle('is-active', mode === 'section' && i === k);
      el.tabIndex = mode === 'outline' || mode === 'section' ? 0 : -1;
    });
  }

  function go(n, { noHash = false } = {}) {
    n = Math.max(0, Math.min(scenes.length - 1, n));
    if (n === cur) return;
    const prev = scenes[cur];
    const next = scenes[n];
    const from = prev ? prev.dataset.mode : null;
    const to = next.dataset.mode;

    if (prev) {
      prev.classList.remove('active');
      prev.classList.add('leave');
      prev.setAttribute('aria-hidden', 'true');
      clearTimeout(prev._t);
      prev._t = setTimeout(() => prev.classList.remove('leave'), 700);
    }
    clearTimeout(next._t);
    next.classList.remove('leave');
    next.style.setProperty('--base', baseDelay(from, to) + 'ms');
    void next.offsetWidth;  // зафиксировать исходное положение перед анимацией
    next.classList.add('active');
    next.removeAttribute('aria-hidden');

    stage.dataset.from = from || '';
    stage.dataset.mode = to;
    layoutWheel(to, to === 'section' ? +next.dataset.k : -1, to === 'outline' && from === 'title');

    cur = n;
    hudCur.textContent = String(n + 1).padStart(2, '0');
    hudBar.style.setProperty('--p', (n / (scenes.length - 1)).toFixed(4));
    if (!noHash) {
      try { history.replaceState(null, '', '#' + (n + 1)); } catch (e) { /* во встроенном окне адрес не меняется */ }
    }
  }

  const nextSlide = () => go(cur + 1);
  const prevSlide = () => go(cur - 1);
  const sectionSlide = k => scenes.findIndex(s => s.dataset.mode === 'section' && +s.dataset.k === k);

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } catch (e) { /* полный экран может быть недоступен */ }
  }

  // Клавиатура и пульт-кликер (он отправляет PageDown / PageUp)
  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'KeyF') return toggleFullscreen();
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
        e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
        e.preventDefault(); prevSlide(); break;
      case 'Home': go(0); break;
      case 'End': go(scenes.length - 1); break;
    }
  });

  // Клик — дальше, правый клик — назад, клик по пункту колеса — к разделу
  addEventListener('click', e => {
    const w = e.target.closest('.witem');
    if (w) return go(sectionSlide(+w.dataset.k));
    nextSlide();
  });
  addEventListener('contextmenu', e => { e.preventDefault(); prevSlide(); });

  let lastWheel = 0;
  addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) < 8 || Date.now() - lastWheel < 900) return;
    lastWheel = Date.now();
    e.deltaY > 0 ? nextSlide() : prevSlide();
  }, { passive: true });

  let touchX = null;
  addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) dx < 0 ? nextSlide() : prevSlide();
  });

  // Курсор прячется, если мышь не двигается
  let idleTimer;
  addEventListener('mousemove', () => {
    document.body.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
  });

  addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10) - 1;
    if (!Number.isNaN(n)) go(n, { noHash: true });
  });

  // Старт: без анимации сквозных объектов, если открыли сразу на середине
  hudTot.textContent = String(scenes.length).padStart(2, '0');
  scenes.forEach(s => s.setAttribute('aria-hidden', 'true'));
  stage.classList.add('no-anim');
  go((parseInt(location.hash.slice(1), 10) || 1) - 1, { noHash: true });
  requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.remove('no-anim')));
})();
