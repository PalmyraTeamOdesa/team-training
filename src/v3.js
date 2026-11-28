/* ===================== v3: chat tab, section chats, «Інакше», readiness, avatars ===================== */
Object.assign(st,{planSeg:'plan',secMsgs:{},ready:null,readyAll:{},altRev:{},altCm:{},_alt:null,_crop:null});

/* ---------- AVATARS ---------- */
const AV_URL=(()=>{try{const o=JSON.parse(localStorage.getItem('avurl')||'{}');const n=Date.now();Object.keys(o).forEach(k=>{if(!o[k]||o[k].e<n)delete o[k]});return o}catch(e){return {}}})();
let _avQ=new Set(),_avT=null;
function avPath(id){if(!id)return null;if(st.me&&id===st.me.id)return st.me.avatar||null;const a=(st.athletes||[]).find(x=>x.id===id);if(a&&a.p&&a.p.avatar)return a.p.avatar;const m=(st.members||[]).find(x=>x.id===id);return m&&m.avatar_path||null}
function avIn(id,ini){const n=ini||initials(nameOf(id));const p=avPath(id);let img='';if(p){const c=AV_URL[p];if(c&&c.u)img=`<img class="avimg" src="${esc(c.u)}" alt="" onerror="this.remove()">`;else if(!c)avQueue(p)}return esc(n)+img}
function avQueue(p){if(_avQ.has(p))return;_avQ.add(p);clearTimeout(_avT);_avT=setTimeout(avSign,40)}
async function avSign(){const ps=[..._avQ];_avQ.clear();if(!ps.length)return;try{const {data}=await sb.storage.from('avatars').createSignedUrls(ps,7*86400);const e=Date.now()+6.5*864e5;
 ps.forEach(p=>{const x=(data||[]).find(d=>d.path===p);AV_URL[p]=x&&x.signedUrl?{u:x.signedUrl,e}:{u:'',e:Date.now()+36e5}});localStorage.setItem('avurl',JSON.stringify(AV_URL));render()}catch(e){console.warn(e)}}
function avSetLocal(uid,path){if(st.me&&uid===st.me.id){st.me.avatar=path;if(st.me.row)st.me.row.avatar_path=path}
 const a=(st.athletes||[]).find(x=>x.id===uid);if(a&&a.p)a.p.avatar=path;const m=(st.members||[]).find(x=>x.id===uid);if(m)m.avatar_path=path;
 (st.people||[]).forEach(r=>{if(r.id===uid)r.avatar_path=path})}
SHEETS.avMenu=uid=>{const self=uid===st.me.id;const has=!!avPath(uid);
 if(self&&st._agLeft==null&&!st._agQ){st._agQ=1;sb.functions.invoke('avatar-gen',{body:{mode:'status'}}).then(r=>{st._agLeft=r.data&&r.data.left!=null?r.data.left:null;st._agQ=0;renderSheet()}).catch(()=>{st._agQ=0})}
 if(!self&&isCoach()&&!(st._agAdm||{})[uid]){st._agAdm=st._agAdm||{};st._agAdm[uid]={n:'…'};sb.from('avatar_gens').select('status,created_at,cost_usd').eq('user_id',uid).then(r=>{const a=r.data||[];const wk=a.filter(x=>x.status!=='failed'&&new Date(x.created_at)>Date.now()-7*864e5).length;st._agAdm[uid]={n:wk,all:a.filter(x=>x.status==='ok').length,usd:a.reduce((s,x)=>s+(+x.cost_usd||0),0)};renderSheet()})}
 const ag=st._ag||{};const L=st._agLeft;const busyAg=!!st._agBusy;
 const aiBox=self?`<div class="card s8" style="width:100%"><div class="between"><div class="over">${ic('spark',14)} АІ-аватар</div><span class="t12 ${L===0?'c-bad':'ter'}">${L==null?'…':'залишилось '+L+' з 5 на тиждень'}</span></div>
  <textarea class="inp" id="agp" rows="2" maxlength="400" placeholder="Напр.: велосипедист у шоломі в стилі коміксу, море на фоні" oninput="(st._ag=st._ag||{}).p=this.value">${esc(ag.p||'')}</textarea>
  <div class="chips">${['мультяшний стиль','рожева шапка','прибрати висипання','як на постері Tour de France'].map(t=>`<button class="chip" onclick="agAdd('${t}')">${t}</button>`).join('')}</div>
  <div class="row" style="gap:8px"><button class="btn p sm grow" ${L===0||busyAg?'disabled':''} onclick="agRun(this,'generate')">${busyAg&&ag.m==='generate'?'<span class="spin"></span>':ic('spark',18)} Згенерувати</button><button class="btn s sm grow" ${L===0||busyAg?'disabled':''} onclick="agEditPick(this)">${busyAg&&ag.m==='edit'?'<span class="spin"></span>':ic('edit',18)} Змінити моє фото</button></div>
  <div class="t12 ter">«Змінити моє фото»: оберіть своє фото, АІ змінить його за описом. Результат можна обрізати перед збереженням.</div></div>`
  :(isCoach()&&st._agAdm&&st._agAdm[uid]?`<div class="t12 ter">АІ-аватари: ${st._agAdm[uid].n} за 7 днів${st._agAdm[uid].all!=null?' · усього '+st._agAdm[uid].all+' · ≈$'+(st._agAdm[uid].usd||0).toFixed(2):''}</div>`:'');
 return {title:self?'Фото профілю':'Фото · '+esc(shortName(uid)),body:`<div class="stack" style="align-items:center"><span class="av xl">${avIn(uid)}</span>
  <div class="t14 sec" style="text-align:center">${has?'Фото бачать учасники клубу.':'Зараз показуються ініціали. Додайте фото, щоб вас легше впізнавали.'}</div>${aiBox}</div>`,
  foot:`${has?`<button class="btn s" style="flex:1" onclick="avDelete(this,'${uid}')">${ic('x',20)} Видалити фото</button>`:''}<button class="btn p" style="flex:1" onclick="avPick('${uid}')">${ic('upload',20)} ${has?'Змінити фото':'Додати фото'}</button>`}};
