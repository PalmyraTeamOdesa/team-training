/* ---------- WORKOUT IMPORT: .fit / .gpx / .tcx (also inside .zip / .gz), many files at once ---------- */
const IMP_RX=/\.(fit|gpx|tcx)(\.gz)?$/i;
const IMP_MAX_FILES=40,IMP_MAX_BYTES=25*1024*1024;
const FIT_MFR={1:'Garmin',23:'Suunto',32:'Wahoo',89:'Tacx',123:'Polar',260:'Zwift',265:'Strava',267:'Bryton',294:'COROS'};
function impCan(){return !!(st.me&&st.me.status==='active'&&st.me.onboarded&&(!st.coach||st.coachSelf))}
function pickActivityFile(){
 const i=document.createElement('input');i.type='file';i.multiple=true;
 i.accept='.fit,.gpx,.tcx,.zip,.gz,application/octet-stream,application/vnd.ant.fit,application/gpx+xml,application/vnd.garmin.tcx+xml,application/xml,text/xml,application/zip,application/gzip';
 i.onchange=()=>i.files&&i.files.length&&importFiles(Array.from(i.files));i.click()}
async function impBytes(stream){return new Response(stream).arrayBuffer()}
async function gunzip(buf){if(typeof DecompressionStream==='undefined')throw new Error('gz');return impBytes(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')))}
async function inflateRaw(u8){if(typeof DecompressionStream==='undefined')throw new Error('zip');return impBytes(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw')))}
/* minimal ZIP reader (central directory; stored + deflate) */
async function unzip(buf){
 const dv=new DataView(buf),u8=new Uint8Array(buf);let e=-1;
 for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-65557);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
 if(e<0)throw new Error('zip');
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];const td=new TextDecoder();
 for(let k=0;k<n&&p+46<=buf.byteLength;k++){
  if(dv.getUint32(p,true)!==0x02014b50)break;
  const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),usize=dv.getUint32(p+24,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
  const name=td.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
  if(!IMP_RX.test(name)||/(^|\/)(__MACOSX|\.)/.test(name)||usize>IMP_MAX_BYTES)continue;
  const ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);const raw=u8.subarray(ds,ds+csize);
  let data;if(method===0)data=raw.slice().buffer;else if(method===8)data=await inflateRaw(raw);else continue;
  out.push({name:name.split('/').pop(),buf:data});if(out.length>=IMP_MAX_FILES)break}
 return out}
/* files → [{name,buf}] (unpacks .zip and .gz) */
async function impExpand(files){
 const out=[],bad=[];
 for(const f of files){
  if(out.length>=IMP_MAX_FILES)break;
  const nm=f.name||'workout';
  if(f.size>IMP_MAX_BYTES*2){bad.push({name:nm,err:'Файл завеликий (до 25 МБ)'});continue}
  try{
   let buf=await f.arrayBuffer();const u8=new Uint8Array(buf,0,Math.min(4,buf.byteLength));
   if(u8[0]===0x50&&u8[1]===0x4b){const z=await unzip(buf);if(!z.length)bad.push({name:nm,err:'В архіві немає .fit, .gpx чи .tcx'});out.push(...z);continue}
   let name=nm;if(u8[0]===0x1f&&u8[1]===0x8b){buf=await gunzip(buf);name=nm.replace(/\.gz$/i,'')}
   if(buf.byteLength>IMP_MAX_BYTES){bad.push({name:nm,err:'Файл завеликий (до 25 МБ)'});continue}
   out.push({name,buf})}catch(e){console.warn(e);bad.push({name:nm,err:'Не вдалося розпакувати'})}}
 return {files:out,bad}}
async function impHash(buf){try{const h=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(h).slice(0,16)).map(b=>b.toString(16).padStart(2,'0')).join('')}catch(e){let x=2166136261;const u=new Uint8Array(buf);for(let i=0;i<u.length;i++){x^=u[i];x=Math.imul(x,16777619)>>>0}return 'f'+x.toString(16)+'_'+u.length}}
function impKind(name,buf){const u=new Uint8Array(buf,0,Math.min(64,buf.byteLength));if(u.length>12&&u[8]===0x2e&&u[9]===0x46&&u[10]===0x49&&u[11]===0x54)return 'fit';
 const head=new TextDecoder().decode(u).toLowerCase();const ext=(name.split('.').pop()||'').toLowerCase();
 if(ext==='gpx'||ext==='tcx')return ext;if(/<gpx|<\?xml/.test(head)){const t=new TextDecoder().decode(new Uint8Array(buf,0,Math.min(2000,buf.byteLength)));return /TrainingCenterDatabase/.test(t)?'tcx':'gpx'}return ext}
/* parse one file → array of activities (multisport FIT gives several) */
function parseActivity(name,buf){const k=impKind(name,buf);
 if(k==='fit')return parseFit(buf);
 if(k==='gpx'||k==='tcx')return [parseXmlActivity(new TextDecoder().decode(buf),k)];
 throw new Error('type')}
