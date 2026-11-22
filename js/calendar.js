// 볼프하임 캘린더. 옛 아티팩트 코드에서 저장(Supabase)과 GitHub 읽기(Edge Function)만 바꿨다.
(async()=>{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const DEFAULT_SUN={"1":["09:00","15:30"],"2":["08:00","16:30"],"3":["06:30","17:45"],"4":["05:00","19:30"],"5":["03:45","21:00"],"6":["03:00","22:00"],"7":["03:15","21:45"],"8":["04:30","20:30"],"9":["05:45","18:45"],"10":["07:00","17:00"],"11":["08:00","15:45"],"12":["09:15","15:15"],"10h":["07:30","16:30"]};
const DEFAULT={v:2,savedAt:0,modern:{date:'2026-08-23',time:'',where:'',routines:[],sig:'',synced:'',sun:DEFAULT_SUN},
  fantasy:{era:'제국력',y:1123,m:11,d:1,time:'',where:'',routines:[],months:[['1월',31],['2월',28],['3월',31],['4월',30],['5월',31],['6월',30],['7월',31],['8월',31],['9월',30],['10월',31],['11월',30],['12월',31]],weekdays:[],sig:'',synced:'',sun:DEFAULT_SUN},
  events:{modern:{},fantasy:{}}};
const validState=o=>!!(o&&o.events&&o.events.modern&&o.events.fantasy&&o.modern&&o.modern.date&&o.fantasy&&Array.isArray(o.fantasy.months));
await DB.requireLogin();
DB.nav();
let S=JSON.parse(JSON.stringify(DEFAULT)),loadErr='',fresh=false;
try{const row=await DB.loadDoc('calendar');if(row&&validState(row.data))S=row.data;else fresh=true}
catch(e){loadErr='불러오지 못했어요: '+(e.message||e)}

/* 날짜 계산: 현대는 실제 달력, 판타지는 설정의 달 목록 */
const dn=s=>{const[y,m,d]=s.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/864e5)};
const mDays=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
const MW=['일','월','화','수','목','금','토'];
const mWd=n=>((n+4)%7+7)%7;
const mKey=(y,m,d)=>`${y}-${pad(m)}-${pad(d)}`;
const mLabel=k=>{const[y,m,d]=k.split('-').map(Number);return `${y}년 ${m}월 ${d}일 (${MW[mWd(dn(k))]})`};
const F=()=>S.fantasy;
const YL=()=>F().months.reduce((a,m)=>a+m[1],0);
const fSer=(y,m,d)=>{const M=F().months;let c=0;for(let i=0;i<m-1&&i<M.length;i++)c+=M[i][1];return(y-1)*YL()+c+d-1};
const fParse=k=>{const[y,m,d]=k.split('-').map(Number);return{y,m,d}};
const fWd=n=>{const W=F().weekdays.length;return W?((n%W)+W)%W:0};
const fLabel=k=>{const o=fParse(k),W=F().weekdays;return `${F().era} ${o.y}년 ${F().months[o.m-1]?.[0]??(o.m+'월')} ${o.d}일`+(W.length?` (${W[fWd(fSer(o.y,o.m,o.d))]})`:'')};
const todayKey=w=>w==='modern'?S.modern.date:`${F().y}-${F().m}-${F().d}`;
const label=(w,k)=>k==='미정'?'날짜 미정':(w==='modern'?mLabel(k):fLabel(k));
const sortVal=(w,k)=>k==='미정'?-1e15:w==='modern'?dn(k):(o=>fSer(o.y,o.m,o.d))(fParse(k));

/* 화면 상태 */
const posOf=k=>{const p=k.split('-').map(Number);return{y:p[0],m:p[1],sel:k}};
let V={world:location.hash==='#fantasy'?'fantasy':'modern',mode:'cal',q:''};
V.modern=posOf(todayKey('modern'));V.fantasy=posOf(todayKey('fantasy'));
V.cat=V.cat||'all';
try{V.hideDone=localStorage.getItem('daybook.hideDone')==='1'}catch(e){V.hideDone=false}

/* 저장: Supabase docs 테이블의 calendar 한 줄 */
let status=loadErr||(fresh?'저장된 일정이 없어요 · 설정의 백업 칸에 옛 캘린더 백업을 붙여 넣어 불러오세요':'불러왔어요');
const setStatus=s=>{status=s;const e=$('#st');if(e)e.textContent=s};
let saving=Promise.resolve();
function persist(){
  if(loadErr){setStatus('처음에 불러오지 못해서 저장하지 않았어요 · 새로고침해 주세요');return}
  setStatus('저장 중…');
  const snap=JSON.parse(JSON.stringify(S));
  saving=saving.then(()=>DB.saveDoc('calendar',snap)).then(()=>setStatus('저장됨'),e=>setStatus('저장 실패: '+(e.message||e)));
}
function commit(){S.savedAt=Date.now();render();persist()}

/* 최근기억 상태판 읽기 */
function parseBoard(txt){
  const line=k=>{const m=txt.match(new RegExp('-\\s*'+k+'\\s*[:：]\\s*(.+)'));return m?m[1].trim():''};
  const cur=line('현재 스토리 날짜·시각');
  if(!cur)throw new Error('"현재 스토리 날짜·시각" 줄을 찾지 못했어요. 최근기억 파일의 상태판을 붙여 넣어 주세요.');
  const o={where:line('현재 위치/시간대'),routines:[],events:[]};
  let r=cur.match(/(\S+력)\s*(-?\d+)년\s*(\d+)월\s*(\d+)일\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})?/);
  if(r){o.w='fantasy';o.era=r[1];o.y=+r[2];o.m=+r[3];o.d=+r[4];o.time=r[5]||''}
  else{r=cur.match(/(\d{4})년\s*(\d+)월\s*(\d+)일\s*(?:\([^)]*\))?\s*(\d{1,2}:\d{2})?/);if(!r)throw new Error('날짜 형식을 읽지 못했어요: '+cur);o.w='modern';o.y=+r[1];o.m=+r[2];o.d=+r[3];o.time=r[4]||''}
  const up=line('다가오는 일정');
  o.sig=[cur,o.where,up].join('|');
  for(let it of up?up.split(/\s+\/\s+/):[]){
    it=it.trim();if(!it)continue;
    if(/^매일/.test(it)){o.routines.push(it.replace(/^매일\s*,?\s*/,''));continue}
    let a,mm,dd,rest,lab='';
    if((a=it.match(/^(\d{1,2})\/(\d{1,2})\s*(?:\([^)]*\))?\s*,?\s*(.*)$/))||(a=it.match(/^(\d{1,2})월\s*(\d{1,2})일\s*(?:\([^)]*\))?\s*,?\s*(.*)$/))){mm=+a[1];dd=+a[2];rest=a[3]}
    else if(a=it.match(/^(\d{1,2})월\s*(초순|상순|중순|하순|초|말)\s*,?\s*(.*)$/)){mm=+a[1];dd=/말/.test(a[2])?'end':/하순/.test(a[2])?21:/중순/.test(a[2])?11:1;rest=a[3];lab=`${mm}월 ${a[2]}`}
    else{o.routines.push(it);continue}
    let time='',t=rest.match(/^(새벽|아침|오전|점심|낮|오후|저녁|밤|해질녘|자정)\s*,?\s*(.*)$/)||rest.match(/^(\d{1,2}:\d{2}(?:~(?:\d{1,2}:\d{2}|\S+(?:\s+(?:전|후))?))?(?:\s*(?:전|후|쯤|경)(?=[\s,]))?)\s*,?\s*(.*)$/);
    if(t){time=t[1];rest=t[2]}
    if(lab)time=lab+(time?' '+time:'');
    const title=rest.split(/,\s+/)[0].replace(/\s*\([PTS]\d+[a-z]?(?:·[PTS]\d+[a-z]?)*\)\s*$/,'').trim()||rest;
    const codes=rest.match(/[PTS]\d+[a-z]?/g)||[];
    o.events.push({mm,dd,time,title,note:/,\s/.test(rest)?rest:codes.join('·')});
  }
  return o;
}
function applyBoard(o,keep){
  const w=o.w,X=S[w];
  if(w==='fantasy'){if(o.m>X.months.length)throw new Error(`${o.m}월이 판타지 달 목록에 없어요.`);Object.assign(X,{era:o.era,y:o.y,m:o.m,d:o.d})}
  else X.date=mKey(o.y,o.m,o.d);
  Object.assign(X,{time:o.time,where:o.where,routines:o.routines,sig:o.sig,synced:new Date().toISOString().slice(0,10)});
  // 최근기억 일정은 지우지 않고 제목으로 맞춰 본다. 새 목록에 없는 것은 "목록에서 빠짐"(gone)으로 남긴다.
  const E=S.events[w],nt=t=>String(t||'').replace(/\s+/g,''),old=[];
  for(const[k,a]of Object.entries(E))for(const e of a)if(e.src==='mem')old.push({k,e});
  for(const k of Object.keys(E)){E[k]=E[k].filter(e=>e.src!=='mem');if(!E[k].length)delete E[k]}
  const put=(k,e)=>(E[k]||(E[k]=[])).push(e);
  const slots=o.events.map(e=>{
    const y=o.y+(e.mm<o.m-6?1:0);
    const len=w==='modern'?mDays(y,e.mm):(X.months[e.mm-1]||[0,30])[1];
    const d=e.dd==='end'?len:Math.min(e.dd,len);
    return{e,k:w==='modern'?mKey(y,e.mm,d):`${y}-${e.mm}-${d}`};
  });
  const used=new Set(),hit=new Map();
  const take=(s,f)=>{const m=old.find(x=>!used.has(x)&&nt(x.e.title)===nt(s.e.title)&&f(x));if(m){used.add(m);hit.set(s,m)}};
  for(const s of slots)take(s,x=>x.k===s.k);
  for(const s of slots)if(!hit.has(s))take(s,x=>!x.e.done);
  for(const s of slots){
    const m=hit.get(s),f={title:s.e.title,time:s.e.time,note:s.e.note};
    if(m){Object.assign(m.e,f);delete m.e.gone;put(s.k,m.e)}
    else put(s.k,{id:Math.random().toString(36).slice(2,9),...f,place:'',who:'',src:'mem'});
  }
  const day=new Date(),today=`${day.getFullYear()}-${pad(day.getMonth()+1)}-${pad(day.getDate())}`;let gone=0;
  for(const x of old)if(!used.has(x)){if(!x.e.done){if(!x.e.gone)x.e.gone=today;gone++}put(x.k,x.e)}
  V[w]=posOf(todayKey(w));if(!keep)V.world=w;
  return `${w==='modern'?'현대':'판타지'}: ${label(w,todayKey(w))}${o.time?' '+o.time:''}, 일정 ${o.events.length}개, 매일 할 일 ${o.routines.length}개를 반영했어요.`+(gone?` 목록에서 빠진 일정 ${gone}개는 지우지 않고 남겨 뒀어요.`:'');
}

