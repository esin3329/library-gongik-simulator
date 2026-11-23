'use strict';
// ---------- 사운드 (전부 WebAudio로 실시간 합성, 외부 파일 없음) ----------
let AC=null, MASTER, SFXG, MUSG, MUSLP, NOISE;
function loadBool(k,def){ try{ const v=localStorage.getItem(k); return v===null?def:v==='1'; }catch(e){ return def; } }
function saveBool(k,v){ try{ localStorage.setItem(k, v?'1':'0'); }catch(e){} }
const AUDIO = { music: loadBool('gongik-music',true), sfx: loadBool('gongik-sfx',true) };
const MUSIC_VOL = 0.5;
function initAudio(){
  if(AC){ if(AC.state==='suspended') AC.resume(); return; }
  try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
  MASTER=AC.createGain(); MASTER.gain.value=0.9; MASTER.connect(AC.destination);
  SFXG=AC.createGain(); SFXG.gain.value=AUDIO.sfx?1:0; SFXG.connect(MASTER);
  MUSLP=AC.createBiquadFilter(); MUSLP.type='lowpass'; MUSLP.frequency.value=2400; MUSLP.connect(MASTER);
  MUSG=AC.createGain(); MUSG.gain.value=AUDIO.music?MUSIC_VOL:0; MUSG.connect(MUSLP);
  NOISE=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);
  const nd=NOISE.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
  if(S && S.running) musicStart();
}
function setAudio(kind,on){
  AUDIO[kind]=on; saveBool('gongik-'+kind,on);
  if(AC){
    if(kind==='sfx') SFXG.gain.setTargetAtTime(on?1:0,AC.currentTime,0.05);
    else MUSG.gain.setTargetAtTime(on?MUSIC_VOL:0,AC.currentTime,0.1);
  }
  audioButtons();
}
function audioButtons(){
  const m=$('#tMusic'), f=$('#tSfx'); if(!m) return;
  m.textContent = '🎵'; m.classList.toggle('off',!AUDIO.music); m.title='배경음악 '+(AUDIO.music?'끄기':'켜기')+' (M)';
  f.textContent = AUDIO.sfx?'🔊':'🔇';   f.classList.toggle('off',!AUDIO.sfx);   f.title='효과음 '+(AUDIO.sfx?'끄기':'켜기')+' (N)';
}
// 기본 소리 재료
function tone(f,d=0.08,type='square',vol=0.05,delay=0,dest,attack=0.005){
  if(!AC) return; const t=AC.currentTime+delay; return toneAt(f,t,d,type,vol,dest||SFXG,attack);
}
function toneAt(f,t,d,type,vol,dest,attack=0.005){
  const o=AC.createOscillator(), g=AC.createGain();
  o.type=type; o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+attack); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(g).connect(dest); o.start(t); o.stop(t+d+0.05); return o;
}
function sweep(f0,f1,d,type='sine',vol=0.06,delay=0,dest){
  if(!AC) return; const t=AC.currentTime+delay, o=tone(f0,d,type,vol,delay,dest);
  o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+d);
}
function noiseAt(t,d,vol,freq,ftype,dest){
  const src=AC.createBufferSource(), f=AC.createBiquadFilter(), g=AC.createGain();
  src.buffer=NOISE; f.type=ftype; f.frequency.value=freq;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
  src.connect(f).connect(g).connect(dest); src.start(t, Math.random()*0.5); src.stop(t+d+0.05);
}
function noise(d,vol,freq=3000,ftype='highpass',delay=0){ if(AC) noiseAt(AC.currentTime+delay,d,vol,freq,ftype,SFXG); }

const sfx = {
  ok(){ tone(1760,0.07,'square',0.035); tone(2637,0.05,'square',0.02,0.05); },          // 스캐너 "삑"
  err(){ tone(180,0.18,'sawtooth',0.06); tone(150,0.2,'sawtooth',0.05,0.12); },        // 오류 "삐—"
  drop(){ tone(420,0.06,'triangle',0.08); noise(0.04,0.05,1200,'lowpass'); },          // 책 내려놓기
  shelf(){ tone(300,0.05,'triangle',0.08); tone(500,0.05,'triangle',0.06,0.05); noise(0.05,0.05,2500,'bandpass',0.02); },
  found(){ tone(880,0.08,'sine',0.06); tone(1320,0.12,'sine',0.06,0.08); tone(1760,0.18,'sine',0.04,0.16); },
  click(){ tone(900,0.025,'square',0.02); },
  ouch(){ noise(0.06,0.12,1800,'bandpass'); sweep(320,140,0.25,'triangle',0.07,0.03); }, // 허리 "뚝"
  sigh(){ sweep(520,240,0.6,'sine',0.05); noise(0.5,0.02,800,'lowpass'); },              // 앉기 "후—"
  murmur(){ for(let i=0;i<5;i++) tone(180+Math.random()*120,0.12,'triangle',0.03,i*0.07+Math.random()*0.03); }, // 웅성웅성
  clunk(){ noise(0.15,0.2,400,'lowpass'); tone(90,0.25,'square',0.06); tone(70,0.3,'square',0.05,0.08); },      // 컨베이어 "덜컹"
  thud(){ noise(0.08,0.12,600,'lowpass'); tone(140,0.08,'triangle',0.06); },
  whirr(){ sweep(80,240,0.5,'sawtooth',0.03); },                                          // 벨트 재가동
  plop(){ tone(240,0.07,'triangle',0.05); tone(160,0.06,'triangle',0.04,0.03); },        // 분류함에 떨어짐
  shuffle(){ for(let i=0;i<4;i++) noise(0.05,0.06,2200,'bandpass',i*0.06); },             // 책 여러 권 옮기기
  truck(){ tone(110,0.35,'sawtooth',0.04); tone(90,0.35,'sawtooth',0.04,0.3); tone(440,0.12,'square',0.04,0.75); tone(440,0.18,'square',0.04,0.95); }, // 부릉 + 빵빵
  ping(){ tone(1320,0.15,'sine',0.04); tone(990,0.2,'sine',0.03,0.1); },
  chime(){ tone(1046,0.9,'sine',0.035); tone(1568,0.9,'sine',0.02,0.02); tone(784,1.2,'sine',0.025,0.45); },   // 정시 종
  alarm(){ tone(988,0.1,'square',0.03); tone(784,0.1,'square',0.03,0.12); },
  done(){ [784,988,1175].forEach((f,i)=>tone(f,0.18,'triangle',0.05,i*0.07)); },
  ding(){ tone(1318,0.5,'sine',0.05); tone(1046,0.7,'sine',0.04,0.25); },
  start(){ [523,659,784,1046].forEach((f,i)=>tone(f,0.25,'triangle',0.06,i*0.09)); },
  win(){ [523,659,784,1046,1318].forEach((f,i)=>tone(f,0.35,'triangle',0.07,i*0.11)); tone(1568,0.8,'sine',0.05,0.6); },
  lose(){ [392,370,349,294].forEach((f,i)=>tone(f,i===3?0.9:0.3,'sawtooth',0.045,i*0.32)); },
};

