'use strict';
// ===== 공통 유틸 =====
const $ = s => document.querySelector(s);
const rnd = (a,b) => a + Math.floor(Math.random()*(b-a+1));
const pick = a => a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const hhmm = (h,m=0) => h*60+m;
const fmtTime = m => { m=Math.floor(m); return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
function weighted(w){ let s=w.reduce((a,b)=>a+b,0), r=Math.random()*s; for(let i=0;i<w.length;i++){ r-=w[i]; if(r<0) return i; } return w.length-1; }

// ===== 우리 도서관 / 자료실 =====
// 내 근무실은 어린이자료실
const ROOMS = {
  mine:{name:'어린이자료실 (우리)', short:'우리 어린이실', color:'#ef6c00'},
  gen: {name:'종합자료실',          short:'종합자료실',    color:'#3a7d44'},
  hum: {name:'인문자료실',          short:'인문자료실',    color:'#795548'},
  digi:{name:'디지털자료실',        short:'디지털자료실',  color:'#455a64'},
};
const ROOM_KEYS = ['mine','gen','hum','digi'];
const OTHER_ROOMS = ['gen','hum','digi'];

// ===== 상호대차 상대 도서관 (가상의 이름) — 이름이 비슷해서 헷갈리는 게 포인트 =====
const LIBS = {
  a:{name:'해맑은도서관',       color:'#d9822b'},
  b:{name:'해맑은어린이도서관', color:'#b8860b'},
  c:{name:'푸른숲도서관',       color:'#2b6cb0'},
  d:{name:'푸른숲작은도서관',   color:'#26838a'},
  e:{name:'별빛도서관',         color:'#8e44ad'},
  f:{name:'별빛마을도서관',     color:'#c2185b'},
};
const LIB_KEYS = Object.keys(LIBS);

// ===== 책 =====
const CLASS_COLORS = ['#c0392b','#e67e22','#c9a400','#27ae60','#16a085','#2980b9','#8e44ad','#d35b9c','#8d5524','#5d6d7e'];
// 어린이자료실 책 (가상의 제목)
const TITLES = {
  0:['궁금한 건 못 참아 백과','도서관에 간 고양이','어린이 지식 사전'],
  1:['화날 땐 어떻게 해?','친구랑 싸웠어요','마음이 쑥쑥 자라는 생각'],
  2:['세계 신화 그림책','별자리 옛이야기','신들의 산 이야기'],
  3:['우리 동네 직업 탐험','용돈 쓰는 법','안전 지킴이 대작전'],
  4:['공룡 대탐험','곤충 박사의 하루','우주로 가는 기차','신기한 바다 생물'],
  5:['꼬마 요리사','로봇 만들기 놀이','우리 몸 탐험대'],
  6:['색칠하며 배우는 미술','동요 악보 모음','종이접기 대장'],
  7:['처음 배우는 한글','파닉스 놀이터','영어 그림 사전'],
  8:['달빛 아래 토끼','우리 엄마 출동!','잠꾸러기 곰','용감한 꼬마 기사','비 오는 날의 우산','마법 학교 1학년','내 동생은 외계인','방귀쟁이 꼬마 용'],
  9:['그림으로 보는 한국사','세계 여행 그림책','옛날 옛적 우리 마을'],
};
const FOUND_ITEMS = ['편의점 영수증','가족사진 한 장','말린 네잎클로버','천 원짜리 지폐','콘서트 티켓','누군가의 연애편지(?)','은행잎','포스트잇 메모','다른 도서관 책갈피','아이가 그린 그림','지하철 노선도','머리끈','시험 성적표','과자 봉지(…)','명함','비행기 탑승권','사탕 하나'];
const COMPLAINTS = ['학부모: "반납 어디다 해요?"','학부모: "여기 책 쌓여 있는데요?"','사서님: "반납 더미가 왜 이렇게 쌓여 있어요?"','어린이: "이 책 반납된 거 맞아요?"'];
const PATRON_EMOJI = ['🧒','👧','👦','👶','👩‍👧','👨‍👦','👩','👵','🧒','👧','👦','📖'];

// ===== 정기간행물 (가상의 이름) =====
const NEWS_TITLES = ['한빛일보','새벽신문','바른경제','오늘스포츠','우리동네소식','The Morning Post'];
const MAGS = [
  {t:'월간 과학놀이',     cyc:'월간'},
  {t:'격주간 요리생활',   cyc:'격주'},
  {t:'월간 여행과 지도',  cyc:'월간'},
  {t:'격주간 경제인사이트', cyc:'격주'},
  {t:'월간 디자인노트',   cyc:'월간'},
];

// ===== 이용자 수 (시간대별) =====
const CROWD = [[540,12],[600,28],[660,45],[720,38],[780,62],[840,82],[900,100],[960,96],[1020,70],[1080,40]];

// ===== 장소 =====
const LOCS = {
  desk:    {name:'데스크',          ico:'📟', key:'q'},
  shelf:   {name:'서가',            ico:'📚', key:'w'},
  entrance:{name:'입구·레일 이송기',     ico:'🚪', key:'e'},
  corner:  {name:'신문·잡지·태블릿', ico:'🗞', key:'r'},
  dock:    {name:'지하 하역장',     ico:'🚚', key:'t'},
  rest:    {name:'이용자 좌석',     ico:'🧸', key:'y'},
};

// ===== 난이도 =====
// minSec: 게임 1분 = 실제 몇 초 / spawn: 반납 빈도 / bm: 책갈피 확률 / back: 허리 부담 / drain: 서 있을 때 체력 감소
// pen: 감점 배율 / wrong: 잘못 온 책·날짜 틀린 신문 비율 / seat: 좌석 붐빔 / jam: 컨베이어 걸림 / binCap: 분류함 크기
// paper: 프린터 용지 소모 / porterWait: 포터가 기다려 주는 시간(분)
const DIFFS = {
  easy:  {name:'쉬움',   desc:'천천히 업무를 익히고 싶을 때',  minSec:1.1,  spawn:0.65, bm:0.12, back:0.6,  drain:0.6, pen:0.5, wrong:0.1,  seat:0.65, jam:0.004, binCap:8, paper:0.6, porterWait:50},
  normal:{name:'보통',   desc:'평범한 평일',                   minSec:0.9,  spawn:1,    bm:0.2,  back:1,    drain:1,   pen:1,   wrong:0.18, seat:1,    jam:0.01,  binCap:6, paper:1,   porterWait:40},
  hard:  {name:'어려움', desc:'시험기간 + 반납 폭탄',          minSec:0.75, spawn:1.4,  bm:0.3,  back:1.35, drain:1.5, pen:1.5, wrong:0.25, seat:1.25, jam:0.018, binCap:5, paper:1.5, porterWait:30},
};

// ===== 달력: 2026년 12월 15일(화)부터 근무, 월요일은 휴관 =====
const WEEKDAYS = ['일','월','화','수','목','금','토'];
const START_DATE = new Date(2026,11,15);
function dateOfDay(n){
  const d=new Date(START_DATE); let c=1;
  while(c<n){ d.setDate(d.getDate()+1); if(d.getDay()!==1) c++; }
  return d;
}
const fmtDate = d => `${d.getMonth()+1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
// 잡지: 격주간은 1일·15일, 월간은 1일 (휴관일이면 다음 날)
function magKind(d){
  const day=d.getDate(), wd=d.getDay();
  const isFirst = day===1 || (day===2 && wd===2);
  const isMid   = day===15 || (day===16 && wd===2);
  return isFirst ? 'monthly' : isMid ? 'biweekly' : null;
}
// 신착: 매주 화·금
const isNewBookDay = d => d.getDay()===2 || d.getDay()===5;
