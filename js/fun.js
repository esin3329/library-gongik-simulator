'use strict';
// ===== 재미 요소 =====
// 1) 실시간 점수 + 콤보  2) 이용자 돌발 상황(선택지)  3) 단체 방문 러시  4) 퇴근길 아이템(다음 날부터 효과)

// ---------- 아이템: 하루를 버틸 때마다 하나씩 장만 ----------
const PERKS = {
  glove:  {ico:'🧤', name:'고무 골무',        desc:'반납기 스캔이 30% 빨라진다'},
  shoes:  {ico:'👟', name:'쿠션 운동화',      desc:'장소 이동이 30% 빨라진다'},
  belt:   {ico:'🩹', name:'허리 보호대',      desc:'허리 통증이 25% 덜 쌓인다'},
  arms:   {ico:'💪', name:'팔 근육',          desc:'손으로 3권 더 들 수 있다'},
  coffee: {ico:'☕', name:'믹스커피 비축',    desc:'체력이 30% 천천히 닳는다'},
  eyes:   {ico:'👀', name:'책갈피 눈썰미',    desc:'반납기에 올리자마자 숨은 책갈피가 보인다'},
  friend: {ico:'😊', name:'사서님과 친해짐',  desc:'신뢰도가 25% 덜 깎인다'},
  cart:   {ico:'🛒', name:'큰 북카트',        desc:'북카트에 4권 더 실을 수 있다'},
  rhythm: {ico:'🎧', name:'리듬감',           desc:'콤보가 4초 더 오래 이어진다'},
  truck:  {ico:'📝', name:'북트럭 예약제',    desc:'다른 근무자가 북트럭을 덜 가져간다'},
};
let PERK_LIST = (()=>{ try{ return JSON.parse(store('gongik-perks')||'[]').filter(k=>PERKS[k]); }catch(e){ return []; } })();
function setPerks(a){ PERK_LIST=a; store('gongik-perks', JSON.stringify(a)); }
const hasPerk = k => PERK_LIST.includes(k);
const perkBar = () => PERK_LIST.length
  ? `<div class="perkbar"><b>내 장비</b> ${PERK_LIST.map(k=>`<span title="${PERKS[k].name}: ${PERKS[k].desc}">${PERKS[k].ico}</span>`).join('')}</div>` : '';
let perkChoices = [];
function perkOffer(complete, d){
  perkChoices=[];
  if(!complete || d===0) return '';
  const pool=Object.keys(PERKS).filter(k=>!hasPerk(k)); if(!pool.length) return '';
  perkChoices=shuffle(pool).slice(0,3);
  return `<h2>🎁 퇴근길에 하나 장만하기 <small style="color:var(--muted)">(내일부터 효과, 계속 유지)</small></h2>
    <div class="perks">${perkChoices.map(k=>`<button class="perk" data-a="perk" data-k="${k}"><span class="pi">${PERKS[k].ico}</span><b>${PERKS[k].name}</b><small>${PERKS[k].desc}</small></button>`).join('')}</div>`;
}
function pickPerk(k){
  if(!perkChoices.includes(k)) return;
  setPerks([...PERK_LIST, k]); perkChoices=[]; sfx.found();
  document.querySelectorAll('.perk').forEach(b=>{ b.disabled=true; b.classList.toggle('on', b.dataset.k===k); });
  const st=document.querySelector('#overlay [data-a=start]'); if(st) st.disabled=false;
  const h=document.querySelector('.perkhint'); if(h) h.remove();
}
function padReveal(){ if(hasPerk('eyes')) for(const b of S.desk.pad) if(b.bm==='hidden') b.bm='visible'; }