function hav(a,b){const R=6371e3,t=Math.PI/180;const dLa=(b[0]-a[0])*t,dLo=(b[1]-a[1])*t;const x=Math.sin(dLa/2)**2+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
/* NP from (t sec, watts) samples, resampled to 1 s */
function npOf(samples,times){
 let s=samples;if(times&&times.length===samples.length&&times.length>1){const t0=times[0],t1=times[times.length-1];if(t1-t0>=60&&t1-t0<86400){const r=[];let j=0;for(let t=t0;t<=t1;t++){while(j+1<times.length&&times[j+1]<=t)j++;r.push(samples[j])}s=r}}
 if(s.length<60)return 0;const roll=[];let a=0;for(let i=0;i<s.length;i++){a+=s[i];if(i>=30)a-=s[i-30];if(i>=29)roll.push(a/30)}return Math.pow(roll.reduce((x,v)=>x+v**4,0)/roll.length,.25)}
function elevGain(alts){let g=0,ref=null;for(const a of alts){if(!isFinite(a))continue;if(ref==null){ref=a;continue}if(a-ref>=2){g+=a-ref;ref=a}else if(ref-a>=2)ref=a}return g}
const avgOf=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
/* aerobic decoupling (Pa:Hr, %): efficiency (power / HR) of the 1st vs 2nd half of the ride, warm-up skipped. null when the file has no power+HR streams or is < 40 min */
function decOf(S){const v=S.filter(x=>x&&isFinite(x.t)&&x.pw!=null&&isFinite(x.pw)&&x.pw>=0&&x.pw<3000&&x.hr>40&&x.hr<230);if(v.length<120)return null;
 v.sort((a,b)=>a.t-b.t);const t0=v[0].t+600,t1=v[v.length-1].t;if(t1-v[0].t<2400)return null;const w=v.filter(x=>x.t>=t0);if(w.length<100)return null;
 const mid=(t0+t1)/2,A=w.filter(x=>x.t<mid),B=w.filter(x=>x.t>=mid);if(A.length<40||B.length<40)return null;
 const ef=h=>avgOf(h.map(x=>x.pw))/avgOf(h.map(x=>x.hr));const e1=ef(A),e2=ef(B);if(!(e1>0)||avgOf(A.map(x=>x.pw))<50)return null;
 const d=(e1-e2)/e1*100;return isFinite(d)?Math.max(-30,Math.min(40,+d.toFixed(1))):null}
function sportFrom(s){s=String(s||'').toLowerCase();
 if(/swim|плав/.test(s))return 'swim';if(/run|walk|hik|trail|treadmill|бег|біг/.test(s)||s==='9'||s==='running')return 'run';
 if(/bik|cycl|ride|velo|вело|zwift|rouvy|^1$|^2$/.test(s))return 'bike';if(/strength|gym|fitness|training|yoga|workout|weight|cardio|crossfit/.test(s))return 'gym';return ''}
function parseXmlActivity(text,ext){
 const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('xml');
 const all=(n,el)=>Array.from((el||doc).getElementsByTagNameNS('*',n));const kid=(el,n)=>{if(!el)return null;for(const c of el.children)if(c.localName===n)return c;return null};
 const num=(el,n)=>{const x=el.getElementsByTagNameNS('*',n)[0];return x?parseFloat(x.textContent):NaN};
 const val=(el,n)=>{const c=kid(el,n);if(!c)return NaN;const v=kid(c,'Value');return parseFloat((v||c).textContent)};
 let pts=[],sport='',title='',lap={};
 if(ext==='gpx'){
  pts=all('trkpt').map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon'),t:Date.parse((kid(p,'time')||{}).textContent||''),ele:parseFloat((kid(p,'ele')||{}).textContent),hr:num(p,'hr'),cad:num(p,'cad'),pw:(()=>{const a=num(p,'power');return isFinite(a)?a:num(p,'PowerInWatts')})()}));
  const trk=all('trk')[0];sport=sportFrom(trk&&(kid(trk,'type')||{}).textContent);title=((trk&&kid(trk,'name'))||all('name')[0]||{}).textContent||'';
 }else{
  const act=all('Activity')[0];sport=sportFrom(act?act.getAttribute('Sport'):'');
  pts=all('Trackpoint').map(p=>({lat:num(p,'LatitudeDegrees'),lon:num(p,'LongitudeDegrees'),t:Date.parse((kid(p,'Time')||{}).textContent||''),ele:num(p,'AltitudeMeters'),hr:val(p,'HeartRateBpm'),cad:(()=>{const c=kid(p,'Cadence');return c?parseFloat(c.textContent):num(p,'RunCadence')})(),pw:num(p,'Watts'),d:num(p,'DistanceMeters')}));
  const laps=all('Lap');const sum=f=>laps.reduce((a,l)=>a+(f(l)||0),0);
  lap={tt:sum(l=>parseFloat((kid(l,'TotalTimeSeconds')||{}).textContent)),td:sum(l=>parseFloat((kid(l,'DistanceMeters')||{}).textContent)),kc:sum(l=>parseFloat((kid(l,'Calories')||{}).textContent)),
   hrMax:Math.max(0,...laps.map(l=>val(l,'MaximumHeartRateBpm')).filter(isFinite)),start:laps[0]?Date.parse(laps[0].getAttribute('StartTime')||''):NaN};
  const nt=act&&kid(act,'Notes');title=nt?nt.textContent:'';
 }
 const times=pts.map(p=>p.t).filter(isFinite);
 let dist=0,moving=0,elapsed=times.length>1?(times[times.length-1]-times[0])/1000:0,geo=false;
 for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(isFinite(b.lat)&&isFinite(a.lat)&&(a.lat||a.lon)&&(b.lat||b.lon)){geo=true;const d=hav([a.lat,a.lon],[b.lat,b.lon]);dist+=d;const dt=(b.t-a.t)/1000;if(dt>0&&dt<=30&&d/dt>0.4)moving+=dt}}
 const maxD=Math.max(0,...pts.map(p=>p.d).filter(isFinite));if(maxD>0)dist=maxD;
 const hrs=pts.map(p=>p.hr).filter(x=>isFinite(x)&&x>30&&x<240),cad=pts.map(p=>p.cad).filter(x=>isFinite(x)&&x>0&&x<250);
 const pwI=pts.map((p,i)=>i).filter(i=>isFinite(pts[i].pw)&&pts[i].pw>=0&&pts[i].pw<3000),pws=pwI.map(i=>pts[i].pw),pwt=pwI.map(i=>pts[i].t/1000);
 let dur=ext==='tcx'&&lap.tt?lap.tt:(geo&&moving>60&&moving<elapsed*.98?moving:elapsed);
 const start=times.length?new Date(times[0]):isFinite(lap.start)?new Date(lap.start):null;
 if(!dist&&ext==='tcx'&&lap.td)dist=lap.td;else if(ext==='tcx'&&lap.td)dist=lap.td;
 if(!sport){const v=dur?dist/dur*3.6:0;sport=v>15?'bike':v>3?'run':'bike'}
 return {sport,title:title.trim(),start,dur,elapsed,dist,elev:elevGain(pts.map(p=>p.ele)),hr:avgOf(hrs),hrMax:hrs.length?Math.max(...hrs):(lap.hrMax||0),
  pow:avgOf(pws),powMax:pws.length?Math.max(...pws):0,np:npOf(pws,pwt.every(isFinite)?pwt:null),cad:avgOf(cad.filter(c=>c>0)),kcal:ext==='tcx'?lap.kc||0:0,device:'',kind:ext,dec:pws.length?decOf(pts.map(p=>({t:p.t/1000,pw:p.pw,hr:p.hr}))):null}}
