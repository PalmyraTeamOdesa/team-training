/* ---------- PHOTO COMPRESSION (target 200–300 KB) ---------- */
async function compressImage(file){
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Не вдалося прочитати фото'));i.src=url});
  let max=1600,q=.82,blob=null;
  for(let k=0;k<8;k++){
   const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));
   if(blob.size<=300*1024)break;
   if(q>.6)q-=.08;else max=Math.round(max*.8);
  }
  if(file.size<=blob.size&&file.size<=300*1024&&/^image\/(jpeg|png|webp)$/.test(file.type))return file;
  return blob;
 }finally{URL.revokeObjectURL(url)}
}

/* ---------- ACTIVITY FILES (.fit / .gpx / .tcx) ---------- */
function pickActivityFile(){const i=document.createElement('input');i.type='file';i.accept='.fit,.gpx,.tcx,application/octet-stream,application/gpx+xml,application/xml';i.onchange=()=>i.files[0]&&loadActivityFile(i.files[0]);i.click()}
async function loadActivityFile(file){
 if(file.size>25*1024*1024)return toast('Файл завеликий (до 25 МБ)','alert');
 const ext=(file.name.split('.').pop()||'').toLowerCase();let r;
 try{
  if(ext==='fit')r=parseFit(await file.arrayBuffer());
  else if(ext==='gpx'||ext==='tcx')r=parseXmlActivity(await file.text(),ext);
  else return toast('Підтримуються .fit, .gpx, .tcx','alert');
 }catch(e){console.error(e);return toast('Не вдалося прочитати файл','alert')}
 const p=me();const L=Object.assign(estLog(p,null,{sport:r.sport||'bike',min:Math.max(1,Math.round((r.dur||3600)/60))}),{extra:true,file,title:r.title||file.name.replace(/\.[^.]+$/,''),day:r.start?iso(r.start):dayIso(0,TODAY)});
 L.dur=Math.max(1,Math.round((r.dur||0)/60))||L.dur;
 if(r.dist!=null)L.dist=L.sport==='swim'?Math.round(r.dist):+(r.dist/1000).toFixed(1);
 L.hr=r.hr?Math.round(r.hr):'';L.pow=r.pow?Math.round(r.pow):'';L.np=r.np?Math.round(r.np):'';if(r.kcal)L.kcal=Math.round(r.kcal);
 if(L.sport==='run'&&L.dist)L.pace=Math.round(L.dur*60/L.dist);if(L.sport==='swim'&&L.dist)L.pace=Math.round(L.dur*60/L.dist*100);
 if(L.day>dayIso(0,TODAY))L.day=dayIso(0,TODAY);
 st._log=L;openSheet('log');
}
function hav(a,b){const R=6371e3,t=Math.PI/180;const dLa=(b[0]-a[0])*t,dLo=(b[1]-a[1])*t;const x=Math.sin(dLa/2)**2+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function npOf(samples){if(samples.length<60)return 0;const roll=[];let s=0;for(let i=0;i<samples.length;i++){s+=samples[i];if(i>=30)s-=samples[i-30];if(i>=29)roll.push(s/30)}return Math.pow(roll.reduce((a,v)=>a+v**4,0)/roll.length,.25)}
function parseXmlActivity(text,ext){
 const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw new Error('xml');
 const all=n=>Array.from(doc.getElementsByTagNameNS('*',n));const num=(el,n)=>{const x=el.getElementsByTagNameNS('*',n)[0];return x?parseFloat(x.textContent):NaN};
 let pts=[],sport='bike',title='';
 if(ext==='gpx'){pts=all('trkpt').map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon'),t:(p.getElementsByTagNameNS('*','time')[0]||{}).textContent,hr:num(p,'hr'),pw:num(p,'power')}));
  const ty=(all('type')[0]||{}).textContent||'';if(/run/i.test(ty))sport='run';else if(/swim/i.test(ty))sport='swim';title=(all('name')[0]||{}).textContent||''}
 else{const act=all('Activity')[0];const sp=act?act.getAttribute('Sport'):'';if(/run/i.test(sp))sport='run';else if(/swim/i.test(sp))sport='swim';
  pts=all('Trackpoint').map(p=>({lat:num(p,'LatitudeDegrees'),lon:num(p,'LongitudeDegrees'),t:(p.getElementsByTagNameNS('*','Time')[0]||{}).textContent,hr:num(p,'Value'),pw:num(p,'Watts'),d:num(p,'DistanceMeters')}));
  const laps=all('Lap');var tt=laps.reduce((a,l)=>a+(num(l,'TotalTimeSeconds')||0),0),td=laps.reduce((a,l)=>a+(num(l,'DistanceMeters')||0),0),kc=laps.reduce((a,l)=>a+(num(l,'Calories')||0),0)}
 const times=pts.map(p=>p.t?Date.parse(p.t):NaN).filter(isFinite);
 let dist=0;for(let i=1;i<pts.length;i++){if(isFinite(pts[i].lat)&&isFinite(pts[i-1].lat))dist+=hav([pts[i-1].lat,pts[i-1].lon],[pts[i].lat,pts[i].lon])}
 const maxD=Math.max(0,...pts.map(p=>p.d).filter(isFinite));if(maxD>0)dist=maxD;
 const hrs=pts.map(p=>p.hr).filter(x=>isFinite(x)&&x>30),pws=pts.map(p=>p.pw).filter(isFinite);
 const dur=ext==='tcx'&&tt?tt:(times.length>1?(times[times.length-1]-times[0])/1000:0);
 return {sport,title,start:times.length?new Date(times[0]):null,dur,dist:ext==='tcx'&&td?td:dist,hr:hrs.length?hrs.reduce((a,b)=>a+b)/hrs.length:0,pow:pws.length?pws.reduce((a,b)=>a+b)/pws.length:0,np:npOf(pws),kcal:ext==='tcx'?kc:0};
}
/* minimal FIT decoder: reads session (18) / record (20) messages */
function parseFit(buf){
 const dv=new DataView(buf);const hs=dv.getUint8(0);const dataLen=dv.getUint32(4,true);if(String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11))!=='.FIT')throw new Error('fit');
 let pos=hs;const end=Math.min(buf.byteLength,hs+dataLen);const defs={};const out={session:null,recs:[]};
 const rd=(t,o,le,size)=>{const b=t&0x1f;try{switch(b){case 0:case 2:case 10:case 13:return dv.getUint8(o);case 1:return dv.getInt8(o);case 3:return dv.getInt16(o,le);case 4:case 11:return dv.getUint16(o,le);case 5:return dv.getInt32(o,le);case 6:case 12:return dv.getUint32(o,le);default:return null}}catch(e){return null}};
 const inval=(t,v)=>{const b=t&0x1f;return v==null||((b===2||b===0||b===10)&&v===0xff)||((b===4||b===11)&&v===0xffff)||((b===6||b===12)&&v===0xffffffff)||(b===1&&v===0x7f)||(b===3&&v===0x7fff)||(b===5&&v===0x7fffffff)};
 while(pos<end){
  const h=dv.getUint8(pos++);
  if(h&0x80){const lt=(h>>5)&3;const d=defs[lt];if(!d)break;pos=readMsg(d,pos);continue}
  const lt=h&0x0f;
  if(h&0x40){pos++;const arch=dv.getUint8(pos++);const le=arch===0;const gm=dv.getUint16(pos,le);pos+=2;const nf=dv.getUint8(pos++);const fields=[];for(let i=0;i<nf;i++){fields.push({n:dv.getUint8(pos),s:dv.getUint8(pos+1),t:dv.getUint8(pos+2)});pos+=3}
   let dev=0;if(h&0x20){const nd=dv.getUint8(pos++);for(let i=0;i<nd;i++){dev+=dv.getUint8(pos+1);pos+=3}}defs[lt]={le,gm,fields,dev};}
  else{const d=defs[lt];if(!d)break;pos=readMsg(d,pos)}
 }
 function readMsg(d,p){const m={};for(const f of d.fields){const sz=f.s;const base=f.t&0x1f;const unit={0:1,1:1,2:1,3:2,4:2,5:4,6:4,10:1,11:2,12:4,13:1}[base];if(unit&&sz===unit){const v=rd(f.t,p,d.le);if(!inval(f.t,v))m[f.n]=v}p+=sz}p+=d.dev;
  if(d.gm===18&&!out.session)out.session=m;else if(d.gm===20)out.recs.push(m);return p}
 const s=out.session||{};const SP={1:'run',2:'bike',5:'swim',4:'gym',10:'gym',11:'run',17:'run'};
 const pw=out.recs.map(r=>r[7]).filter(v=>v!=null);const hr=out.recs.map(r=>r[3]).filter(v=>v!=null&&v>30);
 const t0=s[2]!=null?new Date((s[2]+631065600)*1000):(out.recs[0]&&out.recs[0][253]!=null?new Date((out.recs[0][253]+631065600)*1000):null);
 const lastD=out.recs.map(r=>r[5]).filter(v=>v!=null).pop();
 return {sport:SP[s[5]]||'bike',start:t0,dur:s[8]!=null?s[8]/1000:(s[7]!=null?s[7]/1000:0),dist:s[9]!=null?s[9]/100:(lastD!=null?lastD/100:0),hr:s[16]||(hr.length?hr.reduce((a,b)=>a+b)/hr.length:0),pow:s[20]||(pw.length?pw.reduce((a,b)=>a+b)/pw.length:0),np:s[34]||npOf(pw),kcal:s[11]||0};
}
