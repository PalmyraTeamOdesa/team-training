/* ---------- WEB PUSH ---------- */
const PUSH_PROMPT_KEY='triton_push_prompt_v1';
function pushSupported(){return typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window}
function pushIosNeedsInstall(){try{const i=instInfo();return !!(i.iOS&&!i.standalone)}catch(e){return false}}
function pushPromptDismissed(){try{return localStorage.getItem(PUSH_PROMPT_KEY)==='1'}catch(e){return false}}
function pushDismissPrompt(){try{localStorage.setItem(PUSH_PROMPT_KEY,'1')}catch(e){}const el=$('#push-prompt');if(el)el.remove();else render()}
function pushStatusLabel(){
 if(!pushSupported())return 'Цей браузер не підтримує';
 if(pushIosNeedsInstall())return 'Спочатку додайте на екран Додому';
 if(typeof Notification!=='undefined'&&Notification.permission==='denied')return 'Заборонено в налаштуваннях браузера';
 if(st.pushOn)return 'Увімкнено на цьому пристрої';
 return 'Вимкнено'}
function b64ToUint8(b64){const pad='='.repeat((4-(b64.length%4))%4);const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function loadPushPrefs(){
 if(!st.me||(!st.coach&&st.me.status!=='active'))return;
 try{const r=await sb.from('push_prefs').select('*').eq('user_id',st.me.id).maybeSingle();st.pushPrefs=r.data||{chats:true,dms:true,news:true,awards:true,coach_alerts:true}}
 catch(e){st.pushPrefs=st.pushPrefs||{chats:true,dms:true,news:true,awards:true,coach_alerts:true}}
 try{if(!pushSupported()){st.pushOn=false;return}const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();st.pushOn=!!sub}catch(e){st.pushOn=false}}
async function pushEnsurePrefs(){
 if(st.pushPrefs&&st.pushPrefs.user_id)return st.pushPrefs;
 const row={user_id:st.me.id,chats:true,dms:true,news:true,awards:true,coach_alerts:true};
 const r=await sb.from('push_prefs').upsert(row,{onConflict:'user_id'}).select().single();
 if(r.error)throw r.error;st.pushPrefs=r.data;return st.pushPrefs}
async function pushSetPref(key,btn){
 await busy(btn,async()=>{const cur=await pushEnsurePrefs();const next=Object.assign({},cur,{[key]:!cur[key],updated_at:new Date().toISOString()});
  const r=await sb.from('push_prefs').upsert({user_id:st.me.id,chats:!!next.chats,dms:!!next.dms,news:!!next.news,awards:!!next.awards,coach_alerts:!!next.coach_alerts},{onConflict:'user_id'}).select().single();
  if(r.error)throw r.error;st.pushPrefs=r.data;renderSheet();toast('Збережено')})}
async function pushEnable(btn){
 if(pushIosNeedsInstall()){openSheet('ppush');return}
 if(!pushSupported()){toast('Цей браузер не підтримує сповіщення','info');return}
 if(Notification.permission==='denied'){openSheet('ppush');return}
 await busy(btn,async()=>{
  if(Notification.permission==='default'){const p=await Notification.requestPermission();if(p!=='granted'){render();renderSheet();if(p==='denied')toast('Доступ заборонено. Його можна ввімкнути в налаштуваннях браузера.','info');return}}
  if(Notification.permission!=='granted')return;
  try{
   const reg=await navigator.serviceWorker.ready;
   let sub=await reg.pushManager.getSubscription();
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(VAPID_PUBLIC)});
   const keys=sub.toJSON().keys||{};
   const {error}=await sb.rpc('push_subscribe',{p_endpoint:sub.endpoint,p_p256dh:keys.p256dh,p_auth:keys.auth,p_ua:(navigator.userAgent||'').slice(0,300)});
   if(error)throw error;
  }catch(e){
   const m=String(e&&e.message||e||'');
   if(/permission denied/i.test(m)){toast('Браузер не дав підписатися на пуш. Перевірте дозвіл у налаштуваннях або додайте застосунок на екран.','info');return}
   throw e;
  }
  st.pushOn=true;try{localStorage.setItem(PUSH_PROMPT_KEY,'1')}catch(e){}
  await pushEnsurePrefs();
  render();renderSheet();toast('Сповіщення увімкнено')
 })}