/* 해 뜸~짐: 고정기억 "북부 월별 날씨" */
function parseSun(txt){
  const o={},re=/^-\s*(\d{1,2})월\s*:\s*해\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})(?:\s*\(하순\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\))?/gm;let r;
  while(r=re.exec(txt)){o[+r[1]]=[r[2],r[3]];if(r[4])o[r[1]+'h']=[r[4],r[5]]}
  if(Object.keys(o).length<6)throw new Error('해 뜸~짐 줄을 찾지 못했어요');
  return o;
}
function sunOf(w,k){const T=S[w].sun;if(!T||!k||k==='미정')return null;const p=k.split('-').map(Number),m=p[1],d=p[2];return(d>=21&&T[m+'h'])||T[m]||null}
const sunTxt=(w,k)=>{const x=sunOf(w,k);return x?`해 뜸 ${x[0]} · 해 짐 ${x[1]}`:''};

/* 장기기억 추가 계획 블록 읽기 */
function parseLtm(txt){
  const body=txt.split('[볼프하임 캘린더 업데이트]')[1];if(!body)throw new Error('[볼프하임 캘린더 업데이트] 머리줄을 찾지 못했어요.');
  const items=[];
  for(const l of body.split('[끝]')[0].split('\n').map(x=>x.trim()).filter(x=>x.includes('|'))){
    const c=l.split('|').map(x=>x.trim());if(c[0]==='세계')continue;
    if(c.length<8)throw new Error('칸 수가 모자라요: '+l.slice(0,40));
    const w=c[0]==='현대'?'modern':c[0]==='판타지'?'fantasy':null;if(!w)throw new Error('세계는 판타지나 현대여야 해요: '+c[0]);
    items.push({w,date:c[1],time:c[2],title:c[3],codes:c[4],status:c[5]==='추가함'?'추가함':'추가 예정',dest:c[6],basis:c.slice(7).join(' | ')});
  }
  if(!items.length)throw new Error('항목 줄이 없어요.');
  return{items,commit:((txt.match(/기준 커밋:[ \t]*([0-9a-f]{6,40})/)||[])[1]||'')};
}
function ltmKey(w,s){
  s=(s||'').trim();if(!s||s==='미정')return['미정',''];
  const cur=w==='modern'?S.modern.date.split('-').map(Number):[F().y,F().m,F().d];
  const mk=(y,m,d)=>w==='modern'?mKey(y,m,d):`${y}-${m}-${d}`;
  const len=(y,m)=>w==='modern'?mDays(y,m):(F().months[m-1]||[0,30])[1];
  const yOf=m=>cur[0]+(m<cur[1]-6?1:0);
  let r;
  if(r=s.match(/(-?\d+)년\s*(\d+)월\s*(\d+)일/))return[mk(+r[1],+r[2],+r[3]),''];
  if(r=s.match(/^(?:\S*?(-?\d+)년\s*)?(\d+)월\s*(초순|상순|중순|하순|초|말)$/)){const m=+r[2],y=r[1]?+r[1]:yOf(m);return[mk(y,m,/말/.test(r[3])?len(y,m):/하순/.test(r[3])?21:/중순/.test(r[3])?11:1),`${m}월 ${r[3]}`]}
  if(r=s.match(/^(\d+)월\s*(\d+)일$/)||s.match(/^(\d+)\/(\d+)$/)){const m=+r[1];return[mk(yOf(m),m,+r[2]),'']}
  return['미정','날짜: '+s];
}
function applyLtm(o,all){
  const ws=all?['modern','fantasy']:[...new Set(o.items.map(i=>i.w))];
  for(const w of ws){const E=S.events[w];for(const k of Object.keys(E)){E[k]=E[k].filter(e=>e.src!=='ltm');if(!E[k].length)delete E[k]}}
  for(const i of o.items){
    const[k,lab]=ltmKey(i.w,i.date),E=S.events[i.w];
    (E[k]||(E[k]=[])).push({id:Math.random().toString(36).slice(2,9),title:i.title,time:lab&&!lab.startsWith('날짜')?lab+(i.time?' '+i.time:''):i.time,place:'',who:'',note:lab.startsWith('날짜')?lab:'',cat:'ltm',status:i.status,codes:i.codes,dest:i.dest,basis:i.basis,src:'ltm'});
  }
  if(o.commit)S.ltmCommit=o.commit;
  const todo=o.items.filter(i=>i.status!=='추가함').length;
  return `장기기억 항목 ${o.items.length}개를 반영했어요 (추가 예정 ${todo}개).`;
}

