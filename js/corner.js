'use strict';
// ===== 신문·잡지·태블릿 코너 =====
function makeCorner(){
  const tabs=[]; let n=0;
  for(let i=0;i<4;i++) tabs.push({id:++n, type:'AR', name:`AR ${i+1}`,   bat:rnd(55,100), at:null});
  for(let i=0;i<2;i++) tabs.push({id:++n, type:'EN', name:`영어 ${i+1}`, bat:rnd(55,100), at:null});
  pick(tabs.filter(t=>t.type==='AR')).bat = rnd(3,12);   // 충전 안 된 AR 태블릿 하나
  shuffle(tabs);
  const stands=[{id:'ar1',type:'AR'},{id:'ar2',type:'AR'},{id:'ar3',type:'AR'},{id:'en1',type:'EN'},{id:'en2',type:'EN'}];
  return {
    tabs, stands, tsel:null,
    holders: NEWS_TITLES.map(t=>({t, today:false})), news:[], newsRet:[], nsel:null,
    mags: MAGS.map(m=>({...m, no:rnd(120,260)})), magNew:[], magDup:[], msel:null,
  };
}
const TYPE_NAME = {AR:'AR 책 스캔', EN:'영어 말하기 도우미'};
const tabletsOK = () => { const C=S.corner; return C.stands.every(s=>{ const t=C.tabs.find(x=>x.at===s.id); return t && t.type===s.type && t.bat>=20; }); };
const newsOK = () => S.flags.newsCame && !S.corner.news.length && S.corner.holders.every(h=>h.today);
const magOK  = () => S.flags.magCame && !S.corner.magNew.length;

function newsArrive(){
  const C=S.corner; let id=0;
  C.news = NEWS_TITLES.map(t=>({id:++id, t, today:true}));
  if(Math.random()<D().wrong*2) C.news.push({id:++id, t:pick(NEWS_TITLES), today:false});   // 배달 실수: 어제 신문
  shuffle(C.news);
  sfx.ding(); log('🗞 오늘 신문이 배달됐다. (신문·잡지·태블릿 코너)','info');
}
function magArrive(){
  const C=S.corner, kind=magKind(S.date); let id=0;
  for(const m of C.mags) if(m.cyc==='격주' || kind==='monthly') C.magNew.push({id:++id, t:m.t, no:m.no+1});
  if(C.magNew.length && Math.random()<0.7){ const m=pick(C.mags.filter(x=>C.magNew.some(n=>n.t===x.t))); C.magNew.push({id:++id, t:m.t, no:m.no}); } // 중복 배송
  shuffle(C.magNew);
  sfx.ding(); log(`📰 ${kind==='monthly'?'월간·격주간':'격주간'} 잡지 새 호가 왔다. (신문·잡지·태블릿 코너)`,'info');
}

VIEWS.corner = ()=>{
  const C=S.corner;
  // 태블릿
  const cab = C.tabs.filter(t=>!t.at).map(t=>tabletCard(t)).join('') || '<small>충전함이 비었어요</small>';
  const stands = C.stands.map(s=>{ const t=C.tabs.find(x=>x.at===s.id);
    return `<div class="stand ${s.type}" data-a="stand" data-s="${s.id}"><small>${TYPE_NAME[s.type]} 거치대</small>${t?tabletCard(t):'<div class="vacant-t">비어 있음</div>'}</div>`; }).join('');
  // 신문
  const papers = C.news.map(p=>`<div class="paper ${C.nsel===p.id?'sel':''}" data-a="paper" data-id="${p.id}"><b>${p.t}</b><small>${p.today?fmtDate(S.date):fmtDate(new Date(S.date.getTime()-864e5))}</small></div>`).join('');
  const holders = C.holders.map((h,i)=>`<div class="holder ${h.today?'ok':''}" data-a="holder" data-i="${i}"><b>${h.t}</b><small>${h.today?'✅ 오늘 신문':'어제 신문'}</small></div>`).join('');
  // 잡지
  let magHtml;
  if(!S.mag) magHtml = `<div class="empty">오늘은 잡지 오는 날이 아니에요.<br><small>격주간: 1일·15일 / 월간: 1일</small></div>`;
  else if(!S.flags.magCame) magHtml = `<div class="empty">잡지는 10:00쯤 도착해요.</div>`;
  else {
    const fresh = C.magNew.map(m=>`<div class="mag ${C.msel===m.id?'sel':''}" data-a="mag" data-id="${m.id}"><b>${m.t}</b><small>제${m.no}호</small></div>`).join('') || '<small>새 호 정리 끝!</small>';
    const shelf = C.mags.map((m,i)=>`<div class="magslot" data-a="mslot" data-i="${i}"><b>${m.t}</b><small>진열: 제${m.no}호 · ${m.cyc}</small></div>`).join('');
    magHtml = `<div class="sub">도착한 새 호</div><div class="row-wrap">${fresh}</div>
      <div class="sub">잡지 진열대 (클릭해서 새 호 진열 → 지난 호는 보관함으로)</div><div class="row-wrap">${shelf}</div>
      <button class="sm-btn" data-a="magdup">📦 중복 배송 반품함 (${C.magDup.length})</button>`;
  }
  return `<div class="corner">
    <div class="panel"><h3><span>📱 태블릿 배치</span><span>${tabletsOK()?'✅':''}</span></h3>
      <div class="sub">충전함 (클릭해서 고르기)</div><div class="row-wrap">${cab}</div>
      <div class="sub">거치대 (AR 3대 · 영어 2대)</div><div class="row-wrap">${stands}</div>
      <div class="tip">배터리 20% 미만인 태블릿은 충전함에 두세요. 놓인 태블릿을 클릭하면 충전함으로 돌아가요.</div></div>
    <div class="panel"><h3><span>🗞 신문 작업</span><span>${newsOK()?'✅':''}</span></h3>
      ${S.flags.newsCame?`<div class="sub">배달된 신문</div><div class="row-wrap">${papers||'<small>다 꽂았어요!</small>'}</div>`:'<div class="empty">신문은 09:30쯤 와요.</div>'}
      <div class="sub">신문철 (제목 맞춰 끼우기)</div><div class="row-wrap">${holders}</div>
      <button class="sm-btn" data-a="newsret">↩ 날짜 틀린 신문 반품 (${C.newsRet.length})</button></div>
    <div class="panel"><h3><span>📰 잡지 작업</span><span>${S.mag&&magOK()?'✅':''}</span></h3>${magHtml}</div>
  </div>`;
};
function tabletCard(t){
  const C=S.corner;
  return `<div class="tablet ${t.type} ${C.tsel===t.id?'sel':''}" data-a="tab" data-id="${t.id}"><b>${t.type==='AR'?'📷':'🗣'} ${t.name}</b>
    <div class="bat"><i style="width:${t.bat}%;background:${t.bat<20?'#e57373':'#81c784'}"></i></div><small>${t.bat}%</small></div>`;
}

