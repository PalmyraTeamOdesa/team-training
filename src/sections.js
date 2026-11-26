/* ---------- SECTIONS: roles, daily board, marks, points, ratings ---------- */
const SEC_DEF={bike:{name:'Велоспорт',color:'#F2994A',icon:'bike'},swim:{name:'Плавання',color:'#2D9CDB',icon:'swim'},run:{name:'Біг',color:'#3DD68C',icon:'run'}};
const SEC_ORDER=['bike','swim','run'];
Object.assign(st,{secs:[],secCoaches:[],secMembers:[],capPrefs:{},sec:null,secSeg:'board',bDay:null,boards:{},myLines:[],secRate:{},rateMode:'week',clubRate:null,_be:null,_secAth:{}});
const SEC_ACH=[['Залізна дисципліна','Усі тренування тижня виконано','medal'],['Прогрес тижня','Помітне покращення результатів','zap'],['Командний гравець','Підтримка інших і участь у групових тренуваннях','users'],['Перша дистанція','Перша повна дистанція в секції','flag'],['Техніка вогонь','Помітний прогрес у техніці','star'],['Ранкова пташка','Тренування рано вранці без пропусків','flame']];

/* --- helpers --- */
function secInfo(id){const s=st.secs.find(x=>x.id===id);return Object.assign({id},SEC_DEF[id]||{},s||{})}
function isAdmin(){return !!st.coach}
function coachSecs(uid){uid=uid||st.me.id;return st.secCoaches.filter(c=>c.user_id===uid).map(c=>c.section_id)}
function memberSecs(uid){uid=uid||st.me.id;return st.secMembers.filter(m=>m.athlete_id===uid).map(m=>m.section_id)}
function canCoach(sec){return isAdmin()||coachSecs().includes(sec)}
function mySecs(){const s=isAdmin()?SEC_ORDER.slice():[...new Set([...coachSecs(),...memberSecs()])];return SEC_ORDER.filter(x=>s.includes(x))}
function secAthletes(sec){return st.secMembers.filter(m=>m.section_id===sec).map(m=>m.athlete_id)}
function secCoachIds(sec){return st.secCoaches.filter(c=>c.section_id===sec).map(c=>c.user_id)}
/* sports where this athlete is in a section that has a coach → auto-plan off for that sport */
function coachedSports(pid){return memberSecs(pid).filter(s=>secCoachIds(s).length).map(s=>secInfo(s).sport||s)}
function pEff(p){if(!p)return p;const cs=coachedSports(p.id);if(!cs.length)return p;const sp={};Object.keys(p.sports).forEach(k=>sp[k]=Object.assign({},p.sports[k],cs.includes(k)?{own:true}:{}));return Object.assign({},p,{sports:sp})}
function isoAdd(s,n){const d=parseIso(s);return iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()+n))}
function todayIso(){return dayIso(0,TODAY)}
function dayLabel(s){const t=todayIso();const d=parseIso(s);const base=DAYS_FULL[idxOfIso(s)]+', '+fmtDate(d);if(s===t)return 'Сьогодні · '+fmtDate(d);if(s===isoAdd(t,1))return 'Завтра · '+fmtDate(d);if(s===isoAdd(t,-1))return 'Вчора · '+fmtDate(d);return base}
function secChip(id,on,fn){const s=secInfo(id);return `<button class="chip secchip ${on?'on':''}" style="--sc:${s.color}" onclick="${fn}('${id}')">${ic(s.icon,16)} ${esc(s.name)}</button>`}
function secDot(id){const s=secInfo(id);return `<span class="secdot" style="--sc:${s.color}">${ic(s.icon,14)}</span>`}
function shortName(id){return cleanName(nameOf(id)).split(' ')[0]||'Учасник'}
const MARK={done:['✅','Виконав','ok'],skip:['❌','Пропускаю','bad'],alt:['🔁','Зробив інакше','warn']};

/* --- loading --- */
async function loadSections(){
 const [s,c,m,p]=await Promise.all([sb.from('sections').select('*').order('sort'),sb.from('section_coaches').select('*'),sb.from('section_members').select('*'),sb.from('coach_athlete_prefs').select('*')]);
 st.secs=D(s)||[];st.secCoaches=D(c)||[];st.secMembers=D(m)||[];st.capPrefs={};(D(p)||[]).forEach(x=>st.capPrefs[x.athlete_id]=x.show_full);
 if(!st.sec||(st.sec!=='club'&&!mySecs().includes(st.sec)))st.sec=mySecs()[0]||'club';
 await loadMyLines()}
async function loadMyLines(){if(!st.me||!memberSecs().length){st.myLines=[];return}
 const r=await sb.from('board_lines').select('*, board_posts!inner(id,section_id,day,plan,author_id,board_marks(*))').eq('athlete_id',st.me.id).gte('board_posts.day',isoAdd(todayIso(),-1)).lte('board_posts.day',isoAdd(todayIso(),7));
 st.myLines=(D(r)||[]).map(l=>({...l,post:l.board_posts}))}
async function loadBoard(sec,day,force){const k=sec+'|'+day;if(st.boards[k]&&!force)return st.boards[k];
 const r=await sb.from('board_posts').select('*, board_lines(*), board_marks(*), board_comments(*), board_points(*)').eq('section_id',sec).eq('day',day).maybeSingle();
 st.boards[k]=D(r)||{none:true,section_id:sec,day};return st.boards[k]}
function boardOf(sec,day){return st.boards[sec+'|'+day]}

