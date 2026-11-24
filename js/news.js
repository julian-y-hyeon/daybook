// 신문. 데이터는 wolfheim 저장소 studio/daybook/news.json에서 Edge Function으로 읽는다.
(async () => {
await DB.requireLogin();
DB.nav();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SRC = 'studio/daybook/news.json';
let N = { outlets: {}, feed: [], articles: {} };
try {
 const res = await DB.readRepo([SRC]);
 const tx = res.files && res.files[SRC];
 if (typeof tx !== 'string') throw new Error((res.errors && res.errors[SRC]) || '파일이 없어요');
 const o = JSON.parse(tx);
 if (!o || !Array.isArray(o.feed) || !o.articles) throw new Error('news.json 형식이 맞지 않아요');
 N = o;
} catch (e) { $('#st').textContent = '불러오지 못했어요: ' + (e.message || e); }

const out = k => N.outlets[k] || { name: k, c: '#666' };
const grad = c => `background:linear-gradient(150deg,${c} 0%,#1b1d22 115%)`;
const logo = o => `<span class="logo" style="background:${esc(o.c)}">${esc(o.name.slice(0,2))}</span>`;

function feed() {
 const cards = N.feed.map(g => {
  const o = out(g.o), ids = (g.a || []).filter(id => N.articles[id]);
  if (!ids.length) return '';
  const L = N.articles[ids[0]];
  return `<section class="card"><div class="oh">${logo(o)}<b>${esc(o.name)}</b><span class="tm">· ${esc(g.tm)}</span><span class="sub">+구독</span></div>
<a class="lead" href="#a-${esc(ids[0])}"><div class="ph" style="${grad(o.c)}"><span>${esc(L.photo || '')}</span></div><h2>${esc(L.title)}</h2></a>
${ids.slice(1).map(id => `<a class="row" href="#a-${esc(id)}">${esc(N.articles[id].title)}</a>`).join('')}</section>`;
 }).join('');
 $('#feed').innerHTML = `<div class="sec"><h1>언론사별 소식</h1><small>${esc(N.now || '')}</small></div>` + (cards || '<p class="empty">아직 기사가 없어요.</p>');
}

function cmt(c, best) {
 return `<div class="cm"><div class="n">${best ? '<span class="best">BEST</span>' : ''}${esc(c.n)}<i>${esc(c.tm)}</i></div><p>${esc(c.t)}</p>${c.up != null && !c.reply ? `<div class="v"><span>추천 ${esc(c.up)}</span><span>비추천 ${esc(c.dn || 0)}</span>${c.re && c.re.length ? `<span>답글 ${c.re.length}</span>` : ''}</div>` : ''}${c.re && c.re.length ? `<div class="re">${c.re.map(r => cmt(Object.assign({ reply: 1 }, r))).join('')}</div>` : ''}</div>`;
}

function view(id) {
 const a = N.articles[id], o = out(a.o);
 const cms = (a.cm || []).slice().sort((x, y) => (y.up || 0) - (x.up || 0));
 const total = cms.reduce((s, c) => s + 1 + (c.re ? c.re.length : 0), 0);
 $('#view').innerHTML = `<button class="back" type="button">‹ 뉴스</button>
<div class="meta" style="border:0;padding:0">${logo(o)}<b style="color:var(--ink)">${esc(o.name)}</b></div>
<div class="kick">${esc(a.sec || '')}</div><h1>${esc(a.title)}</h1>
<div class="meta"><span>입력 2026. ${esc(a.tm)}</span></div>
${a.photo ? `<div class="big" style="${grad(o.c)}"></div><p class="cap">${esc(a.photo)}</p>` : ''}
<div class="body">${(a.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>
<div class="cmh">댓글 <span>${total}</span></div>
${cms.map((c, i) => cmt(c, i < 2 && (c.up || 0) > (c.dn || 0) * 2 && (c.up || 0) >= 100)).join('')}`;
 $('#view .back').addEventListener('click', () => { location.hash = ''; });
}

let y = 0;
function show() {
 const m = location.hash.match(/^#a-(.+)$/);
 const id = m && N.articles[decodeURIComponent(m[1])] ? decodeURIComponent(m[1]) : null;
 if (id) { y = scrollY; view(id); $('#feed').hidden = true; $('#view').hidden = false; scrollTo(0, 0); }
 else { $('#view').hidden = true; $('#feed').hidden = false; scrollTo(0, y); }
}
feed(); show();
addEventListener('hashchange', show);
})();