/* GitHub 커넥터로 최근기억 직접 읽기 (읽기만 함) */
const GH={files:[['modern','story-modern/memory/레이너_최근기억.md','board'],['fantasy','story/memory/레이너_최근기억.md','board'],['modern','story-modern/memory/레이너_고정기억.md','sun'],['fantasy','story/memory/레이너_고정기억.md','sun'],['all','studio/daybook/calendar.md','ltm']]};
let ghMsg='GitHub 최근기억 확인 중…',ghBusy=false,ghRetry=false;
const setGh=(m,retry)=>{ghMsg=m;ghRetry=!!retry;const e=$('#gh');if(e)e.innerHTML=ghHTML()};
const goneN=()=>['modern','fantasy'].reduce((n,w)=>n+Object.values(S.events[w]).flat().filter(isGone).length,0);
const ghHTML=()=>`<span>${esc(ghMsg)}</span>${(n=>n?`<span class="gonen">목록에서 빠진 일정 ${n}개 · 완료로 확정하거나 지워 주세요</span>`:'')(goneN())}${ghBusy?'':`<button class="btn" id="ghgo">${ghRetry?'다시 시도':'다시 불러오기'}</button>`}`;
async function syncGitHub(byUser){
  if(ghBusy)return;ghBusy=true;setGh('GitHub 최근기억·장기기억 계획 읽는 중…');
  let res;
  try{res=await DB.readRepo(GH.files.map(f=>f[1]))}
  catch(e){ghBusy=false;setGh('GitHub에서 읽지 못했어요: '+(e.message||e),true);return}
  const got=[],errs=[];let changed=false;
  for(const[w,path,kind]of GH.files){
    const wn=w==='all'?'장기기억 계획':w==='modern'?'현대':'판타지';
    const tx=res.files&&res.files[path];
    if(typeof tx!=='string'){errs.push(wn+(kind==='sun'?' 고정기억':'')+': '+((res.errors&&res.errors[path])||'파일이 없어요'));continue}
    try{
      if(kind==='ltm'){if(tx!==S.ltmSrc){applyLtm(parseLtm(tx),true);S.ltmSrc=tx;changed=true;got.push('장기기억 계획 새로 반영')}continue}
      if(kind==='sun'){const o=parseSun(tx);if(JSON.stringify(o)!==JSON.stringify(S[w].sun||null)){S[w].sun=o;changed=true;got.push(wn+' 해 시각 새로 반영')}continue}
      const o=parseBoard(tx);if(o.w!==w)throw new Error('세계가 맞지 않아요');
      if(S[w].sig!==o.sig){applyBoard(o,true);changed=true;got.push(wn+' 새로 반영')}else got.push(wn+' 그대로')}
    catch(x){errs.push(wn+(kind==='sun'?' 고정기억':'')+': '+x.message)}
  }
  ghBusy=false;
  const t=new Date(),hm=pad(t.getHours())+':'+pad(t.getMinutes());
  if(errs.length)setGh([...new Set(errs)].join(' / ')+(got.length?' · '+got.join(', '):''),true);
  else setGh(`GitHub 최근기억 ${hm} 확인 · ${got.join(', ')}`);
  if(changed)commit();
}

