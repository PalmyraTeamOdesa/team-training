/* ---------- PROFILE ---------- */
SHEETS.profile=()=>{const p=me();const coach=isCoach();
 const sw=st.coach?(coach?li({left:`<span class="ico a">${ic('bike',20)}</span>`,t:'Мій кабінет спортсмена',s:'Ваш власний план і щоденник',on:'toSelf(this)'}):li({left:`<span class="ico a">${ic('users',20)}</span>`,t:'Повернутися в режим тренера',s:'Команда, запити, бібліотека',on:'toCoach()'})):'';
 const rows=coach?[['users','Люди клубу','Список, ролі, нагороди, пауза','people',"closeAll();go('team')"],['trophy','Нагороди й бали',rewardsSummary(),'myrewards','openRewards()'],['user','Мої дані',esc(p.name),'pdata'],['bell','Нагадування','Сповіщення в застосунку','premind'],['lock','Змінити пароль','','password']]:[
  ['trophy','Нагороди й бали',rewardsSummary(),'myrewards','openRewards()'],
  ['user','Мої дані',`${p.age} р. · ${p.height} см · ${String(p.weight).replace('.',',')} кг`,'pdata'],
  ['target','Цілі',p.goals.map(g=>GOALS[g]).join(', ')||'—','pgoals'],
  ['gauge','Зони',p.form.ftp?'Розраховано з FTP '+p.form.ftp+' Вт':'Після тесту FTP','zones'],
  ['gym','Інвентар',p.equip.length+' позицій','pequip'],
  ['clock','Мій час і можливості','Дні, години, вид активності','schedule'],
  ['bell','Нагадування','Тренування о '+p.remind,'premind'],
  ['link','Strava, Garmin і файли','Strava і Garmin незабаром · файли вже працюють','pconn'],
  ['eyeoff','Приватність',p.hide?'Цифри приховані':'Цифри видно команді','priv'],
  ['download','Експорт даних','JSON з усіма вашими даними','pexport'],
  ['lock','Змінити пароль','','password']];
 const inst=instMenuRow();if(inst)rows.push(inst);
 return {title:'Профіль',full:true,body:`<div class="stack"><div class="row12"><button class="avbtn" onclick="openSheet('avMenu','${st.me.id}')" aria-label="Змінити фото"><span class="av lg ${st.coach?'me':''}">${avIn(st.me.id,p.ini)}</span><span class="avcam">${ic('edit',14)}</span></button><div class="grow"><div class="t20">${esc(p.name)}</div><div class="t14 sec">${st.coach?'Головний тренер · TRITON':esc(p.group)+(p.city?' · '+esc(p.city):'')}</div><div class="t12 ter">${esc(st.user.email||'')}</div></div></div>
 ${sw?`<div class="list">${sw}</div>`:''}
 <div class="list">${rows.map(r=>li({left:`<span class="ico">${ic(r[0],20)}</span>`,t:r[1],s:r[2],on:r[4]||(r[3]==='pexport'?'exportData(this)':r[3]==='inst'?'instInstall(this)':`openSheet('${r[3]}')`)})).join('')}</div>
 <button class="btn d" onclick="logout()">${ic('logout',20)} Вийти</button><div class="t12 ter center">TRITON Team · версія ${APP_VERSION}</div></div>`}};
async function toSelf(btn){await busy(btn,async()=>{sheetStack=[];_sheetDepth=0;st.coachSelf=true;await loadMine();await loadTeam();st.tab='today';render._k='';
 if(!st.me.days.some(d=>d.acts.length)){if(memberSecs().length){st.tab='sec';render();if(typeof navWrite==='function')navWrite(false);toast('Це ваш кабінет спортсмена. Анкету й план можна заповнити пізніше','info');return}toast('Заповніть свою анкету, щоб отримати план','info');startOnb();return}
 render();if(typeof navWrite==='function')navWrite(false)})}
