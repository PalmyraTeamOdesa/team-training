/* ---------- PROFILE ---------- */
SHEETS.profile=()=>{const p=me();const coach=isCoach();
 const sw=st.coach?(coach?li({left:`<span class="ico a">${ic('bike',20)}</span>`,t:'Мій кабінет спортсмена',s:'Ваш власний план і щоденник',on:'toSelf(this)'}):li({left:`<span class="ico a">${ic('users',20)}</span>`,t:'Повернутися в режим тренера',s:'Команда, запити, бібліотека',on:'toCoach()'})):'';
 const rows=coach?[['user','Мої дані',esc(p.name),'pdata'],['bell','Нагадування','Сповіщення в застосунку','premind'],['lock','Змінити пароль','','password'],['phone','Додати на головний екран','Працює як застосунок','phome']]:[
  ['user','Мої дані',`${p.age} р. · ${p.height} см · ${String(p.weight).replace('.',',')} кг`,'pdata'],
  ['target','Цілі',p.goals.map(g=>GOALS[g]).join(', ')||'—','pgoals'],
  ['gauge','Зони',p.form.ftp?'Розраховано з FTP '+p.form.ftp+' Вт':'Після тесту FTP','zones'],
  ['gym','Інвентар',p.equip.length+' позицій','pequip'],
  ['clock','Мій час і можливості','Дні, години, вид активності','schedule'],
  ['bell','Нагадування','Тренування о '+p.remind,'premind'],
  ['link','Strava, Garmin і файли','Strava і Garmin незабаром · файли вже працюють','pconn'],
  ['eyeoff','Приватність',p.hide?'Цифри приховані':'Цифри видно команді','priv'],
  ['download','Експорт даних','JSON з усіма вашими даними','pexport'],
  ['lock','Змінити пароль','','password'],
  ['phone','Додати на головний екран','Працює як застосунок','phome']];
 return {title:'Профіль',full:true,body:`<div class="stack"><div class="row12"><span class="av lg ${st.coach?'me':''}">${esc(p.ini)}</span><div class="grow"><div class="t20">${esc(p.name)}</div><div class="t14 sec">${st.coach?'Головний тренер · TRITON':esc(p.group)+(p.city?' · '+esc(p.city):'')}</div><div class="t12 ter">${esc(st.user.email||'')}</div></div></div>
 ${sw?`<div class="list">${sw}</div>`:''}
 <div class="list">${rows.map(r=>li({left:`<span class="ico">${ic(r[0],20)}</span>`,t:r[1],s:r[2],on:r[3]==='pexport'?'exportData(this)':`openSheet('${r[3]}')`})).join('')}</div>
 <button class="btn d" onclick="logout()">${ic('logout',20)} Вийти</button><div class="t12 ter center">TRITON Team · версія ${APP_VERSION}</div></div>`}};
async function toSelf(btn){await busy(btn,async()=>{st.coachSelf=true;await loadMine();await loadTeam();st.tab='today';closeAll();render._k='';if(!st.me.days.some(d=>d.acts.length)){toast('Заповніть свою анкету, щоб отримати план','info');startOnb();return}render()})}
function toCoach(){st.coachSelf=false;closeAll();render._k='';render()}
function pf(label,key,attrs){const p=me();return `<div class="field"><label>${label}</label><input class="inp" value="${esc(p[key])}" ${attrs||''} oninput="me()['${key}']=this.value"></div>`}
SHEETS.pdata=()=>{const p=me();return {title:'Мої дані',body:`<div class="stack">${pf('Імʼя і прізвище','name','maxlength="80"')}
 ${isCoach()?'':`${nf({id:'p-age',label:'Вік',val:p.age,min:6,max:90,step:1,unit:'р.',set:v=>p.age=v})}
 ${nf({id:'p-height',label:'Зріст',val:p.height,min:100,max:230,step:1,unit:'см',set:v=>p.height=v})}
 ${nf({id:'p-weight',label:'Вага',val:p.weight,min:20,max:200,step:0.1,unit:'кг',set:v=>p.weight=v})}
 ${nf({id:'p-ftp',label:'Поточний FTP',val:p.form.ftp||'',min:50,max:600,step:5,unit:'Вт',empty:true,ph:'невідомо',set:v=>p.form.ftp=v||0})}
 ${nf({id:'p-hrr',label:'Пульс спокою',val:p.form.hrRest||'',min:30,max:110,step:1,unit:'уд/хв',empty:true,ph:'невідомо',set:v=>p.form.hrRest=v||0})}
 ${nf({id:'p-hrm',label:'Макс. пульс',val:p.form.hrMax||'',min:120,max:230,step:1,unit:'уд/хв',empty:true,ph:'невідомо',set:v=>p.form.hrMax=v||0})}
 ${p.sports.run&&p.sports.run.on?nf({id:'p-5k',label:'5 км',val:p.form.run5k||'',min:12*60,max:60*60,step:5,kind:'time',unit:'хв:с',empty:true,set:v=>p.form.run5k=v===''?'':nfFmtTime(v)}):''}
 ${p.sports.swim&&p.sports.swim.on?nf({id:'p-15',label:'1500 м',val:p.form.swim1500||'',min:16*60,max:80*60,step:5,kind:'time',unit:'хв:с',empty:true,set:v=>p.form.swim1500=v===''?'':nfFmtTime(v)}):''}
 ${pf('Місто','city','maxlength="60"')}`}</div>`,foot:`<button class="btn p" onclick="savePData(this)">Зберегти</button>`}};