ACTIONS.tab = (d,id) => {
  const C=S.corner, t=C.tabs.find(x=>x.id===id); if(!t) return;
  if(t.at){ t.at=null; C.tsel=null; sfx.click(); return; }
  C.tsel = C.tsel===id ? null : id; sfx.click();
};
ACTIONS.stand = d => {
  const C=S.corner, t=C.tabs.find(x=>x.id===C.tsel); if(!t) return;
  const s=C.stands.find(x=>x.id===d.s);
  if(t.type!==s.type){ sfx.err(); S.mistakes++; S.rep-=pen(1); log(`${TYPE_NAME[s.type]} 거치대에는 ${s.type==='AR'?'AR':'영어'} 태블릿을 놓아야 해요!`,'bad'); return; }
  busy(300,'📱 태블릿 놓는 중…',()=>{
    const occ=C.tabs.find(x=>x.at===s.id); if(occ) occ.at=null;
    t.at=s.id; C.tsel=null; sfx.drop();
    if(t.bat<20) log(`🔋 ${t.name} 배터리가 ${t.bat}%… 이건 충전함에 두는 게 좋겠다.`,'warn');
  });
};
ACTIONS.paper = (d,id) => { const C=S.corner; C.nsel = C.nsel===id ? null : id; sfx.click(); };
ACTIONS.holder = d => {
  const C=S.corner, p=C.news.find(x=>x.id===C.nsel); if(!p) return;
  const h=C.holders[+d.i];
  if(p.t!==h.t){ sfx.err(); S.mistakes++; S.rep-=pen(2); log(`이건 ${h.t} 신문철이에요! (${p.t})`,'bad'); return; }
  if(!p.today){ sfx.err(); S.mistakes++; S.rep-=pen(2); log('날짜를 보세요! 어제 신문이 잘못 왔어요. 반품하세요.','bad'); return; }
  busy(400,'🗞 신문철에 끼우는 중…',()=>{ h.today=true; C.news=C.news.filter(x=>x!==p); C.nsel=null; sfx.shelf(); });
};
ACTIONS.newsret = () => {
  const C=S.corner, p=C.news.find(x=>x.id===C.nsel); if(!p) return;
  if(p.today){ sfx.err(); log('오늘 신문인데요? 신문철에 끼워 주세요.','warn'); return; }
  C.news=C.news.filter(x=>x!==p); C.newsRet.push(p); C.nsel=null; sfx.drop(); log('날짜 틀린 신문을 반품함에 넣었다.','good');
};
ACTIONS.mag = (d,id) => { const C=S.corner; C.msel = C.msel===id ? null : id; sfx.click(); };
ACTIONS.mslot = d => {
  const C=S.corner, m=C.magNew.find(x=>x.id===C.msel); if(!m) return;
  const slot=C.mags[+d.i];
  if(m.t!==slot.t){ sfx.err(); S.mistakes++; S.rep-=pen(2); log(`잡지 이름이 달라요! (${m.t} ≠ ${slot.t})`,'bad'); return; }
  if(m.no<=slot.no){ sfx.err(); S.mistakes++; S.rep-=pen(2); log(`제${m.no}호는 이미 진열돼 있어요! 중복 배송은 반품함으로.`,'bad'); return; }
  busy(500,'📰 새 호 진열 중…',()=>{ slot.no=m.no; C.magNew=C.magNew.filter(x=>x!==m); C.msel=null; sfx.shelf(); log(`${m.t} 제${m.no}호 진열, 지난 호는 보관함으로.`,'good'); });
};
ACTIONS.magdup = () => {
  const C=S.corner, m=C.magNew.find(x=>x.id===C.msel); if(!m) return;
  const slot=C.mags.find(x=>x.t===m.t);
  if(m.no>slot.no){ sfx.err(); log('이건 새 호예요! 진열대에 놓아 주세요.','warn'); return; }
  C.magNew=C.magNew.filter(x=>x!==m); C.magDup.push(m); C.msel=null; sfx.drop(); log('중복 배송된 잡지를 반품함에 넣었다.','good');
};
