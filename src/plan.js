/* ---------- PLAN GENERATOR ---------- */
const HARD=['ss','thr','vo2','ana','tempo','int','test'];
function goalCats(p){
 const m={ftp:['ss','thr','vo2'],weight:['tempo','ss','z2'],endur:['tempo','ss','z2'],race:['thr','vo2','tempo'],fun:['cad','ana','z2']};
 const out=[];(p.goals.length?p.goals:['endur']).forEach(g=>(m[g]||[]).forEach(c=>{if(!out.includes(c))out.push(c)}));
 return out.length?out:['tempo','ss'];
}
function pickW(sport,cat,min,level,seed){
 let c=LIB.filter(w=>w.sport===sport&&w.cat===cat&&(level==='adv'||w.level!=='adv'));
 if(!c.length)c=LIB.filter(w=>w.sport===sport&&w.cat===cat);
 if(!c.length)c=LIB.filter(w=>w.sport===sport);
 let fit=c.filter(w=>w.dur<=min+10);
 if(!fit.length){const FB={ss:['tempo','thr','z2'],thr:['ss','tempo','vo2'],vo2:['thr','ana','tempo'],tempo:['ss','z2'],ana:['vo2','cad'],z2:['rec','cad'],cad:['rec'],long:['easy'],int:['tempo','easy'],tempo_r:['easy'],aer:['tech','int']}[cat]||[];
  for(const fc of FB){const f2=LIB.filter(w=>w.sport===sport&&w.cat===fc&&w.dur<=min+10&&(level==='adv'||w.level!=='adv'));if(f2.length){fit=f2;break}}}
 if(!fit.length)fit=LIB.filter(w=>w.sport===sport&&w.cat!=='test'&&w.dur<=min+10&&(level==='adv'||w.level!=='adv'));
 if(!fit.length)fit=c.slice().sort((x,y)=>x.dur-y.dur).slice(0,1);
 const pool=fit.length?fit:c;
 const best=Math.min(...pool.map(w=>Math.abs(min-w.dur)));
 const near=pool.filter(w=>Math.abs(min-w.dur)<=best+15);
 return near[(seed||0)%near.length];
}
function wTSS(w){if(!w)return 0;let t=0;w.segs.forEach(s=>{if(s.t==='i')t+=s.n*(s.on*s.onP*s.onP+s.off*s.offP*s.offP);else if(s.t==='s')t+=s.d*s.p*s.p;else t+=s.d*((s.lo+s.hi)/2)**2});return Math.round(t/36)}
function wKcal(w,p){if(!w)return 0;const ftp=(p&&p.form.ftp)||220;if(w.sport==='bike'){let kj=0;w.segs.forEach(s=>{if(s.t==='i')kj+=s.n*(s.on*s.onP+s.off*s.offP)*ftp;else if(s.t==='s')kj+=s.d*s.p*ftp;else kj+=s.d*(s.lo+s.hi)/2*ftp});return Math.round(kj/1000*1.05)}
 const per={run:11,swim:9,gym:6}[w.sport]||7;return Math.round(w.dur*per*((p?p.weight:75)/80))}
