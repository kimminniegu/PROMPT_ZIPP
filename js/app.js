(function () {
  'use strict';

  const TASKS = [
    { id: 'write',   name: '글쓰기',        desc: '메일, 제안서, 자소서, 발표 자료 쓸 때', tone: 'basics',
      featured: ['p076', 'p068', 'p072'], subs: ['메일·메시지', '제안서·자소서', '발표·개요', '말투·표현'] },
    { id: 'analyze', name: '분석·결정',     desc: '비교하고 판단하거나 계획을 세울 때',         tone: 'patterns',
      featured: ['p025', 'p031', 'p096'], subs: ['비교·추천', '계획·일정', '전략·협상', '여러 관점', '깊이 판단'] },
    { id: 'verify',  name: '답 검증',       desc: 'AI 답을 믿어도 될지 확인할 때',             tone: 'advanced',
      featured: ['p056', 'p059', 'p065'], subs: ['사실 확인', '스스로 고치기', '단계별 검증'] },
    { id: 'skill',   name: '프롬프트 실력',  desc: '질문과 프롬프트를 더 잘 쓰고 싶을 때',       tone: 'basics',
      featured: ['p116', 'p011', 'p050'], subs: ['기본·예시', '역할·듣는 사람', '마크다운·강조', '질문 잘하기', '단축어·상황 고정', '프롬프트 만들기'] },
    { id: 'play',    name: '게임·롤플레이', desc: '놀면서 연습하고 싶을 때',                   tone: 'advanced',
      featured: ['p040', 'p042', 'p094'], subs: [] },
    { id: 'code',    name: '코딩',          desc: '웹페이지나 앱을 만들 때',                  tone: 'patterns',
      featured: ['p005', 'p019', 'p038'], subs: ['작은 앱 만들기', '게임 만들기 과정', '퀴즈 앱 만들기 과정', '기획·요청 잘하기', '고치기·점검'] }
  ];
  const taskOf = (id) => TASKS.find((t) => t.id === id);

  // 메뉴 순서대로 보여 준다 (같은 메뉴 안에서는 원래 순서 유지)
  const taskOrder = (p) => TASKS.findIndex((t) => t.id === p.task);
  const DATA = (window.PROMPTS || []).slice().sort((a, b) => taskOrder(a) - taskOrder(b));

  const state = { task: null, sub: null, q: '' };
  let searchTimer;

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
  // 사용법에 함께 붙여넣으라고 적힌 카드만 묶어서 복사한다. 나머지 단계는 하나씩 입력해야 한다.
  const copiesTogether = (p) => p.parts.some((x) => /한 번에 복사|함께 붙여넣기/.test(x.where));

  /* ── 큰 분류 버튼 ── */
  function buildTaskNav() {
    const button = (name, task) => {
      const b = el('button', 'task-btn', name);
      b.type = 'button';
      b.dataset.task = task || '';
      b.addEventListener('click', () => pick(task));
      return b;
    };
    $('#taskNav').replaceChildren(
      button('한눈에 보기', null),
      ...TASKS.map((t) => button(t.name, t.id))
    );
  }

  function syncTaskNav() {
    document.querySelectorAll('.task-btn').forEach((b) => {
      if (b.dataset.task === (state.task || '')) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  const scrollBehavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  function pick(task) {
    state.task = task;
    state.sub = null;
    if (!task) {
      clearTimeout(searchTimer);
      state.q = '';
      $('#q').value = '';
    }
    render();
    if (!task) {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      return;
    }
    // 목록 시작이 이미 화면에 잘 보이면 화면을 움직이지 않는다
    const top = $('#library').getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.6) {
      $('#library').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  }

  function pickSub(sub) {
    state.sub = sub;
    render();
    if ($('#library').getBoundingClientRect().top < 0) {
      $('#library').scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }
  }

  /* ── 필터링 ── */
  function matches(p) {
    if (state.task && p.task !== state.task) return false;
    if (state.q) {
      // 검색할 때는 세부 탭과 상관없이 고른 메뉴 전체에서 찾는다
      const hay = (p.title + ' ' + p.chapter + ' ' + p.parts.map((x) => x.label + ' ' + x.body).join(' ')).toLowerCase();
      return state.q.split(/\s+/).every((w) => hay.includes(w));
    }
    return !state.sub || p.sub === state.sub;
  }

  function render() {
    const box = $('#cardList');
    const t = taskOf(state.task);
    const isHome = !t && !state.q;

    // 첫 화면에서는 버튼 이름과 겹치므로 제목을 화면에서만 숨긴다 (화면 낭독기는 읽음)
    $('#listHead').classList.toggle('sr-only', isHome);

    if (isHome) {
      box.className = 'home';
      box.replaceChildren(...TASKS.map(homeSection));
      $('#empty').hidden = true;
      $('#resultCount').textContent = '';
      $('#filterName').textContent = '한눈에 보기';
    } else {
      const list = DATA.filter(matches);
      box.className = 'card-list';
      box.replaceChildren(...list.map((p) => cardEl(p)));
      $('#empty').hidden = list.length > 0;
      $('#resultCount').textContent = list.length + '개';
      $('#filterName').textContent = t ? t.name : '검색 결과';
    }

    renderTabs();
    syncTaskNav();
  }

  /* ── 세부 탭: 한 번에 하나만 고르며, 카드가 있는 분류만 있으므로 0개가 나오지 않는다 ── */
  function renderTabs() {
    const wrap = $('#subTabs');
    const t = taskOf(state.task);
    wrap.hidden = !t || !t.subs.length || !!state.q;
    if (wrap.hidden) return;

    // 같은 메뉴 안에서는 버튼을 다시 만들지 않아 키보드 위치가 유지된다
    if (wrap.dataset.task !== t.id) {
      wrap.dataset.task = t.id;
      const cards = DATA.filter((p) => p.task === t.id);
      const tab = (name, sub, n) => {
        const b = el('button', 'sub-tab', name);
        b.type = 'button';
        b.dataset.sub = sub || '';
        b.appendChild(el('span', null, String(n)));
        b.addEventListener('click', () => pickSub(sub));
        return b;
      };
      wrap.replaceChildren(
        tab('전체', null, cards.length),
        ...t.subs.map((s) => tab(s, s, cards.filter((p) => p.sub === s).length))
      );
    }
    wrap.querySelectorAll('.sub-tab').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.sub === (state.sub || '')));
    });
  }

  /* ── 첫 화면: 할 일별 대표 카드 3개 ── */
  function homeSection(t) {
    const sec = el('section', 'home-sec');
    const head = el('div', 'home-head');
    const text = el('div');
    text.append(el('h3', 'home-name', t.name), el('p', 'home-desc', t.desc));

    const more = el('button', 'btn btn-ghost', DATA.filter((p) => p.task === t.id).length + '개 모두 보기');
    more.type = 'button';
    more.insertAdjacentHTML('beforeend', ICON.chev);
    more.addEventListener('click', () => {
      pick(t.id);
      $('#libTitle').focus({ preventScroll: true });
    });
    head.append(text, more);

    const grid = el('div', 'home-grid');
    grid.append(...t.featured.map((id) => cardEl(DATA.find((p) => p.id === id), true)));
    sec.append(head, grid);
    return sec;
  }

  function cardEl(p, compact) {
    const c = el('article', compact ? 'card compact' : 'card');
    c.dataset.g = taskOf(p.task).tone;
    c.tabIndex = 0;
    c.setAttribute('aria-label', p.title + ' 자세히 보기');

    const left = el('div', 'card-left');
    left.appendChild(el(compact ? 'h4' : 'h3', 'card-title', p.title));

    // 미리보기는 참고용 단계보다 실제로 쓰는 프롬프트를 먼저 보여 준다
    const main = p.parts.find((x) => !x.where.startsWith('참고용')) || p.parts[0];
    const right = el('div', 'card-right');
    right.appendChild(el('p', 'card-preview', main.body));

    const actions = el('div', 'card-actions');
    const canCopy = p.parts.length === 1 || copiesTogether(p);
    if (canCopy) {
      const copy = el('button', 'btn btn-primary');
      copy.type = 'button';
      copy.innerHTML = ICON.copy + (p.parts.length > 1 ? '전체 복사' : '복사');
      copy.addEventListener('click', (e) => { e.stopPropagation(); copyText(fullText(p), copy); });
      actions.appendChild(copy);
    }
    const more = el('button', canCopy ? 'btn btn-ghost' : 'btn btn-primary', canCopy ? '자세히 보기' : '단계별로 복사하기');
    more.type = 'button';
    more.insertAdjacentHTML('beforeend', ICON.chev);
    more.addEventListener('click', (e) => { e.stopPropagation(); openDetail(p); });
    actions.appendChild(more);
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
    if (p.parts.length > 1 && copiesTogether(p)) {
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
    buildTaskNav();

    $('#q').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); render(); }, 120);
    });
    $('#q').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#library').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#dClose').addEventListener('click', closeDetail);
    $('#detail').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDetail(); });

    render();
  }

  init();
})();