// ---------- 점수 · 콤보 · 손맛 ----------
let lastPt=null, lastPtAt=0, popN=0, popAt=0;
document.addEventListener('pointerdown', e=>{ lastPt={x:e.clientX, y:e.clientY}; lastPtAt=performance.now(); }, true);
function popup(text, cls){
  let x, y;
  if(lastPt && performance.now()-lastPtAt<2500){ x=lastPt.x; y=lastPt.y-14; }
  else { const r=$('#score').getBoundingClientRect(); x=r.left+r.width/2; y=r.bottom+14; }
  const now=performance.now(); popN = now-popAt<400 ? popN+1 : 0; popAt=now;
  const el=document.createElement('div'); el.className='pop '+cls; el.textContent=text;
  el.style.left=(x+rnd(-12,12))+'px'; el.style.top=(y-popN*24)+'px';
  document.body.appendChild(el); setTimeout(()=>el.remove(),1100);
}
function shake(){ const v=$('#view'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake'); setTimeout(()=>v.classList.remove('shake'),400); }
function banner(big, small){
  const el=document.createElement('div'); el.className='banner'; el.innerHTML=`<b>${big}</b><small>${small}</small>`;
  document.body.appendChild(el); setTimeout(()=>el.remove(),3000);
}
sfx.blip  = n => tone(523*Math.pow(2,Math.min(n,24)/12),0.07,'triangle',0.05);
sfx.combo = n => [0,4,7,12].forEach((s,i)=>tone(523*Math.pow(2,(s+Math.min(n,30)/3)/12),0.12,'square',0.035,i*0.06));
sfx.event = () => { tone(660,0.09,'sine',0.07); tone(990,0.14,'sine',0.07,0.1); };
sfx.rush  = () => { [392,523,659,784,659,784].forEach((f,i)=>tone(f,0.12,'square',0.045,i*0.09)); noise(0.6,0.05,1500,'bandpass',0.1); };

const rushOn    = () => !!(S && S.rush && S.min>=S.rush.at && S.min<S.rush.at+S.rush.len);
const rushBonus = () => rushOn() ? 35 : 0;
const comboWin  = () => 7000 + (hasPerk('rhythm')?4000:0);
const comboMult = () => (1 + Math.min(S.combo,20)*0.05) * (rushOn()?1.5:1);
function gain(base, label=''){
  S.combo++; S.comboAt=performance.now(); S.bestCombo=Math.max(S.bestCombo,S.combo);
  const pts=Math.round(base*comboMult()); S.score+=pts;
  popup(`+${pts}${label?' '+label:''}`, S.combo>=10?'good hot':'good');
  if(S.combo%5===0){ sfx.combo(S.combo); log(`🔥 ${S.combo} 콤보! 점수 ×${comboMult().toFixed(2)}`,'good'); }
  else sfx.blip(S.combo);
}
function lose(pts, label=''){
  S.score-=pts;
  if(S.combo>=5) log(`💥 ${S.combo} 콤보가 끊겼다…`,'bad');
  S.combo=0; popup(`-${pts}${label?' '+label:''}`,'bad'); shake();
}
const snap = () => ({p:S.processed, s:S.shelved, sh:S.shipped, m:S.mistakes, f:S.found.length, t:S.tasks.filter(t=>t.done).length, tl:tiltedCount()});

// ---------- 단체 방문 ----------
function rushTick(){
  const R=S.rush; if(!R || R.over) return;
  if(!R.started && S.min>=R.at){
    R.started=true; sfx.rush(); banner(`🎒 ${R.who} 단체 방문!`, `${R.len}분 동안 이용자 폭증 · 점수 ×1.5`);
    log(`🎒 ${R.who} 아이들이 우르르 들어왔다! 반납이 쏟아진다. (점수 ×1.5)`,'warn'); render();
  }
  if(R.started && S.min>=R.at+R.len){
    R.over=true; const n=rnd(6,9);
    for(let i=0;i<n;i++) S.desk.pile.push(withBm(loanBook('테이블'), D().bm+0.1));
    tiltSome(2); sfx.murmur();
    log(`🎒 단체가 돌아갔다. 테이블에 책 ${n}권이 남았고 서가도 좀 엉망이다…`,'info'); render();
  }
}

// ---------- 이용자 돌발 상황 ----------
function evOk(pts, msg, rep=0){ S.evGood++; S.rep+=rep; gain(pts,'대처'); log(msg,'good'); }
function evBad(rep, msg){ S.rep-=pen(rep); lose(10); sfx.err(); log(`${msg} (신뢰도 -${pen(rep)})`,'bad'); }
const EVENTS = [
  {id:'find', w:3, keep:true, make(){
    const ci=rnd(0,2), slots=S.shelves[ci].slots.filter(s=>s.length); if(!slots.length) return null;
    const b=pick(pick(slots));
    return {who:pick(['👧','👦','🧒']), text:`"「${b.title}」 어디 있어요?"`, sub:`청구기호 ${callNo(b)} — 어느 서가일까?`,
      choices:[0,1,2].map(i=>({t:`${CASES[i].name} <small>${CASES[i].range}</small>`,
        fx:()=> i===ci ? evOk(20,`"찾았다! 고맙습니다!" 아이가 책을 꼭 안고 간다.`,1) : evBad(2,'"거기 없는데요…" 아이가 시무룩해졌다.')}))};
  }},
  {id:'overdue', w:1, make:()=>({who:'👩', text:'"연체 3일째인데… 오늘만 그냥 빌려주시면 안 돼요?"', choices:[
    {t:'연체 기간만큼 대출이 정지된다고 정중히 안내', fx:()=>evOk(15,'학부모가 아쉬워하며 고개를 끄덕였다.',1)},
    {t:'…이번만 몰래 해 드린다', fx:()=>evBad(4,'사서님이 다 보고 계셨다…')},
    {t:'"사서님께 여쭤볼게요"', fx:()=>{ S.rep-=pen(1); log('사서님이 대신 안내해 주셨다. 조금 민망하다.',''); }},
  ]})},
  {id:'lost', w:1, make:()=>({who:'😢', text:'"엄마가 안 보여요…"', choices:[
    {t:'데스크에서 같이 기다리며 안내 방송 요청', fx:()=>evOk(25,'엄마가 금방 달려오셨다. 아이가 손을 흔들고 간다 👋',3)},
    {t:'"저기 가서 찾아봐"', fx:()=>evBad(5,'아이가 더 크게 운다… 다들 쳐다본다.')},
  ]})},
  {id:'climb', w:1, t:6, make:()=>({who:'🧗', text:'아이가 서가를 타고 올라가려 한다!', sub:'빨리!', choices:[
    {t:'뛰어가서 말린다', fx:()=>{ S.sta-=5; evOk(20,'휴, 다치기 전에 내려왔다.',1); }},
    {t:'"내려와!" 멀리서 소리친다', fx:()=>evBad(3,'도서관에 쩌렁쩌렁… 다들 놀랐다.')},
    {t:'못 본 척', fx:()=>{ tiltSome(4); evBad(6,'쿵! 책이 와르르… 서가가 엉망이 됐다.'); }},
  ]})},
  {id:'noisy', w:1, make:()=>({who:'🏃', text:'아이들이 서가 사이에서 술래잡기를 한다.', choices:[
    {t:'"도서관에서는 걸어 다니자~" 부드럽게', fx:()=>evOk(15,'"네에~" 아이들이 살금살금 걷는다.')},
    {t:'"쉬이이잇!!!"', fx:()=>evBad(2,'쉿 소리가 제일 시끄러웠다.')},
  ]})},
  {id:'torn', w:1, make:()=>({who:'📕', text:'아이가 찢어진 그림책을 들고 왔다. "제가 안 그랬어요…"', choices:[
    {t:'"알려 줘서 고마워" → 파손 도서로 접수', fx:()=>evOk(20,'아이 얼굴이 환해졌다. 책은 수선실로.',1)},
    {t:'테이프로 대충 붙여서 꽂는다', fx:()=>evBad(3,'사서님: "이건 수선실로 보내야죠…"')},
  ]})},
  {id:'toilet', w:1, t:5, make:()=>({who:'🚻', text:'"화장실 어디예요?? 급해요!!"', sub:'빨리!', choices:[
    {t:'"복도 끝에서 오른쪽!"', fx:()=>evOk(10,'아이가 전력 질주로 사라졌다.')},
    {t:'"음… 그게 어디였더라"', fx:()=>evBad(1,'…아이가 스스로 찾아냈다. 다행이다.')},
  ]})},
  {id:'ar', w:1, make:()=>({who:'📷', text:'"AR 태블릿이 안 켜져요!"', choices:[
    {t:'충전된 태블릿으로 바꿔 준다', fx:()=>{ S.sta-=1; evOk(15,'"와 된다!" 퀴즈 풀러 간다.'); }},
    {t:'"전원 버튼을 꾹 눌러 보세요~"', fx:()=> Math.random()<0.5 ? evOk(10,'켜졌다! 운이 좋았다.') : evBad(1,'여전히 안 켜진다. 아이가 한숨을 쉰다.')},
  ]})},
  {id:'help', w:0.8, make:()=>({who:'👩‍💼', text:'사서님: "공익님, 이 상자 좀 같이 들어 줄래요?"', choices:[
    {t:'"네! 바로 갈게요"', fx:()=>{ S.back+=4*D().back; S.sta-=3; evOk(15,'무거운 상자를 옮겼다. 사서님이 고마워하신다.',3); }},
    {t:'"지금 반납 처리 중이라서요…"', fx:()=>{ S.rep-=pen(1); log('사서님: "아, 그래요. 바쁘죠." …눈치가 보인다.',''); }},
  ]})},
  {id:'coffee', w:0.6, once:true, make:()=>({who:'☕', text:'사서님이 커피를 사 오셨다!', choices:[
    {t:'"감사합니다!" 바로 마신다', fx:()=>{ S.sta+=30; evOk(5,'달달한 커피에 기운이 난다. (체력 +30)'); }},
    {t:'"이따 마실게요"', fx:()=>{ log('책상에 두었다가… 다 식어 버렸다.',''); }},
  ]})},
  {id:'drawing', w:0.6, once:true, make:()=>({who:'🖍', text:'아이가 "공익쌤"이라며 그림을 그려 줬다!', choices:[
    {t:'"고마워! 데스크에 붙여 둘게"', fx:()=>{ S.sta+=10; evOk(10,'데스크에 그림이 붙었다. 왠지 힘이 난다.',3); }},
    {t:'"어… 고마워" (주머니에 넣는다)', fx:()=>{ S.sta+=5; log('주머니 속 그림이 바스락거린다.',''); }},
  ]})},
];
const EV_TIMEOUT = 10;
function startEvent(){
  const pool=EVENTS.filter(e=>!(e.once && S.evOnce[e.id]));
  for(let k=0;k<5;k++){
    const e=pool[weighted(pool.map(x=>x.w))], ev=e.make(); if(!ev) continue;
    if(e.once) S.evOnce[e.id]=true;
    if(!e.keep) shuffle(ev.choices);
    S.event={...ev, id:e.id, start:S.min, until:S.min+(e.t||EV_TIMEOUT)};
    sfx.event(); renderEvent(); return;
  }
  S.evNext=S.min+10;
}
const nextEvent = () => S.min + rnd(60,90)/Math.sqrt(D().spawn);   // 하루 5~7번 정도
function eventChoose(i){
  const E=S.event; if(!E || !E.choices[i]) return;
  S.event=null; S.evAll++; sfx.click();
  E.choices[i].fx();
  S.evNext=nextEvent(); renderEvent(); render();
}
function eventTick(){
  const E=S.event;
  if(E){
    if(S.min>=E.until){
      S.event=null; S.evAll++; S.rep-=pen(3); lose(10,'무시'); sfx.murmur();
      log(`${E.who} 기다리다 지친 이용자가 사서님께 갔다… (신뢰도 -${pen(3)})`,'bad');
      S.evNext=nextEvent(); renderEvent();
    }
    return;
  }
  if(S.min>=S.evNext && S.min<hhmm(17,40)) startEvent();
}
function renderEvent(){
  let el=$('#event'); if(!el){ el=document.createElement('div'); el.id='event'; document.body.appendChild(el); }
  const E = S && S.running ? S.event : null;
  if(!E){ el.className='hide'; el.innerHTML=''; return; }
  el.className='';
  el.innerHTML=`<div class="ev-head"><span class="ev-who">${E.who}</span><div><b>${E.text}</b>${E.sub?`<small>${E.sub}</small>`:''}</div></div>
    <div class="ev-ch">${E.choices.map((c,i)=>`<button data-a="evc" data-i="${i}"><kbd>${'ZXC'[i]}</kbd> ${c.t}</button>`).join('')}</div>
    <div class="ev-timer"><i id="evBar"></i></div>`;
}
document.addEventListener('keydown', e=>{
  if(!S || !S.running || !S.event) return;
  const i='zxc'.indexOf(e.key.toLowerCase()); if(i>=0){ e.preventDefault(); eventChoose(i); }
});

// ---------- 하루 시작 · 매 틱 · HUD ----------
function funInit(){
  Object.assign(S, {score:0, combo:0, comboAt:0, bestCombo:0, event:null, evOnce:{}, evGood:0, evAll:0,
    evNext: hhmm(10)+rnd(0,30),
    rush: (S.day===1 || Math.random()<0.7) ? {at: S.day===1 ? hhmm(11) : rnd(hhmm(10,30),hhmm(13,30)), len:40,
      who: pick(['해님유치원','꿈나무어린이집','햇살초 2학년','별님유치원'])} : null});
  S._w=snap(); S._bk=S.back; S._rp=S.rep;
  renderEvent();
}
function funTick(){
  const w=S._w, n=snap();
  if(n.m>w.m)  lose(15*(n.m-w.m),'실수');
  if(n.p>w.p)  gain(5*(n.p-w.p), n.p-w.p>1?`처리 ${n.p-w.p}권`:'처리');
  if(n.s>w.s)  gain(8*(n.s-w.s),'배가');
  if(n.sh>w.sh) gain(2*(n.sh-w.sh),`상차 ${n.sh-w.sh}권`);
  if(n.f>w.f)  gain(10,'분실물 발견');
  if(n.t>w.t)  gain(60*(n.t-w.t),'업무 완료!');
  if(n.tl<w.tl) gain(3*(w.tl-n.tl),'세우기');
  S._w=n;
  // 아이템: 허리 보호대 · 사서님과 친해짐 (늘어난/깎인 만큼에서 일부를 되돌린다)
  if(S.back>S._bk && hasPerk('belt'))  S.back-=(S.back-S._bk)*0.25;
  if(S.rep<S._rp && hasPerk('friend')) S.rep+=(S._rp-S.rep)*0.25;
  S._bk=S.back; S._rp=S.rep;
  if(S.combo && performance.now()-S.comboAt>comboWin()) S.combo=0;
  rushTick(); eventTick();
}
function funHud(){
  $('#score').textContent=S.score;
  const c=$('#combo');
  if(S.combo>=2){
    const left=1-(performance.now()-S.comboAt)/comboWin();
    c.className='combo'+(S.combo>=10?' hot':'');
    c.innerHTML=`🔥${S.combo} <small>×${comboMult().toFixed(2)}</small><i style="width:${Math.max(0,left)*100}%"></i>`;
  } else c.className='combo hide';
  const rb=$('#rushTag'); if(rb) rb.style.display=rushOn()?'':'none';
  const E=S.event, bar=$('#evBar');
  if(E && bar) bar.style.width=Math.max(0,(E.until-S.min)/(E.until-E.start))*100+'%';
}