async function savePData(btn){await busy(btn,async()=>{const p=me();p.name=String(p.name).trim()||p.name;const h=p.ftpHist||[];if(p.form.ftp&&(!h.length||h[h.length-1].v!==p.form.ftp)){h.push({d:dayIso(0,TODAY),v:p.form.ftp});p.ftpHist=h}
 await saveMe();if(st.coach)await loadMembers();closeSheet();render();toast('Збережено');checkNewAch()})}
SHEETS.pgoals=()=>{const p=me();return {title:'Цілі',body:`<div class="stack"><div class="chips">${Object.keys(GOALS).map(g=>`<button class="chip ${p.goals.includes(g)?'on':''}" onclick="tgArr(me().goals,'${g}')">${GOALS[g]}</button>`).join('')}</div>
 ${nf({id:'g-ftp',label:'Ціль FTP',val:p.targets.ftp||'',min:80,max:600,step:5,unit:'Вт',empty:true,set:v=>p.targets.ftp=v||0})}
 ${isKid()?'':nf({id:'g-wt',label:'Ціль вага',val:p.targets.weight||'',min:30,max:200,step:0.1,unit:'кг',empty:true,set:v=>p.targets.weight=v||0})}
 <div class="note">${ic('info',20)}<span>Зміна цілей перебудує план з наступного тижня.</span></div></div>`,foot:`<button class="btn p" onclick="saveGoals(this)">Зберегти</button>`}};
async function saveGoals(btn){await busy(btn,async()=>{if(!me().goals.length)me().goals=['endur'];await saveMe();if(canEditPlan(1)){const g=genFor(st.me,1,1);try{await savePlan(st.me.id,1,g.days,{scale:g.scale,note:g.note})}catch(e){}}closeSheet();render();toast('Цілі оновлено')})}
function tgArr(arr,v){const i=arr.indexOf(v);if(i>=0)arr.splice(i,1);else arr.push(v);renderSheet()}
SHEETS.zones=()=>{const p=me();const f=p.form.ftp,hm=p.form.hrMax||(220-p.age);const Z=[['Z1 Відновлення',0,.55,0,.68],['Z2 Витривалість',.56,.75,.69,.83],['Z3 Темп',.76,.9,.84,.94],['Z4 Поріг',.91,1.05,.95,1.05],['Z5 VO2max',1.06,1.2,null,null],['Z6 Анаеробна',1.21,null,null,null]];
 return {title:'Зони',body:`<div class="stack"><div class="t14 sec">Автоматично з FTP ${f||'—'} Вт і макс. пульсу ${hm}${p.form.hrMax?'':' (оцінка 220 − вік)'}. Оновіть FTP у «Мої дані» після тесту.</div>
 <div class="list">${Z.map(z=>`<div class="li"><span class="sd" style="width:12px;height:12px;border-radius:4px;background:${zoneCol((z[1]+(z[2]||1.4))/2)}"></span><div class="grow"><div class="t14 w6">${z[0]}</div><div class="t12 sec">${z[3]!=null?'Пульс '+Math.round(z[3]*hm*.93)+'–'+Math.round(z[4]*hm*.93):'Пульс не показовий'}</div></div><div class="t14 num">${f?(z[2]?Math.round(z[1]*f)+'–'+Math.round(z[2]*f):'>'+Math.round(z[1]*f))+' Вт':''}</div></div>`).join('')}</div></div>`}};
