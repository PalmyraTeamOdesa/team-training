/* ---------- PEOPLE (admin): list, person sheet, roles, rewards, pause, expel; DM + coach highlights for everyone ---------- */
Object.assign(st,{pq:'',pf:'all',allProfiles:[],_pr:null,_rw:null,myPts:[],_rwLoaded:false});

/* --- helpers: ranking admin → coaches → participants, badges --- */
function isAdminId(id){return st.members.some(m=>m.id===id&&m.is_coach)||(st.coach&&st.me&&id===st.me.id)}
function personRank(id){return isAdminId(id)?0:coachSecs(id).length?1:2}
function sortPeople(ids){return [...ids].sort((a,b)=>personRank(a)-personRank(b)||cleanName(nameOf(a)).localeCompare(cleanName(nameOf(b)),'uk'))}
function isPausedId(id){const m=st.members.find(x=>x.id===id);return !!(m&&m.paused)}
function roleBadge(id){const r=personRank(id);const row=profRow(id)||{};
 if(row.status==='pending')return '<span class="rb pz">'+(row.onboarded?'очікує':'анкета не заповнена')+'</span>';
 return r===0?'<span class="rb adm">адмін</span>'+(coachSecs(id).length?'<span class="rb crd">тренер</span>':''):r===1?'<span class="rb crd">тренер</span>':'<span class="rb mem">учасник</span>'}
function secPills(id,only){const c=coachSecs(id),m=memberSecs(id);return SEC_ORDER.filter(s=>(c.includes(s)||m.includes(s))&&(!only||only.includes(s))).map(s=>{const i=secInfo(s);return `<span class="spill" style="--sc:${i.color}">${ic(i.icon,12)} ${esc(i.name)}${c.includes(s)?' · тренер':''}</span>`}).join('')}
function openDm(id){if(!id||id===st.me.id)return;openSheet('dm',id)}
async function refreshPeople(){await Promise.all([loadMembers(),loadSections(),isAdmin()?loadCoach():null]);st.secRate={};st.clubRate=null;st.boards={};render()}
function profRow(id){return st.allProfiles.find(r=>r.id===id)}

/* coaches shown to everyone (athlete side): highlighted, with a DM button */
function coachIdsFor(sec){const ids=new Set();if(sec)secCoachIds(sec).forEach(i=>ids.add(i));else{st.members.filter(m=>m.is_coach).forEach(m=>ids.add(m.id));st.secCoaches.forEach(c=>ids.add(c.user_id))}if(sec){st.members.filter(m=>m.is_coach).forEach(m=>ids.add(m.id))}return sortPeople([...ids].filter(i=>i!==st.me.id))}
function coachesCard(sec,title){const ids=coachIdsFor(sec);if(!ids.length)return '';
 return `<div class="s8"><div class="over">${title||'Тренери'}</div><div class="list">${ids.map(id=>`<div class="li crow"><span class="av sm me">${avIn(id)}</span><div class="grow" style="min-width:0"><div class="row" style="gap:6px;flex-wrap:wrap"><b class="t14 w6">${esc(cleanName(nameOf(id)))}</b>${roleBadge(id)}</div><div class="pchips">${secPills(id,sec?[sec]:null)||''}</div></div><button class="ib" onclick="openDm('${id}')" aria-label="Написати">${ic('msg',20)}</button></div>`).join('')}</div></div>`}

/* --- People tab (admin) --- */
function peopleBaseIds(){return st.allProfiles.filter(r=>r.status==='active'||r.status==='blocked'||r.status==='pending').map(r=>r.id)}
function peopleIds(){const q=(st.pq||'').trim().toLowerCase(),f=st.pf;
 const ids=peopleBaseIds().filter(id=>{const r=profRow(id),out=r.status==='blocked';
  if(f==='out')return out;if(out)return false;
  if(f==='coach')return personRank(id)<=1&&(coachSecs(id).length||isAdminId(id));
  if(SEC_ORDER.includes(f))return coachSecs(id).includes(f)||memberSecs(id).includes(f);
  if(f==='pause')return !!r.paused;
  return true}).filter(id=>!q||cleanName(nameOf(id)).toLowerCase().split(/\s+/).some(w=>w.startsWith(q))||cleanName(nameOf(id)).toLowerCase().includes(q));
 return sortPeople(ids)}