function avPick(uid){st._avFor=uid||st.me.id;let i=$('#avfile');if(i)i.remove();i=document.createElement('input');i.type='file';i.id='avfile';i.accept='image/*,.heic,.heif';i.style.display='none';document.body.appendChild(i);
 i.onchange=()=>{const f=i.files&&i.files[0];if(f)avLoad(f)};i.click()}
async function avLoad(f){try{let img;try{img=await createImageBitmap(f,{imageOrientation:'from-image'})}catch(e){img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('fmt'));im.src=URL.createObjectURL(f)})}
  const w=img.width||img.naturalWidth,h=img.height||img.naturalHeight;if(!w||!h)throw new Error('fmt');st._crop={img,w,h,z:1,x:0,y:0,S:300};openSheet('avCrop')}
 catch(e){console.warn(e);toast('Не вдалося відкрити фото. Спробуйте JPG або PNG','alert')}}
SHEETS.avCrop=()=>{setTimeout(avCropBind,0);const c=st._crop;return {title:'Обріжте фото',body:`<div class="stack" style="align-items:center">
 <div class="crop" id="crop"><canvas id="cropc" width="600" height="600"></canvas><div class="cropmask"></div></div>
 <div class="t12 ter">Перетягніть фото, зведіть пальці або посуньте повзунок, щоб збільшити</div>
 <div class="row" style="gap:12px;width:100%;max-width:320px"><span class="t14 ter">${ic('minus',18)}</span><input type="range" id="cropz" min="1" max="4" step="0.01" value="${c?c.z:1}" class="grow" oninput="avZoom(+this.value)" aria-label="Масштаб"><span class="t14 ter">${ic('plus',18)}</span></div></div>`,
 foot:`<button class="btn s" style="flex:1" onclick="closeSheet()">Скасувати</button><button class="btn p" style="flex:1" onclick="avSave(this)">Зберегти</button>`}};
function avBase(){const c=st._crop;return c.S/Math.min(c.w,c.h)}
function avClamp(){const c=st._crop;const s=avBase()*c.z;const mx=Math.max(0,(c.w*s-c.S)/2),my=Math.max(0,(c.h*s-c.S)/2);c.x=Math.max(-mx,Math.min(mx,c.x));c.y=Math.max(-my,Math.min(my,c.y))}
function avDraw(){const c=st._crop,cv=$('#cropc');if(!c||!cv)return;const k=cv.width/c.S;const ctx=cv.getContext('2d');ctx.fillStyle='#111';ctx.fillRect(0,0,cv.width,cv.height);
 const s=avBase()*c.z;const dw=c.w*s,dh=c.h*s;ctx.imageSmoothingQuality='high';ctx.drawImage(c.img,(c.S/2+c.x-dw/2)*k,(c.S/2+c.y-dh/2)*k,dw*k,dh*k)}
function avZoom(z,cx,cy){const c=st._crop;if(!c)return;const z2=Math.max(1,Math.min(4,z));const r=z2/c.z;cx=cx||0;cy=cy||0;c.x=(c.x-cx)*r+cx;c.y=(c.y-cy)*r+cy;c.z=z2;avClamp();avDraw();const s=$('#cropz');if(s&&+s.value!==z2){s.value=z2;if(typeof slSync==='function')slSync(s)}}
function avCropBind(){const el=$('#crop'),c=st._crop;if(!el||!c||el._b)return;el._b=1;c.S=el.clientWidth||300;avClamp();avDraw();
 const P=new Map();let pinch=null;const rel=e=>{const r=el.getBoundingClientRect();return [e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2]};
 el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);if(P.size===2){const [a,b]=[...P.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),z:c.z}}e.preventDefault()});
 el.addEventListener('pointermove',e=>{if(!P.has(e.pointerId))return;const prev=P.get(e.pointerId);P.set(e.pointerId,[e.clientX,e.clientY]);
  if(P.size>=2&&pinch){const [a,b]=[...P.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);const r=el.getBoundingClientRect();avZoom(pinch.z*d/pinch.d,(a[0]+b[0])/2-r.left-r.width/2,(a[1]+b[1])/2-r.top-r.height/2)}
  else{c.x+=e.clientX-prev[0];c.y+=e.clientY-prev[1];avClamp();avDraw()}e.preventDefault()});
 const up=e=>{P.delete(e.pointerId);if(P.size<2)pinch=null};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 el.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=rel(e);avZoom(c.z*(e.deltaY<0?1.1:1/1.1),x,y)},{passive:false})}
