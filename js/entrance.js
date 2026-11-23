'use strict';
// ===== 입구: 1층 자동반납기 · 천장 레일 이송기 · 신착 전용 북트럭 =====
const AUTO_CAP = 20;
const LIFT_CAP = 12;    // 이송기 수령함 크기

// 천장 레일 이송기: 다른 층에서 반납된 어린이실 책이 자동으로 내려온다
function liftSchedule(){
  const t=[hhmm(9,20)]; let m=hhmm(9,20);
  while((m+=rnd(40,60)) < hhmm(17,10)) t.push(m);
  return t;
}
function liftArrives(first){
  const E=S.ent, n = first ? rnd(6,9) : rnd(2,4);
  for(let i=0;i<n;i++) E.liftQueue.push(withBm(loanBook('이송기'), D().bm*0.6));
  liftDeliver(true);
}
function liftDeliver(announce){
  const E=S.ent; let n=0;
  while(E.liftQueue.length && E.lift.length<LIFT_CAP){ E.lift.push(E.liftQueue.shift()); n++; }
  if(n && announce){ E.lastLift=performance.now(); sfx.whirr(); setTimeout(sfx.ding,1300); log(`📦 천장 레일 이송기로 어린이실 책 ${n}권이 내려왔다. (입구·레일 이송기)`,'info'); }
  if(E.liftQueue.length && !S.flags.liftFull){ S.flags.liftFull=true; sfx.alarm(); log('📦 이송기 수령함이 꽉 차서 이송이 멈췄다! 비워 주자.','warn'); }
  if(S.mode==='entrance') render(); else renderTabs();
}

// 천장 레일: 캐리어가 레일을 따라 계속 지나가고, 도착하면 하나가 정류장에서 내려온다
// (다시 그려도 애니메이션이 처음부터 시작하지 않도록 현재 시각으로 위상을 맞춤)
const RAIL_LOOP = 8;
function railView(){
  const now=performance.now()/1000, ph=now%RAIL_LOOP;
  const since=(performance.now()-(S.ent.lastLift||-1e9))/1000;
  const stopped = S.ent.liftQueue.length>0;
  const pass = [0,RAIL_LOOP/2].map(o=>`<div class="carrier pass ${stopped?'paused':''}" style="animation-delay:-${(ph+o).toFixed(2)}s"><i></i>📦</div>`).join('');
  const drop = since<3 ? `<div class="carrier drop" style="animation-delay:-${since.toFixed(2)}s"><i></i>📚</div>` : '';
  return `<div class="rail ${stopped?'stopped':''}"><div class="track"></div>${pass}${drop}
    <div class="station">▼ 어린이실 정류장</div></div>`;
}

VIEWS.entrance = ()=>{
  const A=S.ent.auto, E=S.ent.lift, N=S.desk.newTruck;
  const stack = arr => arr.slice(0,24).map(b=>`<div class="mini-sp" style="--c:${CLASS_COLORS[b.k]}"></div>`).join('');
  const nextLift = S.ent.liftAt[0];
  return `<div class="two">
    <div class="panel"><h3><span>📥 1층 자동반납기</span><span class="${A.length>=AUTO_CAP-3?'hotx':''}">${A.length}/${AUTO_CAP}</span></h3>
      <div class="machine"><div class="slotmouth">반납구 ▶</div><div class="stackbox">${stack(A)||'<small>비어 있음</small>'}</div></div>
      ${carryButtons('moveAuto', A.length)}
      <div class="tip">밤사이 반납된 책이 아침에 가득 쌓여 있어요. 낮에도 이용자들이 계속 넣으니 틈틈이 비워 주세요.<br>꽉 차면(${AUTO_CAP}권) 이용자들이 데스크로 몰려와요.</div>
    </div>
    <div class="panel"><h3><span>📦 천장 레일 이송기 수령함</span><span class="${E.length>=LIFT_CAP-2?'hotx':''}">${E.length}/${LIFT_CAP}</span></h3>
      ${railView()}
      <div class="machine elev"><div class="slotmouth">📥</div><div class="stackbox">${stack(E)||'<small>비어 있음</small>'}</div></div>
      ${carryButtons('moveLift', E.length)}
      <div class="tip">다른 층에서 반납된 어린이실 책이 이송기로 자동으로 내려와요.${nextLift?` 다음 도착 예정: <b>${fmtTime(nextLift)}</b>쯤`:''}<br>
        수령함이 꽉 차면 이송이 멈춰요.${S.ent.liftQueue.length?` <b class="hotx">(이송 대기 ${S.ent.liftQueue.length}권)</b>`:''}</div>
    </div>
    <div class="panel"><h3><span>🆕 신착 전용 북트럭</span><span>${N.length}권</span></h3>
      <div class="machine elev"><div class="slotmouth">🆕</div><div class="stackbox">${stack(N)||`<small>${S.newDay?(S.flags.newCame?'다 실었어요':'11:00쯤 도착'):'오늘은 신착 없는 날 (화·금)'}</small>`}</div></div>
      <button class="big-btn" data-a="newtake" ${N.length?'':'disabled'}>🛒 북카트에 싣기</button>
      <div class="tip">정리실에서 등록을 마친 신착 도서가 전용 북트럭으로 와요. 스캔 없이 바로 카트에 실어 배가하면 돼요.</div>
    </div></div>`;
};

