'use strict';
// ===== 핵심: 상태 · 시간 흐름 · 업무 시간표 · 화면 전환 · 입력 =====
let S = null;
let DIFF = 'normal';
const D = () => DIFFS[DIFF];
const pen = n => Math.max(1, Math.round(n*D().pen));
const ACTIONS = {};     // data-a 이름 → 행동
const VIEWS = {};       // 장소 → 화면
const VIEW_KEYS = {};   // 장소별 단축키
const PILE_WARN = 15, SEATS = 12;
let CART_MAX = 12;

// ----- 저장 -----
function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,String(v)); }catch(e){ return null; } }
let memDday = 365;
function getDday(){ const v=store('gongik-dday'); return v==null ? memDday : +v; }
function setDday(v){ memDday=v; store('gongik-dday',v); }
function getDiff(){ return store('gongik-diff') || DIFF; }
function setDiff(v){ DIFF=v; store('gongik-diff',v); }

const patrons = () => Math.min(130, basePatrons() + rushBonus());
function basePatrons(){
  const m=S.min;
  for(let i=1;i<CROWD.length;i++) if(m<=CROWD[i][0]){ const [t0,v0]=CROWD[i-1],[t1,v1]=CROWD[i]; return Math.round(v0+(v1-v0)*(m-t0)/(t1-t0)); }
  return CROWD[CROWD.length-1][1];
}
function log(text,cls=''){
  const el=document.createElement('div'); el.className=cls; el.textContent=text;
  const box=$('#log'); box.prepend(el);
  while(box.children.length>5) box.lastChild.remove();
  setTimeout(()=>el.remove(),6500);
}
// 허리가 아프고 지칠수록 굼떠진다
const delay = () => 120 + S.back*5 + Math.max(0,50-S.sta)*12;
function busy(ms,label,fn){
  if(performance.now() < S.lock) return false;
  S.lock=performance.now()+ms; S.busyLabel=label;
  setTimeout(()=>{ if(S && S.running){ fn(); render(); } }, ms);
  return true;
}
function go(loc){
  if(!S || S.mode===loc || performance.now()<S.lock) return;
  const far = loc==='dock' || S.mode==='dock';
  const ms = ((far?1300:300)*(1+S.back/250) + Math.max(0,40-S.sta)*15) * (hasPerk('shoes')?0.7:1);
  S.sit=false; S.mySeat=-1; S.lean=false; S.shiftMode=false; S.desk.bundleMode=false;
  sfx.click(); if(far) setTimeout(sfx.ding, ms-150);
  busy(ms, far?'🛗 엘리베이터 타는 중…':'🚶 이동 중…', ()=>{ S.mode=loc; S.sel=null; S.sta-=far?1:0.3; });
  render();
}

// ----- 하루 시작 -----
function newDay(){
  uid=0; CART_MAX = 12 + (hasPerk('cart')?4:0);
  const day=365-getDday()+1, date=dateOfDay(day);
  const {shelves, loans}=genShelves();
  S = {
    day, date, mag:magKind(date), newDay:isNewBookDay(date),
    min:hhmm(9), rep:100, sta:100, back:0, maxBack:0,
    mode:'desk', lock:0, busyLabel:'', running:true, flags:{}, sel:null,
    processed:0, shelved:0, shipped:0, mistakes:0, found:[],
    cart:[], shelves, loans, caseView:2, shiftMode:false,
    desk:{pile:[], pad:[], cur:null, padMsg:null, padFx:'', outBin:[], floorBin:[], newTruck:[], bundleMode:false, bsel:[],
          printer:{paper:rnd(5,60), checked:false, looked:false, emptyT:0}},
    ent:{auto:[], lift:[], liftQueue:[], liftAt:liftSchedule()},
    corner:makeCorner(),
    dock:{porter:'before', arrive:hhmm(14,30), leave:hhmm(14,30)+D().porterWait, out:[], pending:[], inb:[], unloaded:false, sel:null,
          order:shuffle(LIB_KEYS.slice()), loaded:{}, belt:{items:[], wait:[], bins:[[],[],[],[],[]], stop:''}},
    trucksBusy:[], sit:false, lean:false, mySeat:-1, seats:[], seatT:0,
    overT:0, tiltT:0, taskTick:-1,
    shiftTask: day===1 ? {ci:2, at:hhmm(15)} : (Math.random()<0.45 ? {ci:rnd(0,2), at:rnd(hhmm(10,30),hhmm(15))} : null),
  };
  for(let i=0,n=rnd(8,11);i<n;i++) S.ent.auto.push(returnBook('자동반납'));              // 밤새 쌓인 책
  for(let i=0,n=rnd(5,8);i<n;i++){ const b=foreignBook('반납'); b.bm=null; b.scanned=true; S.desk.outBin.push(b); } // 어제까지 모인 타관도서
  S.tasks=makeTasks();
  funInit();
  updateSeats();
  $('#log').innerHTML='';
  log(`${fmtDate(date)} 09:00 출근. 오른쪽 업무 시간표를 확인하자!`,'info');
  musicStop(); sfx.start(); setTimeout(musicStart,700);
  render(); hud();
}

