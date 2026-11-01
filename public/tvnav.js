// Навигация стрелками с пульта ТВ (D-pad): переводит фокус на ближайший элемент в направлении нажатия.
(function () {
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  document.addEventListener('keydown', (e) => {
    const d = dirs[e.key];
    const cur = document.activeElement;
    if (!d || (cur && cur.tagName === 'INPUT' && d[0] !== 0)) return;
    const items = [...document.querySelectorAll('button, input, a[href], video')].filter((el) => el.offsetParent);
    if (!cur || cur === document.body) { items[0]?.focus(); return e.preventDefault(); }
    const c = cur.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const along = dx * d[0] + dy * d[1];
      if (along <= 0) continue;
      const across = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
      const score = along + across * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); e.preventDefault(); }
  });
})();
