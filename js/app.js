(function () {
  'use strict';

  const DATA = window.PROMPTS || [];

  const GROUPS = [
    { id: 'basics',   en: 'basics',   ko: '기본기',          desc: '유형, 예시, 페르소나, 마크다운, 말투처럼 매일 쓰는 기본' },
    { id: 'patterns', en: 'patterns', ko: '패턴 · 프레임워크', desc: '게임, 질문 개선, 팩트 체크, 리플렉션과 CO-STAR 같은 틀' },
    { id: 'advanced', en: 'advanced', ko: '고급 기술',        desc: '다중 관점, 심사숙고(CoT), 프롬프트를 만드는 프롬프트(APE)' }
  ];

  const state = { group: null, chapter: null, tags: new Set(), q: '' };

  const $ = (s, el = document) => el.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const ICON = {
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>'
  };

  /* ── 복사 ── */
  function copyText(text, btn) {
    const ok = () => {
      toast('복사했어요. AI 채팅창에 붙여넣으세요');
      if (btn) {
        const old = btn.innerHTML;
        btn.classList.add('done');
        btn.innerHTML = ICON.check + '복사됨';
        setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = old; }, 1400);
      }
    };
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', '');
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('복사가 안 됐어요. 직접 드래그해서 복사해 주세요'); }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else fallback();
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  const fullText = (p) => p.parts.map((x) => x.body).join('\n\n');

  /* ── 그룹 카드 ── */
  function renderGroups() {
    const wrap = $('#groupList');
    GROUPS.forEach((g) => {
      const items = DATA.filter((p) => p.group === g.id);
      const chapters = [];
      items.forEach((p) => {
        const c = chapters.find((x) => x.name === p.chapter);
        c ? c.n++ : chapters.push({ name: p.chapter, n: 1 });
      });

      const card = el('article', 'group');
      card.dataset.g = g.id;

      const left = el('div');
      left.appendChild(el('p', 'group-en', g.en));
      const ko = el('button', 'group-ko');
      ko.type = 'button';
      ko.innerHTML = '';
      ko.append(g.ko + ' ' + items.length + '개');
      ko.insertAdjacentHTML('beforeend', ICON.chev);
      ko.addEventListener('click', () => setFilter({ group: g.id, chapter: null }));
      left.appendChild(ko);
      left.appendChild(el('p', 'group-desc', g.desc));

      const pills = el('div', 'pills');
      chapters.forEach((c) => {
        const b = el('button', 'pill');
        b.type = 'button';
        b.dataset.chapter = c.name;
        b.setAttribute('aria-pressed', 'false');
        b.appendChild(el('span', null, c.name));
        b.appendChild(el('span', 'n', String(c.n)));
        b.insertAdjacentHTML('beforeend', ICON.chev);
        b.addEventListener('click', () => {
          const same = state.chapter === c.name;
          setFilter(same ? { group: null, chapter: null } : { group: g.id, chapter: c.name });
        });
        pills.appendChild(b);
      });

      card.append(left, pills);
      wrap.appendChild(card);
    });
  }

  function setFilter(f) {
    state.group = f.group;
    state.chapter = f.chapter;
    render();
    $('#library').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  /* ── 필터링 ── */
  function matches(p) {
    if (state.group && p.group !== state.group) return false;
    if (state.chapter && p.chapter !== state.chapter) return false;
    for (const t of state.tags) {
      if (t === 'Gemini' || t === 'Claude') { if (!p.tools.includes(t)) return false; }
      else if (!p.tags.includes(t)) return false;
    }
    if (state.q) {
      const hay = (p.title + ' ' + p.chapter + ' ' + p.parts.map((x) => x.label + ' ' + x.body).join(' ')).toLowerCase();
      return state.q.split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  }

  function render() {
    const list = DATA.filter(matches);
    const box = $('#cardList');
    box.replaceChildren(...list.map(cardEl));
    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = list.length + '개';

    const g = GROUPS.find((x) => x.id === state.group);
    $('#filterName').textContent = state.chapter || (g ? g.ko : '전체 프롬프트');
    $('#resetBtn').hidden = !state.group && !state.chapter;

    document.querySelectorAll('.pill').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chapter === state.chapter)));
  }

  function cardEl(p) {
    const c = el('article', 'card');
    c.dataset.g = p.group;
    c.tabIndex = 0;
    c.setAttribute('aria-label', p.title + ' 자세히 보기');

    const left = el('div', 'card-left');
    left.appendChild(el('h3', 'card-title', p.title));
    const tags = el('div', 'tags');
    if (p.tags.includes('ref')) tags.appendChild(el('span', 'tag ref', '참고용 틀'));
    if (p.tags.includes('trade')) tags.appendChild(el('span', 'tag', '무역'));
    if (p.tags.includes('vibe')) tags.appendChild(el('span', 'tag', '바이브 코딩'));
    p.tools.forEach((t) => tags.appendChild(el('span', 'tag', t)));
    if (tags.children.length) left.appendChild(tags);
    left.appendChild(el('p', 'card-chapter', p.chapter));

    const right = el('div', 'card-right');
    right.appendChild(el('p', 'card-label', p.parts[0].label));
    right.appendChild(el('p', 'card-preview', p.parts[0].body));

    const actions = el('div', 'card-actions');
    const copy = el('button', 'btn btn-primary');
    copy.type = 'button';
    copy.innerHTML = ICON.copy + (p.parts.length > 1 ? '전체 복사' : '복사');
    copy.addEventListener('click', (e) => { e.stopPropagation(); copyText(fullText(p), copy); });
    const more = el('button', 'btn btn-ghost', '자세히 보기');
    more.type = 'button';
    more.addEventListener('click', (e) => { e.stopPropagation(); openDetail(p); });
    actions.append(copy, more);
    if (p.parts.length > 1) actions.appendChild(el('span', 'parts-note', p.parts.length + '단계 프롬프트'));
    right.appendChild(actions);

    c.append(left, right);
    c.addEventListener('click', () => openDetail(p));
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === c) openDetail(p); });
    return c;
  }

  /* ── 상세 보기 ── */
  function openDetail(p) {
    const d = $('#detail');
    $('#dChapter').textContent = p.chapter;
    $('#dTitle').textContent = p.title;
    const parts = $('#dParts');
    parts.replaceChildren(...p.parts.map((x) => {
      const w = el('section', 'part');
      const head = el('div', 'part-head');
      head.appendChild(el('span', 'part-label', x.label || '프롬프트'));
      const b = el('button', 'btn btn-primary');
      b.type = 'button';
      b.innerHTML = ICON.copy + '복사';
      b.addEventListener('click', () => copyText(x.body, b));
      head.appendChild(b);
      w.appendChild(head);
      if (x.where) w.appendChild(el('p', 'part-where', '사용법: ' + x.where));
      w.appendChild(el('pre', 'part-body', x.body));
      return w;
    }));
    const foot = $('#dFoot');
    foot.replaceChildren();
    if (p.parts.length > 1) {
      const all = el('button', 'btn btn-ghost');
      all.type = 'button';
      all.innerHTML = ICON.copy + p.parts.length + '개 한 번에 복사';
      all.addEventListener('click', () => copyText(fullText(p), all));
      foot.appendChild(all);
    }
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    parts.scrollTop = 0;
  }

  function closeDetail() {
    const d = $('#detail');
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }

  /* ── 시작 ── */
  function init() {
    $('#totalCount').textContent = DATA.length;
    renderGroups();

    let t;
    $('#q').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); render(); }, 120);
    });
    $('#q').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#library').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      const tag = b.dataset.tag;
      state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag);
      b.setAttribute('aria-pressed', String(state.tags.has(tag)));
      render();
    }));

    $('#resetBtn').addEventListener('click', () => { state.group = null; state.chapter = null; render(); });
    $('#dClose').addEventListener('click', closeDetail);
    $('#detail').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDetail(); });

    render();
  }

  init();
})();