function makeTasks(){
  const T=[], add=(id,label,loc,start,due,check)=>T.push({id,label,loc,start,due:Math.min(due,hhmm(18)),check,done:false,failed:false,announced:false});
  add('auto',   '자동반납기 책 → 데스크',     'entrance', hhmm(9),     hhmm(9,50),  ()=>S.flags.autoMoved);
  add('printer','서가번호 프린터 용지 확인',  'desk',     hhmm(9),     hhmm(10),    ()=>S.desk.printer.checked);
  add('floor',  '이송기로 온 책 → 데스크',    'entrance', hhmm(9,20),  hhmm(10,20), ()=>S.flags.floorMoved);
  add('tablet', 'AR·영어 태블릿 배치',        'corner',   hhmm(9),     hhmm(10,30), tabletsOK);
  add('news',   '신문 작업',                  'corner',   hhmm(9,30),  hhmm(11),    newsOK);
  if(S.mag) add('mag', `잡지 작업 (${S.mag==='monthly'?'월간·격주간':'격주간'})`, 'corner', hhmm(10), hhmm(12), magOK);
  if(S.newDay) add('new', '신착 도서 배가', 'shelf', hhmm(11), hhmm(16), ()=>S.flags.newCame && !S.desk.newTruck.length && !S.cart.some(b=>b.isNew));
  add('bundle', '타관도서 묶기',              'desk',     hhmm(13),    hhmm(14,30), ()=>!S.desk.outBin.length);
  add('porter', '포터 상차·하차',             'dock',     hhmm(14,30), S.dock.leave, ()=>S.dock.porter!=='before' && S.shipped>0 && !S.dock.out.length && S.dock.unloaded);
  add('belt',   '지하 컨베이어 작업 (끈 제거!)', 'dock',  hhmm(14,30), hhmm(16,30), ()=>S.dock.unloaded && !S.dock.inb.length && !beltBusy());
  add('scan',   '근무실 반납기 스캔 → 배가',  'desk',     hhmm(15),    hhmm(17,30), ()=>S.flags.inboundDesk && S.dock.unloaded && !S.dock.inb.length && !beltBusy() && !anyInbound());
  add('tilt',   '기울어진 책 세우기',         'shelf',    hhmm(17),    hhmm(18),    ()=>S.flags.tilt17 && tiltedCount()===0);
  if(S.shiftTask) add('shift', `${CASES[S.shiftTask.ci].name} 책 땡기기 · 라벨링`, 'shelf', S.shiftTask.at, S.shiftTask.at+150, ()=>shelfClean(S.shiftTask.ci));
  return T.sort((a,b)=>a.start-b.start);
}
const anyInbound = () => [...S.desk.pile, ...S.desk.pad, ...S.cart].some(b=>b.source==='타관반납');

