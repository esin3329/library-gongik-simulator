'use strict';
// ===== 데스크: 반납기(한 번에 5권 스캔) · 분류 · 서가번호 프린터 · 신착 · 타관도서 묶기 =====
const PAD_MAX = 5;
const DEST = {
  cart: {ico:'🛒', name:'북카트',          sub:'우리 어린이실 서가로',                key:'1', color:'#3a7d44'},
  floor:{ico:'📦', name:'레일 이송기',     sub:'종합·인문·디지털자료실로 (정시마다 자동 발송)', key:'2', color:'#795548'},
  out:  {ico:'📦', name:'타관도서함',      sub:'오후에 묶어서 포터로',              key:'3', color:'#2b6cb0'},
};
const destOf = b => b.owner!=='home' ? 'out' : (b.room!=='mine' ? 'floor' : 'cart');
function ownerText(b){
  if(b.owner!=='home') return LIBS[b.owner].name;
  if(b.room!=='mine') return ROOMS[b.room].name;
  const ci=caseOfCls(b.cls); return `우리 어린이실 · ${ci>=0?CASES[ci].name:''}`;
}
const ownerColor = b => b.owner!=='home' ? LIBS[b.owner].color : ROOMS[b.room].color;

function bookCard(b, act, extra=''){
  return `<div class="book ${extra}" data-a="${act}" data-id="${b.id}" style="--c:${CLASS_COLORS[b.k]}">
    <div class="spine"></div>
    <div class="info"><b>${b.title}</b><span class="call">${callNo(b)}</span><span class="src src-${b.source}">${b.source}</span></div>
    ${b.isNew?'<i class="newtag">NEW</i>':''}
    ${b.bm==='visible'?`<div class="bm" data-a="bm" data-id="${b.id}" title="책갈피 빼기">🔖</div>`:''}
    ${b.scanned&&!b.isNew?`<div class="owner" style="background:${ownerColor(b)}">${ownerText(b)}</div>`:''}
  </div>`;
}
function flashPad(){ S.desk.padFx='err'; setTimeout(()=>{ if(S) S.desk.padFx=''; },350); }
const padMsg = (t,c='') => { S.desk.padMsg={t,c}; };

// ----- 화면 -----
VIEWS.desk = ()=>{
  const P=S.desk;
  if(P.bundleMode) return bundleView();
  const pile = P.pile.length ? P.pile.map(b=>bookCard(b,'take')).join('') : `<div class="empty">반납 더미가 비었다 🎉</div>`;
  const slots=[];
  for(let i=0;i<PAD_MAX;i++){
    const b=P.pad[i];
    slots.push(b ? `<div class="padslot ${b.id===P.cur?'cur':''} ${b.scanned?'ok':''}">${bookCard(b, b.scanned?'cur':'unpad','mini')}</div>`
                 : `<div class="padslot vacant">${i+1}</div>`);
  }
  const cur = P.pad.find(b=>b.id===P.cur);
  const destBtn = k => {
    const X=DEST[k], n = k==='cart' ? `${S.cart.length}/${CART_MAX}` : k==='floor' ? P.floorBin.length : P.outBin.length;
    return `<button class="bin" style="--bc:${X.color}" data-a="sort" data-dest="${k}" ${cur?'':'disabled'}>
      <span class="ico">${X.ico}</span><span>${X.name}<kbd>${X.key}</kbd></span><span class="cnt">${n}</span><small>${X.sub}</small></button>`;
  };
  const pr=P.printer;
  const printer = `<div class="printer ${pr.looked&&pr.paper<=0?'empty':''}">
    <div><b>🖨 서가번호 출력 프린터</b></div>
    ${pr.looked ? `<div class="bar wide"><i style="width:${pr.paper}%;background:${pr.paper<20?'#e57373':'#81c784'}"></i></div><small>용지 ${Math.round(pr.paper)}%${pr.paper<=0?' — 이용자들이 번호를 못 뽑고 있어요!':''}</small>`
                : '<small>용지 상태: 확인 필요</small>'}
    <div class="btnrow"><button class="sm-btn" data-a="pcheck">👀 용지 확인</button><button class="sm-btn" data-a="prefill">🧻 용지 갈기</button></div></div>`;
  const unscanned = P.pad.some(b=>!b.scanned);
  return `<div class="desk">
    <div class="panel"><h3><span>📥 반납 더미</span><span class="${P.pile.length>PILE_WARN?'hotx':''}">${P.pile.length}권${P.pile.length>PILE_WARN?' · 넘침!':''}</span></h3>
      <div class="pile">${pile}</div>
      <div class="tip">책을 클릭하면 반납기에 올라가요.</div></div>
    <div class="panel"><h3><span>📟 반납기 <small>한 번에 5권까지 스캔</small></span><span>${P.pad.length}/${PAD_MAX}</span></h3>
      <div class="pad ${P.padFx}">${slots.join('')}</div>
      <div class="scanmsg ${P.padMsg?.c||''}">${P.padMsg?.t||''}</div>
      <div class="btnrow">
        <button class="big-btn" data-a="fill" ${P.pad.length<PAD_MAX&&P.pile.length?'':'disabled'}>📥 올리기</button>
        <button class="big-btn" data-a="scan" ${unscanned?'':'disabled'}>📟 스캔</button>
      </div>
      ${cur?`<div class="curinfo">분류할 책: <b>${callNo(cur)}</b> ${cur.title} → <b style="color:${ownerColor(cur)}">${ownerText(cur)}</b></div>`:''}
      <div class="tip"><kbd>Space</kbd> 올리기/스캔 · <kbd>B</kbd> 책갈피 빼기 · <kbd>1</kbd>~<kbd>3</kbd> 분류<br>
        책갈피가 끼어 있으면 그 책은 인식이 안 돼요. 스캔 안 된 책을 클릭하면 더미로 내려요.</div>
    </div>
    <div class="panel"><h3><span>🗂 분류</span></h3>
      <div class="bins">${destBtn('cart')}${destBtn('floor')}${destBtn('out')}</div>
      <button class="wide-btn" data-a="bundleMode" ${P.outBin.length?'':'disabled'}>🧵 타관도서 묶기 (${P.outBin.length}권)</button>
      ${printer}
    </div></div>`;
};