function personRow(id){const r=profRow(id)||{},rank=personRank(id),out=r.status==='blocked',nm=cleanName(nameOf(id));
 return `<div class="li prow ${rank<2&&!out?'crow':''} ${out?'dim':''}"><button class="pmain" onclick="openSheet('person','${id}')"><span class="av sm ${rank<2&&!out?'me':''}">${avIn(id)}</span><span class="grow" style="min-width:0"><span class="row" style="gap:6px;flex-wrap:wrap"><b class="t14 w6">${esc(nm)}${id===st.me.id?' · ви':''}</b>${roleBadge(id)}${r.paused?'<span class="rb pz">пауза</span>':''}${out?'<span class="rb out">виключено</span>':''}</span><span class="pchips">${secPills(id)||'<span class="t12 ter">без секції</span>'}</span></span></button>${id!==st.me.id?`<button class="ib" onclick="openDm('${id}')" aria-label="Написати">${ic('msg',20)}</button>`:''}</div>`}
function peopleListHtml(){const ids=peopleIds();return ids.length?`<div class="list">${ids.map(personRow).join('')}</div>`:emptyBox('Нікого не знайдено',st.pq?'Спробуйте інше імʼя':'У цьому фільтрі порожньо')}
function peopleView(){
 const act=st.allProfiles.filter(r=>r.status==='active'),pend=st.allProfiles.filter(r=>r.status==='pending');
 const coaches=act.filter(r=>isAdminId(r.id)||coachSecs(r.id).length).length;const paused=act.filter(r=>r.paused).length,out=st.allProfiles.filter(r=>r.status==='blocked').length;
 const F=[['all','Усі'],['coach','Тренери'],...SEC_ORDER.map(s=>[s,secInfo(s).name]),['pause','Пауза · '+paused]].concat(out?[['out','Виключені · '+out]]:[]);
 return `<div class="stack">${pend.length?`<button class="note" style="text-align:left;width:100%;border:0;color:inherit" onclick="go('req')">${ic('inbox',20)}<span>Нові заявки: <b style="color:var(--tx)">${pend.length}</b>${pend.some(r=>!r.onboarded)?' · є без анкети':''} · відкрити</span></button>`:''}
 <div class="grid3"><div class="tile"><div class="v">${act.length}</div><div class="l">людей</div></div><div class="tile"><div class="v">${coaches}</div><div class="l">тренерів</div></div><div class="tile"><div class="v ${paused?'c-warn':''}">${paused}</div><div class="l">на паузі</div></div></div>
 <input class="inp" id="pq" type="search" placeholder="Пошук за імʼям" autocomplete="off" value="${esc(st.pq)}" oninput="peopleSearch(this.value)">
 ${chipRow(F,st.pf,'peopleFilter',true)}
 <div id="plist">${peopleListHtml()}</div>
 <button class="btn p" onclick="openInvite()">${ic('link',20)} Запросити за посиланням</button>
 <button class="btn s" onclick="openNewPerson()">${ic('plus',18)} Нова людина</button>
 <div class="list">${li({left:`<span class="ico">${ic('chart',20)}</span>`,t:'Огляд команди і звіт',s:'Статус, виконання плану, тижневий звіт',on:"openSheet('teamOverview')"})}</div></div>`}
function peopleSearch(v){st.pq=v;const el=$('#plist');if(el)el.innerHTML=peopleListHtml()}
function peopleFilter(v){st.pf=v;render()}
SHEETS.teamOverview=()=>({title:'Огляд команди',full:true,body:cTeamView()});