/* --- main view (tab «Секції») --- */
function secView(){
 const list=mySecs();const coachMode=isCoach();
 if(!coachMode&&st.me.status!=='active')return teamView();
 if(!list.length&&!coachMode){st.sec='club';}
 const chips=list.map(id=>secChip(id,st.sec===id,'secPick')).join('')+(coachMode?'':`<button class="chip ${st.sec==='club'?'on':''}" onclick="secPick('club')">${ic('users',16)} Клуб</button>`);
 let h=`<div class="stack"><div class="chips scroll">${chips}</div>`;
 if(st.sec==='club'||!st.sec){if(!list.length&&!coachMode)h+=`<div class="note">${ic('info',20)}<span>Вас ще не додали до секції. Коли адміністратор додасть, тут зʼявиться дошка тренера.</span></div>`;return h+teamView()+'</div>'}
 const sec=st.sec,s=secInfo(sec),cc=canCoach(sec);
 const coaches=secCoachIds(sec);
 h+=`<div class="sechero" style="--sc:${s.color}"><span class="secico">${ic(s.icon,22)}</span><div class="grow"><div class="t16 w7">${esc(s.name)}</div><div class="t12 sec ell">${coaches.length?'Тренер: '+coaches.map(id=>esc(cleanName(nameOf(id)))).join(', '):'Тренера ще не призначено'} · ${secAthletes(sec).length} спортсм.</div></div>${cc?tag(isAdmin()?'адмін':'тренер','a'):''}</div>`;
 const segs=[['board','Дошка'],['rate','Рейтинг']];if(cc)segs.push(['people','Учасники']);
 h+=seg(segs,st.secSeg,'secSegSet');
 h+=({board:boardBody,rate:secRateBody,people:secPeopleBody})[st.secSeg]?.(sec)||'';
 return h+'</div>'}
function secPick(id){st.sec=id;if(id!=='club'&&st.secSeg==='people'&&!canCoach(id))st.secSeg='board';render()}
function secSegSet(v){st.secSeg=v;render()}

/* --- board view --- */
function boardBody(sec){
 const day=st.bDay||(st.bDay=todayIso());const b=boardOf(sec,day);
 if(!b){loadBoard(sec,day).then(render).catch(fail);return `<div class="empty"><span class="spin"></span></div>`}
 const cc=canCoach(sec),s=secInfo(sec),uid=st.me.id;
 let h=`<div class="between"><button class="ib" onclick="bdNav(-1)" aria-label="Попередній день">${ic('back',20)}</button><button class="t16 w6" style="background:none;border:0;color:var(--tx)" onclick="bdToday()">${dayLabel(day)}</button><button class="ib" onclick="bdNav(1)" aria-label="Наступний день" style="transform:scaleX(-1)">${ic('back',20)}</button></div>`;
 if(b.none){h+=emptyBox(cc?'План на цей день ще не написано':'Тренер ще не написав план на цей день',cc?'Напишіть загальний план і рядки для спортсменів':'Загляньте пізніше або перегляньте інший день');
  if(cc)h+=`<button class="btn p" onclick="bdEdit('${sec}','${day}')">${ic('edit',20)} Написати план</button>`;return h}
 const lines=b.board_lines||[];const marks=b.board_marks||[];const mine=lines.find(l=>l.athlete_id===uid);const myMark=marks.find(m=>m.athlete_id===uid);
 const member=secAthletes(sec).includes(uid);
 if(mine)h+=`<div class="myline" style="--sc:${s.color}"><div class="over" style="color:var(--sc)">Ваше завдання</div><div class="t18 w7" style="margin-top:4px;white-space:pre-line">${esc(mine.text)}</div></div>`;
 h+=`<div class="card s8 bplan" style="--sc:${s.color}"><div class="between"><div class="over">Загальний план</div><div class="t12 ter">${b.author_id?esc(cleanName(nameOf(b.author_id))):''}</div></div><div class="t16" style="white-space:pre-line">${esc(b.plan||'—')}</div>
  ${lines.length?`<div class="list" style="margin-top:4px">${lines.filter(l=>l.athlete_id!==uid).map(l=>{const mk=marks.find(m=>m.athlete_id===l.athlete_id);return `<div class="li" style="min-height:44px"><div class="grow t14"><b class="w6">${esc(shortName(l.athlete_id))}:</b> ${esc(l.text)}</div>${mk?`<span title="${MARK[mk.status][1]}">${MARK[mk.status][0]}</span>`:''}</div>`}).join('')}</div>`:''}</div>`;
 if(member){h+=myMark?`<div class="card flat s8"><div class="between"><div class="t14 w6">${MARK[myMark.status][0]} ${MARK[myMark.status][1]}</div><button class="btn t sm" onclick="bdMark('${sec}','${day}','${myMark.status}')">Змінити</button></div>${myMark.comment?`<div class="t14 sec">${esc(myMark.comment)}</div>`:''}${markNums(myMark)}</div>`
  :`<div class="row" style="gap:8px">${Object.entries(MARK).map(([k,v])=>`<button class="btn s sm grow" onclick="bdMark('${sec}','${day}','${k}')">${v[0]} ${v[1]}</button>`).join('')}</div>`;
  const myPts=(b.board_points||[]).filter(p=>p.athlete_id===uid);if(myPts.length)h+=`<div class="row" style="gap:6px;flex-wrap:wrap">${myPts.map(p=>tag((p.points?'+'+p.points+' балів ':'')+esc(p.reaction||''),'a')).join('')}</div>`}
 if(cc){h+=`<div class="row" style="gap:8px"><button class="btn s sm grow" onclick="bdEdit('${sec}','${day}')">${ic('edit',18)} Редагувати</button><button class="btn s sm grow" onclick="bdCopyTo('${sec}','${day}')">${ic('refresh',18)} На завтра</button></div>`;h+=bdSummary(sec,b)}
 h+=bdComments(sec,b);
 return h}
function markNums(m){const a=[];if(m.time_min)a.push(fmtMin(+m.time_min));if(m.dist_km)a.push(String(+m.dist_km).replace('.',',')+' км');if(m.hr)a.push('пульс '+m.hr);return a.length?`<div class="t12 ter">${a.join(' · ')}</div>`:''}
function bdNav(n){st.bDay=isoAdd(st.bDay||todayIso(),n);render()}
function bdToday(){st.bDay=todayIso();render()}