function avBlob(cv,type,q){return new Promise(r=>cv.toBlob(b=>r(b),type,q))}
async function avSave(btn){const c=st._crop;if(!c)return;await busy(btn,async()=>{const N=512;const cv=document.createElement('canvas');cv.width=cv.height=N;const ctx=cv.getContext('2d');ctx.imageSmoothingQuality='high';
  const k=N/c.S,s=avBase()*c.z,dw=c.w*s,dh=c.h*s;ctx.fillStyle='#fff';ctx.fillRect(0,0,N,N);ctx.drawImage(c.img,(c.S/2+c.x-dw/2)*k,(c.S/2+c.y-dh/2)*k,dw*k,dh*k);
  let type='image/webp',b=await avBlob(cv,type,.82);if(!b||b.type!=='image/webp'){type='image/jpeg';b=await avBlob(cv,type,.82)}
  for(const q of [.72,.62,.5]){if(b.size<=120*1024)break;b=await avBlob(cv,type,q)}
  const uid=st._avFor||st.me.id;const old=avPath(uid);const path=uid+'/'+Date.now()+(type==='image/webp'?'.webp':'.jpg');
  D(await sb.storage.from('avatars').upload(path,b,{contentType:type,cacheControl:'31536000'}));D(await sb.rpc('set_avatar',{u:uid,path}));
  const su=await sb.storage.from('avatars').createSignedUrl(path,7*86400);if(su.data)AV_URL[path]={u:su.data.signedUrl,e:Date.now()+6.5*864e5};localStorage.setItem('avurl',JSON.stringify(AV_URL));
  avSetLocal(uid,path);if(old&&old!==path)sb.storage.from('avatars').remove([old]).catch(()=>{});st._crop=null;closeSheet();setTimeout(()=>{render();toast('Фото оновлено')},120)})}
async function avDelete(btn,uid){if(!confirm('Видалити фото? Замість нього будуть ініціали.'))return;await busy(btn,async()=>{const old=avPath(uid);D(await sb.rpc('set_avatar',{u:uid,path:null}));if(old)await sb.storage.from('avatars').remove([old]).catch(()=>{});avSetLocal(uid,null);render();renderSheet();toast('Фото видалено')})}

/* AI avatars (avatar-gen, 5 / 7 days) → same crop & compress flow */
function agAdd(t){const g=st._ag=st._ag||{};const el=$('#agp');const v=((el&&el.value)||g.p||'').trim();g.p=v?v+', '+t:t;if(el)el.value=g.p}
async function agToJpeg(src,max){const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('fmt'));im.src=src});
 const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const cv=document.createElement('canvas');cv.width=Math.round(img.naturalWidth*k);cv.height=Math.round(img.naturalHeight*k);const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,cv.width,cv.height);c.drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',.85)}
function agEditPick(btn){const g=st._ag=st._ag||{};const el=$('#agp');g.p=((el&&el.value)||g.p||'').trim();if(g.p.length<3)return toast('Опишіть, що змінити на фото','info');
 let i=$('#agfile');if(i)i.remove();i=document.createElement('input');i.type='file';i.id='agfile';i.accept='image/*,.heic,.heif';i.style.display='none';document.body.appendChild(i);
 i.onchange=async()=>{const f=i.files&&i.files[0];if(!f)return;try{const u=URL.createObjectURL(f);const d=await agToJpeg(u,1024);URL.revokeObjectURL(u);agRun(null,'edit',d)}catch(e){toast('Не вдалося відкрити фото. Спробуйте JPG або PNG','alert')}};i.click()}
async function agRun(btn,mode,image){const g=st._ag=st._ag||{};const el=$('#agp');g.p=((el&&el.value)||g.p||'').trim();if(g.p.length<3)return toast('Опишіть, що згенерувати','info');if(st._agBusy)return;
 st._agBusy=1;g.m=mode;renderSheet();toast('АІ малює… це займе до хвилини','spark');
 try{const r=await sb.functions.invoke('avatar-gen',{body:{mode,prompt:g.p,image}});let d=r.data;if(!d&&r.error&&r.error.context){try{d=await r.error.context.json()}catch(e){}}
  if(d&&d.left!=null)st._agLeft=d.left;
  if(!d||!d.ok||!d.image){toast((d&&d.text)||'Не вдалося згенерувати','alert');return}
  const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=d.image});
  st._avFor=st.me.id;st._crop={img,w:img.naturalWidth,h:img.naturalHeight,z:1,x:0,y:0,S:300};openSheet('avCrop');toast('Готово. Обріжте і збережіть')}
 catch(e){console.warn(e);toast('Не вдалося згенерувати','alert')}finally{st._agBusy=0;renderSheet()}}

