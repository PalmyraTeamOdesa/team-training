/* ---------- STATE ---------- */
const st={screen:'boot',tab:'today',ctab:'team',wk:0,user:null,me:null,coach:false,
 plans:{},logs:[],well:{},weights:[],food:[],cnt:{water:0,coffee:0,alc:0},members:[],posts:[],rides:[],challenges:[],chat:[],dms:[],
 notifs:[],requests:[],awards:[],unlock:null,coachNote:{},athletes:[],allLogs:[],allWell:[],allPlans:{},
 wellStep:0,wellAns:[],feedF:'all',teamSeg:'feed',chatSeg:'team',rateAge:'adult',rateBy:'all',nutSeg:'today',progSeg:'week',achCat:'all',
 libSport:'bike',libCat:'all',ai:[],ctFilter:'all',ctAge:'adult',cardSeg:'plan',ob:null,parsed:null,busy:false};

const isCoach=()=>st.coach&&!st.coachSelf;
const me=()=>st.me;
const isKid=()=>!!st.me&&st.me.age<18;
function cleanName(n){return String(n||'').replace(/\[[^\]]*\]\s*/g,'').trim()}
function initials(n){return cleanName(n).split(/\s+/).map(x=>(x.match(/\p{L}/u)||[''])[0]).join('').slice(0,2).toUpperCase()||'?'}
function iso(d){const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4);return z.toISOString().slice(0,10)}
function wkIso(wk){return iso(dayDate(wk,0))}
function dayIso(wk,i){return iso(dayDate(wk,i))}
function parseIso(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function dayDiff(s){return Math.round((parseIso(s)-WEEK0)/864e5)}
function wkOfIso(s){return Math.floor(dayDiff(s)/7)}
function idxOfIso(s){return (parseIso(s).getDay()+6)%7}
function ago(ts){const d=(Date.now()-new Date(ts).getTime())/6e4;if(d<1)return 'щойно';if(d<60)return Math.round(d)+' хв тому';if(d<1440)return Math.round(d/60)+' год тому';const x=new Date(ts);const days=Math.round(d/1440);if(days<7)return days===1?'вчора':days+' дн. тому';return fmtDate(x)}
function hhmm(ts){const d=new Date(ts);return (d.getHours()<10?'0':'')+d.getHours()+':'+(d.getMinutes()<10?'0':'')+d.getMinutes()}

/* ---------- RENDER ---------- */
let sheetStack=[];
function render(){
 const app=$('#app');const m=app.querySelector('main');const sc=m?m.scrollTop:0;const key=st.screen+st.tab+st.ctab;
 if(st.screen==='boot')app.innerHTML=`<div class="boot">${logoHtml()}</div>`;
 else if(st.screen==='auth')app.innerHTML=authView();
 else if(st.screen==='onb')app.innerHTML=onbView();
 else if(st.screen==='wait')app.innerHTML=waitView();
 else app.innerHTML=headerView()+(typeof instBannerHtml==="function"?instBannerHtml():"")+'<main id="main">'+(isCoach()?coachView():athleteView())+'</main>'+tabsView();
 const m2=app.querySelector('main');if(m2&&render._k===key)m2.scrollTop=sc;render._k=key;
 renderSheet();
}
function logoHtml(){return window.__LOGO?'<img class="logo logoimg" src="icons/logo-256.png" alt="TRITON" width="88" height="88">':'<div class="logo">T</div>'}
function go(tab){const cur=isCoach()?st.ctab:st.tab,same=cur===tab;if(isCoach())st.ctab=tab;else st.tab=tab;const m=$('main');if(m)m.scrollTop=0;render._k='';render();onTab(tab);if(typeof navWrite==='function')navWrite(same)}
function headerView(){
 const p=me();const titles={today:'Сьогодні',plan:'План',team:'Команда',sec:'Секції',food:'Харчування',prog:'Прогрес'};
 const ctitles={team:'Люди',sec:'Секції',req:'Запити',lib:'Бібліотека',events:'Події',chat:'Чати'};
 const t=isCoach()?ctitles[st.ctab]:titles[st.tab];
 const unread=st.notifs.some(n=>!n.read);
 return `<header class="top"><button class="av btn-av" onclick="openSheet('profile')" aria-label="Профіль"><span class="av ${isCoach()?'me':''}">${esc(p.ini)}</span></button>
 <div class="ttl"><h1>${t}</h1>${isCoach()?'<span class="demo">адмін</span>':st.coach?'<span class="demo">кабінет спортсмена</span>':coachSecs().length?'<span class="demo">тренер секції</span>':p.status==='pending'?'<span class="demo">очікує підтвердження</span>':''}</div>
 ${st.coach?`<button class="ib" onclick="cabinetSwitch()" aria-label="${isCoach()?'Мій кабінет спортсмена':'Режим адміністратора'}" title="${isCoach()?'Мій кабінет спортсмена':'Режим адміністратора'}">${ic(isCoach()?'bike':'users',22)}</button>`:''}
 <button class="ib" onclick="openSheet('ai')" aria-label="Асистент">${ic('spark',22)}</button>
 <button class="ib" onclick="openSheet('notifs')" aria-label="Сповіщення">${ic('bell',22)}${unread?'<i class="dot"></i>':''}</button></header>`}
function tabsView(){
 const a=isCoach()?[['team','users','Люди'],['sec','target','Секції'],['req','inbox','Запити'],['events','flag','Події'],['chat','msg','Чати']]
  :[['today','today','Сьогодні'],['plan','cal','План'],['sec','target','Секції'],['food','food','Харчування'],['prog','chart','Прогрес']];
 const cur=isCoach()?st.ctab:st.tab;
 const pend=st.requests.filter(r=>r.status==='pending').length+(isCoach()?st.athletes.filter(a=>a.status==='pending').length:0);
 return `<nav class="tabs">${a.map(x=>`<button class="${cur===x[0]?'on':''}" onclick="go('${x[0]}')">${ic(x[1],24)}<span>${x[2]}</span>${isCoach()&&x[0]==='req'&&pend?`<b class="cnt">${pend}</b>`:''}</button>`).join('')}</nav>`}
function athleteView(){return ({today:todayView,plan:planView,team:secView,sec:secView,food:foodView,prog:progView})[st.tab]()}
function coachView(){return ({team:peopleView,sec:secView,req:cReqView,lib:cLibView,events:cEventsView,chat:cChatView})[st.ctab]()}

/* ---------- SHEETS ---------- */
const SHEETS={};
function openSheet(name,arg){sheetStack.push({name,arg});_sheetDepth++;renderSheet(true);if(typeof navWrite==='function')navWrite(false)}
function closeSheet(){if(_navPop){sheetStack.pop();_sheetDepth=Math.max(0,_sheetDepth-1);renderSheet();return}if(sheetStack.length&&history.state&&history.state.triton){history.back();return}sheetStack.pop();_sheetDepth=Math.max(0,_sheetDepth-1);renderSheet()}
function closeAll(){sheetStack=[];_sheetDepth=0;renderSheet();if(!_navPop&&typeof navWrite==='function')navWrite(true)}
function replaceSheet(name,arg){if(!sheetStack.length)sheetStack.push({name,arg});else sheetStack[sheetStack.length-1]={name,arg};renderSheet(true);if(typeof navWrite==='function')navWrite(true)}
function renderSheet(fresh){
 const scrim=$('#scrim');if(!scrim)return;if(!sheetStack.length){scrim.classList.remove('open');setTimeout(()=>{if(!sheetStack.length)scrim.innerHTML=''},200);return}
 const top=sheetStack[sheetStack.length-1];let s;try{s=SHEETS[top.name](top.arg)}catch(e){console.error(e);s={title:'Помилка',body:`<div class="empty">Не вдалося відкрити</div>`}}
 const old=scrim.querySelector('.sh-body');const sc=(!fresh&&old)?old.scrollTop:0;
 const back=sheetStack.length>1;
 scrim.innerHTML=`<div class="sheet ${s.full?'full':''}" onclick="event.stopPropagation()"><div class="grab"></div>
  <div class="sh-head ${back?'back':''}">${back?`<button class="ib" onclick="closeSheet()" aria-label="Назад">${ic('back',22)}</button>`:''}<h2 class="ell">${s.title}</h2>${s.headR||''}<button class="ib" onclick="closeAll()" aria-label="Закрити">${ic('x',22)}</button></div>
  <div class="sh-body">${s.body}</div>${s.foot?`<div class="sh-foot">${s.foot}</div>`:''}</div>`;
 scrim.classList.add('open');const nb=scrim.querySelector('.sh-body');if(nb)nb.scrollTop=sc;
}
function toast(t,icon){const el=$('#toast');el.innerHTML=ic(icon||'check',20)+'<span>'+esc(t)+'</span>';el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2800)}
function fail(e,t){console.error(e);toast(t||('Помилка: '+((e&&e.message)||e)),'alert')}
async function busy(btn,fn){if(btn&&btn.disabled)return;if(btn){btn.disabled=true;btn._t=btn.innerHTML;btn.innerHTML='<span class="spin"></span>'}try{return await fn()}catch(e){fail(e)}finally{if(btn&&document.body.contains(btn)){btn.disabled=false;btn.innerHTML=btn._t}}}


