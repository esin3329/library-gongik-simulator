'use strict';
// ===== 서가: 배가 · 기울어진 책 세우기 · 책 땡기기 · 서가 라벨링 =====

function spine(b, attrs=''){
  const [a,c] = b.cls.split('.');
  return `<div class="sp h${b.h} ${b.tilted?'tilted':''} ${b.isNew?'isnew':''}" style="--c:${CLASS_COLORS[b.k]}" ${attrs}>
    <span>${a}</span><span>${c?'.'+c:'&nbsp;'}</span><span class="ser">${b.serial}</span></div>`;
}
const tiltedCount = ci => (ci==null ? S.shelves.flatMap(s=>s.slots.flat()) : allShelfBooks(ci)).filter(b=>b.tilted).length;
const fullSlots = ci => S.shelves[ci].slots.filter(s=>s.length>=SLOT_CAP).length;

function shiftStatus(ci){
  const sh=S.shelves[ci], bounds=[], over=[]; let ok=true;
  for(let k=0;k<4;k++){ const s=sh.slots[k], last=s[s.length-1]; const good=endsOk(last); bounds.push({last,good}); if(!good) ok=false; }
  for(let k=0;k<5;k++){ const o=sh.slots[k].length > SLOT_CAP-SLOT_ROOM; over.push(o); if(o) ok=false; }
  return {bounds, over, ok};
}
const shelfClean = ci => shiftStatus(ci).ok && !S.shelves[ci].dirty.some(Boolean);

// 책 땡기기로 풀 수 있는 배치인지 확인 (칸 경계 4개를 끝번호 5·0인 책에서, 칸마다 최대 SLOT_CAP-SLOT_ROOM권)
function shiftSolvable(ci){
  const seq=allShelfBooks(ci), n=seq.length, M=SLOT_CAP-SLOT_ROOM;
  let ends=new Set([-1]);
  for(let k=0;k<4;k++){
    const next=new Set();
    for(const p of ends) for(let j=p+1;j<=Math.min(n-2,p+M);j++) if(endsOk(seq[j])) next.add(j);
    ends=next;
  }
  for(const j of ends) if(n-1-j<=M) return true;
  return false;
}
// 반납이 한꺼번에 몰려서 서가가 빽빽해짐 (책 땡기기 업무의 원인)
function crowdShelf(ci){
  const sh=S.shelves[ci], si=rnd(1,3), added=[];
  const mine = S.loans.filter(b=>caseOfCls(b.cls)===ci && [si,si+1].includes(correctSlot(ci,b)));
  for(const b of mine){ if(added.length>=6) break; const at=correctSlot(ci,b); if(sh.slots[at].length>=SLOT_CAP) continue;
    S.loans.splice(S.loans.indexOf(b),1); b.tilted=false; insertSorted(ci,at,b); added.push(b); }
  // 그래도 여유가 있으면 신착을 몇 권 더
  const cls = sh.slots[si][0]?.cls;
  while(cls && sh.slots[si].length < SLOT_CAP-1 && added.length<8){
    const b=makeBook(cls, maxSerial(cls)+1); const at=correctSlot(ci,b);
    if(sh.slots[at].length>=SLOT_CAP) break; insertSorted(ci,at,b); added.push(b);
  }
  // 풀 수 없는 배치면 풀릴 때까지 한 권씩 되돌림
  while(added.length && !shiftSolvable(ci)){
    const b=added.pop();
    for(const s of sh.slots){ const i=s.indexOf(b); if(i>=0){ s.splice(i,1); break; } }
    S.loans.push(b);
  }
}