function genWeek(p,wk,scale){
 scale=scale||1;const cats=goalCats(p);const sp=p.sports;const res=[];
 const lvl=sp.bike&&sp.bike.level||'mid';
 const bikeDays=[],runDays=[],swimDays=[],gymDays=[];
 p.days.forEach((d,i)=>{const ss=[...new Set(d.acts.map(a=>ACTS[a].s))];ss.forEach(s=>{({bike:bikeDays,run:runDays,swim:swimDays,gym:gymDays})[s].push(i)})});
 const longBike=bikeDays.length>1?bikeDays.reduce((a,b)=>p.days[b].min>p.days[a].min?b:a,bikeDays[0]):-1;
 const perMin=i=>{const n=new Set(p.days[i].acts.map(a=>ACTS[a].s)).size||1;return p.days[i].min/n};
 const longRun=runDays.length>1?runDays.reduce((a,b)=>perMin(b)>perMin(a)?b:a,runDays[0]):-1;
 const runOnly=runDays.filter(i=>new Set(p.days[i].acts.map(a=>ACTS[a].s)).size===1);
 const runTestDay=(runOnly.find(i=>i!==longRun)??runOnly[0]??runDays.find(i=>i!==longRun)??runDays[0]);
 const needFtp=!p.form.ftp,needRun=!p.form.run5k&&sp.run.on&&!sp.run.own,needSwim=!p.form.swim1500&&sp.swim.on&&!sp.swim.own;
 let k=wk,prevHard=false,testDone={bike:false,run:false,swim:false},runN=0,swimN=0,gymN=0;
 for(let i=0;i<7;i++){
  const d=p.days[i];const items=[];
  const ss=[...new Set(d.acts.map(a=>ACTS[a].s))];
  const per=ss.length?Math.round(d.min*scale/ss.length):0;let dayHard=false;
  ss.forEach(s=>{
   if(sp[s]&&sp[s].own){items.push({sport:s,log:true,min:per});return}
   let cat;
   if(s==='bike'){
    if(wk===0&&needFtp&&!testDone.bike&&i!==longBike){cat='test';testDone.bike=true}
    else if(i===longBike)cat=p.goals.includes('fun')?'z2':'z2';
    else if(prevHard)cat=(i%2?'rec':'cad');
    else{cat=cats[k%cats.length];k++}
    const w=cat==='test'&&per>=30?LIB.find(x=>x.sport==='bike'&&x.cat==='test'):pickW('bike',cat,per,lvl,wk+i);items.push({sport:s,w:w.id,min:w.dur});if(HARD.includes(w.cat))dayHard=true;
   }else if(s==='run'){
    if(wk===0&&needRun&&!testDone.run&&i===runTestDay){cat='test';testDone.run=true}
    else if(i===longRun&&perMin(i)>=55)cat='long';
    else if(runN===0&&!prevHard)cat=sp.run.level==='beg'?'tempo':(wk%2?'tempo':'int');
    else cat='easy';
    runN++;const w=pickW('run',cat,per,sp.run.level,wk+i);items.push({sport:s,w:w.id,min:w.dur});if(HARD.includes(w.cat))dayHard=true;
   }else if(s==='swim'){
    if(wk===0&&needSwim&&!testDone.swim){cat='test';testDone.swim=true}else cat=['tech','int','aer'][(swimN+wk)%3];
    swimN++;const w=pickW('swim',cat,per,sp.swim.level,wk+i);items.push({sport:s,w:w.id,min:w.dur});
   }else{cat=gymN%2?'core':'str';gymN++;const w=pickW('gym',cat,per,sp.gym.level,wk+i);items.push({sport:s,w:w.id,min:w.dur})}
  });
  prevHard=dayHard;res.push({i,items,tod:d.tod,rest:!items.length});
 }
 return res;
}
function dayLoad(d){return d.items.reduce((a,it)=>a+(it.w?wTSS(libById(it.w)):Math.round(it.min*.6)),0)}
function dayMin(d){return d.items.reduce((a,it)=>a+it.min,0)}

/* ---------- CHARTS ---------- */
function zoneCol(p){return p<.6?'#3B4A7A':p<.76?'#4E66C9':p<.9?'#7C95FF':p<1.05?'#9C8CF5':p<1.2?'#B99BF7':'#D9C6FF'}
function flatSegs(w){const a=[];w.segs.forEach(s=>{if(s.t==='i'){for(let n=0;n<s.n;n++){a.push({d:s.on,p0:s.onP,p1:s.onP});a.push({d:s.off,p0:s.offP,p1:s.offP})}}else if(s.t==='s')a.push({d:s.d,p0:s.p,p1:s.p});else a.push({d:s.d,p0:s.lo,p1:s.hi})});return a}
function wChart(w,h){h=h||56;const segs=flatSegs(w);const tot=segs.reduce((a,s)=>a+s.d,0);const W=300;let x=0;let out='';
 const max=Math.max(1.3,...segs.map(s=>Math.max(s.p0,s.p1)));
 segs.forEach(s=>{const sw=s.d/tot*W;const y0=h-s.p0/max*h,y1=h-s.p1/max*h;out+=`<path d="M${x.toFixed(2)} ${h} L${x.toFixed(2)} ${y0.toFixed(1)} L${(x+sw).toFixed(2)} ${y1.toFixed(1)} L${(x+sw).toFixed(2)} ${h}Z" fill="${zoneCol((s.p0+s.p1)/2)}"/>`;x+=sw});
 const ftpY=h-1/max*h;
 return `<svg class="wchart" viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" width="100%" height="${h}">${out}<line x1="0" x2="${W}" y1="${ftpY}" y2="${ftpY}" stroke="rgba(255,255,255,.35)" stroke-dasharray="3 3" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`}