/* 그림 */
const cityIcon='<svg viewBox="0 0 44 44" aria-hidden="true"><rect x="4" y="16" width="11" height="24" rx="1" fill="currentColor" opacity=".35"/><rect x="17" y="6" width="12" height="34" rx="1" fill="currentColor" opacity=".8"/><rect x="31" y="20" width="9" height="20" rx="1" fill="currentColor" opacity=".5"/><rect x="21" y="12" width="4" height="4" fill="#e6261f"/></svg>';
const moonIcon='<svg viewBox="0 0 44 44" aria-hidden="true"><defs><clipPath id="mc"><circle cx="22" cy="22" r="17"/></clipPath></defs><circle cx="22" cy="22" r="17" fill="#3a2434"/><g clip-path="url(#mc)"><circle cx="22" cy="22" r="17" fill="#d9e1ee"/><circle cx="32" cy="18" r="16" fill="#3a2434"/></g><circle cx="22" cy="22" r="17" fill="none" stroke="#c9d4e6" stroke-opacity=".5"/></svg>';

/* 렌더 */
const evs=(w,k)=>(S.events[w][k]||[]).slice().sort((a,b)=>(a.time||'~').localeCompare(b.time||'~'));
const isL=e=>e.cat==='ltm',isP=e=>e.cat==='plan',isFin=e=>!!e.done,isGone=e=>!!e.gone&&!e.done,isDone=e=>isFin(e)||isL(e)&&e.status==='추가함';
function evBtn(w,k,e){const meta=[isL(e)&&e.dest&&'들어갈 곳 '+e.dest,isL(e)&&e.codes,e.place&&'장소 '+e.place,e.who&&'인물 '+e.who,e.note,isL(e)&&e.basis&&'근거 '+e.basis].filter(Boolean).map(esc).join(' · ');
  const tag=isL(e)?`<span class="tag ltm">장기기억 · ${esc(e.status||'추가 예정')}</span>`:isP(e)?'<span class="tag plan">챙길 일정</span>':e.src==='mem'?'<span class="tag">최근기억</span>':'';
  const st=isFin(e)?'<span class="tag fin">완료</span>':isGone(e)?`<span class="tag gone">목록에서 빠짐 · ${esc(e.gone)}</span>`:'';
  return `<button class="ev${isL(e)?' ltm':''}${isP(e)?' plan':''}${isDone(e)?' done':''}${isGone(e)?' gone':''}" data-edit="${esc(e.id)}" data-k="${esc(k)}"><span class="t">${esc(e.time||(k==='미정'?'미정':'종일'))}</span><span><b>${isFin(e)?'✓ ':''}${esc(e.title)}</b>${tag}${st}${meta?`<small>${meta}</small>`:''}</span></button>`}
