'use strict';
// ===== 어린이실 이용자 좌석: 잠깐 앉아 쉬기 (붐비면 자리가 없다) =====
function updateSeats(){
  const p=patrons();
  const n=clamp(Math.round(SEATS*p/80*D().seat),0,SEATS);
  const seats=Array.from({length:SEATS},()=>null);
  const idx=[...Array(SEATS).keys()].filter(i=>!(S.sit && i===S.mySeat));
  shuffle(idx);
  for(let i=0;i<Math.min(n,idx.length);i++) seats[idx[i]]=pick(PATRON_EMOJI);
  S.seats=seats;
  if(S.mode==='rest') render();
}

VIEWS.rest = ()=>{
  const p=patrons();
  const seats=S.seats.map((s,i)=>{
    if(S.sit && i===S.mySeat) return `<div class="seat me"><span class="e">😮‍💨</span>나</div>`;
    if(s) return `<div class="seat">${s}</div>`;
    return `<div class="seat free" data-a="sit" data-i="${i}">빈자리<br>앉기</div>`;
  }).join('');
  const free=S.seats.filter(s=>!s).length;
  let msg;
  if(S.sit) msg=`앉아서 쉬는 중… (반납 더미 ${S.desk.pile.length}권, 자동반납기 ${S.ent.auto.length}권 쌓이는 중)`;
  else if(S.lean) msg='벽에 기대 서 있다. 그래도 없는 것보단 낫다.';
  else if(!free) msg='😩 앉을 자리가 하나도 없다… 벽에라도 기대자.';
  else msg='빈자리를 클릭해서 잠깐 앉으세요. 체력과 허리가 회복됩니다.';
  return `<div class="rest panel"><h3><span>🧸 어린이실 이용자 좌석</span><span>이용자 ${p}명 · 빈자리 ${free}/${SEATS}</span></h3>
    <div class="seats">${seats}</div>
    <div class="restctl">
      ${S.sit?`<button class="big-btn" data-a="standup">일어나기</button>`:''}
      <button class="big-btn gray" data-a="lean">${S.lean?'벽에서 떨어지기':'🧱 벽에 기대기'}</button>
    </div>
    <div class="restmsg">${msg}</div>
    <div class="tip" style="text-align:center">앉기: 체력·허리 빠르게 회복 / 벽에 기대기: 조금 회복 / 그냥 서 있기: 체력이 계속 줄어요.<br>자리는 이용자 수에 따라 15분마다 바뀝니다.</div>
  </div>`;
};
ACTIONS.sit = d => {
  const i=+d.i; if(S.seats[i]) return;
  S.sit=true; S.lean=false; S.mySeat=i; sfx.sigh();
  log(pick(['후… 살 것 같다.','잠깐만 앉아 있자.','의자가 이렇게 소중했나.']),'good');
};
ACTIONS.standup = () => { S.sit=false; S.mySeat=-1; };
ACTIONS.lean = () => { S.lean=!S.lean; if(S.lean){ S.sit=false; S.mySeat=-1; } };