// ---------- 배경음악: 도서관 로파이 (이용자 수에 따라 템포·악기가 늘어남) ----------
const MUS = { on:false, next:0, step:0, timer:null, motif:[] };
const mtof = m => 440*Math.pow(2,(m-69)/12);
// Fmaj7 → Em7 → Dm7 → Cmaj7
const PROG = [[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]];
const PENTA = [60,62,64,67,69,72,74,76,79];
function makeMotif(){
  const m=[]; let idx=4;
  for(let i=0;i<32;i++){
    const strong = i%2===0;
    if(Math.random() < (strong?0.55:0.18)){ idx=clamp(idx+pick([-2,-1,-1,0,1,1,2]),0,PENTA.length-1); m.push(idx); }
    else m.push(null);
  }
  return m;
}
function bpm(){ return 68 + (S ? patrons() : 20)*0.24; }   // 한산 68 → 붐빔 92
function musicStart(){
  if(!AC || MUS.on) return;
  MUS.on=true; MUS.next=AC.currentTime+0.15; MUS.step=0; MUS.motif=makeMotif();
  MUS.timer=setInterval(musicSchedule,50);
}
function musicStop(){ MUS.on=false; clearInterval(MUS.timer); }
function musicSchedule(){
  if(!MUS.on || !AC) return;
  if(MUS.next < AC.currentTime-0.1) MUS.next = AC.currentTime+0.05;   // 탭이 잠깐 멈췄으면 몰아서 치지 말고 건너뛰기
  while(MUS.next < AC.currentTime+0.4){
    musicStep(MUS.step, MUS.next);
    MUS.next += 60/bpm()/2; MUS.step++;
    if(MUS.step%64===0) MUS.motif=makeMotif();   // 8마디마다 새 멜로디
  }
}
function kick(t){ const o=toneAt(110,t,0.18,'sine',0.22,MUSG,0.002); o.frequency.setValueAtTime(110,t); o.frequency.exponentialRampToValueAtTime(42,t+0.15); }
function musicStep(step,t){
  const bar=Math.floor(step/8)%4, pos=step%8, ch=PROG[bar], beat=60/bpm();
  const p = S ? patrons() : 20;
  const tense = S && S.running && (S.desk.pile.length>PILE_WARN || S.dock.belt.stop || S.rep<30 || S.tasks.some(t=>!t.done && !t.failed && t.due-S.min<15 && S.min>=t.start));
  // 패드 화음 + 베이스
  if(pos===0){
    ch.forEach((m,i)=>toneAt(mtof(m),t+i*0.012,beat*4*0.95,'triangle',0.018,MUSG,0.35));
    toneAt(mtof(ch[0]-12),t,beat*1.8,'sine',0.11,MUSG,0.02);
  }
  if(pos===5) toneAt(mtof(ch[0]-12+7),t,beat*1.2,'sine',0.08,MUSG,0.02);
  // 드럼: 사람이 늘면 들어옴
  if(p>35){ if(pos===0||pos===5) kick(t); if(pos===4) noiseAt(t,0.14,0.07,1800,'bandpass',MUSG); }
  if(p>65 || tense) noiseAt(t,0.035,pos%2?0.012:0.022,7000,'highpass',MUSG);
  // 멜로디 (전자피아노 느낌: 사인 + 배음)
  const n = MUS.motif[step%32];
  if(n!=null){
    const f = mtof(PENTA[n]);
    toneAt(f,t,beat*1.4,'sine',0.05,MUSG,0.01);
    toneAt(f*2,t,beat*0.5,'sine',0.012,MUSG,0.005);
    if(tense) toneAt(f*1.5,t,beat*0.3,'square',0.008,MUSG,0.005);  // 급할 땐 살짝 날카롭게
  }
}
// 이용자 좌석에 앉아 있으면 음악이 먹먹하게 (멀리서 들리는 느낌)
function musicMood(){
  if(!AC || !MUSLP) return;
  const target = S && S.sit ? 700 : 2400;
  if(Math.abs(MUSLP.frequency.value-target)>50) MUSLP.frequency.setTargetAtTime(target,AC.currentTime,0.4);
}