function bundleView(){
  const P=S.desk;
  const books = P.outBin.map(b=>`<div class="bbook ${P.bsel.includes(b.id)?'sel':''}" data-a="bsel" data-id="${b.id}">
      <span class="chip" style="background:${LIBS[b.owner].color}">${LIBS[b.owner].name}</span><span class="call">${callNo(b)}</span></div>`).join('');
  const outs = S.dock.out.map(x=>`<span class="bchip" style="--c:${LIBS[x.lib].color}">🧵 ${LIBS[x.lib].name} · ${x.books.length}권</span>`).join('') || '<small>아직 없음</small>';
  return `<div class="panel bundle"><h3><span>🧵 타관도서 묶기</span><button class="sm-btn" data-a="bundleMode">← 데스크로</button></h3>
    <div class="tip" style="margin-top:0">같은 도서관 책끼리 골라서 끈으로 묶으세요. <b>이름이 비슷한 도서관</b>이 많아요! (해맑은 ↔ 해맑은어린이, 별빛 ↔ 별빛마을…)</div>
    <div class="bgrid">${books||'<div class="empty">묶을 책이 없어요</div>'}</div>
    <div class="btnrow"><button class="big-btn" data-a="tie" ${P.bsel.length?'':'disabled'}>🧵 선택한 ${P.bsel.length}권 끈으로 묶기</button></div>
    <h3 style="margin-top:16px"><span>🚚 하역장으로 보낼 묶음</span></h3><div class="chips">${outs}</div></div>`;
}

// ----- 행동 -----
ACTIONS.take = (d,id) => {
  const P=S.desk;
  if(P.pad.length>=PAD_MAX){ sfx.err(); padMsg('반납기에는 5권까지만 올릴 수 있어요.','bad'); return; }
  const i=P.pile.findIndex(b=>b.id===id); if(i<0) return;
  P.pad.push(P.pile.splice(i,1)[0]); sfx.drop(); padReveal();
};
ACTIONS.fill = () => {
  const P=S.desk; let n=0;
  while(P.pad.length<PAD_MAX && P.pile.length){ P.pad.push(P.pile.shift()); n++; }
  if(n){ sfx.drop(); padReveal(); }
};
ACTIONS.unpad = (d,id) => { const P=S.desk, b=P.pad.find(x=>x.id===id); if(!b) return; P.pad=P.pad.filter(x=>x!==b); P.pile.unshift(b); };
ACTIONS.cur = (d,id) => { const b=S.desk.pad.find(x=>x.id===id); if(b&&b.scanned) S.desk.cur=id; };
ACTIONS.scan = () => {
  const P=S.desk, todo=P.pad.filter(b=>!b.scanned); if(!todo.length) return;
  busy((delay()+150+todo.length*90)*(hasPerk('glove')?0.7:1),'📟 반납기 스캔 중…',()=>{
    let err=0;
    for(const b of todo){ if(b.bm){ err++; if(b.bm==='hidden') b.bm='visible'; } else b.scanned=true; }
    S.sta-=0.4;
    if(err){ sfx.err(); flashPad(); padMsg(`삐— ${err}권 인식 오류! 🔖 책갈피를 빼고 다시 스캔하세요.`,'bad'); }
    else { sfx.ok(); padMsg(`삑! ${todo.length}권 스캔 완료. 분류하세요.`,'good'); }
    const first=P.pad.find(b=>b.scanned); P.cur=first?first.id:null;
  });
};
function removeBm(id){
  const P=S.desk, b=P.pile.find(x=>x.id===id)||P.pad.find(x=>x.id===id);
  if(!b||!b.bm) return;
  b.bm=null; const item=pick(FOUND_ITEMS); S.found.push(item); sfx.found();
  log(`🔖 책 사이에서 '${item}' 발견 → 분실물함으로`,'info');
}
ACTIONS.bm = (d,id) => removeBm(id);
function sortTo(dest){
  const P=S.desk, b=P.pad.find(x=>x.id===P.cur && x.scanned); if(!b) return;
  const right=destOf(b);
  if(dest!==right){ sfx.err(); flashPad(); S.rep-=pen(3); S.mistakes++; padMsg(`잠깐! 이 책은 ${ownerText(b)} 책이에요. (신뢰도 -${pen(3)})`,'bad'); return; }
  if(dest==='cart'){
    if(S.cart.length>=CART_MAX){ sfx.err(); padMsg('북카트가 꽉 찼어요! 서가(W)에 꽂고 오세요.','bad'); return; }
    S.cart.push(b);
  } else if(dest==='floor') P.floorBin.push(b);
  else P.outBin.push(b);
  P.pad=P.pad.filter(x=>x!==b); S.processed++; sfx.drop(); padMsg('처리 완료','good');
  const nx=P.pad.find(x=>x.scanned); P.cur=nx?nx.id:null;
}
ACTIONS.sort = d => sortTo(d.dest);
ACTIONS.newtake = () => {
  const P=S.desk, space=CART_MAX-S.cart.length;
  if(!space){ sfx.err(); log('북카트가 꽉 찼다!','bad'); return; }
  const moved=P.newTruck.splice(0,space); S.cart.push(...moved); sfx.shuffle();
  log(`🆕 신착 ${moved.length}권을 북카트에 실었다.`,'good');
};