async function pushDisable(btn){
 await busy(btn,async()=>{
  let endpoint=null;
  try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){endpoint=sub.endpoint;await sub.unsubscribe()}}catch(e){}
  if(endpoint){try{await sb.rpc('push_unsubscribe',{p_endpoint:endpoint})}catch(e){}}
  st.pushOn=false;render();renderSheet();toast('Сповіщення вимкнено на цьому пристрої')
 })}
async function pushSendTest(btn){
 await busy(btn,async()=>{
  if(!st.pushOn){await pushEnable(btn);if(!st.pushOn)return}
  const {data,error}=await sb.functions.invoke('push-send',{body:{action:'test'}});
  if(error)throw error;
  if(data&&data.error==='not_configured'){toast('Сповіщення ще налаштовуються','info');return}
  if(data&&data.sent>0)toast('Тестове сповіщення надіслано');
  else if(data&&data.sent===0)toast('Підписку збережено, але доставка не підтвердилась. Спробуйте ще раз за хвилину.','info');
  else toast('Не вдалося надіслати','info');
 })}
function pushDeniedHelp(){
 let i={};try{i=instInfo()}catch(e){}
 if(i.iOS)return 'Відкрийте Параметри → Сповіщення → TRITON (або Safari) і дозвольте сповіщення.';
 if(i.android)return 'У Chrome: меню ⋮ → Налаштування сайту → Сповіщення → Дозволити. Або Параметри Android → Програми → Chrome → Сповіщення.';
 return 'У Chrome або Edge відкрийте налаштування сайту (замочок біля адреси) і дозвольте сповіщення, потім поверніться сюди.';
}
function pushShouldPrompt(){
 if(!st.me||(st.me.status!=='active'&&!st.coach))return false;
 if(st.pushOn||pushPromptDismissed())return false;
 if(!pushSupported()&&!(typeof instInfo==='function'&&instInfo().iOS))return false;
 return true}
function pushPromptHtml(){
 if(!pushShouldPrompt())return '';
 if(pushIosNeedsInstall())return `<div class="card" id="push-prompt"><div class="t16">Сповіщення на телефон</div><div class="t14 sec">На iPhone сповіщення працюють після того, як додасте TRITON на екран Додому в Safari.</div><div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn p sm" onclick="openSheet('phome')">Як додати</button><button class="btn t sm" onclick="pushDismissPrompt()">Пізніше</button></div></div>`;
 if(typeof Notification!=='undefined'&&Notification.permission==='denied')return `<div class="card" id="push-prompt"><div class="t16">Сповіщення на телефон</div><div class="t14 sec">${esc(pushDeniedHelp())}</div><div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn t sm" onclick="pushDismissPrompt()">Зрозуміло</button></div></div>`;
 return `<div class="card" id="push-prompt"><div class="t16">Сповіщення на телефон</div><div class="t14 sec">Чат, оголошення і новини приходитимуть, навіть коли застосунок закритий.</div><div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn p sm" onclick="pushEnable(this)">Увімкнути</button><button class="btn t sm" onclick="pushDismissPrompt()">Пізніше</button></div></div>`}
