'use strict';
// ===== 지하 하역장: 포터 상차·하차 · 컨베이어 자동반납기 =====
// 컨베이어 분류함: 0 우리 어린이실, 1 종합, 2 인문, 3 디지털, 4 오류함(타관 도서·책갈피)
const BELT_X = [0.2,0.36,0.52,0.68,0.88];
const BELT_SPEED = 0.16;

function makeInbound(){
  const K=S.dock, n=rnd(3,4);
  K.pending=[];
  for(let i=0;i<n;i++){
    const books=[], m=rnd(4,6);
    for(let j=0;j<m;j++){
      let b;
      if(Math.random()<D().wrong) b=foreignBook('타관반납');                       // 잘못 온 책
      else if(Math.random()<0.5) b=loanBook('타관반납');
      else b=randomBook({room:pick(OTHER_ROOMS), source:'타관반납'});
      if(!b.bm) withBm(b, D().bm*0.5);
      books.push(b);
    }
    K.pending.push({id:++uid, from:pick(LIB_KEYS), tied:true, books});
  }
}
function dockTick(dt,dmin){
  const K=S.dock;
  if(K.porter==='before' && S.min>=K.arrive){
    K.porter='here'; makeInbound(); sfx.truck();
    log(`🚚 포터 도착! ${fmtTime(K.leave)}에 떠나요. 상차·하차하러 지하로!`,'warn');
    render();
  }
  if(K.porter==='here' && S.min>=K.leave){
    K.porter='gone'; sfx.truck();
    if(K.out.length) log(`🚚 포터가 떠났다… 못 실은 묶음 ${K.out.length}개는 내일로.`,'bad');
    if(K.pending.length){ log('하차 안 한 책 묶음을 포터가 그대로 싣고 가버렸다!','bad'); K.pending=[]; }
    render();
  }
  beltTick(dt,dmin);
}

// ----- 컨베이어 -----
const beltTarget = b => (b.bm || b.owner!=='home') ? 4 : ROOM_KEYS.indexOf(b.room);
function beltTick(dt,dmin){
  const B=S.dock.belt; let changed=false;
  if(B.stop!=='jam' && B.items.some(it=>!it.bundle) && Math.random()<D().jam*dmin){
    const it=pick(B.items.filter(x=>!x.bundle)); it.jam=3; sfx.clunk(); changed=true; log('⛔ 컨베이어에 책이 걸렸다! (지하 하역장)','bad');
  }
  if(B.items.some(it=>it.jam)){ if(B.stop!=='jam'){ B.stop='jam'; changed=true; } }
  else {
    if(B.stop==='jam'){ B.stop=''; changed=true; }
    let blocked=null;
    for(const it of B.items){
      if(it.x<BELT_X[it.t]) continue;
      if(it.t<4 && B.bins[it.t].length>=D().binCap){ blocked=blocked||it; continue; }
      it.drop=true;
    }
    B.items=B.items.filter(it=>{ if(!it.drop) return true; B.bins[it.t].push(it.b); if(S.mode==='dock') sfx.plop(); changed=true; return false; });
    const was=B.stop==='full';
    B.stop = blocked ? 'full' : '';
    if(blocked && !was){ sfx.err(); log(`⛔ ${ROOMS[ROOM_KEYS[blocked.t]].short} 분류함 가득! 컨베이어 정지.`,'bad'); changed=true; }
    if(!blocked && was) changed=true;
    if(!B.stop){
      for(const it of B.items) it.x=Math.min(BELT_X[it.t], it.x+BELT_SPEED*dt);
      if(B.wait.length && !B.items.some(it=>it.x<0.085)){ const b=B.wait.shift(); B.items.push({id2:++uid,b,x:0,t:beltTarget(b),jam:0}); changed=true; }
    }
  }
  if(changed){ if(S.mode==='dock') render(); else renderTabs(); }
}
function beltPositions(){ for(const it of S.dock.belt.items){ const el=document.getElementById('bi-'+it.id2); if(el) el.style.left=(it.x*100)+'%'; } }
const beltBusy = () => { const B=S.dock.belt; return B.items.length || B.wait.length || B.bins.some(b=>b.length); };

