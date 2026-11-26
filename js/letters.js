// 편지: wolfheim 저장소 studio/daybook/letters.json에서 Edge Function으로 읽는다. 최신이 위.
(async () => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SRC = 'studio/daybook/letters.json';
await DB.requireLogin();
DB.nav();
const st = $('#st');
let L = [];
try {
  st.textContent = '불러오는 중…';
  const res = await DB.readRepo([SRC]);
  const txt = res.files && res.files[SRC];
  if (!txt) throw new Error((res.errors && res.errors[SRC]) || '파일이 없어요');
  const o = JSON.parse(txt);
  if (!o || !Array.isArray(o.letters)) throw new Error('letters.json 형식이 맞지 않아요');
  L = o.letters.filter(x => x && x.id && Array.isArray(x.body));
  st.textContent = '';
} catch (e) {
  st.textContent = '편지를 불러오지 못했어요: ' + (e.message || e);
  return;
}
if (!L.length) { st.textContent = '아직 편지가 없어요'; return; }

const short = x => { const m = String(x.id).match(/^\d+-(\d+)-(\d+)$/); return m ? `${+m[1]}월 ${+m[2]}일` : x.date; };
function show() {
  const id = decodeURIComponent(location.hash.slice(1));
  const i = Math.max(0, L.findIndex(x => x.id === id));
  const x = L[i];
  $('#list').innerHTML = L.map((y, j) => `<a href="#${esc(y.id)}"${j === i ? ' aria-current="true"' : ''}><b>${esc(short(y))}</b><small>${esc(y.date)}</small></a>`).join('');
  const prev = L[i + 1], next = L[i - 1];
  $('#main').innerHTML = `<article class="paper">
   <p class="head">${esc(x.head)}</p>
   ${x.body.map(p => `<p>${esc(p)}</p>`).join('')}
   <p class="sign">${esc(x.sign || '— R.')}</p>
  </article>
  ${x.base ? `<details class="base"><summary>바탕이 된 일</summary><p>${esc(x.base)}</p></details>` : ''}
  <nav class="turn" aria-label="앞뒤 편지">${prev ? `<a href="#${esc(prev.id)}">‹ ${esc(short(prev))}</a>` : '<span></span>'}${next ? `<a href="#${esc(next.id)}">${esc(short(next))} ›</a>` : '<span></span>'}</nav>`;
  document.title = `편지 · ${short(x)}`;
}
show();
addEventListener('hashchange', () => { show(); if (innerWidth < 800) $('#main').scrollIntoView({ block: 'start' }); });
})();