/* ---------- CHAT TAB (athlete) ---------- */
function chatTitle(){return st.chatSeg==='sec'?'Чати секцій':st.chatSeg==='dm'?'Особисті':'Загальний чат'}
function chatTabView(){
 if(st.me.status!=='active')return `<div class="stack">${pendingBanner()}${emptyBox('Чат відкриється після підтвердження','Тренер отримав вашу заявку.')}</div>`;
 if(!['team','sec','dm'].includes(st.chatSeg))st.chatSeg=st.chatSeg==='coach'?'dm':'team';
 const su=mySecs().filter(inSec).reduce((a,s)=>a+secUnread(s),0);
 let h=`<div class="stack">${seg([['team','Загальний'],['sec','Секції'+(su?` <b class="cnt in">${su}</b>`:'')],['dm','Особисті']],st.chatSeg,'chatSeg')}`;
 if(st.chatSeg==='sec'){const list=SEC_ORDER.filter(inSec);
  h+=list.length?`<div class="list">${list.map(s=>{const i=secInfo(s);const ms=st.secMsgs[s]||[];const last=ms[ms.length-1];const n=secUnread(s);
   return li({left:`<span class="secico sm" style="--sc:${i.color}">${ic(i.icon,20)}</span>`,t:'Чат · '+esc(i.name),s:last?esc(shortName(last.sender_id))+': '+esc(last.body):'Поки немає повідомлень',on:`openSheet('secChat','${s}')`,right:n?`<b class="cnt in">${n}</b>`:`<span class="chev">${ic('chev',20)}</span>`})}).join('')}</div>`
   :emptyBox('Ви ще не в секціях','Запишіться в секцію, і тут зʼявиться її чат')+`<button class="btn s" onclick="go('sec')">Перейти до секцій</button>`;
  return h+'</div>'}
 if(st.chatSeg==='dm'){const cids=st.members.filter(m=>m.is_coach&&m.id!==st.me.id).map(m=>m.id).concat(st.secCoaches.map(c=>c.user_id)).filter((x,i,a)=>x!==st.me.id&&a.indexOf(x)===i);
  const peers=[...new Set(st.dms.map(m=>m.sender_id===st.me.id?m.recipient_id:m.sender_id))].filter(id=>id&&!cids.includes(id));
  const rows=cids.concat(peers).map(id=>{const th=dmWith(id);return {id,last:th[th.length-1],coach:cids.includes(id)}}).sort((a,b)=>(b.coach-a.coach)||((b.last?b.last.created_at:'')>(a.last?a.last.created_at:'')?1:-1));
  h+=rows.length?`<div class="list">${rows.map(r=>li({left:avOf(r.id),t:esc(cleanName(nameOf(r.id)))+(r.coach?' '+tag('тренер','a'):''),s:r.last?(r.last.sender_id===st.me.id?'Ви: ':'')+esc(r.last.body):'Написати особисто',on:`openSheet('dm','${r.id}')`,right:r.last?`<span class="t12 ter">${ago(r.last.created_at)}</span>`:''})).join('')}</div>`:emptyBox('Особистих повідомлень поки немає');
  return h+`<div class="t12 ter">Написати будь-кому можна зі списку людей у секції або з картки учасника.</div></div>`}
 return h+`<div class="s8" style="display:flex;flex-direction:column">${st.chat.length?st.chat.slice(-100).map(m=>msgBubble(m,true)).join(''):emptyBox('Напишіть першим','Тут спілкується вся команда')}</div>
 <div class="composer"><input class="inp" id="tchat" maxlength="4000" placeholder="Повідомлення команді" onkeydown="if(event.key==='Enter')sendTeam(this)"><button class="sendb" onclick="sendTeam(this)" aria-label="Надіслати">${ic('send',20)}</button></div></div>`}

/* ---------- SECTION CHATS ---------- */
function secReadMap(){try{return JSON.parse(localStorage.getItem('secread:'+st.me.id)||'{}')}catch(e){return {}}}
function secMarkRead(s){const m=secReadMap();m[s]=new Date().toISOString();localStorage.setItem('secread:'+st.me.id,JSON.stringify(m))}
function secUnread(s){const ms=st.secMsgs[s]||[];const r=secReadMap()[s]||'';return ms.filter(m=>m.sender_id!==st.me.id&&m.created_at>r).length}
async function loadSecChats(){if(!st.me)return;const list=isCoach()||st.coach?SEC_ORDER.slice():SEC_ORDER.filter(inSec);if(!list.length)return;
 try{await Promise.all(list.map(async s=>{const r=await sb.from('section_messages').select('*').eq('section_id',s).order('created_at',{ascending:false}).limit(150);if(!r.error)st.secMsgs[s]=(r.data||[]).reverse()}))}catch(e){console.warn(e)}}
function secChatBtn(sec){const n=secUnread(sec);const i=secInfo(sec);return `<button class="secchat" style="--sc:${i.color}" onclick="openSheet('secChat','${sec}')"><span class="secico sm">${ic('msg',18)}</span><div class="grow" style="text-align:left"><div class="t14 w6">Чат секції</div><div class="t12 sec ell">${(()=>{const ms=st.secMsgs[sec]||[];const l=ms[ms.length-1];return l?esc(shortName(l.sender_id))+': '+esc(l.body):'Тільки для учасників і тренерів «'+esc(i.name)+'»'})()}</div></div>${n?`<b class="cnt in">${n}</b>`:`<span class="chev">${ic('chev',20)}</span>`}</button>`}
SHEETS.secChat=sec=>{const i=secInfo(sec);secMarkRead(sec);if(!st.secMsgs[sec]){sb.from('section_messages').select('*').eq('section_id',sec).order('created_at',{ascending:false}).limit(150).then(r=>{st.secMsgs[sec]=(r.data||[]).reverse();renderSheet();scrollSheet()})}
 const ms=st.secMsgs[sec]||[];const paused=st.me&&st.me.paused;setTimeout(scrollSheet,0);
 return {title:'Чат · '+esc(i.name),full:true,body:`<div class="s8" style="display:flex;flex-direction:column;padding-top:4px"><div class="t12 ter" style="text-align:center">Бачать лише учасники секції і тренери</div>${ms.length?ms.map(m=>msgBubble(m,true)).join(''):emptyBox('Напишіть першим','Тут спілкується секція «'+esc(i.name)+'»')}</div>`,
  foot:paused?`<div class="t14 sec">На паузі писати в чат секції не можна</div>`:`<div class="composer" style="flex:1"><input class="inp" id="schat" maxlength="4000" placeholder="Повідомлення секції" onkeydown="if(event.key==='Enter')sendSec(this,'${sec}')"><button class="sendb" onclick="sendSec(this,'${sec}')" aria-label="Надіслати">${ic('send',20)}</button></div>`}};