// ----- 시간 흐름 -----
function tick(dt){
  const dmin=dt/D().minSec, prevHour=Math.floor(S.min/60);
  S.min+=dmin;
  const p=patrons();
  if(Math.random() < (0.015+p/100*0.09)*D().spawn*dmin) spawnReturn(p);
  if(Math.random() < 0.05*p/100*dmin) borrowOne();
  S.tiltT += dmin*(0.3+p/100);
  if(S.tiltT>35){ S.tiltT=0; tiltSome(1); }
  if(!S.flags.tilt17 && S.min>=hhmm(17)){ S.flags.tilt17=true; tiltSome(3); log('오후 내내 붐벼서 서가가 엉망이다. 기울어진 책을 세우자.','warn'); }
  while(S.ent.liftAt.length && S.min>=S.ent.liftAt[0]){ const first=S.ent.liftAt[0]===hhmm(9,20); S.ent.liftAt.shift(); liftArrives(first); }
  if(!S.flags.newsCame && S.min>=hhmm(9,30)){ S.flags.newsCame=true; newsArrive(); render(); }
  if(S.mag && !S.flags.magCame && S.min>=hhmm(10)){ S.flags.magCame=true; magArrive(); render(); }
  if(S.newDay && !S.flags.newCame && S.min>=hhmm(11)) newBooksArrive();
  printerTick(dmin,p);
  truckTick(); if(Math.random()<0.012*dmin*(hasPerk('truck')?0.4:1)) borrowTruck();
  dockTick(dt,dmin);
  if(Math.floor(S.min/60)!==prevHour){ sfx.chime(); hourly(); }
  if(S.desk.pile.length>PILE_WARN){ S.overT+=dmin; if(S.overT>=6){ S.overT=0; S.rep-=pen(2); sfx.murmur(); log(pick(COMPLAINTS),'bad'); } } else S.overT=0;
  bodyTick(dt);
  S.seatT+=dmin; if(S.seatT>=15){ S.seatT=0; updateSeats(); }
  tasksTick();
  funTick();
  musicMood();
  S.rep=clamp(S.rep,0,100);
  if(S.rep<=0) return endDay(false);
  if(S.min>=hhmm(18)) return endDay(true);
}
function bodyTick(dt){
  if(S.sit){ S.sta+=5*dt; S.back-=2*dt; }
  else if(S.lean){ S.sta+=0.8*dt; S.back-=0.3*dt; }
  else { S.sta-=0.15*D().drain*dt*(hasPerk('coffee')?0.7:1); S.back-=0.03*dt; }
  S.sta=clamp(S.sta,0,100); S.back=clamp(S.back,0,100); S.maxBack=Math.max(S.maxBack,S.back);
  if(S.back>70 && !S.flags.back70){ S.flags.back70=true; log('허리가 비명을 지른다… 이용자 좌석에 빈자리 없나?','warn'); }
  if(S.back<50) S.flags.back70=false;
  if(S.sta<25 && !S.flags.sta25){ S.flags.sta25=true; log('다리가 후들거린다. 움직임이 느려진다.','warn'); }
  if(S.sta>40) S.flags.sta25=false;
}
function spawnReturn(p){
  if(p>55 && Math.random()<0.3){ S.desk.pile.push(withBm(loanBook('테이블'), D().bm+0.08)); if(Math.random()<0.2) log('아이들이 테이블에 책을 잔뜩 꺼내 놓고 갔다.',''); }
  else if(Math.random()<0.55 && S.ent.auto.length<AUTO_CAP){
    S.ent.auto.push(returnBook('자동반납'));
    if(S.ent.auto.length>=AUTO_CAP){ sfx.alarm(); log('📥 1층 자동반납기가 꽉 찼다! 비워 줘야 한다.','warn'); }
  }
  else S.desk.pile.push(returnBook('반납'));
  if(S.mode==='desk' || S.mode==='entrance') render(); else renderTabs();
}
function borrowOne(){
  const ci=rnd(0,2), si=rnd(0,4), slot=S.shelves[ci].slots[si];
  if(slot.length<=4) return;
  const i=rnd(0,slot.length-1); if(slot[i].tilted) return;
  S.loans.push(slot.splice(i,1)[0]);
  if(S.mode==='shelf') render();
}
function tiltSome(n){
  const cand=[];
  S.shelves.forEach(sh=>sh.slots.forEach(s=>{ if(s.length<=SLOT_CAP-3) s.forEach(b=>{ if(!b.tilted) cand.push(b); }); }));
  shuffle(cand); cand.slice(0,n).forEach(b=>b.tilted=true);
  if(S.mode==='shelf') render(); else renderTabs();
}
function newBooksArrive(){
  const n=rnd(5,7);
  for(let i=0;i<n;i++){
    const ci=Math.random()<0.6?2:rnd(0,1), cls=pick(CASES[ci].classes);
    const b=makeBook(cls, maxSerial(cls)+1+S.desk.newTruck.filter(x=>x.cls===cls).length, {isNew:true, source:'신착'});
    b.scanned=true; S.desk.newTruck.push(b);
  }
  S.flags.newCame=true; sfx.ding();
  log(`🆕 신착 전용 북트럭 도착 (${n}권)! 입구·레일 이송기에서 카트에 싣고 배가하자.`,'info');
  render();
}
function hourly(){
  const F=S.desk.floorBin;
  if(F.length){ log(`📦 레일 이송기가 다른 자료실 책 ${F.length}권을 실어 갔다.`,''); F.length=0; }
  render();
}
function tasksTick(){
  let changed=false;
  for(const t of S.tasks){
    if(t.done||t.failed) continue;
    if(!t.announced && S.min>=t.start){
      t.announced=true; changed=true;
      if(t.id==='shift'){ crowdShelf(S.shiftTask.ci); log(`사서님: "${CASES[S.shiftTask.ci].name}가 너무 빽빽해요. 책 좀 땡겨서 공간 확보하고 라벨도 새로 붙여 주세요."`,'warn'); }
      if(t.start>hhmm(9)){ sfx.ping(); log(`📋 새 업무: ${t.label} (${fmtTime(t.due)}까지)`,'info'); }
    }
    if(S.min>=t.start && t.check()){ t.done=true; changed=true; S.rep=Math.min(100,S.rep+2); sfx.done(); log(`✅ 완료: ${t.label}`,'good'); }
    else if(S.min>t.due){ t.failed=true; changed=true; S.rep-=pen(5); sfx.err(); log(`❌ 시간 초과: ${t.label} (신뢰도 -${pen(5)})`,'bad'); }
  }
  const tk=Math.floor(S.min/5);
  if(changed || tk!==S.taskTick){ S.taskTick=tk; renderTasks(); renderTabs(); }
}