SHEETS.ppush=()=>{
 const on=!!st.pushOn;const den=typeof Notification!=='undefined'&&Notification.permission==='denied';
 const ios=pushIosNeedsInstall();const supp=pushSupported();
 const P=st.pushPrefs||{chats:true,dms:true,news:true,awards:true,coach_alerts:true};
 const rows=[['chats','Чати','Загальний чат і чати секцій'],['dms','Особисті повідомлення','Листи у приватний чат'],['news','Новини і події','Оголошення, заїзди, стрічка'],['awards','Нагороди і бали','Досягнення та бали від тренера']];
 if(isCoach())rows.push(['coach_alerts','Запити і тривоги','Запити на зміну, самопочуття, тривожні сигнали']);
 let top='';
 if(ios)top=`<div class="note">${ic('phone',20)}<span>На iPhone сповіщення працюють лише після додавання TRITON на екран Додому в Safari (не в Chrome і не з Telegram).</span></div>
  <button class="btn p" onclick="openSheet('phome')">${ic('phone',20)} Як додати на екран Додому</button>`;
 else if(!supp)top=`<div class="note">${ic('info',20)}<span>Цей браузер не підтримує вебсповіщення. Відкрийте застосунок у Chrome або Safari.</span></div>`;
 else if(den)top=`<div class="note warn">${ic('info',20)}<span>${esc(pushDeniedHelp())}</span></div>`;
 else if(on)top=`<div class="note">${ic('check',20)}<span>Сповіщення увімкнено на цьому пристрої.</span></div>
  <button class="btn s" onclick="pushDisable(this)">Вимкнути на цьому пристрої</button>
  <button class="btn t" onclick="pushSendTest(this)">Надіслати тестове</button>`;
 else top=`<button class="btn p" onclick="pushEnable(this)">${ic('bell',20)} Увімкнути сповіщення</button>
  <div class="t14 sec">Дозвіл запитується лише після натискання цієї кнопки.</div>`;
 return {title:'Сповіщення',body:`<div class="stack">${top}
  <div class="over">Що надсилати</div>
  <div class="list">${rows.map(r=>`<button class="li" onclick="pushSetPref('${r[0]}',this)"><div class="grow"><div class="t16">${r[1]}</div><div class="t12 sec">${r[2]}</div></div><span class="tg ${P[r[0]]?'on':''}"></span></button>`).join('')}</div>
  <div class="note">${ic('info',20)}<span>Нагадування про самопочуття і тренування, поки застосунок відкритий, налаштовуються окремо: Профіль → Нагадування.</span></div></div>`}};
function pushParse(href){
 try{const u=new URL(href,location.href);const h=(u.hash||'').replace(/^#/,'');
  if(h==='go'||h.startsWith('go='))return Object.fromEntries(new URLSearchParams(h));
  if(u.searchParams.get('go'))return Object.fromEntries(u.searchParams)}catch(e){}
 return null}
function pushApply(t){
 if(!t||!t.go||st.screen!=='app')return false;
 const L={t:t.go,s:t.s,a:t.a||t.u,u:t.u,post:t.post,d:t.d,seg:t.seg};
 if(t.go==='dm')L.t='dm';
 if(t.go==='teamchat')L.t='teamchat';
 if(t.go==='secchat')L.t='secchat';
 if(t.go==='ach'){closeAll();go('prog');setTimeout(()=>openSheet('ach'),60);return true}
 if(t.go==='req'){closeAll();if(isCoach())go('req');else go('today');return true}
 if(typeof notifLink==='function'&&notifLink({link:L}))return true;
 closeAll();
 if(t.go==='today'){go(isCoach()?'team':'today');return true}
 if(t.go==='chat'||t.go==='teamchat'){st.chatSeg='team';go('chat');return true}
 go(isCoach()?'team':'today');return true}
function pushConsumeHash(){
 const t=pushParse(location.href);if(!t)return;
 try{history.replaceState(history.state||{},'',(typeof navUrl==='function'?navUrl():location.pathname+location.search))}catch(e){}
 pushApply(t)}
function pushOnMessage(ev){
 const d=ev&&ev.data;if(!d||d.type!=='triton-push-nav')return;
 const t=pushParse(d.url||'');if(t)pushApply(t);
 else if(d.url){try{const u=new URL(d.url,location.href);if(u.origin===location.origin){/* already open */} }catch(e){}}}
if(typeof navigator!=='undefined'&&navigator.serviceWorker)navigator.serviceWorker.addEventListener('message',pushOnMessage);