SHEETS.pequip=()=>{const p=me();return {title:'Інвентар',body:`<div class="chips">${Object.keys(EQUIP).map(e=>`<button class="chip ${p.equip.includes(e)?'on':''}" onclick="tgArr(me().equip,'${e}')">${EQUIP[e]}</button>`).join('')}</div>`,foot:`<button class="btn p" onclick="busy(this,async()=>{await saveMe();closeSheet();toast('Збережено')})">Зберегти</button>`}};
SHEETS.premind=()=>{const p=me();const R=p.remindOn;return {title:'Нагадування',body:`<div class="stack">${nf({id:'p-rem',label:'Час ранкового нагадування',val:(()=>{const t=(p.remind||'07:00').split(':');return +t[0]*60+(+t[1]||0)})(),min:5*60,max:22*60,step:15,kind:'clock',set:v=>p.remind=nfFmtClock(v)})}
 <div class="list">${[['morning','Ранкове самопочуття','Щодня в обраний час'],['workout','Тренування дня','Якщо ще не відмічено'],['water','Вода і білок','Двічі на день'],['weekly','Планування тижня','Неділя ввечері']].map(r=>`<button class="li" onclick="me().remindOn.${r[0]}=!me().remindOn.${r[0]};renderSheet()"><div class="grow"><div class="t16">${r[1]}</div><div class="t12 sec">${r[2]}</div></div><span class="tg ${R[r[0]]?'on':''}"></span></button>`).join('')}</div>
 <div class="note">${ic('info',20)}<span>Нагадування показуються, коли застосунок відкритий або встановлений на головний екран (дозвіл на сповіщення).</span></div></div>`,foot:`<button class="btn p" onclick="saveRemind(this)">Зберегти</button>`}};
async function saveRemind(btn){await busy(btn,async()=>{await saveMe();try{if('Notification' in window&&Notification.permission==='default')await Notification.requestPermission()}catch(e){}closeSheet();toast('Збережено')})}
SHEETS.pconn=()=>({title:'Strava, Garmin і файли',body:`<div class="stack"><div class="list">${[['Strava','Автоімпорт тренувань'],['Garmin Connect','Автоімпорт тренувань і сну']].map(c=>`<div class="li"><span class="ico">${ic('link',20)}</span><div class="grow"><div class="t16">${c[0]}</div><div class="t12 sec">${c[1]}</div></div>${tag('незабаром')}</div>`).join('')}</div>
 <button class="btn s" onclick="closeAll();pickActivityFile()">${ic('upload',20)} Завантажити .fit, .gpx або .tcx</button>
 <div class="t12 ter">Поки що експортуйте файл з годинника, Garmin Connect, Strava чи Zwift і завантажте сюди: ми прочитаємо час, дистанцію, пульс і потужність.</div></div>`});
SHEETS.priv=()=>({title:'Приватність',body:`<div class="stack"><div class="list"><button class="li" onclick="togglePriv(this)"><div class="grow"><div class="t16">Приховати мої цифри</div><div class="t12 sec">Команда бачить тренування без потужності, темпу і дистанції</div></div><span class="tg ${me().hide?'on':''}"></span></button></div>
 <div class="note">${ic('lock',20)}<span>План, анкету, самопочуття, вагу і харчування бачите лише ви і тренер. Команда бачить тільки те, чим ви поділились самі.</span></div></div>`});
async function togglePriv(btn){await busy(btn,async()=>{me().hide=!me().hide;await saveMe();renderSheet();toast(me().hide?'Цифри приховано':'Цифри видно команді')})}
SHEETS.phome=()=>({title:'На головний екран',body:`<div class="stack">${window._installEvt?`<button class="btn p" onclick="_installEvt.prompt()">${ic('phone',20)} Встановити застосунок</button>`:''}<div class="card s8"><div class="t16">iPhone</div><div class="t14 sec">Відкрийте в Safari → Поділитися → «На екран Додому»</div></div><div class="card s8"><div class="t16">Android</div><div class="t14 sec">Відкрийте в Chrome → меню ⋮ → «Додати на головний екран»</div></div></div>`});
addEventListener('beforeinstallprompt',e=>{e.preventDefault();window._installEvt=e});
SHEETS.password=()=>({title:'Змінити пароль',body:`<div class="stack"><div class="field"><label>Новий пароль</label><input class="inp" id="np1" type="password" autocomplete="new-password" placeholder="Щонайменше 8 символів"></div><div class="field"><label>Ще раз</label><input class="inp" id="np2" type="password" autocomplete="new-password"></div></div>`,foot:`<button class="btn p" onclick="changePw(this)">Зберегти пароль</button>`});
async function changePw(btn){const a=$('#np1').value,b=$('#np2').value;if(a.length<8)return toast('Щонайменше 8 символів','info');if(a!==b)return toast('Паролі не збігаються','info');
 await busy(btn,async()=>{const {error}=await sb.auth.updateUser({password:a});if(error)throw error;if(location.hash==='#recovery')history.replaceState(null,'',location.pathname);closeAll();toast('Пароль змінено')})}
