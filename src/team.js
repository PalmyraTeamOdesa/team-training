/* ---------- TEAM (athlete) ---------- */
function teamView(){
 if(st.me.status!=='active')return `<div class="stack">${pendingBanner()}${emptyBox('Команда відкриється після підтвердження','Тренер отримав вашу заявку. Поки можна писати тренеру напряму.')}<button class="btn p" onclick="openSheet('dm','${coachId()||''}')">${ic('msg',20)} Написати тренеру</button></div>`;
 let h=`<div class="stack">${seg([['feed','Стрічка'],['rate','Рейтинг'],['events','Події'],['chat','Чат']],st.teamSeg,'teamSeg')}`;
 h+=({feed:feedBody,rate:rateBody,events:eventsBody,chat:chatBody})[st.teamSeg]();
 return h+'</div>'}
function teamSeg(v){st.teamSeg=v;render();if(v==='rate')loadRating()}
function coachId(){const c=st.members.find(m=>m.is_coach);return c?c.id:null}
function feedBody(){
 const myG=st.me.group;
 const list=st.posts.filter(p=>{const a=memberById(p.author_id)||{};if(st.feedF==='all')return true;if(st.feedF==='group')return a.group_name===myG;return p.sport===st.feedF});
 let h=chipRow([['all','Усі'],['group','Моя група'],['bike','Вело'],['run','Біг'],['swim','Плавання'],['gym','Зал']],st.feedF,'feedF',true);
 if(!list.length)return h+emptyBox('Тут поки порожньо','Позначте тренування виконаним і поділіться ним: воно зʼявиться тут');
 return h+list.map(postCard).join('')}
function postCard(p){const a=memberById(p.author_id)||{};const mine=p.author_id===st.me.id;const likes=p.post_likes||[];const liked=likes.some(l=>l.user_id===st.me.id);const cm=(p.post_comments||[]).slice().sort((x,y)=>x.created_at<y.created_at?-1:1);
 return `<div class="card s12">
  <div class="row12">${avOf(p.author_id)}<div class="grow"><div class="t14 w6 ell">${esc(nameOf(p.author_id))}</div><div class="t12 ter">${ago(p.created_at)}${a.group_name?' · '+esc(a.group_name):''}</div></div>${p.sport?`<span class="ico sm">${ic(SPORT[p.sport].i,18)}</span>`:`<span class="ico sm">${ic('cal',18)}</span>`}${mine||isCoach()?`<button class="ib" onclick="delPost(${p.id})" aria-label="Видалити">${ic('x',18)}</button>`:''}</div>
  <div class="t16">${esc(p.title)}</div>
  ${p.kind==='plan'&&p.body?`<div class="t14 sec" style="white-space:pre-line">${esc(p.body)}</div>`:p.body?`<div class="t14 sec">${esc(p.body)}</div>`:''}
  ${p.photo_path?(PHOTO_URL[p.photo_path]?`<img class="post-photo" src="${PHOTO_URL[p.photo_path]}" alt="Фото тренування" loading="lazy">`:`<div class="post-photo"></div>`):''}
  ${(p.stats||[]).length?`<div class="grid3">${p.stats.map(s=>`<div><div class="t16 num">${esc(s[0])}</div><div class="t12 ter">${esc(s[1])}</div></div>`).join('')}</div>`:p.kind==='workout'?`<div class="row t12 ter">${ic('eyeoff',16)} Цифри приховані налаштуваннями приватності</div>`:''}
  ${cm.length?`<div class="s8">${cm.map(c=>`<div class="t14"><b class="w6">${esc(nameOf(c.author_id).split(' ')[0])}</b> <span class="sec">${esc(c.body)}</span></div>`).join('')}</div>`:''}
  <div class="acts"><button class="act ${liked?'on':''}" onclick="like(${p.id})">${ic('heart',20)} ${likes.length||''}</button><button class="act" onclick="openSheet('comment',${p.id})">${ic('msg',20)} ${cm.length||''}</button></div></div>`}
function feedF(v){st.feedF=v;render()}
async function like(id){const p=st.posts.find(x=>x.id===id);const likes=p.post_likes=p.post_likes||[];const k=likes.findIndex(l=>l.user_id===st.me.id);
 try{if(k>=0){likes.splice(k,1);render();D(await sb.from('post_likes').delete().eq('post_id',id).eq('user_id',st.me.id))}else{likes.push({user_id:st.me.id});render();D(await sb.from('post_likes').insert({post_id:id,user_id:st.me.id}))}}catch(e){fail(e)}}
async function delPost(id){if(!confirm('Видалити публікацію?'))return;try{D(await sb.from('posts').delete().eq('id',id));st.posts=st.posts.filter(p=>p.id!==id);render()}catch(e){fail(e)}}
SHEETS.comment=id=>({title:'Коментар',body:`<div class="s12"><textarea class="inp" id="ctx" maxlength="1000" placeholder="Підтримайте одноклубника"></textarea><div class="chips">${['Сильно!','Так тримати','Гарний темп'].map(t=>`<button class="chip" onclick="$('#ctx').value='${t}'">${t}</button>`).join('')}</div></div>`,
 foot:`<button class="btn p" onclick="addComment(this,${id})">Надіслати</button>`});