const evRow=(w,k,e)=>evBtn(w,k,e)+(isGone(e)?`<button class="btn fin" data-fin="${esc(e.id)}" data-k="${esc(k)}">완료로 확정</button>`:'');
function calHTML(){
  const w=V.world,P=V[w],tk=todayKey(w);let head,cols,cells=[];
  if(w==='modern'){cols=7;head=MW;const nd=mDays(P.y,P.m);
    for(let i=0;i<mWd(dn(mKey(P.y,P.m,1)));i++)cells.push(null);for(let d=1;d<=nd;d++)cells.push({k:mKey(P.y,P.m,d),d})}
  else{head=F().weekdays;cols=head.length||7;const nd=F().months[P.m-1][1];
    for(let i=0;i<fWd(fSer(P.y,P.m,1));i++)cells.push(null);for(let d=1;d<=nd;d++)cells.push({k:`${P.y}-${P.m}-${d}`,d})}
  const cell=c=>{if(!c)return '<span class="blank"></span>';const E=evs(w,c.k);
    return `<button class="day${c.k===tk?' now':''}${c.k===P.sel?' sel':''}" data-day="${c.k}" aria-label="${esc(label(w,c.k))}${c.k===tk?', 지금 이야기 날짜':''}, 일정 ${E.length}개"><span class="n">${c.d}</span>${E.slice(0,2).map(e=>`<span class="chip${isL(e)?' ltm':''}${isP(e)?' plan':''}${isDone(e)?' done':''}${isGone(e)?' gone':''}">${isFin(e)?'✓ ':''}${esc(e.title)}</span>`).join('')}${E.length>2?`<span class="more">+${E.length-2}</span>`:''}${E.length?`<span class="dots">${E.slice(0,3).map(e=>`<i${isL(e)?' class="l"':isP(e)?' class="c"':''}></i>`).join('')}</span>`:''}</button>`};
  return `<section class="cal" style="--cols:${cols}">${head.length?`<div class="wd">${head.map(h=>`<span>${esc(h)}</span>`).join('')}</div>`:''}<div class="grid">${cells.map(cell).join('')}</div><p class="legend"><span><i class="lg p"></i>플레이 일정</span><span><i class="lg c"></i>플레이어가 챙길 일정</span><span><i class="lg l"></i>장기기억에 넣을 것</span><span><i class="lg d"></i>장기기억에 넣음</span><span><i class="lg f">✓</i>완료</span><span><i class="lg g"></i>목록에서 빠짐</span></p></section>`;
}
function sideHTML(){
  const w=V.world,X=S[w],k=V[w].sel,E=evs(w,k),isNow=k===todayKey(w);
  return `<aside class="side"><h3>${esc(label(w,k))}</h3>${sunOf(w,k)?`<p class="sun">${esc(sunTxt(w,k))}</p>`:''}<p class="corr">${isNow?`지금 이야기 날짜${X.time?' · '+esc(X.time):''}${X.where?'<br>'+esc(X.where):''}`:sortVal(w,k)<sortVal(w,todayKey(w))?'지나간 날':'다가올 날'}</p>
  <ul class="evl">${E.length?E.map(e=>`<li>${evRow(w,k,e)}</li>`).join(''):'<li class="empty">이 날은 아직 일정이 없어요.</li>'}</ul><button class="btn pri" id="add">+ 일정 추가</button>
  ${(U=>U.length?`<div class="rt"><h4>날짜 미정</h4>${U.map(e=>evRow(w,'미정',e)).join('')}</div>`:'')(evs(w,'미정'))}
  ${X.routines&&X.routines.length?`<div class="rt"><h4>매일</h4><ul>${X.routines.map(r=>`<li>${esc(r)}</li>`).join('')}</ul></div>`:''}</aside>`;
}
function listItems(){
  const w=V.world,q=V.q.trim().toLowerCase(),tk=todayKey(w);
  const okc=e=>!(V.hideDone&&isFin(e))&&(V.cat==='all'||(V.cat==='ltm'?isL(e):V.cat==='plan'?isP(e):!isL(e)&&!isP(e)));
  const groups=Object.entries(S.events[w]).map(([k,a])=>[k,a.filter(e=>okc(e)&&(!q||[e.title,e.who,e.place,e.note,e.codes,e.dest,e.basis].join(' ').toLowerCase().includes(q)))]).filter(g=>g[1].length).sort((a,b)=>sortVal(w,a[0])-sortVal(w,b[0]));
  if(!groups.length)return `<p class="empty">${q?'검색 결과가 없어요.':'아직 일정이 없어요. 달력에서 날짜를 눌러 추가해 보세요.'}</p>`;
  return groups.map(([k,a])=>`<div class="grp">${k==='미정'?`<h3 class="gh">날짜 미정</h3>`:`<button class="gh" data-jump="${esc(k)}">${esc(label(w,k))}${k===tk?' · 지금':''}</button>`}${a.sort((x,y)=>(x.time||'~').localeCompare(y.time||'~')).map(e=>evRow(w,k,e)).join('')}</div>`).join('');
}
function tcard(x,w){const X=S[x];return `<button class="tcard${w===x?' on':''}" data-w="${x}" data-today="1">${x==='modern'?cityIcon:moonIcon}<span><small>${x==='modern'?'현대':'판타지'} · 지금 이야기 날짜</small><b>${esc(label(x,todayKey(x)))}${X.time?' '+esc(X.time):''}</b>${X.where?`<span class="where">${esc(X.where)}</span>`:''}${sunOf(x,todayKey(x))?`<span class="sun">${esc(sunTxt(x,todayKey(x)))}</span>`:''}</span></button>`}
function render(){
  const w=V.world,P=V[w];
  document.body.className=w==='fantasy'?'fan':'';
  if(w==='fantasy'&&P.m>F().months.length)P.m=F().months.length;
  const title=w==='modern'?`${P.y}년 ${P.m}월`:`${F().era} ${P.y}년 ${F().months[P.m-1][0]}`;
  const syn=[S.modern.synced&&'현대 '+S.modern.synced,S.fantasy.synced&&'판타지 '+S.fantasy.synced].filter(Boolean).join(', ');
  $('#app').innerHTML=`<div class="wrap">
  <header class="top"><h1>볼프하임 캘린더</h1><div class="tabs" role="tablist">${['modern','fantasy'].map(x=>`<button role="tab" data-w="${x}" aria-selected="${x===w}">${x==='modern'?'현대':'판타지'}</button>`).join('')}</div></header>
  <section class="today" aria-label="지금 이야기 날짜">${tcard('modern',w)}${tcard('fantasy',w)}</section>
  <p class="ghline" id="gh" aria-live="polite">${ghHTML()}</p>
  <div class="bar"><div class="nav"><button class="ic" data-nav="-1" aria-label="이전 달">‹</button><h2>${esc(title)}</h2><button class="ic" data-nav="1" aria-label="다음 달">›</button><button class="btn" data-nav="0">지금</button></div>
  <div class="seg"><button data-mode="cal" aria-pressed="${V.mode==='cal'}">달력</button><button data-mode="list" aria-pressed="${V.mode==='list'}">연표</button><button class="btn" id="set">설정·최근기억</button></div></div>
  <div class="main${V.mode==='list'?' one':''}">${V.mode==='cal'?calHTML()+sideHTML():`<section class="list"><div class="seg fl">${[['all','전체'],['play','플레이 일정'],['plan','챙길 일정'],['ltm','장기기억']].map(([c,n])=>`<button data-cat="${c}" aria-pressed="${V.cat===c}">${n}</button>`).join('')}<button data-hide="1" aria-pressed="${!!V.hideDone}">완료 숨기기</button></div><input id="q" type="search" placeholder="제목, 인물, 장소, 메모로 검색" aria-label="일정 검색" value="${esc(V.q)}"><div id="lst">${listItems()}</div></section>`}</div>
  <footer class="foot"><span id="st">${esc(status)}</span>${syn?` · 최근기억 반영: ${esc(syn)}`:''}</footer></div>`;
}