/* ---------- HISTORY / ANDROID BACK ---------- */
let _navPop=false,_exitAt=0,_sheetDepth=0;
function navArg(a){if(a==null||['string','number','boolean'].includes(typeof a))return a;try{return JSON.parse(JSON.stringify(a))}catch(e){return null}}
function navSnap(){return {triton:1,screen:st.screen,tab:isCoach()?st.ctab:st.tab,coachSelf:!!st.coachSelf,obStep:st.ob&&st.ob.step||0,sheets:sheetStack.map(s=>({name:s.name,arg:navArg(s.arg)}))}}
function navUrl(){const h=location.hash||'';return location.pathname+location.search+(h&&/^#(i|recovery)\b/.test(h)?h:'')}
function navWrite(replace){if(_navPop)return;try{history[replace?'replaceState':'pushState'](navSnap(),'',navUrl())}catch(e){}}
function navBoot(force){const cur=history.state;if(!force&&cur&&cur.triton&&!cur.sentinel)return;try{history.replaceState(Object.assign(navSnap(),{sentinel:true}),'',navUrl());history.pushState(navSnap(),'',navUrl())}catch(e){}}
function applyNav(s){if(s.screen==='auth'&&st.user){navWrite(true);return}
 if(st.coach&&typeof s.coachSelf==='boolean')st.coachSelf=s.coachSelf;
 const ct=['team','sec','req','lib','events','chat'],at=['today','plan','sec','food','prog','team'];
 if(s.tab){if(isCoach()){if(ct.includes(s.tab))st.ctab=s.tab}else if(at.includes(s.tab))st.tab=s.tab}
 if(st.screen==='onb'&&st.ob&&s.obStep)st.ob.step=s.obStep;
 sheetStack=(s.sheets||[]).map(x=>({name:x.name,arg:x.arg}));_sheetDepth=sheetStack.length;render._k='';render()}
function onNavPop(ev){const s=ev.state;
 if(s&&s.triton&&s.sentinel){const now=Date.now();if(now-_exitAt<2000){_exitAt=0;history.back();return}_exitAt=now;toast('Натисніть ще раз, щоб вийти','info');try{history.pushState(navSnap(),'',navUrl())}catch(e){}return}
 if(!s||!s.triton){const now=Date.now();if(now-_exitAt<2000){_exitAt=0;history.back();return}_exitAt=now;toast('Натисніть ще раз, щоб вийти','info');try{history.pushState(navSnap(),'',navUrl())}catch(e){}return}
 _navPop=true;try{applyNav(s)}finally{_navPop=false}}
addEventListener('popstate',onNavPop);
/* ---------- SMALL COMPONENTS ---------- */
function sportIco(s,cls){return `<span class="ico ${cls||''}">${ic((SPORT[s]||SPORT.bike).i,20)}</span>`}
function tag(t,c){return `<span class="tag ${c||''}">${t}</span>`}
function chipRow(items,cur,fn,scroll){return `<div class="chips ${scroll?'scroll':''}">${items.map(x=>`<button class="chip ${cur===x[0]?'on':''}" onclick="${fn}('${x[0]}')">${x[1]}</button>`).join('')}</div>`}
function seg(items,cur,fn){return `<div class="seg">${items.map(x=>`<button class="${cur===x[0]?'on':''}" onclick="${fn}('${x[0]}')">${x[1]}</button>`).join('')}</div>`}
function li(o){return `<button class="li ${o.cls||''}" onclick="${o.on||''}">${o.left||''}<div class="grow"><div class="t16 ell">${o.t}</div>${o.s?`<div class="t12 sec ell">${o.s}</div>`:''}</div>${o.right!=null?o.right:`<span class="chev">${ic('chev',20)}</span>`}</button>`}
function bar(p,col){return `<div class="bar"><i style="width:${Math.max(0,Math.min(100,p||0))}%;${col?'background:'+col:''}"></i></div>`}
function memberById(id){return st.members.find(m=>m.id===id)||st.athletes.find(a=>a.id===id)}
function nameOf(id){if(st.me&&id===st.me.id)return st.me.name;const m=memberById(id);return m?(m.full_name||m.name||'Без імені'):'Учасник'}
function avOf(id,cls){const m=memberById(id);const n=st.me&&id===st.me.id?st.me.name:m?(m.full_name||m.name):'?';return `<span class="av ${cls||'sm'} ${m&&m.is_coach?'me':''}">${esc(initials(n))}</span>`}
function emptyBox(t,s){return `<div class="empty"><div class="t16" style="color:var(--tx)">${t}</div>${s?`<div class="t14">${s}</div>`:''}</div>`}