async function sendSec(el,sec){const i=$('#schat');const v=(i.value||'').trim();if(!v)return;i.value='';try{const m=D(await sb.from('section_messages').insert({section_id:sec,body:v}).select().single());const a=st.secMsgs[sec]=st.secMsgs[sec]||[];if(!a.some(x=>x.id===m.id))a.push(m);secMarkRead(sec);renderSheet();scrollSheet();const n=$('#schat');if(n)n.focus()}catch(e){i.value=v;fail(e)}}
function onSecMsg(p){const m=p.new;const a=st.secMsgs[m.section_id]=st.secMsgs[m.section_id]||[];if(a.some(x=>x.id===m.id))return;a.push(m);
 const top=sheetStack[sheetStack.length-1];if(top&&top.name==='secChat'&&top.arg===m.section_id){secMarkRead(m.section_id);renderSheet();scrollSheet()}else if(!sheetStack.length)render()}

/* ---------- «ЗРОБИВ ІНАКШЕ»: review sheet ---------- */
function altLoadEst(mk,sec){const sp=(secInfo(sec).sport||sec);let min=+mk.time_min||0;if(!min&&mk.dist_km)min=(+mk.dist_km)/({bike:27,run:10,swim:2.5}[sp]||25)*60;if(!min)min=45;
 const hm=220-((st.me&&st.me.age)||35);const IF=mk.hr?Math.max(.45,Math.min(1.1,.45+.65*((+mk.hr-.5*hm)/(.45*hm)))):.7;return Math.round(min/60*IF*IF*100)}
async function openAlt(sec,post,a,day){st._alt={sec,post,a,day};closeAll();openSheet('alt',{sec,post,a});altFetch()}
async function altFetch(force){const x=st._alt;if(!x)return;const k=x.post+'|'+x.a;try{
 if(x.day&&!boardOf(x.sec,x.day))await loadBoard(x.sec,x.day);
 const [rv,cm]=await Promise.all([sb.from('alt_reviews').select('*').eq('post_id',x.post).eq('athlete_id',x.a).maybeSingle(),sb.from('mark_comments').select('*').eq('post_id',x.post).eq('athlete_id',x.a).order('created_at')]);
 st.altRev[k]=rv.data||null;st.altCm[k]=cm.data||[];renderSheet();
 if((!rv.data||force)&&!x._ai){x._ai=1;renderSheet();const r=await sb.functions.invoke('coach-ai',{body:{mode:'alt',post_id:x.post,athlete_id:x.a}});x._ai=0;if(r.data&&r.data.ok)st.altRev[k]=r.data;renderSheet()}}catch(e){if(x)x._ai=0;console.warn(e);renderSheet()}}
function altMark(x){for(const k in st.boards){const b=st.boards[k];if(b&&b.id===x.post){x.day=x.day||b.day;return {b,m:(b.board_marks||[]).find(m=>m.athlete_id===x.a),l:(b.board_lines||[]).find(l=>l.athlete_id===x.a)}}}return {}}
SHEETS.alt=arg=>{const x=st._alt||arg;const k=x.post+'|'+x.a;const {b,m,l}=altMark(x);const rv=st.altRev[k];const cm=st.altCm[k]||[];const cc=canCoach(x.sec);const s=secInfo(x.sec);
 let h=`<div class="stack"><div class="row12">${avOf(x.a)}<div class="grow" style="min-width:0"><div class="t16 w6 ell">${esc(cleanName(nameOf(x.a)))}</div><div class="t12 sec">${esc(s.name)}${x.day?' · '+dayLabel(x.day):''}</div></div>${tag('🔁 інакше','warn')}</div>`;
 if(!b)return {title:'Зробив інакше',full:true,body:h+`<div class="empty"><span class="spin"></span></div></div>`};
 h+=`<div class="card flat s8"><div class="over">План тренера</div><div class="t14" style="white-space:pre-line">${esc(l?l.text:(b.plan||'—'))}</div></div>`;
 h+=`<div class="card s8"><div class="over">Що зробив замість плану</div><div class="t16" style="white-space:pre-line">${m&&m.comment?esc(m.comment):'<span class="ter">Без опису</span>'}</div>${m?markNums(m):''}${m&&m.status!=='alt'?`<div class="t12 ter">Відмітку змінено на «${MARK[m.status][1]}»</div>`:''}</div>`;
 if(rv){const r=rv.planned_load?Math.round(rv.actual_load/rv.planned_load*100):100;
  h+=`<div class="card s8"><div class="between"><div class="over">Оцінка навантаження</div>${tag(rv.source==='ai'?'АІ':'правила',rv.source==='ai'?'a':'')}</div>
   <div class="grid3"><div class="tile"><div class="v">${rv.actual_load??'—'}</div><div class="l">факт, бали</div></div><div class="tile"><div class="v ter">${rv.planned_load??'—'}</div><div class="l">план, бали</div></div><div class="tile"><div class="v ${r>=120?'c-warn':r>=80?'c-ok':'c-bad'}">${r}%</div><div class="l">від плану</div></div></div>
   ${bar(Math.min(100,r),r>=120?'var(--warn)':r>=80?'var(--ok)':'var(--bad)')}<div class="t14">${esc(rv.verdict||'')}</div>
   <div class="t12 ter">Записано в щоденник як «зроблено інакше». Готовність на наступні дні враховує це навантаження.</div>${cc?`<button class="btn t sm" onclick="altFetch(true)">${ic('refresh',18)} Оцінити ще раз</button>`:''}</div>`}
 else h+=`<div class="card s8"><div class="over">Оцінка навантаження</div><div class="row t14 sec"><span class="spin"></span> АІ оцінює заміну… Орієнтовно ${m?altLoadEst(m,x.sec):'—'} балів</div></div>`;
 h+=`<div class="s8"><div class="over">Обговорення${cm.length?' · '+cm.length:''}</div>${cm.length?cm.map(c=>`<div class="row12" style="align-items:flex-start">${avOf(c.author_id)}<div class="grow" style="min-width:0"><div class="t12 sec">${esc(cleanName(nameOf(c.author_id)))} · ${ago(c.created_at)}</div><div class="t14" style="white-space:pre-line">${esc(c.body)}</div></div></div>`).join(''):`<div class="t14 ter">${cc?'Напишіть спортсмену, що думаєте про заміну':'Тренер може залишити коментар'}</div>`}</div>`;
 return {title:'Зробив інакше',full:true,body:h+'</div>',foot:`<div class="composer" style="flex:1"><input class="inp" id="altc" maxlength="1000" placeholder="${cc&&x.a!==st.me.id?'Коментар спортсмену':'Відповідь тренеру'}" onkeydown="if(event.key==='Enter')altSend(this)"><button class="sendb" onclick="altSend(this)" aria-label="Надіслати">${ic('send',20)}</button></div>`}};