// ----- 화면 -----
VIEWS.dock = ()=>{
  const K=S.dock, B=K.belt, cap=D().binCap;
  let porter;
  if(K.porter==='before') porter=`<div class="porter wait">🚚 포터 도착 예정 <b>${fmtTime(K.arrive)}</b></div>`;
  else if(K.porter==='here') porter=`<div class="porter here">🚚 포터 대기 중 — <b>${fmtTime(K.leave)}</b>에 출발 (남은 ${Math.max(0,Math.ceil(K.leave-S.min))}분)</div>`;
  else porter=`<div class="porter gone">🚚 포터 출발함 (내일 다시 와요)</div>`;
  const here=K.porter==='here';
  const outs = K.out.map(x=>`<div class="bundle ${K.sel===x.id?'sel':''}" data-a="osel" data-id="${x.id}" style="--c:${LIBS[x.lib].color}">🧵 <b>${LIBS[x.lib].name}</b><small>${x.books.length}권</small></div>`).join('')
    || `<small>${S.desk.outBin.length?'데스크에서 타관도서를 먼저 묶어 오세요.':'실을 묶음이 없어요.'}</small>`;
  const boxes = K.order.map(k=>`<button class="lbox" style="--c:${LIBS[k].color}" data-a="obox" data-lib="${k}" ${here?'':'disabled'}><b>${LIBS[k].name}</b><small>${K.loaded[k]||0}묶음</small></button>`).join('');
  const inb = K.inb.map(x=>`<div class="bundle in ${x.tied?'tied':''}" style="--c:${LIBS[x.from].color}">
      <span>${x.tied?'🧵':'📚'} ${LIBS[x.from].name}에서 · ${x.books.length}권</span>
      <span><button class="sm-btn" data-a="cut" data-id="${x.id}" ${x.tied?'':'disabled'}>✂ 끈 제거</button>
      <button class="sm-btn go" data-a="feed" data-id="${x.id}">▶ 투입</button></span></div>`).join('')
    || `<small>${K.porter==='before'?'포터가 오면 하차한 묶음이 여기 놓여요.':'투입할 묶음이 없어요.'}</small>`;
  const items = B.items.map(it=>{
    const lbl = it.bundle ? '🧵 묶음' : callNo(it.b);
    return `<div class="bitem ${it.jam?'jam':''} ${it.bundle?'bundle-item':''}" id="bi-${it.id2}" style="left:${it.x*100}%;--c:${it.bundle?'#7f6a4f':CLASS_COLORS[it.b.k]}" ${it.jam?`data-a="unjam" data-id="${it.id2}" title="클릭해서 빼기"`:''}>${lbl}${it.jam?`<em>×${it.jam}</em>`:''}</div>`;
  }).join('');
  const chuteName = ['우리 어린이실','종합자료실','인문자료실','디지털자료실','⚠ 오류함'];
  const chuteSub  = ['→ 데스크 반납기로','→ 이송기로 발송','→ 이송기로 발송','→ 이송기로 발송','→ 데스크로'];
  const chutes = BELT_X.map((x,i)=>{ const n=B.bins[i].length, full=i<4&&n>=cap;
    return `<button class="chute ${i===4?'rej':''} ${full?'full':''}" style="left:${x*100}%" data-a="dbin" data-i="${i}" ${n?'':'disabled'}>
      <b>${chuteName[i]}</b><span class="n">${i===4?n+'권':n+'/'+cap}</span><small>${chuteSub[i]}</small></button>`; }).join('');
  const status = B.stop==='jam' ? '⛔ 정지: 걸린 것을 여러 번 클릭해서 빼세요.' : B.stop==='full' ? '⛔ 정지: 가득 찬 분류함을 비우세요.' : beltBusy() ? '✅ 가동 중' : '💤 대기 중';
  return `${porter}
  <div class="two">
    <div class="panel"><h3><span>⬆ 상차: 타관도서 묶음 → 도서관별 분류함</span></h3>
      <div class="row-wrap">${outs}</div>
      <div class="sub">포터 차량 분류함 ${here?'':'(포터가 있을 때만)'}</div>
      <div class="lboxes">${boxes}</div>
      <div class="tip">묶음을 고르고 <b>꼭 맞는 도서관</b> 분류함에 넣으세요. 이름이 비슷하니 끝까지 읽기!</div></div>
    <div class="panel"><h3><span>⬇ 하차: 타관에서 온 우리 도서관 책</span></h3>
      ${here&&K.pending.length?`<button class="big-btn" data-a="unload">📥 하차하기 (묶음 ${K.pending.length}개)</button>`:''}
      <div class="sub">지하 자동반납기로 넣을 묶음</div>
      <div class="col">${inb}</div>
      <div class="tip"><b>끈을 먼저 제거</b>하고 투입하세요. 끈째로 넣으면 컨베이어가 걸려요!</div></div>
  </div>
  <div class="panel"><h3><span>🏭 지하 자동반납기 컨베이어</span><span class="scanmsg ${B.stop?'bad':'good'}" style="margin:0">${status}</span></h3>
    <div class="beltbox"><div class="feeder">📥<small>투입구</small><small>대기 ${B.wait.length}</small></div>
      <div class="belt ${B.stop?'stopped':''}">${items}</div><div class="chutes">${chutes}</div></div>
    <div class="tip">우리 어린이실 분류함은 어린이실 북트럭에 실어(없으면 손으로 최대 10권) <b>데스크 반납기에서 스캔</b>해야 해요. 다른 자료실 분류함은 레일 이송기로 보내요.</div></div>`;
};