// ----- 화면 -----
VIEWS.shelf = ()=>{
  const ci=S.caseView, sh=S.shelves[ci];
  const caseTabs = CASES.map((c,i)=>{
    const t=tiltedCount(i), f=fullSlots(i), dirty=S.shelves[i].dirty.some(Boolean);
    return `<button class="casetab ${i===ci?'on':''}" data-a="case" data-i="${i}"><b>${c.name}</b><small>${c.range}</small>
      ${t?`<span class="badge">↗${t}</span>`:''}${f?`<span class="badge hot">꽉참</span>`:''}${dirty?`<span class="badge hot">🏷</span>`:''}</button>`;
  }).join('');
  const sel = S.cart.find(b=>b.id===S.sel);
  const st = S.shiftMode ? shiftStatus(ci) : null;
  let rows='';
  sh.slots.forEach((slot,si)=>{
    const R=SLOT_ROWS[si], L=sh.labels[si];
    let html='';
    for(let i=0;i<=slot.length;i++){
      if(sel && !S.shiftMode) html+=`<div class="slot" data-a="slot" data-s="${si}" data-i="${i}" title="여기에 꽂기"></div>`;
      if(i<slot.length){
        const b=slot[i];
        html+= spine(b, b.tilted && !S.shiftMode ? `data-a="tilt" data-s="${si}" data-i="${i}" title="기울어진 책 — 클릭해서 세우기"` : '');
      }
    }
    for(let i=slot.length;i<SLOT_CAP;i++) html+=`<div class="gap"></div>`;
    const cnt = slot.length, overRoom = cnt>SLOT_CAP-SLOT_ROOM;
    rows+=`<div class="row">
      <div class="rowlabel">
        <div class="plate ${sh.dirty[si]?'dirty':''}" ${sh.dirty[si]?`data-a="label" data-s="${si}" title="클릭해서 라벨 다시 출력·부착"`:''}>${sh.dirty[si]?'🏷 라벨 교체 필요':L.txt}</div>
        <span class="h ${R.cls}">${R.h}</span> <span class="cnt ${cnt>=SLOT_CAP?'full':overRoom&&S.shiftMode?'warn':''}">${cnt}/${SLOT_CAP}</span>
      </div>
      <div class="rowbooks">${html}</div></div>`;
    if(S.shiftMode && si<4){
      const bd=st.bounds[si];
      rows+=`<div class="bound ${bd.good?'good':'bad'}">
        <span>칸 ${si+1} 끝: <b>${bd.last?callNo(bd.last):'(비었음)'}</b> ${bd.good?'✅':'❌ 끝번호가 5나 0이어야 해요'}</span>
        <span><button class="sm-btn" data-a="shdown" data-s="${si}" title="칸 ${si+1}의 마지막 책을 아래 칸 앞으로">⬇ 아래 칸으로 넘기기</button>
        <button class="sm-btn" data-a="shup" data-s="${si}" title="칸 ${si+2}의 첫 책을 위 칸 끝으로">⬆ 위 칸으로 당기기</button></span></div>`;
    }
  });

  let side;
  if(S.shiftMode){
    const dirtyN=sh.dirty.filter(Boolean).length;
    side=`<div class="panel"><h3><span>↔ 책 땡기기 모드</span></h3>
      <div class="tip" style="margin-top:0">각 칸의 <b>마지막 책 끝번호가 5나 0</b>이 되도록 경계를 옮기세요. (예: 813.8-160 / 813.8-165에서 끊기)<br>
      그리고 칸마다 <b>${SLOT_ROOM}권 이상 여유</b>가 있어야 해요 (최대 ${SLOT_CAP-SLOT_ROOM}권).</div>
      <div class="checks">
        <div class="${st.bounds.every(b=>b.good)?'ok':''}">${st.bounds.every(b=>b.good)?'✅':'⬜'} 경계 끝번호 5·0</div>
        <div class="${st.over.every(o=>!o)?'ok':''}">${st.over.every(o=>!o)?'✅':'⬜'} 칸마다 여유 공간</div>
        <div class="${!dirtyN?'ok':''}">${!dirtyN?'✅':'⬜'} 서가 라벨 ${dirtyN?`(${dirtyN}칸 교체 필요)`:''}</div>
      </div>
      <div class="tip">경계를 다 맞춘 뒤, 빨간 라벨을 클릭하면 새 라벨을 출력해서 붙여요.</div>
      <button class="big-btn" data-a="shiftMode">완료하고 나가기</button></div>`;
  } else {
    const cart = S.cart.length ? S.cart.map(b=>bookCard(b,'sel',b.id===S.sel?'sel':'')).join('')
      : `<div class="empty">카트가 비었어요.<br>데스크(Q)에서 분류한 책이 여기로 와요.</div>`;
    let hint='카트에서 책을 골라 청구기호 순서에 맞는 자리(노란 점선)에 꽂으세요.';
    if(sel){ const tc=caseOfCls(sel.cls); hint = tc!==ci ? `<b>${callNo(sel)}</b>은(는) <b>${CASES[tc].name}</b> 책이에요. 위에서 서가를 바꾸세요.`
      : `<b>${callNo(sel)}</b> 선택됨 → 분류번호 순, 같으면 일련번호 순. 칸 라벨의 범위도 확인!`; }
    side=`<div class="panel"><h3><span>🛒 북카트</span><span>${S.cart.length}/${CART_MAX}</span></h3>
      <div class="cartlist">${cart}</div>
      <div class="tip">${hint}<br>↗ 기울어진 책은 클릭해서 세우기.<br>칸이 꽉 차면 <b>책 땡기기</b>로 공간을 만들어요.</div>
      <button class="wide-btn" data-a="shiftMode">↔ ${CASES[ci].name} 책 땡기기 · 라벨링</button></div>`;
  }
  return `<div class="casetabs">${caseTabs}</div>
    <div class="shelfwrap"><div class="bookcase ${S.shiftMode?'shifting':''}">${rows}</div>${side}</div>`;
};