async function altSend(el){const x=st._alt;const i=$('#altc');const v=(i.value||'').trim();if(!v||!x)return;i.value='';try{const c=D(await sb.from('mark_comments').insert({post_id:x.post,athlete_id:x.a,body:v}).select().single());const k=x.post+'|'+x.a;(st.altCm[k]=st.altCm[k]||[]).push(c);renderSheet();scrollSheet()}catch(e){i.value=v;fail(e)}}
function onMarkComment(p){const c=p.new;const x=st._alt;const top=sheetStack[sheetStack.length-1];if(!x||!top||top.name!=='alt'||c.post_id!==x.post||c.athlete_id!==x.a)return;const k=x.post+'|'+x.a;const a=st.altCm[k]=st.altCm[k]||[];if(a.some(y=>y.id===c.id))return;a.push(c);renderSheet();scrollSheet()}
function onAltReview(p){const r=p.new;if(!r)return;st.altRev[r.post_id+'|'+r.athlete_id]=r;const top=sheetStack[sheetStack.length-1];if(top&&top.name==='alt')renderSheet()}
function altBtn(sec,b,id){return `<button class="altlink" onclick="openAlt('${sec}',${b.id},'${id}','${b.day}')">🔁 Що зробив · обговорити ${ic('chev',14)}</button>`}
/* the athlete's alt mark → diary entry «зроблено інакше» (load estimate now, AI refines it) */
async function altSyncLog(sec,b,mk){const uid=st.me.id;const old=st.logs.filter(l=>l.board_post_id===b.id);
 if(old.length){await sb.from('workout_logs').delete().eq('athlete_id',uid).eq('board_post_id',b.id);st.logs=st.logs.filter(l=>l.board_post_id!==b.id)}
 if(mk.status!=='alt')return;const sp=secInfo(sec).sport||sec;const sport=['bike','run','swim','gym'].includes(sp)?sp:'bike';
 const row={athlete_id:uid,day:b.day,sport,title:'Зроблено інакше · '+secInfo(sec).name,status:'done',duration_min:mk.time_min?Math.round(mk.time_min):null,distance:mk.dist_km?(sport==='swim'?Math.round(mk.dist_km*1000):mk.dist_km):null,avg_hr:mk.hr||null,tss:altLoadEst(mk,sec),note:mk.comment||null,source:'board',board_post_id:b.id};
 const r=await sb.from('workout_logs').insert(row).select().single();if(!r.error){st.logs.push(r.data)}
 sb.functions.invoke('coach-ai',{body:{mode:'alt',post_id:b.id,athlete_id:uid}}).then(x=>{if(x.data&&x.data.ok){st.altRev[b.id+'|'+uid]=x.data;const l=st.logs.find(l=>l.board_post_id===b.id);if(l)l.tss=x.data.actual_load;render()}}).catch(()=>{})}

/* ---------- READINESS ---------- */
const WQ4=['Щось болить?',['Ні','Трохи','Так']];
function logLoad(l){return l.tss||Math.round((l.duration_min||0)*(l.rpe||5)*(l.rpe||5)/60*1.1)}
function readyCalc(w){const R=[];let s=100;
 if(w.sleep===0){s-=25;R.push('поганий сон')}else if(w.sleep===1)s-=5;
 if(w.energy===0){s-=20;R.push('мало енергії')}else if(w.energy===1)s-=5;
 if(w.legs===0){s-=20;R.push('важкі ноги')}else if(w.legs===1)s-=5;
 if(w.pain===2){s-=40;R.push('болить')}else if(w.pain===1){s-=15;R.push('легкий дискомфорт')}
 const t=todayIso();const L=d=>st.logs.filter(l=>l.day===d&&l.status==='done').reduce((a,l)=>a+logLoad(l),0);
 let a7=0,a28=0;for(let k=1;k<=28;k++){const v=L(isoAdd(t,-k));if(k<=7)a7+=v;a28+=v}const atl=a7/7,ctl=a28/28,y=L(isoAdd(t,-1));
 if(ctl>5&&atl>ctl*1.35){s-=12;R.push('навантаження за тиждень різко зросло')}
 if(y>Math.max(120,ctl*2.5)){s-=10;R.push('вчора було важке тренування')}
 s=Math.max(5,Math.min(100,Math.round(s)));
 const level=w.pain===2||s<30?'rest':s<50?'recovery':s<70?'light':'good';
 return {score:s,level,reasons:R}}
