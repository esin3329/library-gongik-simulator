'use strict';
// ===== 책과 청구기호 =====
// 청구기호 = 분류번호-일련번호 (예: 813.8-160). 같은 분류번호 안에서는 일련번호 순.
const CASES = [
  {name:'서가 A', range:'000–599 총류~기술과학',      classes:['004.5','181.7','325.2','410.1','512.5','594.5']},
  {name:'서가 B', range:'600–799·900 예술·언어·역사', classes:['650.4','688.9','712.7','747.1','911.05','981.1']},
  {name:'서가 C', range:'800 문학',                   classes:['811.7','813.6','813.7','813.8','843.1','863.1']},
];
const SLOT_CAP = 12;          // 한 칸에 꽂을 수 있는 최대 권수
const SLOT_ROOM = 2;          // 책 땡기기 후 칸마다 남겨야 할 여유 공간
const SLOT_ROWS = [
  {h:'⬆ 맨 윗칸 (까치발)',       cls:'hurt', back:6},
  {h:'눈높이',                   cls:'',     back:1},
  {h:'허리 높이 👍',             cls:'nice', back:0},
  {h:'무릎 높이',                cls:'',     back:2},
  {h:'⬇ 맨 아랫칸 (쭈그려 앉기)', cls:'hurt', back:8},
];

let uid = 0;
const clsNum = c => Math.round(parseFloat(c)*100);
const caseOfCls = cls => CASES.findIndex(c=>c.classes.includes(cls));
const callNo = b => b.cls + '-' + b.serial;
const cmp = (a,b) => a.cnum-b.cnum || a.serial-b.serial;
const endsOk = b => !!b && b.serial%5===0;     // 칸 끝 번호는 5나 0으로

function makeBook(cls, serial, o={}){
  const k = Math.floor(parseFloat(cls)/100);
  return {id:++uid, cls, cnum:clsNum(cls), serial, k, title:pick(TITLES[k]),
          owner:o.owner||'home', room:o.room||'mine', source:o.source||'반납',
          bm:null, scanned:false, tilted:false, isNew:!!o.isNew, h:rnd(1,3)};
}
function randomBook(o={}){
  const c=pick(CASES), cls=pick(c.classes);
  return makeBook(cls, rnd(100,260), o);
}
function withBm(b, rate){
  if(Math.random() < (rate ?? D().bm)) b.bm = Math.random()<0.5 ? 'visible' : 'hidden';
  return b;
}
// 대출 중이던 우리 자료실 책이 돌아옴
function loanBook(source){
  let b;
  if(S.loans.length) b = S.loans.splice(rnd(0,S.loans.length-1),1)[0];
  else b = randomBook();
  Object.assign(b,{source, bm:null, scanned:false, tilted:false, owner:'home', room:'mine', isNew:false});
  return b;
}
const foreignBook = (source='반납') => withBm(randomBook({owner:pick(LIB_KEYS), source}));
function returnBook(source){
  const r=Math.random();
  if(r<0.12) return foreignBook(source);
  if(r<0.30) return withBm(randomBook({room:pick(OTHER_ROOMS), source}));
  return withBm(loanBook(source));
}

// ===== 서가 생성 =====
// 각 서가 = 5칸. 칸 경계(칸의 마지막 책)는 일련번호가 5나 0으로 끝나야 한다.
function cutSlots(seq, maxPer){
  const n=seq.length, res=[]; let s=0;
  for(let k=1;k<5;k++){
    const target=Math.round(n*k/5)-1; let best=-1;
    for(let d=0; d<=6 && best<0; d++){
      for(const j of [target-d, target+d]){
        if(j>=s && j<n-1 && endsOk(seq[j]) && j-s+1<=maxPer && j-s+1>=3){ best=j; break; }
      }
    }
    if(best<0) return null;
    res.push(seq.slice(s,best+1)); s=best+1;
  }
  const last=seq.slice(s);
  if(last.length>maxPer || last.length<3) return null;
  res.push(last);
  return res;
}
function mkLabel(slot, isLast){
  if(!slot.length) return {txt:'(빈 칸)', to:null};
  const f=slot[0], l=slot[slot.length-1];
  return {txt:`${callNo(f)} ~ ${isLast?'':callNo(l)}`, to: isLast ? null : {cnum:l.cnum, serial:l.serial}};
}
function genShelves(){
  const shelves=[], loans=[];
  for(const c of CASES){
    for(let attempt=0; attempt<200; attempt++){
      const all=[];
      for(const cls of c.classes){
        const start=rnd(20,40)*5+rnd(0,4), len=rnd(8,10);
        for(let i=0;i<len;i++) all.push(makeBook(cls,start+i));
      }
      all.sort(cmp);
      const on=[], out=[];
      for(const b of all) (Math.random()<0.3 ? out : on).push(b);
      const slots = cutSlots(on, SLOT_CAP-SLOT_ROOM-1);
      if(!slots) continue;
      shelves.push({slots, labels:slots.map((s,i)=>mkLabel(s,i===4)), dirty:[false,false,false,false,false]});
      loans.push(...out);
      break;
    }
  }
  return {shelves, loans};
}

// ===== 꽂을 자리 판정 =====
function prevBefore(ci,si){ const sl=S.shelves[ci].slots; for(let k=si-1;k>=0;k--) if(sl[k].length) return sl[k][sl[k].length-1]; return null; }
function nextAfter(ci,si){ const sl=S.shelves[ci].slots; for(let k=si+1;k<5;k++) if(sl[k].length) return sl[k][0]; return null; }
// 결과: ok | case | order | label | full | dirty
function checkInsert(ci,si,i,b){
  const sh=S.shelves[ci], slot=sh.slots[si];
  if(caseOfCls(b.cls)!==ci) return 'case';
  if(sh.dirty.some(Boolean)) return 'dirty';
  const prev = i>0 ? slot[i-1] : prevBefore(ci,si);
  const next = i<slot.length ? slot[i] : nextAfter(ci,si);
  if((prev && cmp(prev,b)>0) || (next && cmp(b,next)>0)) return 'order';
  const L=sh.labels;
  if(si<4 && L[si].to && cmp(b,L[si].to)>0) return 'label';
  if(si>0 && L[si-1].to && cmp(b,L[si-1].to)<=0) return 'label';
  if(slot.length>=SLOT_CAP) return 'full';
  return 'ok';
}
// 정답 자리 (라벨 범위 기준)
function correctSlot(ci,b){
  const L=S.shelves[ci].labels;
  for(let si=0;si<5;si++) if(si===4 || !L[si].to || cmp(b,L[si].to)<=0) return si;
  return 4;
}
function insertSorted(ci,si,b){
  const slot=S.shelves[ci].slots[si]; let i=0;
  while(i<slot.length && cmp(slot[i],b)<=0) i++;
  slot.splice(i,0,b);
}
const allShelfBooks = ci => S.shelves[ci].slots.flat();
function maxSerial(cls){
  let m=0;
  for(const sh of S.shelves) for(const s of sh.slots) for(const b of s) if(b.cls===cls) m=Math.max(m,b.serial);
  for(const b of S.loans) if(b.cls===cls) m=Math.max(m,b.serial);
  return m;
}