/* coach summary under the board */
function bdSummary(sec,b){const ids=[...new Set([...(b.board_lines||[]).map(l=>l.athlete_id),...secAthletes(sec)])];const marks=b.board_marks||[];const pts=b.board_points||[];
 const cnt=k=>marks.filter(m=>m.status===k).length;const none=ids.filter(id=>!marks.some(m=>m.athlete_id===id));
 let h=`<div class="s8"><div class="over">Підсумок · відмітились ${marks.length} з ${ids.length}</div>
  <div class="grid3"><div class="tile"><div class="v c-ok">${cnt('done')}</div><div class="l">✅ виконали</div></div><div class="tile"><div class="v c-warn">${cnt('alt')}</div><div class="l">🔁 інакше</div></div><div class="tile"><div class="v c-bad">${cnt('skip')}</div><div class="l">❌ пропуск</div></div></div>`;
 h+=`<div class="list">${ids.map(id=>{const m=marks.find(x=>x.athlete_id===id);const line=(b.board_lines||[]).find(l=>l.athlete_id===id);const pp=pts.filter(p=>p.athlete_id===id);const sum=pp.reduce((a,p)=>a+p.points,0);
  return `<div class="li" style="align-items:flex-start;padding-top:10px;padding-bottom:10px">${avOf(id)}<div class="grow" style="min-width:0"><div class="t14 w6 ell">${esc(cleanName(nameOf(id)))} ${m?MARK[m.status][0]:'<span class="t12 ter">не відмітився</span>'}</div>${line?`<div class="t12 sec ell">${esc(line.text)}</div>`:''}${m&&m.comment?`<div class="t12" style="margin-top:2px">«${esc(m.comment)}»</div>`:''}${m?markNums(m):''}${pp.length?`<div class="t12 acc" style="margin-top:2px">${sum?'+'+sum+' балів ':''}${esc(pp.map(p=>p.reaction).filter(Boolean).join(' '))}</div>`:''}</div>
   <div class="row" style="gap:4px"><button class="ib" onclick="bdReact(this,'${sec}',${b.id},'${id}')" aria-label="Молодець" title="🔥 Молодець">🔥</button><button class="ib" onclick="openSheet('bdPoints',{sec:'${sec}',post:${b.id},id:'${id}'})" aria-label="Бали">${ic('plus',18)}</button><button class="ib" onclick="openSheet('secAward',{sec:'${sec}',id:'${id}'})" aria-label="Нагорода">${ic('trophy',18)}</button></div></div>`}).join('')||'<div class="li"><div class="grow t14 ter">У секції ще немає спортсменів</div></div>'}</div>`;
 if(none.length&&ids.length)h+=`<div class="t12 ter">Не відмітились: ${none.map(id=>esc(shortName(id))).join(', ')}</div>`;
 return h+'</div>'}
async function bdReact(btn,sec,post,id){await busy(btn,async()=>{D(await sb.from('board_points').insert({section_id:sec,post_id:post,athlete_id:id,points:0,reaction:'🔥 Молодець'}));await loadBoard(sec,st.bDay,true);render();toast('🔥 Молодець — надіслано')})}
SHEETS.bdPoints=a=>{st._pts=st._pts||{n:5};return {title:'Бали · '+esc(shortName(a.id)),body:`<div class="stack">${nf({id:'ptsn',label:'Скільки балів',val:st._pts.n,min:1,max:50,step:1,unit:'балів',plus:true,set:v=>st._pts.n=v})}
 <div class="chips">${[1,3,5,10,20].map(n=>`<button class="chip" onclick="st._pts.n=${n};nfSyncView('ptsn',${n},false)">+${n}</button>`).join('')}</div>
 <input class="inp" id="ptsr" maxlength="40" placeholder="Коментар (необовʼязково), напр. 🔥 Молодець"></div>`,foot:`<button class="btn p" onclick="bdPointsSave(this,'${a.sec}',${a.post},'${a.id}')">Нарахувати</button>`}};
async function bdPointsSave(btn,sec,post,id){await busy(btn,async()=>{D(await sb.from('board_points').insert({section_id:sec,post_id:post,athlete_id:id,points:Math.round(st._pts.n||0),reaction:($('#ptsr').value||'').trim()}));closeAll();await loadBoard(sec,st.bDay,true);render();toast('+'+st._pts.n+' балів')})}
SHEETS.secAward=a=>({title:'Досягнення секції',body:`<div class="stack"><div class="t14 sec">${esc(cleanName(nameOf(a.id)))} · ${esc(secInfo(a.sec).name)}</div>
 <div class="list">${SEC_ACH.map((x,k)=>`<button class="li" onclick="secAwardGive(this,'${a.sec}','${a.id}',${k})"><span class="ico sm">${ic(x[2],18)}</span><div class="grow"><div class="t14 w6">${x[0]}</div><div class="t12 sec">${x[1]}</div></div></button>`).join('')}</div>
 <div class="over">Своє</div><input class="inp" id="saw" maxlength="60" placeholder="Назва досягнення"></div>`,foot:`<button class="btn p" onclick="secAwardGive(this,'${a.sec}','${a.id}',-1)">${ic('trophy',20)} Вручити</button>`});
async function secAwardGive(btn,sec,id,k){const x=k>=0?SEC_ACH[k]:null;const name=x?x[0]:($('#saw').value||'').trim();if(!name)return toast('Вкажіть назву','info');
 await busy(btn,async()=>{D(await sb.from('awards').insert({athlete_id:id,section_id:sec,name,description:(x?x[1]:'')+' · '+secInfo(sec).name,icon:x?x[2]:'star'}));closeAll();toast('Нагороду вручено: '+name)})}

/* comments */
function bdComments(sec,b){const cm=(b.board_comments||[]).slice().sort((x,y)=>x.created_at<y.created_at?-1:1);
 return `<div class="s8"><div class="over">Коментарі${cm.length?' · '+cm.length:''}</div>${cm.map(c=>`<div class="row12" style="align-items:flex-start">${avOf(c.author_id)}<div class="grow" style="min-width:0"><div class="t12 sec">${esc(cleanName(nameOf(c.author_id)))} · ${ago(c.created_at)}</div><div class="t14" style="white-space:pre-line">${esc(c.body)}</div></div>${c.author_id===st.me.id||canCoach(sec)?`<button class="ib" onclick="bdDelComment(${c.id})" aria-label="Видалити">${ic('x',16)}</button>`:''}</div>`).join('')}
  <div class="composer"><input class="inp" id="bdc" maxlength="1000" placeholder="Коментар до плану" onkeydown="if(event.key==='Enter')bdComment(null,'${sec}',${b.id})"><button class="sendb" onclick="bdComment(this,'${sec}',${b.id})" aria-label="Надіслати">${ic('send',20)}</button></div></div>`}