/* minimal FIT decoder: file_id(0), session(18), lap(19), record(20); compressed timestamps, developer fields */
function parseFit(buf){
 const dv=new DataView(buf);const hs=dv.getUint8(0);if(buf.byteLength<12||String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11))!=='.FIT')throw new Error('fit');
 const dataLen=dv.getUint32(4,true);let pos=hs;const end=Math.min(buf.byteLength-0,hs+dataLen);const defs={};const sessions=[],recs=[];let fid=null,lastTs=null;
 const SZ={0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};
 const rd=(b,o,le)=>{switch(b){case 0:case 2:case 10:case 13:return dv.getUint8(o);case 1:return dv.getInt8(o);case 3:return dv.getInt16(o,le);case 4:case 11:return dv.getUint16(o,le);case 5:return dv.getInt32(o,le);case 6:case 12:return dv.getUint32(o,le);case 8:return dv.getFloat32(o,le);default:return null}};
 const inval=(b,v)=>v==null||((b===2||b===0||b===13)&&v===0xff)||(b===10&&v===0)||(b===4&&v===0xffff)||(b===11&&v===0)||(b===6&&v===0xffffffff)||(b===12&&v===0)||(b===1&&v===0x7f)||(b===3&&v===0x7fff)||(b===5&&v===0x7fffffff)||(b===8&&!isFinite(v));
 function readMsg(d,p,cts){const m={};for(const f of d.fields){const b=f.t&0x1f;const u=SZ[b];if(u&&f.s===u&&p+u<=buf.byteLength){const v=rd(b,p,d.le);if(!inval(b,v))m[f.n]=v}p+=f.s}p+=d.dev;
  if(m[253]!=null)lastTs=m[253];else if(cts!=null&&lastTs!=null){const ts=lastTs+((cts-(lastTs&0x1f))&0x1f);m[253]=ts;lastTs=ts}
  if(d.gm===18)sessions.push(m);else if(d.gm===20)recs.push(m);else if(d.gm===0&&!fid)fid=m;return p}
 while(pos<end){
  const h=dv.getUint8(pos++);
  if(h&0x80){const d=defs[(h>>5)&3];if(!d)break;pos=readMsg(d,pos,h&0x1f);continue}
  const lt=h&0x0f;
  if(h&0x40){pos++;const le=dv.getUint8(pos++)===0;const gm=dv.getUint16(pos,le);pos+=2;const nf=dv.getUint8(pos++);const fields=[];for(let i=0;i<nf;i++){fields.push({n:dv.getUint8(pos),s:dv.getUint8(pos+1),t:dv.getUint8(pos+2)});pos+=3}
   let dev=0;if(h&0x20){const nd=dv.getUint8(pos++);for(let i=0;i<nd;i++){dev+=dv.getUint8(pos+1);pos+=3}}defs[lt]={le,gm,fields,dev}}
  else{const d=defs[lt];if(!d)break;pos=readMsg(d,pos,null)}
 }
 const T=x=>x!=null?new Date((x+631065600)*1000):null;
 const SP={1:'run',2:'bike',5:'swim',4:'gym',10:'gym',11:'run',17:'run',20:'gym',30:'run',43:'swim'};
 const device=fid?(FIT_MFR[fid[1]]!=null?FIT_MFR[fid[1]]:''):'';
 const fromRecs=(R,s)=>{const pw=R.filter(r=>r[7]!=null&&r[7]<3000),hr=R.map(r=>r[3]).filter(v=>v!=null&&v>30&&v<240),cad=R.map(r=>r[4]).filter(v=>v!=null&&v>0&&v<250);
  const alt=R.map(r=>r[78]!=null?r[78]/5-500:r[2]!=null?r[2]/5-500:NaN);const ds=R.map(r=>r[5]).filter(v=>v!=null);const ts=R.map(r=>r[253]).filter(v=>v!=null);
  return {pow:avgOf(pw.map(r=>r[7])),powMax:pw.length?Math.max(...pw.map(r=>r[7])):0,np:npOf(pw.map(r=>r[7]),pw.every(r=>r[253]!=null)?pw.map(r=>r[253]):null),hr:avgOf(hr),hrMax:hr.length?Math.max(...hr):0,cad:avgOf(cad),elev:elevGain(alt),
   dist:ds.length?(ds[ds.length-1]-(s?0:ds[0]))/100:0,t0:ts[0],t1:ts[ts.length-1],dec:pw.length?decOf(R.map(r=>({t:r[253],pw:r[7],hr:r[3]}))):null}};
 const list=sessions.filter(s=>s[5]!==3);
 if(!list.length){if(!recs.length)throw new Error('fit-empty');const r=fromRecs(recs,null);const dur=r.t1!=null&&r.t0!=null?r.t1-r.t0:0;
  return [{sport:'bike',title:'',start:T(r.t0),dur,elapsed:dur,dist:r.dist,elev:r.elev,hr:r.hr,hrMax:r.hrMax,pow:r.pow,powMax:r.powMax,np:r.np,cad:r.cad,kcal:0,device,kind:'fit',dec:r.dec}]}
 return list.map((s,idx)=>{
  const t0=s[2],elapsed=s[7]!=null?s[7]/1000:0,t1=s[253]!=null&&s[253]>t0?s[253]:(t0!=null?t0+elapsed:null);
  const R=t0!=null?recs.filter(r=>r[253]!=null&&r[253]>=t0&&r[253]<=t1):recs;const r=fromRecs(R,s);
  const sport=SP[s[5]]||(s[6]===58||s[6]===6?'bike':'')||sportFrom(String(s[5]))||'bike';
  return {sport,title:'',start:T(t0)||T(r.t0),dur:s[8]!=null?s[8]/1000:elapsed,elapsed,dist:s[9]!=null?s[9]/100:r.dist,elev:s[22]!=null?s[22]:r.elev,
   hr:s[16]||r.hr,hrMax:s[17]||r.hrMax,pow:s[20]||r.pow,powMax:s[21]||r.powMax,np:s[34]||r.np,cad:s[18]||r.cad,kcal:s[11]||0,
   tss:s[35]!=null?s[35]/10:0,if:s[36]!=null?s[36]/1000:0,device,kind:'fit',dec:r.dec,idx:list.length>1?idx:null}})}
/* ---------- load metrics ---------- */
function impLthr(p){const f=(p&&p.form)||{};if(+f.lthr)return +f.lthr;if(+f.hrMax)return Math.round(+f.hrMax*.89);return 0}
function impLoad(a,p){const ftp=+(p.form&&p.form.ftp)||0;const h=(a.dur||0)/3600;const pw=a.np||a.pow;
 if(a.sport==='bike'&&ftp&&pw){const IF=pw/ftp;return {tss:Math.round(h*IF*IF*100),IF:+IF.toFixed(2),how:'power'}}
 if(a.tss&&a.tss<1000)return {tss:Math.round(a.tss),IF:a.if?+a.if.toFixed(2):null,how:'device'};
 const lt=impLthr(p);if(a.hr&&lt){const IF=Math.min(1.3,a.hr/lt);return {tss:Math.round(h*IF*IF*100),IF:+IF.toFixed(2),how:'hr'}}
 return {tss:Math.round((a.dur/60)*25/60*1.1),IF:null,how:'est'}}