/* 대화상자 */
document.body.insertAdjacentHTML('beforeend',`
<dialog id="ed"><form id="edf"><h3 id="edh"></h3><p class="corr" id="edd"></p>
<label>제목<input name="title" required maxlength="160"></label>
<div class="two"><label>범주<select name="cat"><option value="play">플레이 일정</option><option value="plan">플레이어가 챙길 일정</option><option value="ltm">장기기억에 넣을 것</option></select></label><label>날짜<input name="date" autocomplete="off"></label></div>
<label class="chk" id="donef"><input type="checkbox" name="done"> 완료</label>
<div id="ltmf"><div class="two"><label>상태<select name="status"><option>추가 예정</option><option>추가함</option></select></label><label>번호<input name="codes" placeholder="S167·P167a"></label></div><label>들어갈 곳<input name="dest"></label><label>근거<input name="basis"></label></div>
<div class="two"><label>시간<input name="time" placeholder="예: 14:00, 저녁"></label><label>장소<input name="place"></label></div>
<label>인물<input name="who" placeholder="쉼표로 구분"></label>
<label>메모<textarea name="note" rows="3"></textarea></label><p class="err" id="ederr"></p>
<div class="acts"><button type="button" class="btn danger" id="del">삭제</button><span class="sp"></span><button type="button" class="btn" id="cancel">취소</button><button class="btn pri" type="submit">저장</button></div></form></dialog>
<dialog id="sd"><form id="sdf"><h3>설정·최근기억</h3>
<fieldset><legend>붙여넣기</legend><p class="hint">장기기억 계획은 저장소 <b>studio/daybook/calendar.md</b>에서 알아서 읽어 와요. 급할 때만 <b>[볼프하임 캘린더 업데이트]</b> 블록을 붙여 넣으세요(그 블록에 있는 세계의 장기기억 항목만 바뀌고, 다음에 calendar.md가 바뀌면 그 내용으로 다시 맞춰져요). 평소에는 페이지를 열 때 GitHub에서 알아서 읽어 와요(Edge Function을 거쳐 읽기만 해요). GitHub를 못 읽을 때만 이걸 쓰세요. 저장소의 <b>story/memory/레이너_최근기억.md</b>(판타지)나 <b>story-modern/memory/레이너_최근기억.md</b>(현대)의 상태판을 붙여 넣으세요. 날짜를 보고 어느 세계인지 알아서 고르고, 지금 날짜·위치·다가오는 일정을 바꿔요. 전에 최근기억에서 가져온 일정은 새 것으로 바뀌고, 직접 넣은 일정은 그대로 남아요.</p>
<textarea id="mem" rows="5" spellcheck="false" aria-label="최근기억 붙여넣기" placeholder="- 현재 스토리 날짜·시각: …&#10;- 다가오는 일정: …"></textarea>
<div class="acts" style="margin-top:8px"><button type="button" class="btn pri" id="memgo">반영하기</button><span class="hint" id="memm" style="margin:0"></span></div></fieldset>
<fieldset><legend>현대</legend><div class="two"><label>지금 이야기 날짜<input type="date" name="mDate" required></label><label>시각<input name="mTime" placeholder="20:55"></label></div><label>위치·시간대<input name="mWhere"></label></fieldset>
<fieldset><legend>판타지</legend>
<div class="two"><label>연호<input name="era" required maxlength="20"></label><label>시각<input name="fTime" placeholder="09:47"></label></div>
<label>지금 이야기 날짜 (년, 월, 일)<span class="three"><input name="fy" type="number" required aria-label="년"><input name="fm" type="number" min="1" required aria-label="월"><input name="fd" type="number" min="1" required aria-label="일"></span></label>
<label>위치·시간대<input name="fWhere"></label>
<label>달 (한 줄에 하나씩: 이름 일수)<textarea name="months" rows="5" spellcheck="false"></textarea></label>
<label>요일 (쉼표로 구분, 비워 두면 요일 없이 표시)<input name="wds"></label><p class="err" id="serr"></p></fieldset>
<fieldset><legend>백업</legend><p class="hint">아래 텍스트를 복사해 보관하세요. 복구하거나 옛 캘린더 아티팩트의 데이터를 옮겨 올 땐 여기에 붙여 넣고 불러오기를 누르면 돼요. 불러오면 지금 저장된 캘린더 전체가 바뀌어요.</p>
<textarea id="bk" rows="3" spellcheck="false" aria-label="백업 데이터"></textarea>
<div class="acts" style="margin-top:8px"><button type="button" class="btn" id="copy">복사</button><button type="button" class="btn" id="imp">붙여 넣은 내용 불러오기</button><span class="hint" id="bkm" style="margin:0"></span></div></fieldset>
<div class="acts"><span class="sp"></span><button type="button" class="btn" id="scancel">닫기</button><button class="btn pri" type="submit">설정 저장</button></div></form></dialog>`);
const fe=(f,n)=>f.elements.namedItem(n);
let edCtx=null,delArm=false;
function openEd(k,id){
  const w=V.world,ev=id?(S.events[w][k]||[]).find(e=>e.id===id):null,f=$('#edf');
  edCtx={w,k,id:ev?ev.id:null};delArm=false;
  $('#edh').textContent=ev?'일정 고치기':'새 일정';$('#edd').textContent=label(w,k)+(ev&&ev.src==='ltm'?' · 다음에 장기기억 블록을 붙여 넣으면 새 내용으로 바뀌어요':'')+(ev&&ev.src==='mem'?' · 고치면 직접 넣은 일정이 돼서 다음 최근기억 반영 때 맞춰 보지 않아요(완료 체크만 바꾸면 그대로예요)':'')+(ev&&isGone(ev)?` · ${ev.gone}에 최근기억 목록에서 빠졌어요`:'');
  for(const n of['title','time','place','who','note','codes','dest','basis'])fe(f,n).value=ev?(ev[n]||''):'';
  fe(f,'cat').value=ev&&isL(ev)?'ltm':ev&&isP(ev)?'plan':'play';fe(f,'status').value=ev&&ev.status==='추가함'?'추가함':'추가 예정';
  fe(f,'date').value=k==='미정'?'':k;fe(f,'date').placeholder=(w==='modern'?'2026-08-25':'1123-11-7')+' · 비우면 날짜 미정';
  fe(f,'done').checked=!!(ev&&ev.done);
  $('#ltmf').style.display=fe(f,'cat').value==='ltm'?'':'none';$('#donef').style.display=fe(f,'cat').value==='ltm'?'none':'';$('#ederr').textContent='';
  $('#del').style.display=ev?'':'none';$('#del').textContent='삭제';
  $('#ed').showModal();fe(f,'title').focus();
}
$('#edf').addEventListener('submit',e=>{e.preventDefault();const f=e.target,val=n=>fe(f,n).value.trim(),title=val('title');if(!title)return;
  const{w,k,id}=edCtx,err=t=>{$('#ederr').textContent=t};
  let nk=val('date');
  if(!nk)nk='미정';
  else if(w==='modern'){const r=nk.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!r||+r[2]<1||+r[2]>12||+r[3]<1||+r[3]>mDays(+r[1],+r[2]))return err('날짜는 2026-08-25처럼 써 주세요.');nk=mKey(+r[1],+r[2],+r[3])}
  else{const r=nk.match(/^(-?\d+)-(\d{1,2})-(\d{1,2})$/);const M=F().months;if(!r||+r[2]<1||+r[2]>M.length||+r[3]<1||+r[3]>M[+r[2]-1][1])return err('날짜는 1123-11-7처럼 써 주세요.');nk=`${+r[1]}-${+r[2]}-${+r[3]}`}
  const old=id?(S.events[w][k]||[]).find(x=>x.id===id):null,ltm=val('cat')==='ltm';
  const o={id:id||Math.random().toString(36).slice(2,9),title,time:val('time'),place:val('place'),who:val('who'),note:val('note')};
  if(val('cat')==='plan'){o.cat='plan';if(old&&old.src==='plan')o.src='plan'}
  if(ltm)Object.assign(o,{cat:'ltm',status:val('status'),codes:val('codes'),dest:val('dest'),basis:val('basis')});
  if(old&&old.src==='ltm'&&ltm)o.src='ltm';
  if(!ltm&&fe(f,'done').checked)o.done=true;
  if(old&&old.src==='mem'&&val('cat')==='play'&&nk===k&&['title','time','place','who','note'].every(n=>(old[n]||'')===o[n])){o.src='mem';if(old.gone)o.gone=old.gone}
  if(id){S.events[w][k]=(S.events[w][k]||[]).filter(x=>x.id!==id);if(!S.events[w][k].length)delete S.events[w][k]}
  (S.events[w][nk]||(S.events[w][nk]=[])).push(o);
  $('#ed').close();if(nk!=='미정'){const p=nk.split('-').map(Number);Object.assign(V[w],{y:p[0],m:p[1],sel:nk})}commit()});