// ----- 화면 -----
function badges(loc){
  switch(loc){
    case 'desk': { const P=S.desk, n=P.pile.length+P.pad.length; return `<span class="badge ${n>PILE_WARN?'hot':''}">${n}</span>${P.printer.looked&&P.printer.paper<=0?'<span class="badge hot">🖨</span>':''}`; }
    case 'shelf': { const t=tiltedCount(); return `<span class="badge ${S.cart.length>=CART_MAX?'hot':''}">🛒${S.cart.length}</span>${t?`<span class="badge">↗${t}</span>`:''}`; }
    case 'entrance': { const a=S.ent.auto.length, e=S.ent.lift.length, nw=S.desk.newTruck.length; return `<span class="badge ${a>=AUTO_CAP-3?'hot':''}">${a}</span>${e?`<span class="badge ${e>=LIFT_CAP-2?'hot':''}">📦${e}</span>`:''}${nw?`<span class="badge hot">🆕${nw}</span>`:''}`; }
    case 'corner': return S.tasks.some(t=>t.loc==='corner'&&!t.done&&!t.failed&&S.min>=t.start) ? '<span class="badge hot">!</span>' : '';
    case 'dock': { const K=S.dock; return `${K.porter==='here'?'<span class="badge hot">🚚</span>':''}${K.belt.stop?'<span class="badge hot">⛔</span>':''}${K.inb.length?`<span class="badge">${K.inb.length}</span>`:''}`; }
    case 'rest': return `<span class="badge">빈자리 ${S.seats.filter(s=>!s).length}</span>`;
  }
  return '';
}
function renderTabs(){
  if(!S) return;
  $('#tabs').innerHTML = Object.entries(LOCS).map(([k,L])=>
    `<button data-a="go" data-loc="${k}" class="${S.mode===k?'on':''}">${L.ico} ${L.name}${badges(k)}<kbd>${L.key.toUpperCase()}</kbd></button>`).join('');
}
function renderTasks(){
  if(!S) return;
  const rows=S.tasks.map(t=>{
    let st,cls;
    if(t.done){ st='✅'; cls='done'; } else if(t.failed){ st='❌'; cls='failed'; }
    else if(S.min<t.start){ st='⏳'; cls='later'; }
    else if(t.due-S.min<20){ st='⏰'; cls='urgent'; } else { st='▶'; cls='now'; }
    return `<div class="task ${cls}" data-a="go" data-loc="${t.loc}" title="클릭하면 ${LOCS[t.loc].name}(으)로 이동"><span class="st">${st}</span>
      <div><b>${t.label}</b><small>${fmtTime(t.start)}–${fmtTime(t.due)} · ${LOCS[t.loc].ico} ${LOCS[t.loc].name}</small></div></div>`;
  }).join('');
  $('#tasks').innerHTML = `<h3>📋 오늘의 업무</h3><div class="date">${fmtDate(S.date)} · 근무 ${S.day}일차</div>${rows}
    <div class="always"><b>상시 업무</b><br>반납 처리 · 배가 · 자동반납기 비우기 · 기울어진 책 세우기 · 프린터 용지 · 틈틈이 휴식</div>${perkBar()}`;
}
function render(){
  if(!S) return;
  renderTabs(); renderTasks();
  $('#view').innerHTML = VIEWS[S.mode]();
}
function hud(){
  $('#clock').textContent=fmtTime(S.min);
  $('#date').textContent=fmtDate(S.date);
  const p=patrons();
  $('#patrons').textContent=p;
  $('#crowd').textContent = p>85?'🔥 붐빔':p>55?'😐 많음':'🙂 한산';
  $('#bSta').style.width=S.sta+'%'; $('#bBack').style.width=S.back+'%'; $('#bRep').style.width=S.rep+'%';
  $('#done').textContent=S.processed; $('#shelved').textContent=S.shelved;
  $('#dday').textContent=`소집해제 D-${getDday()}`;
  funHud();
  const b=performance.now()<S.lock;
  document.body.classList.toggle('isbusy',b);
  $('#busy').style.display=b?'block':'none';
  if(b) $('#busy').textContent=S.busyLabel;
}