async function addComment(btn,id){const t=$('#ctx').value.trim();if(!t)return;await busy(btn,async()=>{const c=D(await sb.from('post_comments').insert({post_id:id,author_id:st.me.id,body:t}).select().single());const p=st.posts.find(x=>x.id===id);(p.post_comments=p.post_comments||[]).push(c);closeAll();render();toast('Коментар додано');checkNewAch()})}

/* weekly rating: plan completion 70% + consistency 30% (not kilometres) */
st.rating=null;
async function loadRating(){try{st.rating=D(await sb.rpc('weekly_rating',{ws:wkIso(0)}));render()}catch(e){fail(e)}}
function rateList(){
 const kid=st.rateAge==='kid';let arr=(st.rating||[]).filter(a=>!(memberById(a.athlete_id)||{}).is_coach).filter(a=>kid?a.is_kid:!a.is_kid).map(a=>{const compl=a.planned?Math.min(100,Math.round(a.done/a.planned*100)):0;const cons=Math.round(Math.min(TODAY+1,a.active_days)/(TODAY+1)*100);return {id:a.athlete_id,name:a.full_name,group:a.group_name,sports:a.sports||[],compl,cons,score:Math.round(compl*.7+cons*.3)}});
 if(st.rateBy!=='all')arr=arr.filter(a=>['bike','run','swim','gym'].includes(st.rateBy)?a.sports.includes(st.rateBy):a.group===st.rateBy);
 arr.sort((x,y)=>y.score-x.score);return arr}
function rateBody(){
 const rm=seg([['week','Тиждень'],['month','Клуб · місяць']],st.rateMode,'rateMode');if(st.rateMode==='month')return rm+clubRateBody();
 if(!st.rating){loadRating();return rm+`<div class="empty">Завантаження…</div>`}
 const arr=rateList();const myId=st.me.id;
 let h=rm+seg([['adult','Дорослі'],['kid','Діти']],st.rateAge,'rateAge')+chipRow([['all','Уся команда'],['bike','Вело'],['run','Біг'],['swim','Плавання'],['Шосе','Шосе'],['Тріатлон','Тріатлон'],['Новачки','Новачки']],st.rateBy,'rateBy',true);
 h+=`<div class="t12 ter">Тиждень ${weekRange(0)} · рахуємо виконання плану (70%) і регулярність (30%), а не кілометри</div>`;
 if(!arr.length)return h+emptyBox('Нікого в цьому фільтрі');
 h+=`<div class="list">${arr.map((a,k)=>`<div class="li" style="${a.id===myId?'background:var(--acc-soft)':''}"><div class="t16 num ${k<3?'acc':'ter'}" style="width:20px;text-align:center">${k+1}</div><span class="av sm ${a.id===myId?'me':''}">${esc(initials(a.name))}</span><div class="grow"><div class="t14 w6 ell">${esc(a.name)}${a.id===myId?' · ви':''}</div><div class="t12 sec">План ${a.compl}% · регулярність ${a.cons}%</div></div><div class="t16 num">${a.score}</div></div>`).join('')}</div>`;
 return h}
function rateAge(v){st.rateAge=v;st.rateBy='all';render()}
function rateBy(v){st.rateBy=v;render()}

/* events: rides, challenge, lessons */
function rideWhen(r){if(!r.starts_at)return '';const d=new Date(r.starts_at);return DAYS_FULL[(d.getDay()+6)%7]+', '+fmtDate(d)+' · '+hhmm(r.starts_at)}
function eventsBody(){
 const up=st.rides.filter(r=>!r.starts_at||new Date(r.starts_at)>Date.now()-6*36e5);
 let h=`<div class="over">Командні заїзди</div>`+(up.length?up.map(r=>{const g=(r.ride_participants||[]).map(x=>x.user_id);const me_=g.includes(st.me.id);return `<div class="card s12"><div class="t16">${esc(r.title)}</div><div class="t14 sec">${esc(rideWhen(r))}${r.details?' · '+esc(r.details):''}</div>
  <div class="between"><button class="row" style="background:none;border:0;min-height:44px;color:inherit" onclick="openSheet('ride',${r.id})"><div class="avstack">${g.slice(0,5).map(id=>avOf(id)).join('')}</div><span class="t12 sec">${g.length} їдуть</span></button>
  <button class="btn ${me_?'s':'p'} sm" onclick="toggleRide(this,${r.id})">${me_?ic('check',18)+' Їду':ic('plus',18)+' їду'}</button></div></div>`}).join(''):emptyBox('Заїздів поки немає','Тренер додасть найближчий'));
 const c=st.challenges[0];
 if(c)h+=`<div class="over">Челендж місяця</div><div class="card s12"><div class="t16">${esc(c.title)}</div>${bar(c.cur/c.goal*100)}<div class="t12 sec">${fmtNum(c.cur)} з ${fmtNum(c.goal)} ${{km:'км',days:'днів',hours:'год',workouts:'тренувань'}[c.metric]}</div></div>`;
 h+=`<div class="over">Міні-уроки</div><div class="hscroll">${LESSONS.map((l,k)=>`<button class="lesson" onclick="openSheet('lesson',${k})"><span class="ico a sm">${ic('book',18)}</span><div class="t16">${l.t}</div><div class="t12 ter">${l.m} читання</div></button>`).join('')}</div>`;
 return h}