async function bdComment(btn,sec,post){const v=($('#bdc').value||'').trim();if(!v)return;await busy(btn,async()=>{D(await sb.from('board_comments').insert({post_id:post,body:v}));await loadBoard(sec,st.bDay,true);render()})}
async function bdDelComment(id){try{D(await sb.from('board_comments').delete().eq('id',id));await loadBoard(st.sec,st.bDay,true);render()}catch(e){fail(e)}}

/* athlete marks */
function bdMark(sec,day,status){st._mk={sec,day,status,time:null,dist:null,hr:null};const b=boardOf(sec,day);const m=b&&(b.board_marks||[]).find(x=>x.athlete_id===st.me.id);if(m)Object.assign(st._mk,{time:m.time_min?+m.time_min:null,dist:m.dist_km?+m.dist_km:null,hr:m.hr||null,comment:m.comment});openSheet('bdMark')}
SHEETS.bdMark=()=>{const m=st._mk;return {title:'Відмітка · '+esc(secInfo(m.sec).name),body:`<div class="stack"><div class="seg">${Object.entries(MARK).map(([k,v])=>`<button class="${m.status===k?'on':''}" onclick="st._mk.status='${k}';renderSheet()">${v[0]} ${v[1]}</button>`).join('')}</div>
 <input class="inp" id="mkc" maxlength="300" placeholder="${m.status==='skip'?'Причина (необовʼязково)':m.status==='alt'?'Що зробили замість плану':'Короткий коментар'}" value="${esc(m.comment||'')}">
 ${m.status!=='skip'?`${nf({id:'mkt',label:'Час',val:m.time,min:0,max:600,step:5,unit:'хв',empty:true,ph:'—',set:v=>st._mk.time=v===''?null:v})}
 ${nf({id:'mkd',label:'Дистанція',val:m.dist,min:0,max:300,step:.1,unit:'км',empty:true,ph:'—',set:v=>st._mk.dist=v===''?null:v})}
 ${nf({id:'mkh',label:'Середній пульс',val:m.hr,min:60,max:210,step:1,unit:'уд/хв',empty:true,ph:'—',set:v=>st._mk.hr=v===''?null:v})}`:''}</div>`,
 foot:`<button class="btn p" onclick="bdMarkSave(this)">Зберегти</button>`}};
async function bdMarkSave(btn){const m=st._mk;m.comment=($('#mkc').value||'').trim();const b=boardOf(m.sec,m.day);if(!b||b.none)return;
 await busy(btn,async()=>{const row={post_id:b.id,athlete_id:st.me.id,status:m.status,comment:m.comment,time_min:m.status==='skip'?null:m.time,dist_km:m.status==='skip'?null:m.dist,hr:m.status==='skip'?null:m.hr,updated_at:new Date().toISOString()};
  D(await sb.from('board_marks').upsert(row,{onConflict:'post_id,athlete_id'}));closeAll();await Promise.all([loadBoard(m.sec,m.day,true),loadMyLines()]);render();toast(MARK[m.status][0]+' '+MARK[m.status][1])})}

/* --- board editor (coach) --- */
function bdEdit(sec,day){const b=boardOf(sec,day);st._be={sec,day,plan:b&&!b.none?b.plan:'',lines:b&&!b.none?(b.board_lines||[]).map(l=>shortName(l.athlete_id)+': '+l.text).join('\n'):'',pick:{}};
 if(b&&!b.none)(b.board_lines||[]).forEach((l,i)=>st._be.pick[i]=l.athlete_id);loadTemplates(sec);openSheet('bdEdit')}
