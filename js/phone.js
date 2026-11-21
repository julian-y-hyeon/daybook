// 통화 · 문자. 옛 아티팩트의 화면을 그대로 두고, 데이터를 Supabase docs 테이블의 phone 한 줄에서 읽는다.
(async () => {
await DB.requireLogin();
DB.nav();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NOTE = '대화이력에서 옮긴 통화입니다. 시각이 기록에 없는 통화와 초 단위 통화 시간은 앞뒤 장면으로 추정했습니다. 녹음 대본에는 두 사람이 소리 내어 한 말만 담았습니다.';
const EMPTY = { status: '', open: '', log: [], rec: {}, days: [] };
const valid = o => !!(o && Array.isArray(o.log) && Array.isArray(o.days) && o.rec && typeof o.rec === 'object');

let P = JSON.parse(JSON.stringify(EMPTY)), loadErr = '';
try { const row = await DB.loadDoc('phone'); if (row && valid(row.data)) P = row.data; }
catch (e) { loadErr = '불러오지 못했어요: ' + (e.message || e); }
const setStatus = s => { $('#st').textContent = s; };
setStatus(loadErr || (P.log.length ? '' : '저장된 기록이 없어요 · 붙여넣기에서 백업을 불러오세요'));

const SV = {
 out:'<svg viewBox="0 0 18 18"><path d="M4 14 14 4M6 4h8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 inn:'<svg viewBox="0 0 18 18"><path d="M14 4 4 14M12 14H4V6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 blk:'<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m4 4 10 10" stroke="currentColor" stroke-width="1.8"/></svg>',
 mic:'<svg viewBox="0 0 18 18"><rect x="6" y="1.5" width="6" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 8.5a5.5 5.5 0 0 0 11 0M9 14v2.5M5.5 16.5h7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
 call:'<svg viewBox="0 0 20 20"><path d="M5 2.5 7.2 5c.4.5.4 1.2 0 1.6l-1 1c.9 1.7 2.3 3.1 4 4l1-1c.4-.4 1.1-.4 1.6 0l2.5 2.2c.5.5.5 1.3 0 1.8l-1 1C10.8 19 1 9.2 2.4 3.6l1-1c.5-.5 1.2-.5 1.6-.1Z" fill="currentColor"/></svg>',
 msg:'<svg viewBox="0 0 20 20"><path d="M10 3c4.4 0 8 2.7 8 6s-3.6 6-8 6c-.8 0-1.6-.1-2.3-.3L4 17l.8-3.2C3 12.7 2 11 2 9c0-3.3 3.6-6 8-6Z" fill="currentColor"/></svg>',
 vid:'<svg viewBox="0 0 20 20"><rect x="1.5" y="5" width="12" height="10" rx="2" fill="currentColor"/><path d="m14.5 8.5 4-2.5v8l-4-2.5z" fill="currentColor"/></svg>',
 list:'<svg viewBox="0 0 20 20"><path d="M7 5h11M7 10h11M7 15h11" stroke="currentColor" stroke-width="1.8"/><circle cx="3" cy="5" r="1.2" fill="currentColor"/><circle cx="3" cy="10" r="1.2" fill="currentColor"/><circle cx="3" cy="15" r="1.2" fill="currentColor"/></svg>',
 spark:'<svg viewBox="0 0 20 20"><path d="M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6zM15 11l.8 2.2 2.2.8-2.2.8L15 17l-.8-2.2L12 14l2.2-.8zM15.5 2l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L13.5 4l1.5-.5z" fill="currentColor"/></svg>'
};

/* 메시지 */
const chat = $('#chat');
const toEnd = () => { chat.style.scrollBehavior = 'auto'; chat.scrollTop = chat.scrollHeight; };
function renderChat() {
 let prev = null;
 chat.innerHTML = P.log.length ? P.log.map(m => {
  if (m.d) { prev = null; return `<div class="date"><b>${esc(m.d)}</b> ${esc(m.tm || '')}</div>`; }
  if (m.call) { prev = null; return `<div class="call${m.miss?' miss':''}"><span><svg viewBox="0 0 12 12"><path d="M3 1.2 4.6 3c.3.4.3.9 0 1.2l-.7.7c.6 1.2 1.6 2.2 2.8 2.8l.7-.7c.3-.3.8-.3 1.2 0L10.8 9c.4.4.4 1 0 1.4l-.7.7C7.3 12 0 4.7.9 1.9l.7-.7c.4-.4 1-.4 1.4 0Z" fill="currentColor"/></svg>${esc(m.call)}</span></div>`; }
  const f = m.f === 'me' ? 'me' : 'them';
  const out = (m.t || []).map((t, i) => {
   const last = i === m.t.length - 1;
   const gap = i === 0 && prev !== null ? ' gap' : '';
   return `<div class="row ${f}${last ? ' tail' : ''}${gap}"><div class="b">${esc(t)}</div></div>`;
  }).join('');
  prev = f;
  return out + (m.read ? `<div class="read"><b>읽음</b> ${esc(m.read)}</div>` : '');
 }).join('') : '<p class="empty-note">아직 기록이 없어요.</p>';
 toEnd();
}

/* 최근 통화 */
const NUM = 'xxxx-xxx-xxxxx';
function renderLog() {
 $('#sxlog').innerHTML = P.days.map(g => `<div class="sx-day">${esc(g.d)}</div><div class="sx-card">${(g.c || []).map(c => {
  const k = SV[c.k] ? c.k : 'inn';
  const ic = `<span class="sx-ic${c.red?' red':''}">${SV[k]}</span>`;
  const rec = c.rec && P.rec[c.rec] ? c.rec : null;
  if (c.id === P.open) return `<div class="sx-open"><h3>${esc(c.n)}${c.cnt?` (${esc(c.cnt)})`:''}</h3><div class="sx-meta"><div><p>${SV[k]}${esc(c.info)}</p><p>${esc(c.tm)}</p></div>${rec?`<span class="mic">${SV.mic}</span>`:''}</div>${rec?`<a class="sx-pill" href="#rec-${esc(rec)}"><span>${esc(P.rec[rec].title)}</span><span>&rarr;</span></a>`:''}<div class="sx-acts"><span>${SV.call}</span><span>${SV.msg}</span><span>${SV.vid}</span><span>${SV.list}</span></div></div>${c.num?'<div class="sx-btns"><span>연락처에 추가</span><span>태그 추가</span></div>':''}`;
  return `<button class="sx-row" data-id="${esc(c.id)}">${ic}<span class="sx-nm${c.red?' red':''}">${esc(c.n)}${c.cnt?` (${esc(c.cnt)})`:''}</span><span class="sx-r">${esc(c.tm)}${rec?SV.mic:''}</span></button>`;
 }).join('')}</div>`).join('');
 $('#sxnote').textContent = P.note || NOTE;
}
$('#sxlog').addEventListener('click', e => {
 const b = e.target.closest('.sx-row'); if (!b) return;
 P.open = b.dataset.id; renderLog();
});

/* 통화 녹음 */
function renderRec(k) {
 const r = P.rec[k]; let prev = null;
 $('#rcbody').innerHTML = `<div class="rc-sum" id="rcsum"><button type="button">${SV.spark}요약</button><h4>${esc(r.title)}</h4><small>AI로 생성된 콘텐츠입니다</small><ul>${(r.sum || []).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>` +
  (r.t || []).map(([w,t]) => { w = w === 'me' ? 'me' : 'them'; const g = prev && prev !== w ? ' gap' : ''; prev = w; return `<div class="ln ${w}${g}"><span>${esc(t)}</span></div>`; }).join('');
 $('#rclen').textContent = r.len || '';
 $('#rcsum button').addEventListener('click', () => $('#rcsum').classList.toggle('open'));
 $('#rcbody').scrollTop = 0;
}

const show = () => {
 const h = location.hash;
 const m = h.match(/^#rec-(.+)$/);
 const rec = m && P.rec[decodeURIComponent(m[1])] ? decodeURIComponent(m[1]) : null;
 const v = rec ? 'r' : h === '#calls' ? 'c' : 'm';
 for (const x of ['m','c','r']) $('#v-'+x).classList.toggle('on', x === v);
 $('.phone').classList.toggle('dk', v !== 'm');
 if (rec) renderRec(rec);
 if (v === 'm') toEnd();
};
function renderAll() { $('#clock').textContent = P.status || ''; renderChat(); renderLog(); show(); }
addEventListener('hashchange', show);
addEventListener('load', toEnd);
renderAll();

/* 저장 */
let saving = Promise.resolve();
function commit(msg) {
 renderAll();
 if (loadErr) { setStatus('처음에 불러오지 못해서 저장하지 않았어요 · 새로고침해 주세요'); return; }
 setStatus('저장 중…');
 const snap = JSON.parse(JSON.stringify(P));
 saving = saving.then(() => DB.saveDoc('phone', snap)).then(() => setStatus(msg ? msg + ' 저장됨.' : '저장됨'), e => setStatus('저장 실패: ' + (e.message || e)));
}

/* 붙여넣기: [통화·문자 업데이트] 블록은 이어 붙이고, 백업 JSON은 통째로 바꾼다 */
const HEAD = '[통화·문자 업데이트]';
function jsonOf(tx) {
 if (tx.includes(HEAD)) tx = tx.split(HEAD)[1].split('[끝]')[0];
 const a = tx.indexOf('{'), b = tx.lastIndexOf('}');
 if (a < 0 || b < a) throw new Error('JSON을 찾지 못했어요.');
 try { return JSON.parse(tx.slice(a, b + 1)); } catch (e) { throw new Error('JSON 형식이 맞지 않아요: ' + e.message); }
}
function mergeUpdate(u) {
 const N = JSON.parse(JSON.stringify(P));
 const log = Array.isArray(u.log) ? u.log : [];
 const seen = new Set(N.log.filter(m => m.d).map(m => m.d + '|' + (m.tm || '')));
 for (const m of log) if (m.d && seen.has(m.d + '|' + (m.tm || ''))) throw new Error(`이미 들어간 구분선이 있어요: ${m.d} ${m.tm || ''}. 같은 블록을 두 번 붙여 넣은 건 아닌지 확인해 주세요.`);
 if (log.some(m => m.read)) for (const m of N.log) delete m.read;
 N.log.push(...log);
 for (const [k, r] of Object.entries(u.rec || {})) {
  if (N.rec[k]) throw new Error(`녹음 ${k}번이 이미 있어요.`);
  if (!r || !r.title || !Array.isArray(r.t)) throw new Error(`녹음 ${k}번에 title이나 t가 없어요.`);
  N.rec[k] = r;
 }
 const ids = new Set(N.days.flatMap(g => (g.c || []).map(c => c.id)));
 const calls = Array.isArray(u.calls) ? u.calls : [];
 let nc = 0;
 for (const g of calls.slice().reverse()) {
  const cs = (g.c || []).map(c => { let id = c.id; while (!id || ids.has(id)) id = 'c' + Math.random().toString(36).slice(2, 8); ids.add(id); nc++; return { ...c, id }; });
  const old = N.days.find(x => x.d === g.d);
  if (old) old.c = [...cs, ...(old.c || [])]; else N.days.unshift({ d: g.d, c: cs });
 }
 if (u.status) N.status = u.status;
 if (u.open) N.open = u.open;
 if (u.note) N.note = u.note;
 return [N, `메시지·통화 ${log.length}줄, 통화 기록 ${nc}개, 녹음 ${Object.keys(u.rec || {}).length}개를 이어 붙였어요.`];
}
$('#openimp').addEventListener('click', () => { $('#impt').value = ''; $('#imperr').textContent = ''; $('#imp').showModal(); });
$('#impclose').addEventListener('click', () => $('#imp').close());
$('#impgo').addEventListener('click', () => {
 try {
  const tx = $('#impt').value, o = jsonOf(tx);
  let msg;
  if (tx.includes(HEAD)) [P, msg] = mergeUpdate(o);
  else if (valid(o)) { P = o; msg = '백업 전체를 불러왔어요.'; }
  else throw new Error('[통화·문자 업데이트] 블록도, 백업 JSON도 아니에요.');
  $('#imp').close(); commit(msg);
 } catch (e) { $('#imperr').textContent = e.message || '읽지 못했어요.'; }
});
$('#bkcopy').addEventListener('click', async () => {
 const t = JSON.stringify(P);
 try { await navigator.clipboard.writeText(t); $('#imperr').textContent = '복사했어요.'; }
 catch (e) { $('#impt').value = t; $('#impt').select(); $('#imperr').textContent = '자동 복사가 막혀 있어요. 선택된 텍스트를 직접 복사해 주세요.'; }
});
})();