async function toggleRide(btn,id){const r=st.rides.find(x=>x.id===id);const ps=r.ride_participants=r.ride_participants||[];const k=ps.findIndex(x=>x.user_id===st.me.id);
 await busy(btn,async()=>{if(k>=0){D(await sb.from('ride_participants').delete().eq('ride_id',id).eq('user_id',st.me.id));ps.splice(k,1)}else{D(await sb.from('ride_participants').insert({ride_id:id,user_id:st.me.id}));ps.push({user_id:st.me.id});toast('Ви в списку учасників')}});render()}
SHEETS.ride=id=>{const r=st.rides.find(x=>x.id===id);const g=(r.ride_participants||[]).map(x=>x.user_id);return {title:'Учасники',body:`<div class="s12"><div class="t14 sec">${esc(r.title)} · ${esc(rideWhen(r))}</div>${g.length?`<div class="list">${g.map(u=>li({left:avOf(u),t:esc(nameOf(u)),s:(memberById(u)||{}).group_name||'',right:''})).join('')}</div>`:emptyBox('Ще ніхто не відмітився')}</div>`}};
SHEETS.lesson=k=>({title:LESSONS[k].t,body:`<div class="s12"><div class="t12 ter">${LESSONS[k].m} читання</div><div class="t16" style="font-weight:400;line-height:24px">${LESSONS[k].body}</div></div>`,foot:`<button class="btn s" onclick="closeAll()">Зрозуміло</button>`});

/* chat: team + private with coach */
function msgBubble(m,showWho){const mine=m.sender_id===st.me.id;if(m.kind==='announce')return `<div class="note">${ic('mega',20)}<span><b style="color:var(--tx)">Оголошення тренера</b> · ${hhmm(m.created_at)}<br>${esc(m.body)}</span></div>`;
 return `<div class="msg ${mine?'me':'them'}">${!mine&&showWho?`<div class="who">${esc(nameOf(m.sender_id).split(' ')[0])} · ${hhmm(m.created_at)}</div>`:''}<span style="white-space:pre-line">${esc(m.body)}</span></div>`}
function chatBody(){const cid=coachId();
 let h=seg([['team','Команда'],['coach','Тренер']],st.chatSeg,'chatSeg');
 if(st.chatSeg==='coach')return h+dmThread(cid);
 return h+`<div class="s8" style="display:flex;flex-direction:column">${st.chat.length?st.chat.slice(-100).map(m=>msgBubble(m,true)).join(''):emptyBox('Напишіть першим','Тут спілкується вся команда')}</div>
 <div class="composer"><input class="inp" id="tchat" maxlength="4000" placeholder="Повідомлення команді" onkeydown="if(event.key==='Enter')sendTeam(this)"><button class="sendb" onclick="sendTeam(this)" aria-label="Надіслати">${ic('send',20)}</button></div>`}
function chatSeg(v){st.chatSeg=v;render()}
function dmWith(id){return st.dms.filter(m=>(m.sender_id===id&&m.recipient_id===st.me.id)||(m.sender_id===st.me.id&&m.recipient_id===id))}
function dmThread(id){if(!id)return emptyBox('Тренер ще не підключений');const th=dmWith(id);
 return `<div class="s8" style="display:flex;flex-direction:column">${th.length?th.map(m=>msgBubble(m,false)).join(''):emptyBox('Напишіть '+esc(nameOf(id).split(' ')[0]),'Особисте повідомлення бачите лише ви двоє')}</div>
 <div class="composer"><input class="inp" id="dmin" maxlength="4000" placeholder="Повідомлення" onkeydown="if(event.key==='Enter')sendDm(this,'${id}')"><button class="sendb" onclick="sendDm(this,'${id}')" aria-label="Надіслати">${ic('send',20)}</button></div>`}
async function sendTeam(el){const i=$('#tchat');const v=i.value.trim();if(!v)return;i.value='';try{const m=D(await sb.from('messages').insert({kind:'chat',body:v}).select().single());if(!st.chat.some(x=>x.id===m.id))st.chat.push(m);render();const n=$('#tchat');if(n)n.focus()}catch(e){i.value=v;fail(e)}}
async function sendDm(el,id){const i=$('#dmin');const v=i.value.trim();if(!v)return;i.value='';try{const m=D(await sb.from('messages').insert({kind:'dm',recipient_id:id,body:v}).select().single());if(!st.dms.some(x=>x.id===m.id))st.dms.push(m);render();renderSheet();const n=$('#dmin');if(n)n.focus()}catch(e){i.value=v;fail(e)}}
SHEETS.dm=id=>({title:esc(nameOf(id)),full:true,body:dmThread(id)});