async function loadTemplates(sec){try{st._tpl=D(await sb.from('board_templates').select('*').eq('section_id',sec).order('created_at',{ascending:false}));if(sheetStack.length)renderSheet()}catch(e){console.warn(e)}}
const DIM={'саша':'олександр','сашко':'олександр','шура':'олександр','женя':'євген','діма':'дмитр','дімон':'дмитр','дима':'дмитр','вова':'володимир','володя':'володимир','коля':'микола','юра':'юрі','льоша':'олекс','леша':'алекс','олежка':'олег','настя':'анастас','катя':'катерин','таня':'тетян','оля':'ольг','ліза':'єлизавет','маша':'марі','міша':'михайл','сєрьожа':'сергі','серьожа':'сергі','петя':'петр','іра':'ірин','наташа':'натал','свєта':'світлан','світа':'світлан','андрюша':'андрі','макс':'максим','тьома':'артем','ваня':'іван','віталік':'віталі','толік':'анатолі','славік':'вячеслав','стас':'станіслав','влад':'владислав','даша':'дар','ксюша':'ксені','люда':'людмил','галя':'галин','надя':'наді','віка':'вікторі','юля':'юлі','поліна':'полін','богдан':'богдан','рома':'роман','ромчик':'роман','денис':'денис','кирюша':'кирил','тарасик':'тарас'};
function nmNorm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/[’ʼ'`]/g,'').trim()}
/* candidates for a typed name among section members */
function nameCands(sec,raw){const t=nmNorm(raw);if(t.length<2)return [];const dim=DIM[t];
 const sc=secAthletes(sec).map(id=>{const full=nmNorm(cleanName(nameOf(id)));const parts=full.split(/\s+/);let s=0;
  if(full===t)s=100;else if(parts.includes(t))s=90;else if(dim&&parts.some(p=>p.startsWith(dim)))s=80;
  else if(parts.some(p=>p.startsWith(t)&&t.length>=3))s=70;
  else{const cp=Math.max(...parts.map(p=>{let k=0;while(k<p.length&&k<t.length&&p[k]===t[k])k++;return k}));if(cp>=4||(cp>=3&&t.length<=4))s=40+cp}
  return {id,s}}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
 if(!sc.length)return [];const top=sc[0].s;return sc.filter(x=>x.s>=top-5||x.s>=80)}
function parseBoardLines(sec,text){const be=st._be||{pick:{}};return String(text||'').split('\n').map((ln,i)=>{const m=ln.match(/^\s*([^:—–]{1,40}?)\s*[:—–]\s*(.+)$/);if(!ln.trim())return null;
  if(!m)return {i,raw:ln,name:'',text:ln.trim(),cands:[],id:null,bad:true};
  const cands=nameCands(sec,m[1]);const id=be.pick[i]&&(cands.some(c=>c.id===be.pick[i])||secAthletes(sec).includes(be.pick[i]))?be.pick[i]:(cands.length===1?cands[0].id:null);
  return {i,raw:ln,name:m[1].trim(),text:m[2].trim(),cands,id}}).filter(Boolean)}
SHEETS.bdEdit=()=>{const be=st._be;const s=secInfo(be.sec);const t=todayIso();
 const dchips=[[t,'Сьогодні'],[isoAdd(t,1),'Завтра'],[isoAdd(t,2),'Післязавтра']];
 return {title:'План · '+esc(s.name),full:true,body:`<div class="stack">
 <div class="chips scroll">${dchips.map(d=>`<button class="chip ${be.day===d[0]?'on':''}" onclick="bdEditDay('${d[0]}')">${d[1]}</button>`).join('')}<input class="inp" type="date" style="width:140px;min-height:40px;height:40px;flex:none" value="${be.day}" onchange="bdEditDay(this.value)"></div>
 <div class="t12 ter">${dayLabel(be.day)}</div>
 <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn s sm" onclick="bdCopyPrev(this)">${ic('refresh',18)} Копіювати попередній</button>${(st._tpl||[]).map(tp=>`<button class="chip" onclick="bdUseTpl(${tp.id})">${ic('list',14)} ${esc(tp.title)}</button>`).join('')}</div>
 <label class="t14 w6">Загальний план</label>
 <textarea class="inp ta" id="bep" rows="3" maxlength="2000" placeholder="Сьогодні їдемо 50 км, темп 30–32, старт 9:00" oninput="st._be.plan=this.value">${esc(be.plan)}</textarea>
 <label class="t14 w6">Рядки для спортсменів <span class="t12 ter" style="font-weight:400">· «Імʼя: завдання», кожен з нового рядка</span></label>
 <textarea class="inp ta mono" id="bel" rows="5" maxlength="4000" placeholder="Віталік: 10×500&#10;Світа: 5×1000" oninput="bdLinesInput(this)" onclick="bdLinesInput(this)" onkeyup="bdLinesInput(this)">${esc(be.lines)}</textarea>
 <div id="besug" class="chips"></div>
 <div id="beprev">${bdPreview()}</div>
 </div>`,foot:`<button class="btn s" style="flex:none;width:56px;padding:0" onclick="bdSaveTpl(this)" aria-label="Зберегти як шаблон" title="Зберегти як шаблон">${ic('list',20)}</button><button class="btn p" style="flex:1;width:auto;min-width:0" onclick="bdSave(this)">Опублікувати</button>`}};
function bdEditDay(d){if(!d)return;st._be.day=d;const b=boardOf(st._be.sec,d);if(!b)loadBoard(st._be.sec,d).then(()=>renderSheet());renderSheet()}
function bdPreview(){const be=st._be;const rows=parseBoardLines(be.sec,be.lines);if(!rows.length)return `<div class="t12 ter">Підказка: почніть рядок з імені — застосунок запропонує спортсмена з секції.</div>`;
 return `<div class="list">${rows.map(r=>{
  if(r.bad)return `<div class="li" style="min-height:44px"><div class="grow t14 c-warn">«${esc(r.raw)}» — додайте «Імʼя:» на початку</div></div>`;
  if(r.id)return `<div class="li" style="min-height:44px"><span class="c-ok">${ic('check',18)}</span><div class="grow t14"><b class="w6">${esc(cleanName(nameOf(r.id)))}</b> · ${esc(r.text)}</div>${r.cands.length>1?`<button class="btn t sm" onclick="bdUnpick(${r.i})">змінити</button>`:''}</div>`;
  const opts=(r.cands.length?r.cands.map(c=>c.id):secAthletes(be.sec));
  return `<div class="li" style="min-height:44px;flex-wrap:wrap;align-items:flex-start;padding:8px 12px"><div class="grow t14 c-warn" style="flex-basis:100%">${r.cands.length?'Хто це «'+esc(r.name)+'»?':'Не знайшли «'+esc(r.name)+'» у секції — оберіть:'}</div><div class="chips" style="margin-top:6px">${opts.map(id=>`<button class="chip" onclick="bdPick(${r.i},'${id}')">${esc(cleanName(nameOf(id)))}</button>`).join('')||'<span class="t12 ter">У секції ще немає спортсменів</span>'}</div></div>`}).join('')}</div>`}
function bdPick(i,id){st._be.pick[i]=id;const el=$('#beprev');if(el)el.innerHTML=bdPreview()}
function bdUnpick(i){st._be.pick[i]='__none__';const el=$('#beprev');if(el)el.innerHTML=bdPreview()}
function bdLinesInput(ta){const be=st._be;be.lines=ta.value;const pos=ta.selectionStart||0;const before=ta.value.slice(0,pos);const lineStart=before.lastIndexOf('\n')+1;const cur=before.slice(lineStart);
 const sug=$('#besug');if(sug){if(cur.length>=1&&!/[:—–]/.test(cur)){const t=nmNorm(cur);const ids=secAthletes(be.sec).filter(id=>{const n=nmNorm(cleanName(nameOf(id)));return n.split(/\s+/).some(p=>p.startsWith(t))||(DIM[t]&&n.includes(DIM[t]))||nameCands(be.sec,cur).some(c=>c.id===id)}).slice(0,6);
   sug.innerHTML=ids.map(id=>`<button class="chip" onmousedown="event.preventDefault()" onclick="bdSug('${id}')">${esc(cleanName(nameOf(id)))}</button>`).join('')}else if(!cur.length){sug.innerHTML=secAthletes(be.sec).filter(id=>!parseBoardLines(be.sec,be.lines).some(r=>r.id===id)).slice(0,8).map(id=>`<button class="chip" onmousedown="event.preventDefault()" onclick="bdSug('${id}')">+ ${esc(shortName(id))}</button>`).join('')}else sug.innerHTML=''}
 const pv=$('#beprev');if(pv)pv.innerHTML=bdPreview()}
function bdSug(id){const ta=$('#bel');if(!ta)return;const v=ta.value;const pos=ta.selectionStart??v.length;const ls=v.lastIndexOf('\n',pos-1)+1;let le=v.indexOf('\n',pos);if(le<0)le=v.length;
 const curLine=v.slice(ls,le);const rest=curLine.includes(':')?curLine.slice(curLine.indexOf(':')+1).trimStart():'';const ins=shortName(id)+': '+rest;
 ta.value=v.slice(0,ls)+ins+v.slice(le);const idx=ta.value.slice(0,ls+ins.length).split('\n').length-1;st._be.pick[idx]=id;ta.focus();const np=ls+ins.length;ta.setSelectionRange(np,np);bdLinesInput(ta)}
async function bdCopyPrev(btn){const be=st._be;await busy(btn,async()=>{const r=D(await sb.from('board_posts').select('*, board_lines(*)').eq('section_id',be.sec).lt('day',be.day).order('day',{ascending:false}).limit(1).maybeSingle());
 if(!r)return toast('Попередніх планів ще немає','info');be.plan=r.plan;be.pick={};be.lines=(r.board_lines||[]).filter(l=>secAthletes(be.sec).includes(l.athlete_id)).map((l,i)=>{be.pick[i]=l.athlete_id;return shortName(l.athlete_id)+': '+l.text}).join('\n');renderSheet();toast('Скопійовано з '+fmtDate(parseIso(r.day)))})}
function bdUseTpl(id){const tp=(st._tpl||[]).find(x=>x.id===id);if(!tp)return;st._be.plan=tp.plan;st._be.lines=tp.lines;st._be.pick={};renderSheet()}
async function bdSaveTpl(btn){const be=st._be;be.plan=$('#bep').value;be.lines=$('#bel').value;const title=(be.plan.split('\n')[0]||'Шаблон').slice(0,40);
 await busy(btn,async()=>{const r=D(await sb.from('board_templates').insert({section_id:be.sec,title,plan:be.plan,lines:be.lines}).select().single());(st._tpl=st._tpl||[]).unshift(r);renderSheet();toast('Шаблон збережено')})}
async function bdSave(btn){const be=st._be;be.plan=$('#bep').value.trim();be.lines=$('#bel').value;const rows=parseBoardLines(be.sec,be.lines);
 const bad=rows.filter(r=>!r.bad&&!r.id);if(bad.length)return toast('Уточніть, хто такий «'+bad[0].name+'»','info');
 const lines=rows.filter(r=>r.id);const seen=new Set();for(const l of lines){if(seen.has(l.id))return toast(cleanName(nameOf(l.id))+' має два рядки — обʼєднайте в один','info');seen.add(l.id)}
 if(!be.plan&&!lines.length)return toast('Напишіть план','info');
 await busy(btn,async()=>{const post=D(await sb.from('board_posts').upsert({section_id:be.sec,day:be.day,plan:be.plan,author_id:st.me.id,updated_at:new Date().toISOString()},{onConflict:'section_id,day'}).select().single());
  const old=D(await sb.from('board_lines').select('athlete_id').eq('post_id',post.id));const keep=lines.map(l=>l.id);const del=old.map(o=>o.athlete_id).filter(id=>!keep.includes(id));
  if(del.length)D(await sb.from('board_lines').delete().eq('post_id',post.id).in('athlete_id',del));
  if(lines.length)D(await sb.from('board_lines').upsert(lines.map(l=>({post_id:post.id,athlete_id:l.id,text:l.text.slice(0,500)})),{onConflict:'post_id,athlete_id'}));
  closeAll();st.bDay=be.day;await loadBoard(be.sec,be.day,true);render();toast('План опубліковано'+(lines.length?' · '+lines.length+' рядк.':''))})}
async function bdCopyTo(sec,day){const b=boardOf(sec,day);if(!b||b.none)return;const t=isoAdd(day,1);st._be={sec,day:t,plan:b.plan,lines:(b.board_lines||[]).map(l=>shortName(l.athlete_id)+': '+l.text).join('\n'),pick:{}};(b.board_lines||[]).forEach((l,i)=>st._be.pick[i]=l.athlete_id);await loadBoard(sec,t).catch(()=>{});loadTemplates(sec);openSheet('bdEdit')}

/* --- section rating (weekly) --- */
function secRateBody(sec){const k=sec+'|'+wkIso(0);const r=st.secRate[k];
 if(!r){sb.rpc('section_rating',{sec,ws:wkIso(0)}).then(x=>{st.secRate[k]=D(x)||[];render()}).catch(fail);return `<div class="empty"><span class="spin"></span></div>`}
 const s=secInfo(sec),uid=st.me.id;
 let h=`<div class="t12 ter">Тиждень ${weekRange(0)} · бали від тренера, далі — виконання завдань з дошки. Оновлюється щотижня.</div>`;
 if(!r.length)return h+emptyBox('Поки порожньо','Рейтинг зʼявиться, коли тренер почне писати плани');
 return h+`<div class="list">${r.map((a,k)=>`<div class="li" style="${a.athlete_id===uid?'background:color-mix(in srgb,'+s.color+' 14%,transparent)':''}"><div class="t16 num ${k<3?'acc':'ter'}" style="width:20px;text-align:center">${k+1}</div>${avOf(a.athlete_id)}<div class="grow" style="min-width:0"><div class="t14 w6 ell">${esc(cleanName(a.full_name))}${a.athlete_id===uid?' · ви':''}</div><div class="t12 sec">виконано ${a.done}/${a.assigned}${a.assigned?' · '+a.pct+'%':''}</div></div><div class="t16 num w7">${a.points}<span class="t12 ter"> б.</span></div></div>`).join('')}</div>`}

/* --- people (coach/admin) --- */
function secPeopleBody(sec){const ids=secAthletes(sec);const coaches=secCoachIds(sec);const adm=isAdmin();const selfCoach=coachSecs().includes(sec);
 let h='';
 if(adm){h+=`<div class="s8"><div class="over">Тренери секції</div><div class="list">${coaches.map(id=>`<div class="li">${avOf(id)}<div class="grow t14 w6 ell">${esc(cleanName(nameOf(id)))}</div><button class="ib" onclick="secRemoveCoach(this,'${sec}','${id}')" aria-label="Прибрати тренера">${ic('x',18)}</button></div>`).join('')||'<div class="li"><div class="grow t14 ter">Тренера ще не призначено</div></div>'}</div>
  <div class="row" style="gap:8px"><button class="btn s sm grow" onclick="openSheet('secPick',{sec:'${sec}',role:'coach'})">${ic('plus',18)} Призначити тренера</button><button class="btn s sm grow" onclick="openSheet('secNewUser',{sec:'${sec}'})">${ic('user',18)} Новий акаунт</button></div></div>`}
 h+=`<div class="s8"><div class="over">Спортсмени · ${ids.length}</div><div class="list">${ids.map(id=>`<div class="li">${avOf(id)}<button class="grow" style="background:none;border:0;text-align:left;color:inherit;min-width:0" onclick="${adm?`openSheet('athlete','${id}')`:`openSheet('secAth',{sec:'${sec}',id:'${id}'})`}"><div class="t14 w6 ell">${esc(cleanName(nameOf(id)))}</div><div class="t12 sec ell">${memberSecs(id).filter(x=>x!==sec).map(x=>secInfo(x).name).join(', ')||'лише ця секція'}</div></button>
  ${selfCoach&&!adm?`<label class="sw" title="Показувати мені повне навантаження з інших видів спорту"><input type="checkbox" ${st.capPrefs[id]?'checked':''} onchange="secFull(this,'${id}')"><span></span></label>`:''}
  ${adm?`<button class="ib" onclick="secRemoveMember(this,'${sec}','${id}')" aria-label="Прибрати зі секції">${ic('x',18)}</button>`:''}</div>`).join('')||'<div class="li"><div class="grow t14 ter">Поки нікого</div></div>'}</div>
  ${selfCoach&&!adm?`<div class="t12 ter">Перемикач праворуч — «показувати мені повне навантаження» спортсмена з інших видів спорту. Його бачите лише ви.</div>`:''}
  ${adm?`<button class="btn s sm" onclick="openSheet('secPick',{sec:'${sec}',role:'member'})">${ic('plus',18)} Додати спортсменів</button>`:''}</div>`;
 return h}
async function secFull(el,id){try{D(await sb.from('coach_athlete_prefs').upsert({coach_id:st.me.id,athlete_id:id,show_full:el.checked},{onConflict:'coach_id,athlete_id'}));st.capPrefs[id]=el.checked;toast(el.checked?'Повне навантаження показується':'Лише ця секція')}catch(e){el.checked=!el.checked;fail(e)}}
function activeAccounts(){const ids=new Map();(st.athletes||[]).filter(a=>a.status==='active').forEach(a=>ids.set(a.id,a.name));st.members.forEach(m=>{if(!m.is_coach)ids.set(m.id,m.full_name)});return [...ids.entries()].map(([id,name])=>({id,name}))}
SHEETS.secPick=a=>{const s=secInfo(a.sec);const have=a.role==='coach'?secCoachIds(a.sec):secAthletes(a.sec);const list=activeAccounts().filter(x=>!have.includes(x.id)).sort((x,y)=>cleanName(x.name).localeCompare(cleanName(y.name)));st._sel=new Set();
 return {title:(a.role==='coach'?'Тренер · ':'Спортсмени · ')+esc(s.name),body:`<div class="stack"><div class="t14 sec">${a.role==='coach'?'Оберіть підтверджений акаунт. Тренер зможе писати плани лише цієї секції і не зможе додавати людей.':'Оберіть підтверджених спортсменів.'}</div>
 <div class="list">${list.map(x=>`<label class="li" style="cursor:pointer"><input type="checkbox" onchange="this.checked?st._sel.add('${x.id}'):st._sel.delete('${x.id}')" style="width:20px;height:20px"><div class="grow t14 w6 ell">${esc(cleanName(x.name))}</div>${memberSecs(x.id).map(secDot).join('')}</label>`).join('')||'<div class="li"><div class="grow t14 ter">Немає доступних акаунтів</div></div>'}</div></div>`,
 foot:`<button class="btn p" onclick="secAssign(this,'${a.sec}','${a.role}')">Додати</button>`}};
async function secAssign(btn,sec,role){const ids=[...st._sel];if(!ids.length)return toast('Нікого не обрано','info');
 await busy(btn,async()=>{if(role==='coach')D(await sb.from('section_coaches').insert(ids.map(id=>({section_id:sec,user_id:id}))));else D(await sb.from('section_members').insert(ids.map(id=>({section_id:sec,athlete_id:id}))));
  closeAll();await loadSections();render();toast(role==='coach'?'Тренера призначено':'Додано: '+ids.length)})}
async function secRemoveCoach(btn,sec,id){await busy(btn,async()=>{D(await sb.from('section_coaches').delete().eq('section_id',sec).eq('user_id',id));await loadSections();render();toast('Тренера прибрано')})}
async function secRemoveMember(btn,sec,id){await busy(btn,async()=>{D(await sb.from('section_members').delete().eq('section_id',sec).eq('athlete_id',id));await loadSections();render();toast('Прибрано зі секції')})}
SHEETS.secNewUser=a=>({title:'Новий акаунт',body:`<div class="stack"><div class="t14 sec">Акаунт одразу підтверджений. Тимчасовий пароль покажемо один раз — передайте його людині особисто.</div>
 <input class="inp" id="nuName" maxlength="80" placeholder="Імʼя та прізвище"><input class="inp" id="nuEmail" type="email" maxlength="120" placeholder="Email">
 <div class="over">Роль у секції «${esc(secInfo(a.sec).name)}»</div><div class="seg"><button id="nuR1" class="on" onclick="st._nuRole='coach';this.classList.add('on');$('#nuR2').classList.remove('on')">Тренер</button><button id="nuR2" onclick="st._nuRole='member';this.classList.add('on');$('#nuR1').classList.remove('on')">Спортсмен</button></div>
 <div id="nuRes"></div></div>`,foot:`<button class="btn p" onclick="secCreateUser(this,'${a.sec}')">Створити</button>`});
async function secCreateUser(btn,sec){const role=st._nuRole||'coach';const full_name=$('#nuName').value.trim(),email=$('#nuEmail').value.trim();if(!full_name||!email)return toast('Вкажіть імʼя та email','info');
 await busy(btn,async()=>{const {data,error}=await sb.functions.invoke('account',{body:{action:'admin_create_user',email,full_name,coach_sections:role==='coach'?[sec]:[],member_sections:role==='member'?[sec]:[]}});
  if(error){let m='Не вдалося створити';try{m=(await error.context.json()).error||m}catch(e){}throw new Error(m)}
  await Promise.all([loadMembers(),loadSections(),isAdmin()?loadCoach():null]);render();
  $('#nuRes').innerHTML=`<div class="note">${ic('check',20)}<span>Акаунт створено. Тимчасовий пароль: <b class="mono" style="color:var(--tx);user-select:all">${esc(data.password)}</b><br>Попросіть змінити його в Профіль → Змінити пароль.</span></div>`;st._nuRole='coach'})}

/* section coach: athlete card (basic; full load only if the coach enabled it) */
SHEETS.secAth=a=>{const id=a.id;const d=st._secAth[id];if(!d){secAthLoad(id);return {title:esc(cleanName(nameOf(id))),body:`<div class="empty"><span class="spin"></span></div>`}}
 const p=d.prof?toP(d.prof):null;let b=`<div class="stack"><div class="t14 sec">${p?(p.age+' р. · '+Object.keys(p.sports).filter(k=>p.sports[k].on).map(k=>SPORT[k].n).join(', ')):''} · секції: ${memberSecs(id).map(x=>secInfo(x).name).join(', ')}</div>`;
 if(!st.capPrefs[id])b+=`<div class="note">${ic('eyeoff',20)}<span>Повне навантаження з інших видів спорту приховано. Увімкніть перемикач у списку учасників, щоб бачити план і тренування цього спортсмена.</span></div>`;
 else{const pl=d.plan;const logs=d.logs||[];
  b+=`<div class="over">План тижня (усі види спорту)</div>${pl?`<div class="list">${sectionize(planRowToDays(pl),id).filter(x=>!x.rest).map(x=>`<div class="li" style="min-height:44px"><div class="t12 ter" style="width:28px">${DAYS[x.i]}</div><div class="grow t14">${x.items.map(it=>esc(itemName(it))+' · '+fmtMin(it.min)).join('<br>')}</div></div>`).join('')}</div>`:'<div class="t14 ter">Плану на цей тиждень немає</div>'}
  <div class="over">Останні тренування</div>${logs.length?`<div class="list">${logs.slice(-10).reverse().map(l=>`<div class="li" style="min-height:44px"><div class="grow"><div class="t14">${SPORT[l.sport]?SPORT[l.sport].n:l.sport} · ${l.status==='done'?fmtMin(l.duration_min||0):'пропуск'}</div><div class="t12 ter">${fmtDate(parseIso(l.day))}${l.rpe?' · RPE '+l.rpe:''}</div></div></div>`).join('')}</div>`:'<div class="t14 ter">Ще немає</div>'}`}
 return {title:esc(cleanName(nameOf(id))),full:true,body:b+'</div>'}};
async function secAthLoad(id){try{const [pr,pl,lg]=await Promise.all([sb.from('profiles').select('*').eq('id',id).maybeSingle(),st.capPrefs[id]?sb.from('plan_weeks').select('*').eq('athlete_id',id).eq('week_start',wkIso(0)).maybeSingle():{data:null},st.capPrefs[id]?sb.from('workout_logs').select('*').eq('athlete_id',id).gte('day',dayIso(-2,0)).order('day'):{data:[]}]);
 st._secAth[id]={prof:D(pr),plan:pl.data,logs:lg.data||[]};renderSheet()}catch(e){fail(e)}}

/* --- Today: my lines from section boards --- */
function todayBoardCards(){const t=todayIso();const mine=st.myLines.filter(l=>l.post&&l.post.day===t);if(!mine.length)return '';
 return mine.map(l=>{const s=secInfo(l.post.section_id);const mk=(l.post.board_marks||[]).find(m=>m.athlete_id===st.me.id);
  return `<div class="myline" style="--sc:${s.color}"><div class="between"><div class="over" style="color:var(--sc)">${ic(s.icon,14)} ${esc(s.name)} · від тренера</div>${mk?`<span class="t12">${MARK[mk.status][0]} ${MARK[mk.status][1]}</span>`:''}</div>
   <div class="t18 w7" style="margin-top:4px;white-space:pre-line">${esc(l.text)}</div>${l.post.plan?`<div class="t14 sec" style="margin-top:4px;white-space:pre-line">${esc(l.post.plan)}</div>`:''}
   <div class="row" style="gap:8px;margin-top:10px">${mk?`<button class="btn s sm grow" onclick="secOpenBoard('${l.post.section_id}','${t}')">Відкрити дошку</button>`:Object.entries(MARK).map(([k,v])=>`<button class="btn s sm grow" onclick="secQuickMark('${l.post.section_id}','${t}','${k}')">${v[0]}</button>`).join('')}</div></div>`}).join('')}
async function secQuickMark(sec,day,k){try{await loadBoard(sec,day);bdMark(sec,day,k)}catch(e){fail(e)}}
function secOpenBoard(sec,day){st.sec=sec;st.secSeg='board';st.bDay=day;go('sec')}

/* --- club rating (monthly) --- */
function clubRateBody(){const ms=iso(new Date(NOW.getFullYear(),NOW.getMonth(),1));
 if(!st.clubRate||st.clubRate.ms!==ms){sb.rpc('club_rating',{ms}).then(x=>{st.clubRate={ms,rows:D(x)||[]};render()}).catch(fail);return `<div class="empty"><span class="spin"></span></div>`}
 const r=st.clubRate.rows,uid=st.me.id;const mn=['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень'][NOW.getMonth()];
 let h=`<div class="t12 ter">Загальний рейтинг клубу за ${mn} · бали від тренерів секцій + 10 за кожне виконане тренування. Оновлюється щомісяця.</div>`;
 if(!r.length)return h+emptyBox('Поки порожньо');
 return h+`<div class="list">${r.map((a,k)=>`<div class="li" style="${a.athlete_id===uid?'background:var(--acc-soft)':''}"><div class="t16 num ${k<3?'acc':'ter'}" style="width:20px;text-align:center">${k+1}</div>${avOf(a.athlete_id)}<div class="grow" style="min-width:0"><div class="t14 w6 ell">${esc(cleanName(a.full_name))}${a.athlete_id===uid?' · ви':''}</div><div class="t12 sec">${a.sessions} трен. · ${a.points} балів</div></div><div class="t16 num w7">${a.score}</div></div>`).join('')}</div>`}
function rateMode(v){st.rateMode=v;render()}