/* --- person sheet --- */
SHEETS.person=id=>{const r=profRow(id);if(!r)return {title:'',body:''};const self=id===st.me.id,a=st.athletes.find(x=>x.id===id),out=r.status==='blocked';
 const cs=coachSecs(id),ms=memberSecs(id);
 let b=`<div class="stack"><div class="row12">${isCoach()||self?`<button class="avbtn" onclick="openSheet('avMenu','${id}')" aria-label="Фото"><span class="av lg ${personRank(id)<2?'me':''}">${avIn(id)}</span><span class="avcam">${ic('edit',14)}</span></button>`:`<span class="av lg ${personRank(id)<2?'me':''}">${avIn(id)}</span>`}<div class="grow" style="min-width:0"><div class="t20">${esc(cleanName(nameOf(id)))}${self?' · ви':''}</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${roleBadge(id)}${r.paused?'<span class="rb pz">пауза</span>':''}${out?'<span class="rb out">виключено</span>':''}</div><div class="t12 sec" style="margin-top:4px">${r.age?r.age+' р. · ':''}${esc(r.group_name||'')}${a&&!self?' · '+lastSeen(a):''}</div></div></div>
 <div class="pchips">${secPills(id)||'<span class="t12 ter">Без секцій</span>'}</div>`;
 if(r.paused)b+=`<div class="note warn">${ic('clock',20)}<span>На паузі${r.paused_note?': '+esc(r.paused_note):''}. Прихований з дощок і рейтингів.</span></div><button class="btn s" onclick="personPause(this,'${id}',false)">${ic('refresh',20)} Зняти паузу</button>`;
 if(r.status==='pending'){b+=`<div class="note">${ic('clock',20)}<span>${r.onboarded?'Анкету заповнено, очікує підтвердження.':'Анкету ще не заповнено. Можна підтвердити зараз або зачекати, поки людина закінчить реєстрацію.'}</span></div>`;return {title:'Людина',full:true,body:b+'</div>',foot:`<button class="btn s" onclick="openSheet('athlete','${id}')">Відкрити заявку</button><button class="btn p" onclick="approve(this,'${id}')">Прийняти в команду</button>`}}
 if(out)return {title:'Людина',full:true,body:b+`<div class="note warn">${ic('alert',20)}<span>Виключено з команди. Вхід закрито, секційні ролі прибрано. Історія тренувань, відміток, балів і нагород збережена.</span></div><button class="btn p" onclick="personRestore(this,'${id}')">${ic('unlock',20)} Повернути в команду</button></div>`};
 b+=`<div class="row" style="gap:8px">${self?`<button class="btn s sm grow" onclick="closeAll();toSelf(null)">${ic('bike',18)} Мій кабінет</button>`:`<button class="btn p sm grow" onclick="openDm('${id}')">${ic('msg',18)} Написати</button><button class="btn s sm grow" onclick="openSheet('athlete','${id}')">${ic('chart',18)} Навантаження</button>`}</div>
 <div class="list">${li({left:`<span class="ico a">${ic('target',20)}</span>`,t:'Секції',s:secSummary(id),on:`openPersonSecs('${id}')`})}${r.onboarded&&(self||isAdmin()||a)?li({left:`<span class="ico a">${ic('gauge',20)}</span>`,t:'Зони',s:zonesSub(toP(r)),on:`zonesOpen('${id}')`}):''}
 ${self?'':li({left:`<span class="ico a">${ic('trophy',20)}</span>`,t:'Нагородити',s:'Бали, 🔥 похвала, досягнення, приз',on:`openReward('${id}')`})}
 ${self?'':li({left:`<span class="ico">${ic('user',20)}</span>`,t:'Навантаження і профіль',s:'План, тренування, анкета, нотатки',on:`openSheet('athlete','${id}')`})}
 ${self?'':li({left:`<span class="ico">${ic('lock',20)}</span>`,t:'Скинути пароль',s:'Створити тимчасовий пароль',on:`resetPw(this,'${id}')`})}
 ${r.paused?'':li({left:`<span class="ico">${ic('clock',20)}</span>`,t:'Пауза',s:'Тимчасово сховати з дощок і рейтингів',on:`openPause('${id}')`})}
 ${self?'':li({left:`<span class="ico" style="color:var(--bad)">${ic('logout',20)}</span>`,t:'<span style="color:var(--bad)">Виключити з команди</span>',s:'Прибрати з секцій і закрити доступ, історія лишається',on:`openSheet('personExpel','${id}')`})}</div></div>`;
 return {title:'Людина',full:true,body:b}};