/* ---------- matching ---------- */
function impWkI(day){const diff=Math.round((parseIso(day)-dayDate(0,0))/864e5);const wk=Math.floor(diff/7);return {wk,i:diff-wk*7}}
function impPlanMatch(day,sport,taken){
 const {wk,i}=impWkI(day);if(wk<-12||wk>0)return null;let d;try{d=weekPlan(st.me.id,wk,true).days[i]}catch(e){return null}
 if(!d||d.rest)return null;const it=d.items.find(x=>x.sport===sport&&!taken.has(day+'|'+(x.w||x.sport)));if(!it)return null;
 if(st.logs.some(l=>l.day===day&&l.status==='done'&&l.workout_id&&l.workout_id===it.w))return null;
 return {w:it.w||null,key:day+'|'+(it.w||it.sport),name:typeof itemName==='function'?itemName(it):SPORT[sport].n}}
function impDup(a,ext){const t=a.start?a.start.getTime():null;
 const ex=st.logs.find(l=>l.external_id&&l.external_id===ext);if(ex)return {kind:'same',log:ex};
 if(t!=null){const near=st.logs.find(l=>l.status==='done'&&l.started_at&&Math.abs(Date.parse(l.started_at)-t)<=5*60e3&&(!l.duration_min||Math.abs(l.duration_min-a.dur/60)<=Math.max(5,l.duration_min*.15)));if(near)return {kind:'near',log:near}}
 return null}
function impManual(day,sport){return st.logs.find(l=>l.day===day&&l.sport===sport&&l.status==='done'&&l.source==='manual'&&!l.external_id&&!l.file_path)}
/* ---------- entry point ---------- */
async function importFiles(files){
 if(!impCan()){toast(st.coach&&!st.coachSelf?'Імпорт є у вашому кабінеті спортсмена':'Імпорт тренувань доступний учасникам команди','info');return}
 toast('Читаю файли…','upload');
 const {files:list,bad}=await impExpand(files);const items=[];const taken=new Set();const p=me();const today=dayIso(0,TODAY);
 for(const f of list){
  let acts;const hash=await impHash(f.buf);
  try{acts=parseActivity(f.name,f.buf)}catch(e){console.warn(e);bad.push({name:f.name,err:/type/.test(e.message)?'Непідтримуваний формат':'Не вдалося прочитати файл'});continue}
  acts.forEach((a,k)=>{
   if(!a.dur||a.dur<60){bad.push({name:f.name,err:'Немає часу тренування'});return}
   const ext='file:'+hash+(a.idx!=null?':'+a.idx:'');let day=a.start?iso(a.start):today;if(day>today)day=today;
   const it={key:ext,name:f.name,buf:f.buf,hash,a,ext,day,title:a.title||(a.idx!=null?SPORT[a.sport].n+' · етап '+(a.idx+1):'')||(f.name.replace(/\.(fit|gpx|tcx)(\.gz)?$/i,'').replace(/[_]+/g,' ').slice(0,60))};
   if(/^\d{4}-\d\d-\d\d|^\d{6,}|^activity|^[0-9a-f-]{16,}$/i.test(it.title))it.title=SPORT[a.sport].n+(a.device?' · '+a.device:'');
   it.title=it.title.charAt(0).toUpperCase()+it.title.slice(1);
   it.dup=impDup(a,ext)||(items.find(x=>x.ext===ext||(x.a.start&&a.start&&Math.abs(x.a.start-a.start)<=5*60e3&&Math.abs(x.a.dur-a.dur)<=Math.max(300,x.a.dur*.15)))?{kind:'batch'}:null);
   it.manual=!it.dup?impManual(day,a.sport):null;it.mode=it.manual?'merge':'new';
   it.match=!it.dup&&!it.manual?impPlanMatch(day,a.sport,taken):null;if(it.match)taken.add(it.match.key);
   it.load=impLoad(a,p);it.sel=!it.dup;items.push(it)})}
 st._imp={items,bad};
 if(!items.length&&!bad.length){toast('Не знайдено файлів .fit, .gpx або .tcx','alert');return}
 openSheet('imp')}
function impStats(a){const s=[fmtMin(a.dur/60)];
 if(a.dist>0)s.push(a.sport==='swim'?fmtNum(a.dist)+' м':String(+(a.dist/1000).toFixed(1)).replace('.',',')+' км');
 if(a.elev>=10&&a.sport!=='swim')s.push('↑'+Math.round(a.elev)+' м');if(a.hr)s.push('♥ '+Math.round(a.hr)+(a.hrMax?'/'+Math.round(a.hrMax):''));
 if(a.np||a.pow)s.push((a.np?'NP ':'')+Math.round(a.np||a.pow)+' Вт');if(a.cad&&a.sport!=='swim')s.push(Math.round(a.cad)+(a.sport==='run'?' кр/хв':' об/хв'));return s.join(' · ')}