function toCoach(){sheetStack=[];_sheetDepth=0;st.coachSelf=false;render._k='';render();if(typeof navWrite==='function')navWrite(false)}
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
/* ---------- INSTALL TO HOME SCREEN ---------- */
const INST_KEY='triton_inst_hide',INST_DAYS=7;
function instStandalone(){return !!(window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone)}
function instIsIpad(){const ua=navigator.userAgent||'';return /iPad/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
function instInfo(){
 const ua=navigator.userAgent||'';
 const iOS=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const iPad=iOS&&instIsIpad();
 const android=/Android/i.test(ua);
 const inApp=/FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|TikTok|Snapchat|Telegram|; wv\)|WebView/i.test(ua)||(android&&/Version\/[\d.]+/.test(ua)&&/Chrome\//.test(ua)&&/\bwv\b/.test(ua));
 const iosSafari=iOS&&/Safari/i.test(ua)&&/Version\//i.test(ua)&&!/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|EdgA/i.test(ua)&&!/Instagram|FBAN|FBAV|Line\/|Telegram|Twitter/i.test(ua);
 return {iOS,iPad,android,inApp,iosSafari,standalone:instStandalone(),canPrompt:!!window._installEvt};
}
function instMarkDevice(){try{const i=instInfo();document.documentElement.classList.toggle('is-ios',!!i.iOS);document.documentElement.classList.toggle('is-ipad',!!i.iPad)}catch(e){}}
instMarkDevice();
function instDismissed(){const t=parseInt(localStorage.getItem(INST_KEY)||'0',10);return t&&(Date.now()-t)<INST_DAYS*864e5}
function instShouldBanner(){if(instStandalone()||instDismissed()||st._instSkip||st.screen!=='app')return false;const i=instInfo();return i.canPrompt||i.iOS||i.inApp||i.android}
function instDismiss(){localStorage.setItem(INST_KEY,String(Date.now()));const b=$('#instbar');if(b)b.remove()}
function instMountBanner(){if(!instShouldBanner()){const b=$('#instbar');if(b)b.remove();return}const html=instBannerHtml();const cur=$('#instbar');if(cur){cur.outerHTML=html;return}const h=$('header.top');if(h)h.insertAdjacentHTML('afterend',html)}
function instBannerHtml(){
 if(!instShouldBanner())return '';
 const i=instInfo();let title,sub,action,label;
 if(i.canPrompt){title='Встановити на екран';sub='Швидкий доступ, як застосунок';action='instInstall(this)';label='Встановити'}
 else if(i.iOS&&!i.iosSafari){title='Відкрийте в Safari';sub='Тут не вийде додати на екран Додому';action='instOpenSafari()';label='Відкрити в Safari'}
 else if(i.iOS){title='На екран Додому';sub='Safari → Поділитися → На екран Додому';action="openSheet('phome')";label='Показати як'}
 else if(i.inApp){title='Відкрийте в Chrome';sub='Тут встановити не вийде';action="openSheet('phome')";label='Як встановити'}
 else {title='Встановити на екран';sub='Працює як застосунок';action="openSheet('phome')";label='Як встановити'}
 return `<div class="instbar" id="instbar" role="region" aria-label="Встановити на екран"><span class="instico">${ic('phone',20)}</span><div class="grow"><div class="t14 w6 ell">${title}</div><div class="t12 sec ell">${sub}</div></div><button class="btn sm p instcta" onclick="${action}">${label}</button><button class="ib instx" onclick="instDismiss()" aria-label="Закрити">${ic('x',18)}</button></div>`;
}
function instMenuRow(){if(instStandalone())return null;const i=instInfo();const sub=i.canPrompt?'Працює як застосунок, без браузера':i.iOS&&!i.iosSafari?'Відкрити в Safari':i.iOS?'Поділитися → На екран Додому':i.inApp?'Відкрийте сторінку в Chrome':'Працює як застосунок';return ['phone','Встановити на екран',sub,i.canPrompt?'inst':'phome']}
async function instInstall(btn){
 const ev=window._installEvt;
 if(!ev||typeof ev.prompt!=='function'){openSheet('phome');return}
 let done=false;
 const fallback=()=>{if(done)return;done=true;window._installEvt=null;instMountBanner();openSheet('phome')};
 try{
  const shown=Promise.resolve(ev.prompt());
  const raced=await Promise.race([shown.then(()=>'ok'),new Promise(r=>setTimeout(()=>r('timeout'),2000))]);
  if(raced!=='ok'){fallback();return}
  const res=await ev.userChoice;
  done=true;window._installEvt=null;
  if(res&&res.outcome==='accepted')instOnInstalled();
  else{st._instSkip=true;instMountBanner();if(sheetStack.some(x=>x.name==='profile'||x.name==='phome'))renderSheet()}
 }catch(e){fallback()}
}
function instOnInstalled(){window._installEvt=null;st._instSkip=true;const b=$('#instbar');if(b)b.remove();toast('Застосунок встановлено');if(sheetStack.some(s=>s.name==='phome'||s.name==='profile'))closeAll()}
function instPageUrl(){return location.href}
function instCopyLink(){const url=instPageUrl();const done=()=>toast('Посилання скопійовано','link');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done).catch(()=>instCopyFallback(url,done));else instCopyFallback(url,done)}
function instCopyFallback(url,done){const t=document.createElement('textarea');t.value=url;t.setAttribute('readonly','');t.style.position='fixed';t.style.left='-9999px';document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){toast(url,'link')}t.remove()}
function instCopySafari(){const url=instPageUrl();const done=()=>toast('Посилання скопійовано. Відкрийте Safari і вставте його в адресний рядок.','link');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done).catch(()=>instCopyFallback(url,done));else instCopyFallback(url,done)}
function instOpenSafari(){
 const href=instPageUrl();
 if(!/^https?:\/\//i.test(href)){instCopySafari();return}
 const scheme=href.replace(/^https:\/\//i,'x-safari-https://').replace(/^http:\/\//i,'x-safari-http://');
 let left=false;
 const to=setTimeout(()=>{if(!left&&!document.hidden)instCopySafari()},900);
 const onVis=()=>{if(document.hidden){left=true;clearTimeout(to);document.removeEventListener('visibilitychange',onVis)}};
 document.addEventListener('visibilitychange',onVis);
 try{if(typeof window.__setHref==='function')window.__setHref(scheme);else location.href=scheme}catch(e){clearTimeout(to);document.removeEventListener('visibilitychange',onVis);instCopySafari()}
}
function instOpenChrome(){const u=new URL(location.href.split('#')[0]);location.href=`intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`}
function instIllShare(){return `<div class="inst-ill share" aria-hidden="true"><div class="ill-btn">${ic('iosshare',36)}</div><div class="ill-lbl">Поділитися</div></div>`}
function instIllHome(){return `<div class="inst-ill home" aria-hidden="true"><div class="ill-row">${ic('homeplus',28)}<span>На екран Додому</span></div></div>`}
function instIllAdd(){return `<div class="inst-ill add" aria-hidden="true"><div class="ill-add">Додати</div></div>`}
function instStepsIos(){const pad=instIsIpad();
 return `<div class="inst-visual" aria-label="Як додати на екран Додому">
  <div class="inst-vis">${instIllShare()}<div class="inst-vis-cap"><span class="inst-num">1</span><div><div class="t16 w6">Поділитися</div><div class="t14 sec">${pad?'Кнопка вгорі справа в Safari':'Кнопка внизу по центру в Safari'}</div></div></div></div>
  <div class="inst-vis-arr" aria-hidden="true">→</div>
  <div class="inst-vis">${instIllHome()}<div class="inst-vis-cap"><span class="inst-num">2</span><div><div class="t16 w6">На екран Додому</div><div class="t14 sec">Прокрутіть список, якщо пункту не видно</div></div></div></div>
  <div class="inst-vis-arr" aria-hidden="true">→</div>
  <div class="inst-vis">${instIllAdd()}<div class="inst-vis-cap"><span class="inst-num">3</span><div><div class="t16 w6">Додати</div><div class="t14 sec">Підтвердіть у правому верхньому куті</div></div></div></div>
 </div>`}
function instShareArrowHtml(){const pad=instIsIpad();
 return `<div id="sharehint" class="sharehint ${pad?'ipad':'iphone'}" aria-hidden="true">
  <div class="sharehint-label">Тут · Поділитися</div>
  <svg class="sharehint-arrow" viewBox="0 0 64 80" width="56" height="70" fill="none"><path d="M32 8v52" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><path d="M12 42 32 68 52 42" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>
 </div>`}
function instUnmountShareArrow(){const e=$('#sharehint');if(e)e.remove()}
function instSyncShareArrow(){
 instUnmountShareArrow();
 const top=sheetStack[sheetStack.length-1];
 const i=typeof instInfo==='function'?instInfo():{};
 if(!top||top.name!=='phome'||!i.iOS||!i.iosSafari||i.standalone)return;
 const host=$('.phone')||document.body;
 host.insertAdjacentHTML('beforeend',instShareArrowHtml());
 instMarkDevice();
}
function instStepsAndroid(){return `<div class="inst-steps" id="inst-android-steps">
 <div class="inst-step"><span class="inst-num">1</span><div class="grow"><div class="t16">Відкрийте меню Chrome ⋮</div><div class="t14 sec">Три крапки вгорі справа</div></div></div>
 <div class="inst-step"><span class="inst-num">2</span><div class="grow"><div class="t16">Оберіть «Додати на головний екран» або «Встановити додаток»</div><div class="t14 sec">Назва пункту залежить від версії Chrome</div></div></div>
</div>
 <div class="card s8"><div class="t16">Якщо пункт не з’являється або нічого не відбувається</div><div class="t14 sec">Видаліть старий ярлик TRITON з екрана Додому і спробуйте знову. Іноді Chrome вважає застосунок уже встановленим.</div></div>`}

function maybeOfferInstall(){if(instStandalone()||!st.me)return;const k='triton_inst_offer_'+(st.me.id||'');try{if(localStorage.getItem(k))return;localStorage.setItem(k,'1')}catch(e){}openSheet('phome')}
function instContinueBrowser(){st._instSkip=true;try{localStorage.setItem(INST_KEY,String(Date.now()))}catch(e){}const b=$('#instbar');if(b)b.remove();closeSheet()}
SHEETS.phome=()=>{
 if(instStandalone())return {title:'На екрані Додому',body:`<div class="stack"><div class="card s8 center" style="padding:24px 16px">${ic('check',28)}<div class="t16" style="margin-top:8px">Уже встановлено</div><div class="t14 sec">Ви відкрили TRITON як застосунок.</div></div></div>`};
 const i=instInfo();const logo=window.__LOGO?`<img class="logoimg" src="icons/logo-256.png" alt="" width="64" height="64" style="width:64px;height:64px">`:`<div class="logo" style="width:64px;height:64px;font-size:28px">T</div>`;
 let body=`<div class="stack"><div class="center s8">${logo}<div class="t16">TRITON Team на екрані Додому</div></div>`;
 if(i.canPrompt)body+=`<button class="btn p" id="inst-prompt-btn" onclick="instInstall(this)">${ic('phone',20)} Встановити на екран</button><div class="t14 sec">Після встановлення застосунок відкриватиметься без рядка браузера. Якщо вікно Chrome не з’явилось — зробіть це вручну:</div>${instStepsAndroid()}`;
 else if(i.iOS&&!i.iosSafari)body+=`<div class="card s8"><div class="t16">Відкрийте в Safari</div><div class="t14 sec">Telegram, Instagram, Chrome та інші програми на iPhone не вміють додавати на екран Додому. Відкрийте це посилання в Safari — там два кроки: Поділитися → На екран Додому.</div></div>
  <button class="btn p" onclick="instOpenSafari()">${ic('link',20)} Відкрити в Safari</button>
  <button class="btn s" onclick="instCopySafari()">${ic('copy',20)} Скопіювати посилання</button>
  <div class="t12 ter">Якщо кнопка не відкрила Safari — скопіюйте посилання, відкрийте Safari і вставте його в адресний рядок.</div>`;
 else if(i.iOS)body+=`<div class="t16 w6">Додайте на екран Додому за два кроки</div><div class="t14 sec">Стрілка вказує на кнопку «Поділитися» в Safari.${i.iPad?' На iPad вона вгорі справа.':' На iPhone вона внизу по центру.'}</div>${instStepsIos()}`;
 else if(i.inApp)body+=`<div class="card s8"><div class="t16">${/Telegram/i.test(navigator.userAgent||'')?'Відкрийте посилання в Chrome, не в Telegram':'Відкрийте сторінку в Chrome'}</div><div class="t14 sec">У Telegram, Instagram та подібних програмах встановити застосунок не вийде. Відкрийте це посилання в Chrome — там з’явиться пропозиція встановити, або меню ⋮ → «Додати на головний екран».</div></div>
  <button class="btn p" onclick="instCopyLink()">${ic('copy',20)} Скопіювати посилання</button>
  <button class="btn s" onclick="instOpenChrome()">${ic('link',20)} Відкрити в Chrome</button>`;
 else body+=`<div class="t14 sec">У Chrome має з’явитись пропозиція встановити. Якщо її немає, зробіть це вручну:</div>${instStepsAndroid()}
  <div class="card s8"><div class="t16">iPhone і iPad</div><div class="t14 sec">Відкрийте в Safari, далі Поділитися → «На екран Додому».</div></div>
  <button class="btn s" onclick="instCopyLink()">${ic('copy',20)} Скопіювати посилання</button>`;
 body+='</div>';
 return {title:'Встановити на екран',body,foot:`<button class="btn t grow" onclick="instContinueBrowser()">Продовжити в браузері</button>`};
};
window._onBeforeInstall=function(e){window._installEvt=e;instMountBanner();if(sheetStack.some(s=>s.name==='profile'||s.name==='phome'))renderSheet()};
window._onAppInstalled=function(){instOnInstalled()};
addEventListener('beforeinstallprompt',e=>{window._installEvt=e;instMountBanner()});
addEventListener('appinstalled',()=>instOnInstalled());
try{const mq=window.matchMedia('(display-mode: standalone)');if(mq.addEventListener)mq.addEventListener('change',ev=>{if(ev.matches)instOnInstalled()})}catch(e){}

SHEETS.password=()=>({title:'Змінити пароль',body:`<div class="stack"><div class="field"><label>Новий пароль</label><input class="inp" id="np1" type="password" autocomplete="new-password" placeholder="Щонайменше 8 символів"></div><div class="field"><label>Ще раз</label><input class="inp" id="np2" type="password" autocomplete="new-password"></div></div>`,foot:`<button class="btn p" onclick="changePw(this)">Зберегти пароль</button>`});
async function changePw(btn){const a=$('#np1').value,b=$('#np2').value;if(a.length<8)return toast('Щонайменше 8 символів','info');if(a!==b)return toast('Паролі не збігаються','info');
 await busy(btn,async()=>{const {error}=await sb.auth.updateUser({password:a});if(error)throw error;if(location.hash==='#recovery')history.replaceState(null,'',location.pathname);closeAll();toast('Пароль змінено')})}
async function exportData(btn){await busy(btn,async()=>{const uid=st.me.id;const t=['profiles','workout_logs','wellness','weights','food_entries','daily_counters','change_requests','plan_weeks','awards'];const out={exported_at:new Date().toISOString()};
 for(const n of t){const r=await sb.from(n).select('*').eq(n==='profiles'?'id':'athlete_id',uid);out[n]=r.data||[]}
 downloadText('triton_moi_dani.json',JSON.stringify(out,null,2),'application/json');toast('Дані збережено у файл')})}

/* ---------- NOTIFICATIONS ---------- */
const N_IC={request:'inbox',wellness:'alert',skip:'info',award:'trophy',comment:'msg',dm:'msg',announce:'mega',join:'users',redflag:'alert',board:'list',board_mark:'check',points:'star',pause:'clock'};
SHEETS.notifs=()=>{const list=st.notifs;const unread=list.filter(n=>!n.read).map(n=>n.id);if(unread.length)setTimeout(async()=>{await sb.from('notifications').update({read:true}).in('id',unread);list.forEach(n=>n.read=true);render()},1200);
 return {title:'Сповіщення',body:list.length?`<div class="list">${list.map(n=>`<button class="li" style="align-items:flex-start;width:100%;text-align:left;background:none;color:inherit" onclick="notifGo(${n.id})"><span class="ico ${n.read?'':'a'}">${ic(N_IC[n.kind]||'bell',20)}</span><div class="grow"><div class="t14 w6">${esc(n.title)}</div>${n.body?`<div class="t12 sec">${esc(n.body)}</div>`:''}</div><span class="t12 ter">${ago(n.created_at)}</span></button>`).join('')}</div>`:emptyBox('Нових сповіщень немає')}};

/* ---------- AI ASSISTANT (Edge Function, xAI) ---------- */
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

if(typeof parseInviteHash==="function")parseInviteHash();

/* tap on a notification → go where it points */
function notifGo(id){const n=st.notifs.find(x=>x.id===id);if(!n)return;if(typeof notifLink==='function'&&notifLink(n))return;closeAll();const t=(n.title||'')+' '+(n.body||'');
 const secByName=()=>{const k=Object.keys(SEC_DEF).find(k=>t.includes(SEC_DEF[k].name));return k};
 const dmFrom=()=>{const m=/від\s+(.+)$/.exec(n.title||'');if(!m)return null;const nm=m[1].trim();const all=(st.members||[]).concat(st.athletes||[]);const x=all.find(a=>(a.full_name||a.name||'')===nm)||all.find(a=>nameOf(a.id)===nm);return x?x.id:null};
 const k=n.kind;
 if(isCoach()){
  if(k==='request'||k==='join'){go('req');return}
  if(k==='dm'||k==='comment'){const u=dmFrom();if(u){go('chat');setTimeout(()=>openSheet('dm',u),60);return}go('chat');return}
  if(k==='announce'){go('events');return}
  if(k==='board'||k==='board_mark'||k==='points'){const sc=secByName();if(sc)st.sec=sc;go('sec');return}
  go('team');return}
 if(k==='dm'){st.chatSeg='dm';go('chat');const u=dmFrom();if(u)setTimeout(()=>openSheet('dm',u),60);return}
 if(k==='announce'){if(/заїзд/i.test(t)){st.teamSeg='events';go('team');return}st.teamSeg='feed';go('team');return}
 if(k==='comment'||k==='join'){st.teamSeg='feed';go('team');return}
 if(k==='award'){go('prog');setTimeout(()=>openSheet('ach'),60);return}
 if(k==='points'||k==='board'||k==='board_mark'){const sc=secByName();if(sc)st.sec=sc;go('sec');return}
 if(k==='pause'||k==='request'){go('today');return}
 go('today')}