/* --- roles & sections (one save) --- */

function secSummary(id){const bits=SEC_ORDER.map(s=>{const c=coachSecs(id).includes(s),m=memberSecs(id).includes(s);if(!c&&!m)return '';return secInfo(s).name+(c&&m?' · тренер і спортсмен':c?' · тренер':'')}).filter(Boolean);return bits.join(', ')||'Не записаний у жодну секцію'}
function openPersonSecs(id){st._pr={id,coach:new Set(coachSecs(id)),member:new Set(memberSecs(id))};openSheet('personRoles',id)}
function openRoles(id){st._pr={id,coach:new Set(coachSecs(id)),member:new Set(memberSecs(id))};openSheet('personRoles',id)}
function prNone(s){prSync();st._pr.coach.delete(s);st._pr.member.delete(s);renderSheet()}
function prGrid(){const pr=st._pr;const admin=typeof isCoach==='function'&&isCoach();
 return `<div class="list">${SEC_ORDER.map(s=>{const i=secInfo(s),none=!pr.coach.has(s)&&!pr.member.has(s);
  return `<div class="li prrow">${secDot(s)}<div class="grow t14 w6">${esc(i.name)}</div><div class="practs"><button class="chip ${none?'on':''}" onclick="prNone('${s}')">Немає</button><button class="chip ${pr.member.has(s)?'on':''}" onclick="prTog('member','${s}')">Спортсмен</button>${admin?`<button class="chip ${pr.coach.has(s)?'on':''}" onclick="prTog('coach','${s}')">Тренер</button>`:''}</div></div>`}).join('')}</div>
 ${admin?`<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn s sm grow" onclick="prAll('coach')">${SEC_ORDER.every(s=>st._pr.coach.has(s))?'Прибрати тренера скрізь':'Тренер в усіх'}</button><button class="btn s sm grow" onclick="prAll('member')">${SEC_ORDER.every(s=>st._pr.member.has(s))?'Прибрати зі всіх':'Спортсмен в усіх'}</button></div>`:''}`}
function prSync(){const a=$('#npn'),b=$('#npe');if(a)st._pr.name=a.value;if(b)st._pr.email=b.value}
function prTog(k,s){prSync();const set=st._pr[k];set.has(s)?set.delete(s):set.add(s);renderSheet()}
function prAll(k){prSync();const set=st._pr[k],all=SEC_ORDER.every(s=>set.has(s));SEC_ORDER.forEach(s=>all?set.delete(s):set.add(s));renderSheet()}
SHEETS.personRoles=id=>{const pr=st._pr;if(!pr||pr.id!==id)return {title:'',body:''};const cur={c:coachSecs(id),m:memberSecs(id)};
 const diff=[];SEC_ORDER.forEach(s=>{const n=secInfo(s).name;if(pr.coach.has(s)&&!cur.c.includes(s))diff.push('+ тренер: '+n);if(!pr.coach.has(s)&&cur.c.includes(s))diff.push('− тренер: '+n);if(pr.member.has(s)&&!cur.m.includes(s))diff.push('+ спортсмен: '+n);if(!pr.member.has(s)&&cur.m.includes(s))diff.push('− спортсмен: '+n)});
 return {title:'Секції · '+esc(shortName(id)),body:`<div class="stack"><div class="t14 sec">Запишіть людину в секції як спортсмена. Тренером може призначити лише адміністратор — тренер пише дошку, нагороджує і бачить своїх спортсменів, але не додає людей.</div>${prGrid()}
  ${diff.length?`<div class="note">${ic('info',20)}<span>${diff.map(esc).join('<br>')}</span></div>`:`<div class="t12 ter">Змін поки немає</div>`}</div>`,
  foot:`<button class="btn p" onclick="prSave(this)">Зберегти</button>`}};
async function prSave(btn){const pr=st._pr;await busy(btn,async()=>{D(await sb.rpc('admin_set_roles',{uid:pr.id,coach_sections:[...pr.coach],member_sections:[...pr.member]}));await refreshPeople();closeSheet();toast('Ролі збережено')})}

/* --- new person (account with roles) --- */

/* --- invite by link (the original share-the-app-URL flow, restored in Люди) --- */
function openInvite(){st._inv=st._inv||{coach:new Set(),member:new Set()};st._pr=st._inv;openSheet('invite')}
function inviteBase(){return (location.origin+location.pathname).replace(/index\.html$/,'')}
function inviteUrl(){const inv=st._inv||st._pr||{member:new Set(),coach:new Set()};const m=[...inv.member],c=[...inv.coach];let h='#i';if(m.length||c.length){h='#i='+m.join(',');if(c.length)h+='&c='+c.join(',')}return inviteBase()+h}
function inviteText(){return 'Запрошую до команди TRITON (Одеса). Зареєструйтесь за посиланням — тренер підтвердить участь. На iPhone відкрийте в Safari.'}
SHEETS.invite=()=>{st._pr=st._inv||(st._inv={coach:new Set(),member:new Set()});const url=inviteUrl();const canShare=typeof navigator.share==='function';
 return {title:'Запросити за посиланням',body:`<div class="stack"><div class="t14 sec">Надішліть посилання в Telegram. Людина реєструється, заповнює анкету і зʼявляється у «Нові заявки». Підтвердження — лише вами, не автоматично. На iPhone посилання потрібно відкрити в Safari.</div>
  <div class="invurl" id="invurl">${esc(url)}</div>
  <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn p grow" onclick="inviteCopy()">${ic('copy',18)} Копіювати</button><button class="btn s grow" onclick="inviteTelegram()">${ic('msg',18)} Надіслати в Telegram</button></div>
  ${canShare?`<button class="btn s" onclick="inviteShare()">${ic('link',18)} Поділитися</button>`:''}
  <div class="over">Секції після підтвердження (необовʼязково)</div>
  <div class="t12 ter">За замовчуванням — спортсмен. Якщо нічого не обрати, секції призначите під час підтвердження заявки.</div>
  ${prGrid()}</div>`}}
function inviteCopy(){const url=inviteUrl(),done=()=>toast('Посилання скопійовано','link');if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(done).catch(()=>instCopyFallback(url,done));else instCopyFallback(url,done)}
function inviteTelegram(){const url=inviteUrl();location.href='https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(inviteText())}
async function inviteShare(){const url=inviteUrl();try{if(navigator.share)await navigator.share({title:'TRITON Team',text:inviteText(),url})}catch(e){if(e&&e.name!=='AbortError')inviteCopy()}}

function openNewPerson(){st._pr={id:null,coach:new Set(),member:new Set(),name:'',email:''};openSheet('newPerson')}
SHEETS.newPerson=()=>{const pr=st._pr;return {title:'Нова людина',body:`<div class="stack"><div class="t14 sec">Акаунт одразу підтверджений. Тимчасовий пароль покажемо один раз.</div><input class="inp" id="npn" maxlength="80" placeholder="Імʼя та прізвище" value="${esc(pr.name||'')}"><input class="inp" id="npe" type="email" maxlength="120" placeholder="Email" value="${esc(pr.email||'')}">${prGrid()}<div id="npres"></div></div>`,foot:`<button class="btn p" onclick="newPersonSave(this)">Створити</button>`}};
async function newPersonSave(btn){prSync();const pr=st._pr;const full_name=(pr.name||'').trim(),email=(pr.email||'').trim();if(!full_name||!email)return toast('Вкажіть імʼя та email','info');
 await busy(btn,async()=>{const {data,error}=await sb.functions.invoke('account',{body:{action:'admin_create_user',email,full_name,coach_sections:[...pr.coach],member_sections:[...pr.member]}});
  if(error){let m='Не вдалося створити';try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}
  await refreshPeople();const el=$('#npres');if(el)el.innerHTML=`<div class="note">${ic('check',20)}<span>Готово. Тимчасовий пароль: <b class="mono" style="color:var(--tx);user-select:all">${esc(data.password)}</b><br>Людина змінить його в Профіль → Змінити пароль.</span></div>`;btn.style.display='none'})}

/* --- rewards: points, 🔥 praise, achievement, prize --- */
const RW_EMO=['🏆','🥇','🏅','⭐','🔥','💪','🚴','🏊','🏃','🎯','🎁','👕'];
const RW_CHEER=['🔥 Молодець','💪 Так тримати','👏 Браво','🚀 Прогрес','🤝 Командний гравець'];
function rwSecs(id){const m=memberSecs(id);return isCoach()?m:m.filter(s=>coachSecs().includes(s))}
function openReward(id,sec){const opts=rwSecs(id);const def=sec&&(opts.includes(sec)||sec==='club')?sec:(opts[0]||(isCoach()?'club':null));st._rw={id,kind:'points',sec:def,n:5,cheer:RW_CHEER[0],pick:-1,emoji:'',title:'',comment:''};openSheet('personReward',id)}
function rwSync(){const r=st._rw;if(!r)return;const c=$('#rwc'),t=$('#rwt');if(c)r.comment=c.value;if(t)r.title=t.value}
function rwKind(k){rwSync();st._rw.kind=k;renderSheet()}
function rwSec(s){rwSync();st._rw.sec=s;renderSheet()}
function rwEmoji(e){rwSync();st._rw.emoji=st._rw.emoji===e?'':e;renderSheet()}
function rwCheer(i){rwSync();st._rw.cheer=RW_CHEER[i];renderSheet()}
function rwPick(i){rwSync();st._rw.pick=st._rw.pick===i?-1:i;renderSheet()}
SHEETS.personReward=id=>{const r=st._rw;if(!r||r.id!==id)return {title:'',body:''};const opts=rwSecs(id).concat(isCoach()?['club']:[]);
 if(!opts.length)return {title:'Нагородити',body:`<div class="note warn">${ic('info',20)}<span>Ця людина не у ваших секціях. Нагороджувати можна лише спортсменів своєї секції.</span></div>`};
 const secs=`<div class="chips scroll">${opts.map(s=>s==='club'?`<button class="chip ${r.sec==='club'?'on':''}" onclick="rwSec('club')">${ic('users',16)} Клуб (загальні)</button>`:secChip(s,r.sec===s,'rwSec')).join('')}</div>`;
 const emo=`<div class="over">Значок</div><div class="chips scroll">${RW_EMO.map(e=>`<button class="chip ${r.emoji===e?'on':''}" style="font-size:20px;min-width:44px" onclick="rwEmoji('${e}')">${e}</button>`).join('')}</div>`;
 let k='';
 if(r.kind==='points')k=`${nf({id:'rwn',label:'Скільки балів',val:r.n,min:1,max:100,step:1,unit:'балів',plus:true,set:v=>st._rw.n=v})}<div class="chips">${[1,3,5,10,20,50].map(n=>`<button class="chip" onclick="st._rw.n=${n};nfSyncView('rwn',${n},false)">+${n}</button>`).join('')}</div>`;
 else if(r.kind==='cheer')k=`<div class="chips">${RW_CHEER.map((c,i)=>`<button class="chip ${r.cheer===c?'on':''}" onclick="rwCheer(${i})">${c}</button>`).join('')}</div>`;
 else if(r.kind==='ach')k=`<div class="list">${SEC_ACH.map((x,i)=>`<button class="li" style="${r.pick===i?'background:var(--acc-soft)':''}" onclick="rwPick(${i})"><span class="ico sm">${ic(x[2],18)}</span><div class="grow"><div class="t14 w6">${x[0]}</div><div class="t12 sec">${x[1]}</div></div>${r.pick===i?`<span class="c-ok">${ic('check',18)}</span>`:''}</button>`).join('')}</div>
  <input class="inp" id="rwt" maxlength="60" placeholder="Або своя назва досягнення" value="${esc(r.title)}" oninput="st._rw.pick=-1">${emo}`;
 else k=`<input class="inp" id="rwt" maxlength="60" placeholder="Приз: що саме (напр. футболка клубу)" value="${esc(r.title)}">${emo}`;
 return {title:'Нагородити · '+esc(shortName(id)),full:true,body:`<div class="stack">${seg([['points','+ Бали'],['cheer','🔥 Похвала'],['ach','🏆 Досягн.'],['prize','🎁 Приз']],r.kind,'rwKind')}
  <div class="over">Де зарахувати</div>${secs}${k}<input class="inp" id="rwc" maxlength="140" placeholder="Коментар (побачить людина в сповіщенні)" value="${esc(r.comment)}"></div>`,
  foot:`<button class="btn p" onclick="rwSend(this)">${ic('send',20)} Надіслати</button>`}};
async function rwSend(btn){rwSync();const r=st._rw,sec=r.sec==='club'?null:r.sec,c=(r.comment||'').trim();
 if(!r.sec)return toast('Оберіть секцію','info');
 let table,row;
 if(r.kind==='points'){table='board_points';row={section_id:sec,athlete_id:r.id,points:Math.round(r.n||0),reaction:c}}
 else if(r.kind==='cheer'){table='board_points';row={section_id:sec,athlete_id:r.id,points:0,reaction:(r.cheer+(c?' · '+c:'')).slice(0,200)}}
 else{const x=r.kind==='ach'&&r.pick>=0?SEC_ACH[r.pick]:null;const name=x?x[0]:(r.title||'').trim();if(!name)return toast('Вкажіть назву','info');
  table='awards';row={athlete_id:r.id,section_id:sec,kind:r.kind==='prize'?'prize':'achievement',name,description:((x?x[1]:'')+(c?(x?' · ':'')+c:'')).slice(0,300),icon:r.emoji||(x?x[2]:(r.kind==='prize'?'🎁':'star'))}}
 await busy(btn,async()=>{const d=D(await sb.from(table).insert(row).select().single());if(table==='awards'&&isAdmin())(st.allAwards=st.allAwards||[]).push(d);st.secRate={};st.clubRate=null;st.boards={};closeSheet();toast({points:'+'+row.points+' балів',cheer:'Похвалу надіслано',ach:'Досягнення вручено',prize:'Приз вручено'}[r.kind]+' · '+shortName(r.id),'trophy')})}

/* --- pause --- */
function openPause(id){st._pz={id,note:''};openSheet('personPause',id)}
SHEETS.personPause=id=>({title:'Пауза · '+esc(shortName(id)),body:`<div class="stack"><div class="t14 sec">Людину тимчасово сховаємо з дощок і рейтингів, нові рядки їй не пишуться, відмітки вимкнено. Історія й доступ до власного плану лишаються. Паузу можна зняти будь-коли.</div>
 <div class="chips">${['Травма','Хвороба','Відпустка','Робота'].map(x=>`<button class="chip" onclick="$('#pzn').value='${x}'">${x}</button>`).join('')}</div><input class="inp" id="pzn" maxlength="120" placeholder="Причина або до якої дати (необовʼязково)"></div>`,foot:`<button class="btn p" onclick="personPause(this,'${id}',true)">${ic('clock',20)} Поставити на паузу</button>`});
async function personPause(btn,id,on){const note=on&&$('#pzn')?$('#pzn').value.trim():'';await busy(btn,async()=>{D(await sb.rpc('admin_set_paused',{uid:id,p:on,note}));await refreshPeople();if(on)closeSheet();toast(on?'На паузі':'Паузу знято')})}

/* --- expel / restore --- */
SHEETS.personExpel=id=>({title:'Виключити з команди',body:`<div class="stack"><div class="note warn">${ic('alert',20)}<span><b style="color:var(--tx)">${esc(cleanName(nameOf(id)))}</b> буде виключено.</span></div>
 <div class="list"><div class="li"><span class="ico">${ic('x',18)}</span><div class="grow t14">Прибрати з усіх секцій${memberSecs(id).concat(coachSecs(id)).length?' ('+[...new Set(memberSecs(id).concat(coachSecs(id)))].map(s=>secInfo(s).name).join(', ')+')':''}, зняти ролі тренера</div></div>
 <div class="li"><span class="ico">${ic('lock',18)}</span><div class="grow t14">Закрити вхід і доступ до команди, чатів, рейтингів, АІ</div></div>
 <div class="li"><span class="ico">${ic('check',18)}</span><div class="grow t14">Історію тренувань, відміток, балів і нагород зберегти</div></div>
 <div class="li"><span class="ico">${ic('refresh',18)}</span><div class="grow t14">Пізніше можна повернути кнопкою «Повернути в команду»</div></div></div></div>`,
 foot:`<button class="btn d" onclick="personExpel(this,'${id}')">${ic('logout',20)} Так, виключити</button>`});
async function personExpel(btn,id){await busy(btn,async()=>{await accountAct('admin_expel',id);await refreshPeople();closeAll();toast('Виключено. Історію збережено')})}
async function personRestore(btn,id){await busy(btn,async()=>{await accountAct('admin_restore',id);await refreshPeople();toast('Повернуто в команду');renderSheet()})}
async function accountAct(action,id){const {data,error}=await sb.functions.invoke('account',{body:{action,user_id:id}});if(error){let m='Не вдалося';try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}if(!data||!data.ok)throw new Error('Не вдалося')}

/* --- athlete side: rewards & points in the profile --- */
async function loadRewards(){try{const uid=st.me.id;const [p,a]=await Promise.all([sb.from('board_points').select('*').eq('athlete_id',uid).order('created_at',{ascending:false}).limit(100),sb.from('awards').select('*').eq('athlete_id',uid).order('created_at',{ascending:false})]);st.myPts=D(p)||[];st.awards=D(a)||[];st._rwLoaded=true;renderSheet()}catch(e){fail(e)}}
function openRewards(){st._rwLoaded=false;openSheet('myrewards')}
function rewardsSummary(){const t=st.myPts.reduce((a,p)=>a+p.points,0);return 'Бали: '+t+' · нагород: '+(st.awards||[]).length}
SHEETS.myrewards=()=>{if(!st._rwLoaded){loadRewards();return {title:'Нагороди й бали',body:`<div class="empty"><span class="spin"></span></div>`}}
 const ms=iso(new Date(NOW.getFullYear(),NOW.getMonth(),1)),pts=st.myPts;const total=pts.reduce((a,p)=>a+p.points,0),month=pts.filter(p=>iso(new Date(p.created_at))>=ms).reduce((a,p)=>a+p.points,0);
 const items=pts.map(p=>({t:p.created_at,ic:p.points?'star':'flame',title:(p.points?'+'+p.points+' балів':'')+(p.points&&p.reaction?' · ':'')+(p.reaction||''),sub:p.section_id?secInfo(p.section_id).name:'Клуб',by:p.coach_id})).concat((st.awards||[]).map(a=>({t:a.created_at,ic:a.icon||'star',title:a.name,sub:(a.kind==='prize'?'Приз':'Досягнення')+(a.description?' · '+a.description:''),by:a.given_by,prize:a.kind==='prize'}))).sort((x,y)=>x.t<y.t?1:-1);
 return {title:'Нагороди й бали',full:true,body:`<div class="stack"><div class="grid3"><div class="tile"><div class="v">${total}</div><div class="l">балів усього</div></div><div class="tile"><div class="v">${month}</div><div class="l">за місяць</div></div><div class="tile"><div class="v">${(st.awards||[]).length}</div><div class="l">нагород</div></div></div>
 <div class="t12 ter">Бали від тренерів рахуються в рейтингу секції та в загальному рейтингу клубу.</div>
 ${items.length?`<div class="list">${items.map(x=>`<div class="li" style="align-items:flex-start"><span class="ico ${x.prize?'a':''}">${ic(x.ic,20)}</span><div class="grow" style="min-width:0"><div class="t14 w6">${esc(x.title)}</div><div class="t12 sec">${esc(x.sub)}${x.by?' · '+esc(shortName(x.by)):''}</div></div><span class="t12 ter">${ago(x.t)}</span></div>`).join('')}</div>`:emptyBox('Поки немає','Тренери можуть нагородити вас балами, досягненнями чи призом')}</div>`}};

/* --- header switch admin ⇄ my athlete cabinet --- */
function cabinetSwitch(){if(isCoach())toSelf(null);else toCoach()}