$('#edf').addEventListener('change',e=>{if(e.target.name==='cat'){$('#ltmf').style.display=e.target.value==='ltm'?'':'none';$('#donef').style.display=e.target.value==='ltm'?'none':''}});
function openSet(){
  const f=$('#sdf'),Fx=F(),M=S.modern;
  fe(f,'mDate').value=M.date;fe(f,'mTime').value=M.time||'';fe(f,'mWhere').value=M.where||'';
  fe(f,'era').value=Fx.era;fe(f,'fTime').value=Fx.time||'';fe(f,'fy').value=Fx.y;fe(f,'fm').value=Fx.m;fe(f,'fd').value=Fx.d;fe(f,'fWhere').value=Fx.where||'';
  fe(f,'months').value=Fx.months.map(m=>m[0]+' '+m[1]).join('\n');fe(f,'wds').value=Fx.weekdays.join(', ');
  $('#bk').value=JSON.stringify(S);$('#serr').textContent='';$('#bkm').textContent='';$('#memm').textContent='';$('#mem').value='';$('#sd').showModal();
}
$('#sdf').addEventListener('submit',e=>{e.preventDefault();const f=e.target,v=n=>fe(f,n).value.trim(),err=t=>{$('#serr').textContent=t};
  const months=[];for(const line of v('months').split('\n').map(s=>s.trim()).filter(Boolean)){const m=line.match(/^(.+?)\s+(\d+)$/);if(!m||+m[2]<1||+m[2]>99)return err(`달 형식을 확인해 주세요: "${line}" (예: 11월 30)`);months.push([m[1],+m[2]])}
  if(!months.length)return err('달을 하나 이상 적어 주세요.');
  const wds=v('wds').split(',').map(s=>s.trim()).filter(Boolean);if(wds.length>14)return err('요일은 14개까지 적을 수 있어요.');
  const fy=parseInt(v('fy'),10),fm=parseInt(v('fm'),10),fd=parseInt(v('fd'),10);
  if(!Number.isFinite(fy)||!(fm>=1&&fm<=months.length))return err(`월은 1~${months.length} 사이여야 해요.`);
  if(!(fd>=1&&fd<=months[fm-1][1]))return err(`${months[fm-1][0]}은 1~${months[fm-1][1]}일까지예요.`);
  if(!v('mDate'))return err('현대 날짜를 채워 주세요.');
  Object.assign(S.modern,{date:v('mDate'),time:v('mTime'),where:v('mWhere')});
  Object.assign(S.fantasy,{era:v('era')||'제국력',y:fy,m:fm,d:fd,time:v('fTime'),where:v('fWhere'),months,weekdays:wds});
  V.modern=posOf(todayKey('modern'));V.fantasy=posOf(todayKey('fantasy'));
  $('#sd').close();commit()});