// ----- 시작 / 퇴근 화면 -----
function diffPicker(){
  return `<div class="diffs">${Object.entries(DIFFS).map(([k,v])=>`<button class="diff ${k===DIFF?'on':''}" data-a="diff" data-d="${k}"><b>${v.name}</b><small>${v.desc}</small></button>`).join('')}</div>`;
}
function showStart(){
  const d=getDday(), date=dateOfDay(365-d+1);
  $('#overlay').className='';
  $('#overlay').innerHTML=`<div class="card">
    <h1>📚 도서관 공익 시뮬레이터</h1>
    <p style="margin-top:0;color:var(--muted)">공익 사서보조 타임 매니지먼트 · ${fmtDate(date)} · 09:00 출근 → 18:00 퇴근</p>${perkBar()}
    <h2>하루 흐름</h2>
    <ul>
      <li><b>오전</b> — 🚪 자동반납기·천장 레일 이송기 책을 데스크로 → 🖨 프린터 용지 확인 → 📱 AR·영어 태블릿 배치 → 🗞 신문 → 📰 잡지(1일·15일)</li>
      <li><b>오후</b> — 🧵 타관도서 묶기 → 🚚 포터 상차(도서관 이름 잘 보기!)·하차 → 🏭 지하 컨베이어(✂ 끈 제거) → 📟 근무실 반납기 스캔 → 📐 기울어진 책 세우기</li>
      <li><b>재미</b> — 🔥 일을 연달아 해내면 <b>콤보</b>로 점수가 올라가요 · 🧒 이용자 돌발 상황은 <kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd>로 골라요 · 🎒 단체 방문 때는 점수 ×1.5 · 🎁 퇴근하면 아이템 장만</li>
      <li><b>상시</b> — 📟 반납기는 <b>한 번에 5권</b> 스캔 (🔖 책갈피 끼면 오류) · 📚 청구기호 순서대로 배가 · 🆕 신착 전용 북트럭(화·금) · ↔ 책 땡기기(칸 끝번호 5·0)와 라벨링</li>
    </ul>
    <p>오른쪽 <b>업무 시간표</b>를 보고 장소를 옮겨 다니세요. 지하는 엘리베이터라 이동이 오래 걸려요. 허리가 아프고 지치면 느려지고, 실수하거나 시간을 넘기면 사서님 신뢰도가 떨어져요.</p>
    <h2>조작</h2>
    <p><kbd>Q</kbd><kbd>W</kbd><kbd>E</kbd><kbd>R</kbd><kbd>T</kbd><kbd>Y</kbd> 장소 이동 · 데스크: <kbd>Space</kbd> 올리기/스캔 <kbd>B</kbd> 책갈피 <kbd>1</kbd>~<kbd>3</kbd> 분류 · <kbd>M</kbd> 음악 <kbd>N</kbd> 효과음</p>
    <h2>난이도</h2>${diffPicker()}
    <div style="text-align:center;margin-top:18px"><button class="big-btn" data-a="start">출근하기 (소집해제 D-${d})</button></div>
  </div>`;
}
function endDay(complete){
  S.running=false; renderEvent(); musicStop(); complete ? sfx.win() : sfx.lose();
  for(const t of S.tasks) if(!t.done) t.failed=true;
  const done=S.tasks.filter(t=>t.done).length;
  const left=S.desk.pile.length+S.desk.pad.length+S.ent.auto.length+S.ent.lift.length+S.ent.liftQueue.length;
  const tilted=tiltedCount();
  const pts = S.score + Math.round(S.rep*2) - left*3 - S.cart.length*3 - tilted*5;
  const mult={easy:0.8, normal:1, hard:1.25}[DIFF], score=Math.round(pts*mult);
  let grade, comment;
  if(!complete){ grade='F'; comment='사서님께 조용히 불려갔다… 내일은 잘하자.'; }
  else if(score>=1500){ grade='S'; comment='사서님: "공익 맞아요? 정규직 하실래요?"'; }
  else if(score>=1100){ grade='A'; comment='오늘 꽤 잘했다. 퇴근길 발걸음이 가볍다.'; }
  else if(score>=750){ grade='B'; comment='평범하게 무사한 하루. 그게 제일 어렵다.'; }
  else { grade='C'; comment='내일의 내가 어떻게든 하겠지…'; }
  let d=getDday(); if(complete && d>0){ d--; setDday(d); }
  const offer=perkOffer(complete,d);
  const tasks=S.tasks.map(t=>`<div class="${t.done?'ok':'no'}">${t.done?'✅':'❌'} ${t.label}</div>`).join('');
  const found=S.found.length ? `<div class="found">${S.found.map(f=>`<span>${f}</span>`).join('')}</div>` : '<p style="color:var(--muted)">오늘은 아무것도 안 나왔다.</p>';
  $('#overlay').className='';
  $('#overlay').innerHTML=`<div class="card">
    <h1>${complete?'🌇 18:00 퇴근!':'😱 근무 중단'}</h1><p style="margin:0;color:var(--muted)">${fmtDate(S.date)} · 난이도 ${D().name}</p>
    <div class="grade" style="color:${grade==='F'?'var(--bad)':'var(--wood)'}">${grade}</div>
    <p style="text-align:center;font-weight:700">${comment}</p>
    <h2>📋 업무 ${done}/${S.tasks.length}</h2><div class="tasklist">${tasks}</div>
    <h2>📊 기록</h2>
    <div class="res">
      <span>반납 처리</span><b>${S.processed}권</b>
      <span>서가에 꽂은 책</span><b>${S.shelved}권</b>
      <span>포터로 보낸 타관도서</span><b>${S.shipped}권</b>
      <span>실수</span><b>${S.mistakes}회</b>
      <span>최고 콤보</span><b>🔥 ${S.bestCombo}</b>
      <span>돌발 상황 잘 대처</span><b>${S.evGood}/${S.evAll}</b>
      <span>사서님 신뢰도</span><b>${Math.round(S.rep)}</b>
      <span>최고 허리 통증</span><b>${Math.round(S.maxBack)}%</b>
      <span>내일로 미룬 책</span><b>${left+S.cart.length}권</b>
      <span>남은 기울어진 책</span><b>${tilted}권</b>
      <span><b>점수</b> (난이도 ×${mult})</span><b>${score}</b>
    </div>
    <h2>🔖 오늘의 분실물함 (${S.found.length})</h2>${found}
    <div style="text-align:center;margin-top:20px">
      ${d===0&&complete ? `<p style="font-size:18px;font-weight:800">🎉 소집해제! 그동안 수고 많으셨습니다.</p><button class="big-btn" data-a="reset">처음부터 (D-365)</button>`
        : `${offer}${diffPicker()}<button class="big-btn" style="margin-top:12px" data-a="start" ${perkChoices.length?'disabled':''}>다음 날 출근 (D-${d})</button>${perkChoices.length?'<p class="perkhint">아이템을 하나 골라야 출근할 수 있어요</p>':''}`}
    </div></div>`;
}