async function exportData(btn){await busy(btn,async()=>{const uid=st.me.id;const t=['profiles','workout_logs','wellness','weights','food_entries','daily_counters','change_requests','plan_weeks','awards'];const out={exported_at:new Date().toISOString()};
 for(const n of t){const r=await sb.from(n).select('*').eq(n==='profiles'?'id':'athlete_id',uid);out[n]=r.data||[]}
 downloadText('triton_moi_dani.json',JSON.stringify(out,null,2),'application/json');toast('Дані збережено у файл')})}

/* ---------- NOTIFICATIONS ---------- */
const N_IC={request:'inbox',wellness:'alert',skip:'info',award:'trophy',comment:'msg',dm:'msg',announce:'mega',join:'users',redflag:'alert'};
SHEETS.notifs=()=>{const list=st.notifs;const unread=list.filter(n=>!n.read).map(n=>n.id);if(unread.length)setTimeout(async()=>{await sb.from('notifications').update({read:true}).in('id',unread);list.forEach(n=>n.read=true);render()},1200);
 return {title:'Сповіщення',body:list.length?`<div class="list">${list.map(n=>`<div class="li" style="align-items:flex-start"><span class="ico ${n.read?'':'a'}">${ic(N_IC[n.kind]||'bell',20)}</span><div class="grow"><div class="t14 w6">${esc(n.title)}</div>${n.body?`<div class="t12 sec">${esc(n.body)}</div>`:''}</div><span class="t12 ter">${ago(n.created_at)}</span></div>`).join('')}</div>`:emptyBox('Нових сповіщень немає')}};

/* ---------- AI ASSISTANT (Edge Function, Gemini) ---------- */
const AI_SUG=['Що їсти перед тренуванням?','Як відновлюватись після інтервалів?','Скільки пити в довгому заїзді?'];
st.aiOff=false;
SHEETS.ai=()=>({title:'Асистент',full:true,body:`<div class="s8" style="display:flex;flex-direction:column;padding-top:4px">
 ${st.aiOff?`<div class="note">${ic('info',20)}<span><b style="color:var(--tx)">АІ ще не підключено.</b> Тренер додасть ключ, і асистент запрацює. Тривожні симптоми все одно передаються тренеру.</span></div>`:''}
 <div class="msg ai">Привіт! Я відповідаю лише на питання про тренування, харчування, відновлення і здоровʼя. Я не лікар: при тривожних симптомах зверніться до лікаря.</div>
 ${st.ai.map(m=>`<div class="msg ${m.me?'me':'ai'}" style="white-space:pre-line">${esc(m.t)}</div>`).join('')}${st._aiWait?'<div class="msg ai">…</div>':''}</div>
 ${st.ai.length<2?`<div class="chips" style="margin-top:16px">${AI_SUG.map(s=>`<button class="chip" onclick="askAI('${s}')">${s}</button>`).join('')}</div>`:''}`,
 foot:`<div class="composer" style="flex:1"><input class="inp" id="aiin" maxlength="1500" placeholder="Питання про спорт чи здоровʼя" onkeydown="if(event.key==='Enter')askAI()"><button class="sendb" onclick="askAI()" aria-label="Надіслати">${ic('send',20)}</button></div>`});
async function askAI(q){q=(q||($('#aiin')||{}).value||'').trim();if(!q||st._aiWait)return;st.ai.push({me:true,t:q});st._aiWait=true;renderSheet();scrollSheet();
 try{const {data,error}=await sb.functions.invoke('ai-assistant',{body:{messages:st.ai.map(m=>({role:m.me?'user':'model',text:m.t}))}});if(error)throw error;
  if(data.configured===false&&!data.redflag){st.aiOff=true;st.ai.push({me:false,t:'АІ ще не підключено'})}else st.ai.push({me:false,t:data.text||'Не вдалося отримати відповідь'});if(data.configured===false)st.aiOff=true}
 catch(e){console.error(e);st.ai.push({me:false,t:'Асистент зараз недоступний. Спробуйте пізніше.'})}
 st._aiWait=false;renderSheet();scrollSheet()}
function scrollSheet(){const b=$('.sh-body');if(b)b.scrollTop=b.scrollHeight}

/* ---------- LOCAL REMINDERS (while app is open) ---------- */
setInterval(()=>{try{if(!st.me||isCoach()||!('Notification' in window)||Notification.permission!=='granted')return;const now=new Date();const hm=nfFmtClock(now.getHours()*60+now.getMinutes());const key='rem_'+iso(now);
 if(me().remindOn.morning&&hm===me().remind&&!localStorage.getItem(key)&&!st.well[iso(now)]){localStorage.setItem(key,'1');new Notification('TRITON',{body:'Як самопочуття? Відмітьте зранку, і план підлаштується.',icon:'icons/icon-192.png'})}}catch(e){}},30000);

/* ---------- ERRORS ---------- */
window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)));window.addEventListener('unhandledrejection',e=>window.__errs.push(String(e.reason&&e.reason.message||e.reason)));