const READY_L={good:['Готові до плану','c-ok'],light:['Тренування полегшено','c-warn'],recovery:['Замінено на відновлення','c-warn'],rest:['Сьогодні краще відпочити','c-bad']};
function readyFor(pid){return pid===st.me.id?st.ready:(st.readyAll||{})[pid]}
function readyActive(rd){return rd&&rd.day===todayIso()&&rd.level!=='good'&&!rd.override&&!rd.coach_reverted}
function adaptDay(d,level){if(!d||d.rest)return d;const keep=d.items.filter(it=>it.section||it.log);const adj=d.items.filter(it=>!it.section&&!it.log);if(!adj.length)return d;
 if(level==='rest')return Object.assign({},d,{items:keep,rest:!keep.length,adapted:'rest',orig:d.items});
 const EZ={light:{bike:'z2',run:'easy',swim:'aer',gym:'core'},recovery:{bike:'rec',run:'easy',swim:'tech',gym:'core'}}[level];
 const items=adj.map(it=>{const min=level==='light'?Math.max(20,Math.round((it.min||45)*.7)):Math.min(40,Math.max(20,Math.round((it.min||45)*.5)));const w=pickW(it.sport,EZ[it.sport]||'z2',min,'beg',d.i);return {sport:it.sport,w:w?w.id:null,min:w?Math.min(w.dur,min+10):min,easy:true}});
 return Object.assign({},d,{items:keep.concat(items),adapted:level,orig:d.items})}
function dayText(d){return d.rest?'відпочинок':d.items.map(it=>itemName(it)+' · '+fmtMin(it.min||0)).join(' + ')}
async function saveReadiness(w){const c=readyCalc(w);const base=weekPlan(st.me.id,0,true).days[TODAY];const ad=c.level==='good'?base:adaptDay(base,c.level);
 const changed=c.level!=='good'&&ad!==base;const row={athlete_id:st.me.id,day:todayIso(),score:c.score,level:c.level,reasons:c.reasons,original:dayText(base),adapted:changed?dayText(ad):null,override:false};
 const r=await sb.from('readiness').upsert(row,{onConflict:'athlete_id,day'}).select().single();st.ready=r.error?Object.assign({},row,{_local:true}):r.data;if(r.error)console.warn(r.error);
 readyTip();return c}
async function readyTip(){const rd=st.ready;if(!rd||rd._local||rd._tipBusy)return;if(rd.tip&&rd.tip_source==='ai:'+rd.level)return;rd._tipBusy=1;
 try{const r=await sb.functions.invoke('coach-ai',{body:{mode:'tip'}});if(r.data&&r.data.tip&&st.ready){st.ready.tip=r.data.tip;st.ready.tip_source=r.data.source;render()}}catch(e){console.warn(e)}finally{if(st.ready)st.ready._tipBusy=0}}
function ruleTip(rd){const R=rd.reasons||[];if(R.includes('болить'))return 'Не тренуйтеся через біль. Напишіть тренеру, де саме болить, і дайте тілу день-два.';
 if(R.includes('поганий сон'))return 'Сьогодні ляжте на 30–60 хв раніше, без екрана за годину до сну. Кава — лише до обіду.';
 if(R.includes('важкі ноги'))return 'Легка прогулянка 20–30 хв, розтяжка і 2–2,5 л води протягом дня допоможуть ногам відновитися.';
 if(R.includes('мало енергії'))return 'Поїжте вуглеводів за 2–3 год до тренування і випийте склянку води з дрібкою солі.';
 if(rd.level==='good')return 'Готовність хороша. Не забудьте про воду: 500 мл за годину тренування, і білок протягом 30 хв після.';
 return 'Пийте воду рівномірно протягом дня і додайте білок до кожного прийому їжі.'}
function readyCard(){const rd=st.ready;if(!rd||rd.day!==todayIso())return '';const L=READY_L[rd.level];const act=readyActive(rd);
 const col=rd.score>=70?'var(--ok)':rd.score>=50?'var(--warn)':'var(--bad)';
 let h=`<div class="card s12 ready"><div class="row12"><div class="rring" style="--p:${rd.score};--rc:${col}"><b>${rd.score}</b></div><div class="grow"><div class="over">Готовність сьогодні</div><div class="t16 w6 ${L[1]}">${rd.level==='good'?L[0]:act?L[0]:rd.coach_reverted?'Тренер повернув план':'Ви тренуєтесь за планом'}</div>${(rd.reasons||[]).length?`<div class="t12 sec">${esc(rd.reasons.join(' · '))}</div>`:''}</div></div>`;
 if(rd.level!=='good'&&rd.original&&!rd.adapted)h+=`<div class="t14 sec">${/відпочинок/.test(rd.original)?'Сьогодні за планом відпочинок — саме те, що потрібно.':'Завдання на сьогодні дає тренер секції, автоматично його не змінюємо. Тренер бачить вашу готовність. Якщо почуваєтесь погано — відмітьте на дошці «❌ Пропускаю» або «🔁 Зробив інакше».'}</div>`;
 if(rd.level!=='good'&&rd.original&&rd.adapted){h+=`<div class="t14 sec">${act?`Було: <s>${esc(rd.original)}</s><br>Стало: <b style="color:var(--tx)">${esc(rd.adapted||'відпочинок')}</b>`:'План: '+esc(rd.original)}</div>`;
  if(act)h+=`<button class="btn s sm" onclick="readyOverride(this,true)">Все одно зробити як було</button><div class="t12 ter">Тренер отримав сповіщення і може скасувати зміну.</div>`;
  else if(rd.override)h+=`<button class="btn t sm" onclick="readyOverride(this,false)">Повернути полегшений варіант</button>`;
  else if(rd.coach_reverted)h+=`<div class="t12 ter">Тренер переглянув самопочуття і залишив план без змін.</div>`}
 const tip=rd.tip&&rd.tip_source&&rd.tip_source.startsWith('ai')?rd.tip:ruleTip(rd);
 h+=`<div class="tip">${ic('spark',18)}<span>${esc(tip)}</span></div>`;
 return h+'</div>'}