// 프린터
function printerTick(dmin,p){
  const pr=S.desk.printer;
  pr.paper=Math.max(0, pr.paper - 0.2*p/100*D().paper*dmin);
  if(pr.paper<=0){ pr.emptyT+=dmin; if(pr.emptyT>=12){ pr.emptyT=0; S.rep-=pen(1); sfx.murmur(); log('이용자: "서가번호가 안 나와요!" (프린터 용지 없음)','bad'); } }
  else pr.emptyT=0;
  if(pr.paper<15 && pr.paper>0 && !S.flags.paperWarn){ S.flags.paperWarn=true; log('🖨 데스크 프린터 용지가 얼마 안 남은 것 같다.','warn'); }
  if(pr.paper>50) S.flags.paperWarn=false;
}
ACTIONS.pcheck = () => {
  const pr=S.desk.printer;
  busy(350,'🖨 용지 확인 중…',()=>{
    pr.looked=true;
    if(pr.paper>=30){ pr.checked=true; log(`🖨 용지 ${Math.round(pr.paper)}% — 아직 괜찮다.`,'good'); }
    else { sfx.alarm(); log(`🖨 용지 ${Math.round(pr.paper)}%! 갈아야 한다.`,'warn'); }
  });
};
ACTIONS.prefill = () => {
  const pr=S.desk.printer;
  busy(delay()+1300,'🧻 롤 용지 가는 중…',()=>{ pr.paper=100; pr.looked=true; pr.checked=true; S.back+=1; sfx.shelf(); log('🖨 프린터 용지 교체 완료!','good'); });
};

// 타관도서 묶기
ACTIONS.bundleMode = () => { S.desk.bundleMode=!S.desk.bundleMode; S.desk.bsel=[]; sfx.click(); };
ACTIONS.bsel = (d,id) => { const s=S.desk.bsel; const i=s.indexOf(id); if(i>=0) s.splice(i,1); else s.push(id); sfx.click(); };
ACTIONS.tie = () => {
  const P=S.desk, books=P.outBin.filter(b=>P.bsel.includes(b.id)); if(!books.length) return;
  busy(delay()+400+books.length*40,'🧵 끈으로 묶는 중…',()=>{
    const libs=new Set(books.map(b=>b.owner));
    if(libs.size>1){ sfx.err(); S.mistakes++; S.rep-=pen(4); log(`다른 도서관 책이 섞여 있다! 다시 풀어서 묶자. (신뢰도 -${pen(4)})`,'bad'); P.bsel=[]; return; }
    P.outBin=P.outBin.filter(b=>!books.includes(b)); P.bsel=[];
    const lib=books[0].owner;
    S.dock.out.push({id:++uid, lib, books});
    sfx.shuffle(); log(`🧵 ${LIBS[lib].name} ${books.length}권 묶음 완료 → 하역장으로`,'good');
  });
};

VIEW_KEYS.desk = (k,e) => {
  const P=S.desk;
  if(P.bundleMode) return false;
  if(k===' '){ e.preventDefault(); if(P.pad.some(b=>!b.scanned)) ACTIONS.scan(); else ACTIONS.fill(); return true; }
  if(k==='b'){ const b=P.pad.find(x=>x.bm==='visible')||P.pile.find(x=>x.bm==='visible'); if(b) removeBm(b.id); return true; }
  if(k==='1'||k==='2'||k==='3'){ sortTo(['cart','floor','out'][+k-1]); return true; }
  return false;
};