// ----- 행동 -----
ACTIONS.osel = (d,id) => { S.dock.sel = S.dock.sel===id ? null : id; sfx.click(); };
ACTIONS.obox = d => {
  const K=S.dock, x=K.out.find(o=>o.id===K.sel); if(!x) return;
  if(K.porter!=='here'){ sfx.err(); log('포터가 없어요.','warn'); return; }
  if(x.lib!==d.lib){ sfx.err(); S.mistakes++; S.rep-=pen(5); log(`앗! ${LIBS[x.lib].name} 묶음을 ${LIBS[d.lib].name} 분류함에 넣을 뻔했다. (신뢰도 -${pen(5)})`,'bad'); return; }
  busy(delay()+350,'📦 분류함에 싣는 중…',()=>{
    K.out=K.out.filter(o=>o!==x); K.sel=null; K.loaded[x.lib]=(K.loaded[x.lib]||0)+1; S.shipped+=x.books.length;
    S.back+=1.5*D().back; sfx.shelf(); log(`⬆ ${LIBS[x.lib].name} 분류함에 ${x.books.length}권 상차.`,'good');
  });
};
ACTIONS.unload = () => {
  const K=S.dock; if(!K.pending.length) return;
  busy(delay()+900,'📥 하차 중…',()=>{
    K.inb.push(...K.pending); K.pending=[]; K.unloaded=true; S.back+=3*D().back; sfx.shuffle();
    log('📥 하차 완료. 끈 풀어서 지하 자동반납기에 넣자.','good');
  });
};
ACTIONS.cut = (d,id) => {
  const x=S.dock.inb.find(o=>o.id===id); if(!x||!x.tied) return;
  busy(delay()+300,'✂ 끈 자르는 중…',()=>{ x.tied=false; sfx.click(); });
};
ACTIONS.feed = (d,id) => {
  const K=S.dock, x=K.inb.find(o=>o.id===id); if(!x) return;
  const B=K.belt;
  if(x.tied){
    K.inb=K.inb.filter(o=>o!==x);
    B.items.push({id2:++uid, bundle:x, b:x.books[0], x:0.06, t:0, jam:5});
    sfx.clunk(); S.mistakes++; S.rep-=pen(3);
    log(`⛔ 끈째로 넣었다! 컨베이어가 걸렸다. 여러 번 클릭해서 빼내자. (신뢰도 -${pen(3)})`,'bad');
    return;
  }
  busy(400,'▶ 투입 중…',()=>{ K.inb=K.inb.filter(o=>o!==x); B.wait.push(...x.books); sfx.drop(); });
};
ACTIONS.unjam = (d,id) => {
  const B=S.dock.belt, it=B.items.find(x=>x.id2===id); if(!it||!it.jam) return;
  busy(delay(),'🔧 걸린 것 빼는 중…',()=>{
    it.jam--; S.sta-=0.3;
    if(it.jam>0){ sfx.thud(); return; }
    if(it.bundle){ B.items=B.items.filter(x=>x!==it); it.bundle.tied=false; S.dock.inb.unshift(it.bundle); log('끈을 끊어서 묶음을 빼냈다. 다시 투입하자.','info'); }
    sfx.whirr(); log('컨베이어 재가동!','good');
  });
};
ACTIONS.dbin = d => {
  const i=+d.i, bin=S.dock.belt.bins[i]; if(!bin.length) return;
  if(i===0 || i===4){
    const how = freeTrucks() ? 'truck' : 'hand';
    if(how==='hand') log(`북트럭이 없어서 손으로 ${Math.min(handMax(),bin.length)}권만 들고 올라간다…`,'warn');
    carry(how, bin, moved=>{
      if(i===0){ for(const b of moved){ b.scanned=false; S.desk.pile.push(b); } S.flags.inboundDesk=true; log(`🛒 우리 어린이실 책 ${moved.length}권 → 데스크 반납 더미. 반납기에서 스캔하자!`,'good'); }
      else { for(const b of moved){ if(b.bm) b.bm='visible'; b.source='오류'; b.scanned=false; S.desk.pile.push(b); } log(`⚠ 오류함 책 ${moved.length}권 → 데스크로 (책갈피·잘못 온 타관 도서 직접 처리)`,'info'); }
    });
    return;
  }
  busy(delay()+300,'📦 이송기에 싣는 중…',()=>{
    const n=bin.length; bin.splice(0); S.processed+=n; sfx.shuffle();
    log(`📦 ${ROOMS[ROOM_KEYS[i]].short} 책 ${n}권을 레일 이송기로 보냈다.`,'good');
  });
};