// ----- 입력 -----
document.addEventListener('click',e=>{
  initAudio();
  const el=e.target.closest('[data-a]'); if(!el || el.disabled) return;
  const a=el.dataset.a, d=el.dataset, id=+d.id;
  if(a==='music'){ setAudio('music',!AUDIO.music); return; }
  if(a==='sfxt'){ setAudio('sfx',!AUDIO.sfx); sfx.click(); return; }
  if(a==='diff'){ sfx.click(); setDiff(d.d); document.querySelectorAll('.diff').forEach(b=>b.classList.toggle('on',b.dataset.d===DIFF)); return; }
  if(a==='perk'){ pickPerk(d.k); return; }
  if(a==='start'){ $('#overlay').className='hide'; newDay(); return; }
  if(a==='reset'){ setDday(365); setPerks([]); showStart(); return; }
  if(!S || !S.running) return;
  if(a==='evc'){ eventChoose(+d.i); return; }
  if(a==='go'){ go(d.loc); return; }
  if(performance.now()<S.lock) return;
  const f=ACTIONS[a]; if(!f) return;
  f(d,id); render();
});
document.addEventListener('keydown',e=>{
  initAudio();
  const k=e.key.toLowerCase();
  if(k==='m'){ setAudio('music',!AUDIO.music); return; }
  if(k==='n'){ setAudio('sfx',!AUDIO.sfx); return; }
  if(!S || !S.running) return;
  const loc=Object.keys(LOCS).find(x=>LOCS[x].key===k);
  if(loc){ go(loc); return; }
  if(performance.now()<S.lock) { if(k===' ') e.preventDefault(); return; }
  const f=VIEW_KEYS[S.mode];
  if(f && f(k,e)) render();
});

// ----- 루프 -----
let last=performance.now();
function frame(t){
  // 프레임이 느려도 시간이 밀리지 않도록 0.1초 단위로 따라잡기 (탭을 오래 숨기면 최대 1초만)
  let dt=Math.min(1,(t-last)/1000); last=t;
  while(S && S.running && dt>0){ const step=Math.min(0.1,dt); tick(step); dt-=step; }
  if(S && S.running){ hud(); if(S.mode==='dock') beltPositions(); }
  requestAnimationFrame(frame);
}
function boot(){ DIFF=getDiff(); audioButtons(); showStart(); requestAnimationFrame(frame); }