function lineChart(vals,opts){opts=opts||{};const W=320,H=opts.h||120,pad=8;const all=vals.concat(opts.target!=null?[opts.target]:[]);
 let mn=Math.min(...all),mx=Math.max(...all);if(mx===mn){mx+=1;mn-=1}const r=mx-mn;mn-=r*.15;mx+=r*.15;
 const X=i=>pad+i*(W-2*pad)/(vals.length-1),Y=v=>H-pad-(v-mn)/(mx-mn)*(H-2*pad);
 const pts=vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
 let t='';if(opts.target!=null)t=`<line x1="${pad}" x2="${W-pad}" y1="${Y(opts.target)}" y2="${Y(opts.target)}" stroke="#B99BF7" stroke-dasharray="4 4" stroke-width="1.5"/>`;
 const col=opts.col||'#7C95FF';
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="lc">${t}<polygon points="${X(0)},${H} ${pts} ${X(vals.length-1)},${H}" fill="${col}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(vals.length-1)}" cy="${Y(vals[vals.length-1])}" r="4" fill="${col}"/></svg>`}
function multiLine(series,h){const W=320,H=h||130,pad=8;const all=series.flatMap(s=>s.v);let mn=Math.min(...all),mx=Math.max(...all);const r=mx-mn||1;mn-=r*.1;mx+=r*.1;
 const n=series[0].v.length;const X=i=>pad+i*(W-2*pad)/(n-1),Y=v=>H-pad-(v-mn)/(mx-mn)*(H-2*pad);
 const zero=mn<0&&mx>0?`<line x1="${pad}" x2="${W-pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.15)"/>`:'';
 return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${zero}${series.map(s=>`<polyline points="${s.v.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}" fill="none" stroke="${s.c}" stroke-width="2.2" ${s.dash?'stroke-dasharray="4 3"':''} stroke-linejoin="round"/>`).join('')}</svg>`}
function barChart(vals,labels,opts){opts=opts||{};const W=320,H=opts.h||110,pad=4,lb=18;const mx=Math.max(...vals)*1.1||1;const bw=(W-2*pad)/vals.length;
 return `<svg viewBox="0 0 ${W} ${H+lb}" width="100%" height="${H+lb}">${vals.map((v,i)=>{const bh=v/mx*H;const hl=opts.hl===i;return `<rect x="${pad+i*bw+bw*.18}" y="${H-bh}" width="${bw*.64}" height="${Math.max(2,bh)}" rx="4" fill="${hl?'#7C95FF':'#3A4766'}"/><text x="${pad+i*bw+bw/2}" y="${H+14}" text-anchor="middle" font-size="11" fill="#8B93A7">${labels[i]}</text>`}).join('')}</svg>`}

/* ---------- ZWO ---------- */
function xmlEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function toZwo(w){
 const r=x=>(+x).toFixed(2);let body='';
 w.segs.forEach(s=>{if(s.t==='w')body+=`    <Warmup Duration="${s.d}" PowerLow="${r(s.lo)}" PowerHigh="${r(s.hi)}"/>\n`;
  else if(s.t==='c')body+=`    <Cooldown Duration="${s.d}" PowerLow="${r(s.lo)}" PowerHigh="${r(s.hi)}"/>\n`;
  else if(s.t==='s')body+=`    <SteadyState Duration="${s.d}" Power="${r(s.p)}"/>\n`;
  else body+=`    <IntervalsT Repeat="${s.n}" OnDuration="${s.on}" OffDuration="${s.off}" OnPower="${r(s.onP)}" OffPower="${r(s.offP)}"/>\n`});
 return `<?xml version="1.0" encoding="UTF-8"?>\n<workout_file>\n  <author>TRITON Triathlon Team</author>\n  <name>${xmlEsc(w.name)}</name>\n  <description>${xmlEsc(w.goal)}</description>\n  <sportType>bike</sportType>\n  <tags><tag name="TRITON"/></tags>\n  <workout>\n${body}  </workout>\n</workout_file>\n`}
function translit(s){const m={а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia'};return s.toLowerCase().split('').map(c=>m[c]!=null?m[c]:c).join('').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function downloadZwo(id){const w=libById(id);if(!w||w.sport!=='bike')return;const x=toZwo(w);window.__lastZwo=x;
 try{const b=new Blob([x],{type:'application/xml'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=translit(w.name)+'.zwo';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}catch(e){}
 toast('Файл .zwo збережено. Відкрийте його в Zwift.')}
function downloadText(name,text,type){try{const b=new Blob([text],{type:type||'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}catch(e){}}

