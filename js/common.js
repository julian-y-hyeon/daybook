// 모든 페이지가 같이 쓰는 것: Supabase 연결, 로그인 확인, 저장·불러오기, 위쪽 메뉴.
(() => {
  const C = window.DAYBOOK;
  const sb = window.supabase.createClient(C.url, C.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // 로그인하지 않았으면 로그인 화면으로 보낸다.
  async function requireLogin() {
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      location.replace('index.html');
      return new Promise(() => {});
    }
    document.documentElement.style.visibility = '';
    return data.session;
  }

  // docs 테이블: key 하나에 JSON 하나
  async function loadDoc(key) {
    const { data, error } = await sb.from('docs').select('data,updated_at').eq('key', key).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function saveDoc(key, value) {
    const updated_at = new Date().toISOString();
    const { error } = await sb.from('docs').upsert({ key, data: value, updated_at });
    if (error) throw error;
    return updated_at;
  }

  // 비공개 저장소 파일을 Edge Function으로 읽는다. 결과: { files: {경로: 내용}, errors: {경로: 사유} }
  async function readRepo(paths) {
    const { data, error } = await sb.functions.invoke(C.fn, { body: { paths } });
    if (error) {
      let msg = error.message || 'Edge Function 호출 실패';
      try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    return data;
  }

  async function logout() {
    await sb.auth.signOut();
    location.replace('index.html');
  }

  // 위쪽 메뉴
  const NAV_CSS = `.dbnav{position:sticky;top:0;z-index:50;display:flex;gap:4px;align-items:center;padding:8px max(4vw,16px);background:rgba(20,20,24,.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:600 14px/1 'IBM Plex Sans KR',-apple-system,system-ui,sans-serif;overflow-x:auto}
.dbnav a,.dbnav button{color:#c9c9d1;text-decoration:none;padding:0 12px;min-height:36px;display:inline-flex;align-items:center;border-radius:999px;border:0;background:none;font:inherit;cursor:pointer;white-space:nowrap}
.dbnav a.on{background:#f2f2f5;color:#16161a}
.dbnav .sp{flex:1}
.dbnav a:focus-visible,.dbnav button:focus-visible{outline:2px solid #7aa7ff;outline-offset:2px}`;
  function nav() {
    const st = document.createElement('style'); st.textContent = NAV_CSS; document.head.appendChild(st);
    const n = document.createElement('nav'); n.className = 'dbnav'; n.setAttribute('aria-label', '메뉴');
    n.innerHTML = '<a href="calendar.html" data-p="cal">캘린더</a><a href="phone.html#messages" data-p="msg">메시지</a><a href="phone.html#calls" data-p="call">최근 통화</a><a href="news.html" data-p="news">신문</a><span class="sp"></span><button type="button" id="dblogout">로그아웃</button>';
    document.body.prepend(n);
    n.querySelector('#dblogout').addEventListener('click', logout);
    const mark = () => {
      const page = location.pathname.endsWith('news.html') ? 'news' : location.pathname.endsWith('phone.html') ? (/^#(calls|rec-)/.test(location.hash) ? 'call' : 'msg') : 'cal';
      for (const a of n.querySelectorAll('a')) a.classList.toggle('on', a.dataset.p === page);
    };
    mark(); addEventListener('hashchange', mark);
  }

  window.DB = { sb, requireLogin, loadDoc, saveDoc, readRepo, logout, nav };
})();