/* 이벤트 */
function goTo(k){const P=V[V.world],p=k.split('-').map(Number);P.y=p[0];P.m=p[1];P.sel=k;V.mode='cal';render()}
function nav(d){const w=V.world,P=V[w];if(!d)return goTo(todayKey(w));const n=w==='modern'?12:F().months.length;P.m+=d;if(P.m<1){P.m=n;P.y--}if(P.m>n){P.m=1;P.y++}render()}
function setWorld(w){V.world=w;render();try{if(location.hash!=='#'+w)location.hash=w}catch(e){}}
addEventListener('hashchange',()=>{const w=location.hash==='#fantasy'?'fantasy':'modern';if(w!==V.world){V.world=w;render()}});
document.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.w){setWorld(d.w);if(d.today)goTo(todayKey(d.w))}
  else if(d.nav!==undefined)nav(+d.nav);
  else if(d.mode){V.mode=d.mode;render()}
  else if(d.cat){V.cat=d.cat;render()}
  else if(d.day){V[V.world].sel=d.day;render();if(innerWidth<900)$('.side')?.scrollIntoView({behavior:'smooth',block:'start'})}
  else if(d.hide){V.hideDone=!V.hideDone;try{localStorage.setItem('daybook.hideDone',V.hideDone?'1':'0')}catch(x){}render()}
  else if(d.fin){const ev=(S.events[V.world][d.k]||[]).find(x=>x.id===d.fin);if(ev){ev.done=true;commit()}}
  else if(d.edit)openEd(d.k,d.edit);
  else if(d.jump)goTo(d.jump);
  else if(t.id==='add')openEd(V[V.world].sel);
  else if(t.id==='set')openSet();
  else if(t.id==='cancel')$('#ed').close();
  else if(t.id==='scancel')$('#sd').close();
  else if(t.id==='ghgo')syncGitHub(true);
  else if(t.id==='memgo'){try{const tx=$('#mem').value,msg=tx.includes('[볼프하임 캘린더 업데이트]')?applyLtm(parseLtm(tx)):applyBoard(parseBoard(tx));$('#sd').close();setStatus(msg);commit();setStatus(msg)}catch(x){$('#memm').textContent=x.message||'읽지 못했어요.'}}
  else if(t.id==='del'){if(!delArm){delArm=true;t.textContent='한 번 더 누르면 삭제';return}
    const{w,k,id}=edCtx,arr=S.events[w][k]||[];S.events[w][k]=arr.filter(x=>x.id!==id);if(!S.events[w][k].length)delete S.events[w][k];$('#ed').close();commit()}
  else if(t.id==='copy'){try{await navigator.clipboard.writeText($('#bk').value);$('#bkm').textContent='복사했어요.'}catch(x){$('#bk').select();$('#bkm').textContent='자동 복사가 막혀 있어요. 선택된 텍스트를 직접 복사해 주세요.'}}
  else if(t.id==='imp'){try{const o=JSON.parse($('#bk').value);if(!validState(o))throw 0;S=o;V.modern=posOf(todayKey('modern'));V.fantasy=posOf(todayKey('fantasy'));$('#sd').close();commit()}catch(x){$('#bkm').textContent='불러올 수 없는 내용이에요. 백업 텍스트 전체를 붙여 넣었는지 확인해 주세요.'}}
});
document.addEventListener('input',e=>{if(e.target.id==='q'){V.q=e.target.value;$('#lst').innerHTML=listItems()}});
render();
syncGitHub(false);
})();