// ----- 나르기: 손으로 (최대 HAND_MAX권) 또는 어린이실 북트럭 (전부) -----
// 어린이실 안에 여분 북트럭이 몇 대 있지만, 다른 근무자가 쓰고 있을 때도 있다.
const HAND_MAX = 10, TRUCK_SPARE = 3;
const handMax = () => HAND_MAX + (hasPerk('arms')?3:0);
const freeTrucks = () => TRUCK_SPARE - S.trucksBusy.length;
function truckTick(){
  const before=S.trucksBusy.length;
  S.trucksBusy=S.trucksBusy.filter(t=>t>S.min);
  if(S.trucksBusy.length<before){ log('🛒 다른 근무자가 쓰던 북트럭이 돌아왔다.',''); renderAny(); }
}
function borrowTruck(){
  if(!freeTrucks()) return;
  S.trucksBusy.push(S.min+rnd(30,70));
  log(`🛒 다른 근무자가 어린이실 북트럭을 가져갔다. (남은 북트럭 ${freeTrucks()}대)`,'warn');
  renderAny();
}
const renderAny = () => { if(S.mode==='entrance'||S.mode==='dock') render(); else renderTabs(); };
function carryButtons(act, n){
  const ft=freeTrucks();
  return `<div class="btnrow">
      <button class="big-btn" data-a="${act}" data-how="hand" ${n?'':'disabled'}>✋ 손으로 (최대 ${handMax()}권)</button>
      <button class="big-btn" data-a="${act}" data-how="truck" ${n&&ft?'':'disabled'}>🛒 북트럭으로 (전부)</button></div>
    <div class="tip">🛒 어린이실 북트럭 <b>${ft}/${TRUCK_SPARE}대</b> 사용 가능${ft?'':' — 다른 근무자가 쓰는 중! 손으로 나르자.'}</div>`;
}
// arr에서 책을 꺼내 옮긴다. done(옮긴 책들, 방법)
function carry(how, arr, done){
  if(!arr.length) return;
  if(how==='truck' && !freeTrucks()){ sfx.err(); log('지금 쓸 수 있는 북트럭이 없다. 손으로 나르자.','warn'); return; }
  const n = how==='hand' ? Math.min(handMax(), arr.length) : arr.length;
  const ms = how==='hand' ? delay()+350+n*60 : delay()+900+n*25;
  busy(ms, how==='hand' ? `✋ 책 ${n}권 들고 가는 중…` : '🛒 어린이실 북트럭 끌고 오는 중…', ()=>{
    const moved=arr.splice(0,n);
    if(how==='hand'){
      S.back += 0.3*n*D().back; S.sta -= 0.2*n;
      if(n>=8 && Math.random()<0.4) log(pick(['그림책은 왜 이렇게 무거워…','팔이 후들거린다.','한 권 떨어뜨릴 뻔했다.']),'');
    } else { S.back += 0.8*D().back; S.sta -= 0.5; }
    sfx.shuffle();
    done(moved, how);
  });
}

ACTIONS.moveAuto = d => carry(d.how, S.ent.auto, moved=>{
  S.desk.pile.push(...moved); if(!S.ent.auto.length) S.flags.autoMoved=true;
  log(`자동반납기 책 ${moved.length}권을 데스크로 옮겼다.${S.ent.auto.length?` (${S.ent.auto.length}권 남음)`:''}`,'good');
});
ACTIONS.moveLift = d => carry(d.how, S.ent.lift, moved=>{
  S.desk.pile.push(...moved); if(!S.ent.lift.length) S.flags.floorMoved=true; S.flags.liftFull=false;
  log(`이송기로 온 책 ${moved.length}권을 데스크로 옮겼다.${S.ent.lift.length?` (${S.ent.lift.length}권 남음)`:''}`,'good');
  liftDeliver(true);
});