function impWhen(it){const d=it.a.start;return fmtDate(parseIso(it.day))+(d?', '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'):'')}
SHEETS.imp=()=>{const S=st._imp;if(!S)return {title:'Імпорт',body:''};const n=S.items.filter(x=>x.sel).length;
 const rows=S.items.map((it,k)=>{const st_=it.dup?(it.dup.kind==='batch'?tag('дубль у виборі','warn'):tag('вже є','warn')):it.manual?tag('оновить запис','a'):it.match?tag('за планом','ok'):tag('нове');
  const note=it.dup?(it.dup.log?'Вже є в щоденнику: '+esc(it.dup.log.title||'')+' ('+fmtDate(parseIso(it.dup.log.day))+')':'Цей самий запис уже є серед вибраних файлів'):it.manual?(it.mode==='merge'?'Замінить цифри у вашому ручному записі «'+esc(it.manual.title||'')+'» даними з файлу':'Збережеться окремим тренуванням поруч із ручним записом'):it.match?'Зарахується як «'+esc(it.match.name)+'» з плану':'Тренування поза планом';
  return `<div class="card flat s8"><div class="row12">${sportIco(it.a.sport)}<div class="grow"><div class="t14 w6 ell">${esc(it.title)}</div><div class="t12 sec">${impWhen(it)}${it.a.device?' · '+esc(it.a.device):''}</div></div><button class="tg ${it.sel?'on':''}" style="border:0" aria-label="Імпортувати" onclick="impToggle(${k})"></button></div>
  <div class="t12">${impStats(it.a)}${it.load?' · TSS '+it.load.tss+(it.load.how==='est'?' (оцінка)':''):''}</div><div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">${st_}<span class="t12 ter grow">${note}</span></div>
  ${it.manual&&!it.dup?`<div class="seg"><button class="${it.mode==='merge'?'on':''}" onclick="impMode(${k},'merge')">Оновити запис</button><button class="${it.mode==='new'?'on':''}" onclick="impMode(${k},'new')">Окреме тренування</button></div>`:''}</div>`}).join('');
 const bad=S.bad.length?`<div class="note warn">${ic('alert',20)}<span>${S.bad.map(b=>esc(b.name)+': '+esc(b.err)).join('<br>')}</span></div>`:'';
 return {title:'Імпорт тренувань',full:true,body:`<div class="stack"><div class="t14 sec">${S.items.length?'Знайдено '+S.items.length+' '+impPl(S.items.length)+'. Перевірте і збережіть: вони потраплять у щоденник, тренер побачить їх у вашому звіті.':'Не вдалося нічого імпортувати.'}</div>${bad}${rows}
  <button class="btn t" onclick="openSheet('impHelp')">${ic('info',18)} Як експортувати файл з годинника чи програми</button></div>`,
  foot:S.items.length?`<button class="btn p" ${n?'':'disabled'} onclick="impSave(this)">${n?'Зберегти '+n+' '+impPl(n):'Нічого не вибрано'}</button>`:''}};
function impPl(n){const a=n%10,b=n%100;return a===1&&b!==11?'тренування':a>=2&&a<=4&&(b<12||b>14)?'тренування':'тренувань'}
function impToggle(k){const it=st._imp.items[k];it.sel=!it.sel;renderSheet()}
function impMode(k,m){const it=st._imp.items[k];it.mode=m;if(m==='new'&&!it.match){it.match=impPlanMatch(it.day,it.a.sport,new Set(st._imp.items.filter(x=>x!==it&&x.match).map(x=>x.match.key)))}if(m==='merge')it.match=null;renderSheet()}
function impRow(it,file_path){const a=it.a,L=it.load||{};
 const dist=a.dist>0?(a.sport==='swim'?Math.round(a.dist):+(a.dist/1000).toFixed(2)):null;const dur=Math.max(1,Math.min(1440,Math.round(a.dur/60)));
 const pace=dist&&(a.sport==='run'||a.sport==='swim')?Math.round(a.sport==='run'?a.dur/dist:a.dur/dist*100):null;
 const r={duration_min:dur,distance:dist,avg_power:a.pow?Math.round(a.pow):null,np:a.np?Math.round(a.np):null,avg_hr:a.hr?Math.round(a.hr):null,max_hr:a.hrMax?Math.round(a.hrMax):null,
  cadence:a.cad&&a.sport!=='swim'?Math.round(a.cad):null,elevation_m:a.elev>=1&&a.sport!=='swim'?Math.round(a.elev):null,max_power:a.powMax?Math.round(a.powMax):null,kcal:a.kcal?Math.round(a.kcal):null,
  pace_sec:pace,tss:L.tss!=null?L.tss:null,intensity:L.IF||null,started_at:a.start?a.start.toISOString():null,external_id:it.ext,device:a.device||null,decoupling:a.dec!=null?a.dec:null,file_path:file_path||null,source:'file'};
 return r}
async function impUpload(it){const path=st.me.id+'/'+Date.now()+'_'+it.hash.slice(0,8)+'_'+it.name.replace(/[^\w.\-]+/g,'_').slice(-60);
 const r=await sb.storage.from('activity-files').upload(path,new Blob([it.buf]),{contentType:'application/octet-stream',upsert:false});if(r.error){console.warn(r.error);return null}return path}
async function impSave(btn){const S=st._imp;await busy(btn,async()=>{
 const sel=S.items.filter(x=>x.sel);let ins=0,upd=0,skip=0;const paths={};
 for(const it of sel){
  if(!paths[it.hash])paths[it.hash]=await impUpload(it);
  const base=impRow(it,paths[it.hash]);
  if(it.manual&&it.mode==='merge'&&!it.dup){const m=it.manual;const patch=Object.assign({},base,{title:m.title||it.title});
   const {data,error}=await sb.from('workout_logs').update(patch).eq('id',m.id).select().maybeSingle();if(error)throw error;if(data){st.logs=st.logs.map(l=>l.id===data.id?data:l);upd++}continue}
  const row=Object.assign({athlete_id:st.me.id,day:it.day,sport:it.a.sport,workout_id:it.match?it.match.w:null,title:it.match&&!it.a.title?it.match.name:it.title||SPORT[it.a.sport].n,status:'done',rpe:null,note:null},base);
  const {data,error}=await sb.from('workout_logs').upsert(row,{onConflict:'athlete_id,external_id',ignoreDuplicates:true}).select();
  if(error)throw error;if(data&&data.length){st.logs.push(data[0]);ins++}else skip++}
 st._imp=null;closeAll();render();
 toast(ins+upd?'Імпортовано: '+(ins+upd)+(upd?' (оновлено '+upd+')':'')+(skip?', пропущено дублів: '+skip:''):'Нічого нового: усе вже є в щоденнику',ins+upd?'check':'info');
 if(typeof checkNewAch==='function')checkNewAch();
 if(ins+upd&&typeof aiRun==='function')aiRun('import')})}
/* ---------- Android share target (files arrive via the service worker) ---------- */
async function impConsumeShare(){
 try{const u=new URL(location.href);if(u.searchParams.has('share')){u.searchParams.delete('share');history.replaceState(history.state||{},'',u.pathname+u.search)}}catch(e){}
 let files=[];try{const c=await caches.open('triton-share');const ks=await c.keys();for(const k of ks){const r=await c.match(k);const b=await r.blob();const nm=decodeURIComponent(r.headers.get('x-name')||'workout.fit');files.push(new File([b],nm));await c.delete(k)}}catch(e){console.warn(e)}
 if(!files.length){toast('Файл не отримано. Спробуйте ще раз або завантажте вручну','info');return}
 if(st.coach&&!st.coachSelf){try{st.coachSelf=true;await loadMine();await loadTeam();st.tab='today';render._k='';render()}catch(e){fail(e);return}}
 if(!impCan()){toast('Імпорт тренувань доступний учасникам команди','info');return}
 importFiles(files)}
/* ---------- how to export (help) ---------- */
const IMP_HELP=[
 ['Garmin Connect','На сайті connect.garmin.com відкрийте тренування → ⚙ (шестерня) → «Експортувати оригінал» (.zip з .fit, можна завантажити як є) або «Експорт у TCX/GPX». У телефоні: тренування → ⋯ → «Експортувати оригінал» або просто підключіть Garmin до Strava і завантажте звідти.'],
 ['Strava','На сайті strava.com відкрийте тренування → ⋯ (три крапки) → «Експорт оригіналу» (.fit) або «Експорт GPX». Усі тренування разом: Налаштування → Мій акаунт → «Завантажити або видалити акаунт» → «Запит на архів» (у ньому папка activities з .fit.gz і .gpx, можна вибрати одразу багато).'],
 ['Wahoo (ELEMNT / SYSTM)','Застосунок ELEMNT: історія → тренування → «Поділитися» → «.fit» → TRITON (на Android) або збережіть у Файли й завантажте. Можна також увімкнути автосинхронізацію Wahoo → Strava.'],
 ['Zwift','Файли .fit лежать на компʼютері в Документи/Zwift/Activities. Або zwift.com → Мій профіль → Активності → тренування → «Завантажити .fit».'],
 ['Rouvy','rouvy.com → Мої активності → тренування → «Експорт» → .fit. Або увімкніть синхронізацію Rouvy → Strava.'],
 ['Polar Flow','flow.polar.com → Щоденник → тренування → «Експорт сесії» → TCX або GPX.'],
 ['Suunto','Застосунок Suunto: тренування → ⋯ → «Експорт .fit» → поділитися з TRITON або зберегти у Файли.'],
 ['COROS','Застосунок COROS: тренування → «Поділитися» → «Експорт даних» → .fit.'],
 ['Apple Watch / iPhone (Здоровʼя)','Застосунок «Здоровʼя» не віддає файли напряму. Встановіть безкоштовний HealthFit або RunGap: вони експортують тренування в .fit у Файли (iCloud), звідти виберіть файл тут. Або синхронізуйте з Strava.'],
 ['Android (Health Connect, Samsung, Google Fit)','Поки що напряму не читаємо. Скористайтесь застосунком годинника (Garmin, Polar, Suunto, COROS, Huawei/Zepp через Strava) або Strava: експортуйте .fit/.gpx і поділіться файлом з TRITON.'],
 ['Велокомпʼютер через кабель','Підключіть Garmin Edge, Bryton, Wahoo тощо до компʼютера: файли в папці Garmin/Activity (або Activities) з розширенням .fit.']];
SHEETS.impHelp=()=>({title:'Як експортувати тренування',full:true,body:`<div class="stack">
 <div class="note">${ic('info',20)}<span>TRITON читає файли <b>.fit</b>, <b>.gpx</b>, <b>.tcx</b>, а також архіви <b>.zip</b> і <b>.gz</b> з ними. Можна вибрати багато файлів одразу. Дублікати ми пропускаємо самі.</span></div>
 <div class="note">${ic('phone',20)}<span><b>Android:</b> встановіть TRITON на головний екран, тоді в будь-якому застосунку «Поділитися» → TRITON надішле файл тренування прямо сюди.</span></div>
 <div class="list">${IMP_HELP.map((h,k)=>`<details class="li" style="display:block"><summary class="t16 w6" style="cursor:pointer">${h[0]}</summary><div class="t14 sec" style="margin-top:8px">${h[1]}</div></details>`).join('')}</div>
 <div class="t12 ter">Garmin Connect API доступний лише бізнес-партнерам Garmin, а Apple Health і Health Connect потребують нативного застосунку, тому їх поки підключаємо через файли або Strava.</div>
 <button class="btn s" onclick="closeSheet();setTimeout(pickActivityFile,50)">${ic('upload',20)} Вибрати файли</button></div>`});
/* ---------- one log: details (athlete history, coach) ---------- */
/* ---------- Strava sync badge + status ---------- */
function isStravaLog(l){return !!l&&(l.source==='strava'||String(l.external_id||'').indexOf('strava:')===0)}
function stravaSyncTime(l,short){if(!l||!l.created_at)return '';const d=new Date(l.created_at);if(isNaN(d))return '';const hm=d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
 const dm=d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0');return d.toDateString()===new Date().toDateString()?hm:short?dm:dm+' '+hm}
/* full=true → «Strava ✓ синхр. 14:05», compact (lists) → «Strava ✓ 14:05» */
function stravaTag(l,full){if(!isStravaLog(l))return '';const t=stravaSyncTime(l,!full);return `<span class="tag ok stg" title="Тренування прийшло зі Strava">Strava ✓${t?(full?' синхр. ':' ')+t:''}</span>`}
const SRC_N={manual:'вручну',file:'з файлу',strava:'Strava',garmin:'Garmin',board:'з дошки секції'};
function logMeta(l){if(l.status==='skipped')return 'пропуск: '+esc(l.skip_reason||'');const s=[fmtMin(l.duration_min||0)];
 if(l.distance)s.push(l.sport==='swim'?fmtNum(l.distance)+' м':String(+l.distance).replace('.',',')+' км');if(l.elevation_m)s.push('↑'+l.elevation_m+' м');
 if(l.np||l.avg_power)s.push((l.np?'NP ':'')+(l.np||l.avg_power)+' Вт');if(l.avg_hr)s.push('♥ '+l.avg_hr);if(l.tss)s.push('TSS '+l.tss);if(l.source&&l.source!=='manual'&&l.source!=='strava')s.push(SRC_N[l.source]||l.source);return s.join(' · ')}
const _logv={};
function logOpen(id,pid){const l=(pid&&st.allLogs||[]).concat(st.logs||[]).find(x=>x.id===id)||_logv[id];if(!l)return;_logv[id]=l;openSheet('logv',id)}
function logOpenSec(id,aid){const d=st._secAth&&st._secAth[aid];const l=d&&(d.logs||[]).find(x=>x.id===id);if(!l)return;_logv[id]=l;openSheet('logv',id)}
SHEETS.logv=id=>{const l=_logv[id];if(!l)return {title:'Тренування',body:''};
 const rows=[['Дата',fmtDate(parseIso(l.day))+(l.started_at?', '+new Date(l.started_at).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'}):'')],['Тривалість',fmtMin(l.duration_min||0)],
  ['Дистанція',l.distance?(l.sport==='swim'?fmtNum(l.distance)+' м':String(+l.distance).replace('.',',')+' км'):''],['Набір висоти',l.elevation_m?l.elevation_m+' м':''],
  ['Темп',l.pace_sec&&typeof nfFmtTime==='function'?nfFmtTime(l.pace_sec)+(l.sport==='swim'?' /100 м':' /км'):''],['Пульс сер. / макс.',l.avg_hr?l.avg_hr+(l.max_hr?' / '+l.max_hr:'')+' уд/хв':''],
  ['Потужність сер.',l.avg_power?l.avg_power+' Вт'+(l.max_power?' (макс. '+l.max_power+')':''):''],['NP',l.np?l.np+' Вт':''],['Каденс',l.cadence?l.cadence+(l.sport==='run'?' кр/хв':' об/хв'):''],
  ['Дрейф пульсу',l.decoupling!=null?String(l.decoupling).replace('.',',')+' %'+(l.decoupling>=5?' (аеробна втома)':''):''],['Навантаження',l.tss?'TSS '+l.tss+(l.intensity?' · IF '+String(l.intensity).replace('.',','):''):''],['Калорії',l.kcal?l.kcal+' ккал':''],['RPE',l.rpe?l.rpe+' / 10':''],
  ['Джерело',(SRC_N[l.source]||l.source||'')+(l.device&&l.device!==(SRC_N[l.source]||l.source)?' · '+l.device:'')],['Синхронізація',isStravaLog(l)?'✓ Зі Strava'+(stravaSyncTime(l)?', '+stravaSyncTime(l):''):''],['Коментар',l.note||'']].filter(x=>x[1]);
 return {title:esc(l.title||SPORT[l.sport].n),body:`<div class="stack"><div class="list">${rows.map(x=>`<div class="li"><div class="grow"><div class="t12 ter">${x[0]}</div><div class="t14">${esc(String(x[1]))}</div></div></div>`).join('')}</div>
 ${l.file_path&&(st.coach||l.athlete_id===st.me.id)?`<button class="btn s" onclick="dlFile('${l.file_path}')">${ic('download',18)} Завантажити файл</button>`:''}</div>`}};
/* ---------- connections sheet: files + Strava (phase 2, feature-flagged on the server) ---------- */
const _impBoot=(()=>{try{const u=new URL(location.href);const m=(location.hash||'').match(/strava=([a-z_]+)/);return {share:u.searchParams.has('share'),strava:m?m[1]:null}}catch(e){return {}}})();
async function stravaLoad(){st.strava={loading:true};renderSheet();
 try{const [c,s]=await Promise.all([sb.functions.invoke('strava-sync',{body:{action:'config'}}),sb.rpc('strava_status')]);st.strava=Object.assign({enabled:!!(c.data&&c.data.enabled)},s.data||{connected:false});
  if(st.strava.connected){try{const r=await sb.from('strava_activity_sync').select('strava_activity_id,start_date,name,sport_type,distance_m,status,reason,source,synced_at').eq('athlete_id',st.me.id).order('start_date',{ascending:false}).limit(40);st.strava.acts=r.error?[]:(r.data||[])}catch(e){st.strava.acts=[]}}}catch(e){console.warn(e);st.strava={enabled:false}}
 renderSheet()}
const STRAVA_WHY={duplicate:'дублікат, це тренування вже є в TRITON',too_short:'коротше за хвилину',db_error:'не вдалося зберегти, спробуйте «Синхронізувати зараз»'};
const STRAVA_SPORT=t=>{t=String(t||'').toLowerCase();return t.includes('swim')?'Плавання':(t.includes('ride')||t.includes('cycl')||t==='velomobile'||t==='handcycle')?'Вело':(t.includes('run')||t==='walk'||t==='hike')?'Біг':'Зал'};
function stravaDayLbl(iso){const d=new Date(iso);if(isNaN(d))return '';const n=Math.round((new Date(new Date().toDateString())-new Date(d.toDateString()))/864e5);return n===0?'сьогодні':n===1?'вчора':n===2?'позавчора':fmtDate(d)}
function stravaActRow(x,showSrc){const ok=x.status==='imported';const km=x.distance_m>0?(x.sport_type&&/swim/i.test(x.sport_type)?fmtNum(x.distance_m)+' м':(x.distance_m/1000).toFixed(1).replace('.',',')+' км'):'';
 const sub=[stravaDayLbl(x.start_date),STRAVA_SPORT(x.sport_type),km].filter(Boolean).join(' · ');
 return `<div class="li" style="min-height:52px"><div class="grow"><div class="t14 w6 ell">${esc(x.name||'Тренування Strava')}</div><div class="t12 sec">${esc(sub)}${showSrc&&x.source==='backfill'?' · при підключенні':''}</div>${ok?'':`<div class="t12 ter">Причина: ${esc(STRAVA_WHY[x.reason]||x.reason||'невідома')}</div>`}</div>${ok?tag('у TRITON ✓','ok'):tag(x.status==='error'?'помилка':'не імпортовано','warn')}</div>`}
function stravaStatusBlock(s){if(!s.connected)return '';const A=s.acts||[];const bf=A.filter(x=>x.source==='backfill');const bn=+s.backfill_imported||bf.filter(x=>x.status==='imported').length;
 const bfBlock=s.backfilled_at?`<details class="li" style="display:block"${bf.length&&bf.length<=6?' open':''}><summary class="t14 w6" style="cursor:pointer">Підтягнуто при підключенні: ${bn} ${(bn%10===1&&bn%100!==11)||(bn%10>=2&&bn%10<=4&&(bn%100<10||bn%100>=20))?'тренування':'тренувань'}</summary>${bf.length?`<div class="list" style="margin-top:8px">${bf.map(x=>stravaActRow(x,false)).join('')}</div>`:`<div class="t12 sec" style="margin-top:8px">${bn?'Список зʼявиться після наступної синхронізації':'За останні 30 днів нових активностей у Strava не було'}</div>`}</details>`
  :`<div class="li"><div class="grow"><div class="t14 w6">Початкове завантаження</div><div class="t12 sec">Ще не виконано. Натисніть «Синхронізувати зараз»: підтягнемо тренування за останні дні</div></div></div>`;
 const recent=A.slice(0,10);
 return `<div class="over">Статус синхронізації</div><div class="list">
  <div class="li"><span class="ico a">${ic('check',20)}</span><div class="grow"><div class="t14 w6">Підключено як ${esc(s.name||'Strava')}</div><div class="t12 sec">${s.last_sync_at?'Остання синхронізація: '+new Date(s.last_sync_at).toLocaleString('uk-UA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Ще не синхронізовано'}</div></div></div>${bfBlock}</div>
 <div class="over">Останні активності зі Strava</div>${recent.length?`<div class="list">${recent.map(x=>stravaActRow(x,true)).join('')}</div>`:`<div class="t14 ter">Поки порожньо. Нові тренування зі Strava зʼявляться тут після синхронізації.</div>`}`}
SHEETS.pconn=()=>{const S=st.strava;if(!S)setTimeout(stravaLoad,0);const s=S||{loading:true};
 const last=s.last_sync_at?new Date(s.last_sync_at).toLocaleString('uk-UA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
 const strava=s.loading?`<div class="li"><span class="ico">${ic('link',20)}</span><div class="grow"><div class="t16">Strava</div><div class="t12 sec">Перевіряю…</div></div><span class="spin"></span></div>`
  :!s.enabled?`<div class="li"><span class="ico">${ic('link',20)}</span><div class="grow"><div class="t16">Strava</div><div class="t12 sec">Автоімпорт тренувань · адміністратор ще налаштовує</div></div>${tag('незабаром')}</div>`
  :s.connected?`<div class="li"><span class="ico a">${ic('link',20)}</span><div class="grow"><div class="t16">Strava · ${esc(s.name||'підключено')}</div><div class="t12 sec">${last?'Остання синхронізація: '+last:'Ще не синхронізовано'}</div></div>${tag('підключено','ok')}</div>`
  :`<button class="li" onclick="stravaConnect(this)"><span class="ico">${ic('link',20)}</span><div class="grow"><div class="t16">Strava</div><div class="t12 sec">Нові тренування зі Strava зʼявлятимуться самі</div></div><span class="tag a">Підключити</span></button>`;
 return {title:'Імпорт тренувань',body:`<div class="stack">
 <button class="btn p" onclick="closeAll();setTimeout(pickActivityFile,50)">${ic('upload',20)} Імпорт файлів .fit, .gpx, .tcx</button>
 <div class="t12 ter">Можна вибрати кілька файлів чи .zip-архів. Ми прочитаємо час, дистанцію, набір висоти, пульс, потужність, каденс і порахуємо TSS; тренування з плану зарахуються автоматично.</div>
 <button class="btn t" onclick="openSheet('impHelp')">${ic('info',18)} Як експортувати з Garmin, Wahoo, Zwift, Polar…</button>
 <div class="over">Автосинхронізація</div><div class="list">${strava}
  <div class="li"><span class="ico">${ic('link',20)}</span><div class="grow"><div class="t16">Garmin Connect</div><div class="t12 sec">Прямий доступ Garmin дає лише бізнес-партнерам. Увімкніть у Garmin Connect синхронізацію зі Strava або імпортуйте файли.</div></div></div></div>
 ${s.connected?`<div class="row" style="gap:8px"><button class="btn s grow" onclick="stravaSync(this)">${ic('refresh',18)} Синхронізувати зараз</button><button class="btn t" onclick="stravaDisconnect(this)">Відключити</button></div>${stravaStatusBlock(s)}`:''}</div>`}};
async function stravaCall(action,extra){const {data,error}=await sb.functions.invoke('strava-sync',{body:Object.assign({action},extra||{})});if(error){let m='';try{m=(await error.context.json()).error}catch(e){}throw new Error(m||error.message)}if(data&&data.error)throw new Error(data.error);return data}
async function stravaConnect(btn){await busy(btn,async()=>{const d=await stravaCall('connect',{return_to:location.origin+location.pathname});if(d&&d.url)location.href=d.url})}
async function stravaSync(btn,quiet){const run=async()=>{let d;try{d=await stravaCall('sync')}catch(e){if(quiet)throw e;const m=String(e&&e.message||'');throw new Error(m==='strava_rate_limit'?'Ліміт запитів Strava, спробуйте за кілька хвилин':m==='not_connected'?'Strava не підключено':m.indexOf('strava_')===0?'Strava не відповіла, спробуйте пізніше':m)}
 const r=await sb.from('workout_logs').select('*').eq('athlete_id',st.me.id).order('day');if(!r.error)st.logs=r.data;
 st.strava=null;render();if(sheetStack.length)renderSheet();
 if(!quiet)toast(d.imported?'Зі Strava додано: '+d.imported:(d.total?'Усе вже в TRITON ('+d.total+' у Strava)':'Нових тренувань у Strava немає'),d.imported?'check':'info');
 if(d.imported&&typeof checkNewAch==='function')checkNewAch();if(d.imported&&typeof aiRun==='function')aiRun('import')};
 if(quiet){try{await run()}catch(e){console.warn(e)}}else await busy(btn,run)}
async function stravaDisconnect(btn){if(!confirm('Відключити Strava? Уже імпортовані тренування залишаться.'))return;await busy(btn,async()=>{await stravaCall('disconnect');st.strava=null;renderSheet();toast('Strava відключено','info')})}
function impBootActions(){
 if(_impBoot.share){_impBoot.share=false;impConsumeShare()}
 if(_impBoot.strava){const k=_impBoot.strava;_impBoot.strava=null;try{history.replaceState(history.state||{},'',location.pathname+location.search)}catch(e){}
  if(k==='ok'){openSheet('pconn');impAfterConnect()}
  else toast(k==='denied'?'Підключення Strava скасовано':'Не вдалося підключити Strava. Спробуйте ще раз','alert')}}

/* after «Підключити»: the server already ran the backfill in the OAuth callback; reload logs and show «Підтягнуто при підключенні: N».
   If the server-side backfill failed (backfilled_at is null) the first «sync» repeats it. */
async function impAfterConnect(){try{let r=await sb.rpc('strava_status');let s=r.data;
 if(s&&s.connected&&!s.backfilled_at){await stravaSync(null,true);r=await sb.rpc('strava_status');s=r.data}
 const l=await sb.from('workout_logs').select('*').eq('athlete_id',st.me.id).order('day');if(!l.error)st.logs=l.data;
 st.strava=null;render();if(sheetStack.length)renderSheet();
 const n=s&&+s.backfill_imported||0;toast(n?'Strava підключено. Підтягнуто тренувань: '+n:'Strava підключено',n?'check':'info');
 if(n){if(typeof checkNewAch==='function')checkNewAch();if(typeof aiRun==='function')aiRun('import')}}catch(e){console.warn(e);toast('Strava підключено','info')}}