// ----- 행동 -----
ACTIONS.case = d => { S.caseView=+d.i; S.shiftMode=false; sfx.click(); };
ACTIONS.sel = (d,id) => { S.sel = S.sel===id ? null : id; const b=S.cart.find(x=>x.id===id); if(b && S.sel){ const tc=caseOfCls(b.cls); if(tc>=0 && tc!==S.caseView){ S.caseView=tc; } } };
ACTIONS.shiftMode = () => { S.shiftMode=!S.shiftMode; S.sel=null; sfx.click(); };

ACTIONS.slot = d => {
  const ci=S.caseView, si=+d.s, i=+d.i;
  const b=S.cart.find(x=>x.id===S.sel); if(!b) return;
  const pre=checkInsert(ci,si,i,b);
  if(pre==='dirty'){ sfx.err(); log('라벨이 안 맞는 칸이 있어요. 책 땡기기 모드에서 라벨부터 붙이세요!','warn'); return; }
  const extra=(si===0||si===4)?350:0;
  busy(delay()+extra, si===0?'🦶 까치발 드는 중…':si===4?'🧎 쭈그려 앉는 중…':'📚 꽂는 중…', ()=>{
    S.back += SLOT_ROWS[si].back*D().back*(1+S.back/150); S.sta -= 0.8+(extra?0.6:0);
    if(si===0||si===4) setTimeout(sfx.ouch,120);
    const r=checkInsert(ci,si,i,b);
    if(r==='ok'){
      S.shelves[ci].slots[si].splice(i,0,b); S.cart=S.cart.filter(x=>x!==b); S.sel=null; S.shelved++; sfx.shelf();
      if(si===4 && Math.random()<0.3) log(pick(['끄응… 아랫칸은 왜 이렇게 낮아.','무릎에서 소리가 났다.']),'');
      if(si===0 && Math.random()<0.3) log(pick(['까치발! 종아리가 당긴다.','팔이 짧은 게 서럽다.']),'');
    } else if(r==='full'){
      sfx.err(); log(`칸이 꽉 찼다 (${SLOT_CAP}권)! ↔ 책 땡기기로 공간을 만들자.`,'warn');
    } else {
      sfx.err(); S.mistakes++; S.rep-=pen(3);
      const L=S.shelves[ci].labels;
      const msg = r==='case' ? `오배가! ${callNo(b)}은(는) ${CASES[caseOfCls(b.cls)].name} 책이에요.`
        : r==='label' ? `라벨 범위 밖이에요! 이 칸 라벨: ${L[si].txt}`
        : '순서가 틀렸어요! 분류번호 → 일련번호 순서를 확인하세요.';
      log(`${msg} (신뢰도 -${pen(3)})`,'bad');
    }
  });
};
ACTIONS.tilt = d => {
  const ci=S.caseView, si=+d.s, b=S.shelves[ci].slots[si][+d.i]; if(!b||!b.tilted) return;
  busy(delay()*0.6,'📐 책 세우는 중…',()=>{ b.tilted=false; S.back+=SLOT_ROWS[si].back*0.3*D().back; sfx.drop(); });
};
function shiftMove(si, down){
  const ci=S.caseView, sh=S.shelves[ci], a=sh.slots[si], c=sh.slots[si+1];
  if(down ? !a.length : !c.length) return;
  if(down ? c.length>=SLOT_CAP : a.length>=SLOT_CAP){ sfx.err(); log('옮길 칸이 꽉 차 있어요.','warn'); return; }
  const hurt = [si,si+1].some(k=>k===0||k===4);
  busy(delay()*0.7+(hurt?150:0), down?'⬇ 책 넘기는 중…':'⬆ 책 당기는 중…', ()=>{
    if(down) c.unshift(a.pop()); else a.push(c.shift());
    sh.dirty[si]=true; sh.dirty[si+1]=true;
    S.back += (hurt?3:0.5)*D().back; S.sta-=0.3; sfx.drop();
  });
}
ACTIONS.shdown = d => shiftMove(+d.s,true);
ACTIONS.shup   = d => shiftMove(+d.s,false);
ACTIONS.label = d => {
  const ci=S.caseView, si=+d.s, sh=S.shelves[ci];
  const st=shiftStatus(ci);
  if(!st.bounds.every(b=>b.good)){ sfx.err(); log('칸 경계(끝번호 5·0)를 먼저 맞추세요. 라벨은 마지막에!','warn'); return; }
  busy(delay()+500,'🏷 라벨 출력·부착 중…',()=>{
    sh.labels[si]=mkLabel(sh.slots[si], si===4); sh.dirty[si]=false; sfx.ok();
    if(!sh.dirty.some(Boolean)) log(`🏷 ${CASES[ci].name} 라벨링 끝! 공간 확보 완료.`,'good');
  });
};
