// 신문(잡지): 기사 날짜로 하루 한 쪽. 데이터는 wolfheim 저장소 studio/daybook/news.json에서 Edge Function으로 읽는다.
// 댓글(cm)은 화면에 보이지 않고, 사진 없는 날 특집을 고르는 데만 쓴다.
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

// 사진: news.json의 img를 Edge Function으로 받아 data 주소로 만든다
const IMGS = {};
function img(name) {
 if (!IMGS[name]) {
  const p = 'studio/daybook/news/' + name;
  IMGS[name] = DB.readRepo([p]).then(r => r.files && r.files[p] ? 'data:image/webp;base64,' + r.files[p] : null).catch(() => null);
 }
 return IMGS[name];
}

const out = k => (N.outlets[k] || { name: k }).name;
const md = tm => { const m = String(tm).match(/(\d+)월\s*(\d+)일/); return m ? [+m[1], +m[2]] : [0, 0]; };
const key = tm => md(tm).map(n => String(n).padStart(2, '0')).join('');
const WD = ['일','월','화','수','목','금','토'], YEAR = 2026;

// 기사 날짜로 하루씩 묶는다. 한 날 안의 순서는 feed 순서(최신 위)
const days = {};
for (const g of N.feed) for (const id of g.a || []) { const a = N.articles[id]; if (a) (days[key(a.tm)] ||= []).push(id); }
const keys = Object.keys(days).sort();
const heat = a => (a.cm || []).reduce((s, c) => s + (c.up || 0), 0);

// 특집 인용구: 본문 속 따옴표 말 중 가장 긴 것, 없으면 첫 문장
function pullOf(a) {
 const t = (a.body || []).join(' ');
 const q = [...t.matchAll(/"([^"]{10,70})"/g)].map(m => m[1]);
 if (q.length) return q.sort((x, y) => y.length - x.length)[0];
 return (t.split(/(?<=다\.)\s/)[0] || '').replace(/\.$/, '');
}
const by = a => { const [m, d] = md(a.tm); return `<p class="by">${esc(out(a.o))} · ${m}월 ${d}일</p>`; };
const txt = (a, dc) => `<div class="txt${dc ? ' dc' : ''}">${(a.body || []).map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
const lab = x => `${+x.slice(0, 2)}월 ${+x.slice(2)}일`;

function render(k) {
 const ids = days[k];
 const fid = ids.find(id => N.articles[id].img) || ids.slice().sort((x, y) => heat(N.articles[y]) - heat(N.articles[x]))[0];
 const f = N.articles[fid], rest = ids.filter(id => id !== fid);
 const [m, d] = md(f.tm), wd = WD[new Date(YEAR, m - 1, d).getDay()];
 const i = keys.indexOf(k);

 const WDk = x => WD[new Date(YEAR, +x.slice(0, 2) - 1, +x.slice(2)).getDay()];
 $('#run').innerHTML = `<span><b>노르덴 뉴스</b> 매거진</span><button type="button" class="pick" aria-expanded="false" aria-controls="picker">제${i + 1}호 · ${YEAR}. ${m}. ${d}. ▾</button>
<ul class="picker" id="picker" hidden>${keys.map((x, j) => `<li><a href="#d${x}"${x === k ? ' aria-current="page"' : ''}><span>제${j + 1}호</span>${+x.slice(0, 2)}.${+x.slice(2)} ${WDk(x)}</a></li>`).join('')}</ul>`;
 const btn = $('#run .pick'), list = $('#picker');
 btn.addEventListener('click', e => { e.stopPropagation(); list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); });
 $('#main').innerHTML = `
<section class="open">
 <div class="day"><small>${m}월 · ${wd}요일</small>${d}</div>
 <div><p class="toc-h">이날의 기사</p><ol class="toc">${[fid, ...rest].map(id => `<li><span>${esc(N.articles[id].sec || '')}</span><a href="#a-${esc(id)}">${esc(N.articles[id].title)}</a></li>`).join('')}</ol></div>
</section>
<article class="feat" id="a-${esc(fid)}">
 <p class="kick">${esc(f.sec || '')} · 특집</p>
 <h2>${esc(f.title)}</h2>
 <div class="fbody">${f.img ? `<figure class="wait"><img alt="${esc(f.photo || '')}" hidden><figcaption>${esc(f.photo || '')}</figcaption></figure>` : ''}
 <div class="cols"><blockquote class="pull">${esc(pullOf(f))}</blockquote><div>${by(f)}${txt(f, /^[가-힣]/.test((f.body || [''])[0]))}</div></div></div>
</article>
${rest.length ? `<section class="more">${rest.map(id => { const a = N.articles[id]; return `<article id="a-${esc(id)}"><p class="kick">${esc(a.sec || '')}</p><h3>${esc(a.title)}</h3>${by(a)}${txt(a)}</article>`; }).join('')}</section>` : ''}`;
 if (f.img) img(f.img).then(u => {
  const fig = $('#main .feat figure'); if (!fig || cur !== k) return;
  if (!u) { fig.remove(); return; }
  // 세로 사진은 자르지 않고 왼쪽 단에 세운다
  const im = fig.querySelector('img');
  im.onload = () => { if (im.naturalHeight > im.naturalWidth) fig.closest('.feat').classList.add('tall'); fig.classList.remove('wait'); };
  im.src = u; im.hidden = false;
 });

 const p = keys[i - 1], n = keys[i + 1];
 $('#turn').innerHTML = `<a class="pv ${p ? '' : 'off'}" href="#d${p || ''}">← ${p ? lab(p) : ''}</a>
<a class="nx ${n ? '' : 'off'}" href="#d${n || ''}">${n ? lab(n) : ''} →</a>`;
}

let cur = null;
function go(k) { if (cur !== k) { cur = k; render(k); } }
function show() {
 if (!keys.length) { $('#main').innerHTML = '<p class="empty">아직 기사가 없어요.</p>'; $('#turn').innerHTML = ''; return; }
 const h = decodeURIComponent(location.hash.slice(1));
 let m = h.match(/^d(\d{4})$/);
 if (m && days[m[1]]) { go(m[1]); scrollTo(0, 0); return; }
 m = h.match(/^a-(.+)$/);
 if (m && N.articles[m[1]]) { go(key(N.articles[m[1]].tm)); const el = document.getElementById(h); if (el) el.scrollIntoView(); return; }
 go(cur || keys[keys.length - 1]);
}
show();
addEventListener('hashchange', show);
// 날짜 목록: 바깥을 누르거나 Esc면 닫는다
const closePick = () => { const l = $('#picker'); if (l && !l.hidden) { l.hidden = true; $('#run .pick').setAttribute('aria-expanded', 'false'); } };
document.addEventListener('click', e => { if (!e.target.closest('#picker')) closePick(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePick(); });
})();