async function readyOverride(btn,v){await busy(btn,async()=>{const r=await sb.from('readiness').update({override:v}).eq('athlete_id',st.me.id).eq('day',todayIso()).select().single();if(r.error)throw r.error;st.ready=Object.assign(st.ready,r.data);render();toast(v?'Тренування як у плані':'Повернули полегшений варіант')})}
async function loadReady(){try{const r=await sb.from('readiness').select('*').eq('athlete_id',st.me.id).eq('day',todayIso()).maybeSingle();st.ready=r.data||null;if(st.ready)readyTip()}catch(e){}}
async function loadReadyAll(){try{const r=await sb.from('readiness').select('*').eq('day',todayIso());st.readyAll={};(r.data||[]).forEach(x=>st.readyAll[x.athlete_id]=x)}catch(e){}}
function readyCoachBlock(id){const rd=(st.readyAll||{})[id];if(!rd)return `<div class="t12 ter">Самопочуття сьогодні ще не відмічено</div>`;const L=READY_L[rd.level];const act=readyActive(rd);
 return `<div class="card s8"><div class="between"><div class="over">Готовність сьогодні</div><b class="t16 ${rd.score>=70?'c-ok':rd.score>=50?'c-warn':'c-bad'}">${rd.score}%</b></div><div class="t14 w6">${rd.level==='good'?L[0]:rd.override?'Спортсмен обрав план без змін':rd.coach_reverted?'Ви повернули план':L[0]}</div>${(rd.reasons||[]).length?`<div class="t12 sec">${esc(rd.reasons.join(' · '))}</div>`:''}
  ${rd.level!=='good'&&rd.original?`<div class="t12 sec">План: ${esc(rd.original)}${rd.adapted?'<br>Полегшено до: '+esc(rd.adapted):''}</div>`:''}
  ${rd.level!=='good'&&!rd.override&&rd.adapted?(act?`<button class="btn s sm" onclick="readyRevert(this,'${id}',true)">${ic('refresh',18)} Скасувати полегшення</button>`:rd.coach_reverted?`<button class="btn t sm" onclick="readyRevert(this,'${id}',false)">Повернути полегшення</button>`:''):''}</div>`}
async function readyRevert(btn,id,v){await busy(btn,async()=>{D(await sb.rpc('readiness_revert',{a:id,d:todayIso(),v}));await loadReadyAll();render();renderSheet();toast(v?'План повернуто. Спортсмен отримав сповіщення':'Полегшення повернуто')})}
SHEETS.readyC=id=>{if(!(st.readyAll||{})[id]&&!st._rdl){st._rdl=1;loadReadyAll().then(()=>{st._rdl=0;renderSheet()})}return {title:'Готовність · '+esc(shortName(id)),body:`<div class="stack">${readyCoachBlock(id)}</div>`}};

/* ---------- NOTIFICATIONS: precise deep links ---------- */
function notifLink(n){const L=n.link;if(!L||!L.t)return false;closeAll();
 if(L.t==='alt'&&L.s&&L.post){st.sec=L.s;st.secSeg='board';if(L.d)st.bDay=L.d;go('sec');setTimeout(()=>openAlt(L.s,L.post,L.a,L.d),60);return true}
 if(L.t==='board'&&L.s){st.sec=L.s;st.secSeg='board';if(L.d)st.bDay=L.d;go('sec');return true}
 if(L.t==='secchat'&&L.s){st.sec=L.s;go('sec');setTimeout(()=>openSheet('secChat',L.s),60);return true}
 if(L.t==='teamchat'||L.t==='chat'){st.chatSeg='team';go('chat');return true}
 if(L.t==='dm'&&(L.a||L.u)){st.chatSeg='dm';go('chat');setTimeout(()=>openSheet('dm',L.a||L.u),60);return true}
 if(L.t==='ready'&&L.a){if(L.a===st.me.id&&!isCoach()){go('today');return true}if(isCoach()&&st.athletes.some(a=>a.id===L.a)){go('team');setTimeout(()=>openSheet('athlete',L.a),60);return true}setTimeout(()=>openSheet('readyC',L.a),60);return true}
 if(L.t==='aiplan'&&L.a){if(L.a===st.me.id&&!isCoach()){go('today');return true}if(isCoach()&&st.athletes.some(a=>a.id===L.a)){st.cardSeg='plan';go('team');setTimeout(()=>openSheet('athlete',L.a),60);return true}return false}
 if(L.t==='plan'){go(isCoach()?'team':'plan');return true}
 if(L.t==='today'){if(isCoach()&&typeof cabinetSwitch==='function'){}go(isCoach()?'team':'today');return true}
 if(L.t==='events'||L.t==='ride'){goClub('events');return true}
 if(L.t==='feed'||L.t==='club'){goClub(L.seg||'feed');return true}
 return false}
