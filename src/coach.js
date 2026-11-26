/* ---------- COACH DATA ---------- */
async function loadCoach(){
 const from=dayIso(-4,0);
 const [profs,req,plans,logs,well,wts,notes,aw,unl,aiu]=await Promise.all([
  sb.from('profiles').select('*').order('full_name'),
  sb.from('change_requests').select('*').order('created_at',{ascending:false}).limit(200),
  sb.from('plan_weeks').select('*').gte('week_start',wkIso(-4)),
  sb.from('workout_logs').select('*').gte('day',from).order('day'),
  sb.from('wellness').select('*').gte('day',dayIso(-2,0)),
  sb.from('weights').select('*').gte('day',dayIso(-8,0)).order('day'),
  sb.from('coach_notes').select('*'),
  sb.from('awards').select('*'),
  sb.from('plan_unlocks').select('*'),
  sb.from('ai_usage').select('*').gte('day',wkIso(0))]);
 const coachIds=new Set(st.members.filter(m=>m.is_coach).map(m=>m.id));coachIds.add(st.me.id);
 st.allProfiles=D(profs);st.athletes=D(profs).filter(r=>!coachIds.has(r.id)).map(r=>{const p=toP(r);return {id:r.id,name:p.name,ini:p.ini,age:p.age,group:p.group,status:r.status,paused:!!r.paused,onboarded:r.onboarded,p}});
 st.requests=D(req);D(plans).forEach(r=>st.plans[r.athlete_id+'|'+r.week_start]=r);st.allLogs=D(logs);st.allWell=D(well);st.allWeights=D(wts);
 st.coachNote={};D(notes).forEach(n=>st.coachNote[n.athlete_id]=n.note);st.allAwards=D(aw);st.aiUse={};D(aiu).forEach(u=>{const o=st.aiUse[u.user_id]||(st.aiUse[u.user_id]={msgs:0,tokens:0});o.msgs+=u.msgs;o.tokens+=u.tokens});st.unlocks={};D(unl).forEach(u=>st.unlocks[u.athlete_id]=u);
}
function aStatus(a){const wl=st.allWell.filter(w=>w.athlete_id===a.id).sort((x,y)=>x.day<y.day?1:-1);const recent=wl.filter(w=>w.day>=dayIso(0,TODAY-2>=0?TODAY-2:0)||w.day>=iso(new Date(Date.now()-2*864e5)));
 const badW=recent.filter(w=>wellBad(w)>=2).length;const sk=st.allLogs.filter(l=>l.athlete_id===a.id&&l.status==='skipped'&&l.day>=iso(new Date(Date.now()-7*864e5)));
 const lastAny=st.allLogs.filter(l=>l.athlete_id===a.id).map(l=>l.day).concat(wl.map(w=>w.day)).sort().pop();
 const inj=sk.some(l=>/травм|хвор/.test(l.skip_reason||''));
 if(badW>=1||inj)return {s:'bad',reason:inj?'Пропуск: '+sk.find(l=>/травм|хвор/.test(l.skip_reason||'')).skip_reason:'Погане самопочуття'};
 if(sk.length>=2)return {s:'warn',reason:sk.length+' пропуски за тиждень'};
 if(!lastAny||lastAny<iso(new Date(Date.now()-5*864e5)))return {s:'warn',reason:lastAny?'Неактивний з '+fmtDate(parseIso(lastAny)):'Ще немає активності'};
 return {s:'ok',reason:'',last:lastAny}}
function lastSeen(a){const l=st.allLogs.filter(x=>x.athlete_id===a.id).map(x=>x.day).concat(st.allWell.filter(w=>w.athlete_id===a.id).map(w=>w.day)).sort().pop();if(!l)return 'немає активності';const d=Math.round((parseIso(dayIso(0,TODAY))-parseIso(l))/864e5);return d===0?'сьогодні':d===1?'вчора':d+' дн. тому'}

/* ---------- COACH: TEAM ---------- */
function cTeamView(){
 const pend=st.athletes.filter(a=>a.status==='pending');const act=st.athletes.filter(a=>a.status==='active');
 const kid=st.ctAge==='kid';let list=act.filter(a=>kid?a.age<18:a.age>=18);
 if(st.ctFilter==='attn')list=list.filter(a=>aStatus(a).s!=='ok');else if(st.ctFilter!=='all')list=list.filter(a=>a.group===st.ctFilter);
 const attn=act.filter(a=>aStatus(a).s!=='ok').length;
 let h=`<div class="stack">`;
 if(pend.length)h+=`<div class="s8"><div class="over">Нові заявки · ${pend.length}</div><div class="list">${pend.map(a=>`<div class="li"><span class="av sm">${esc(a.ini)}</span><div class="grow" style="min-width:0"><div class="t14 w6 ell">${esc(a.name)}</div><div class="t12 sec">${a.onboarded?(a.age<18?'Дитина, '+a.age+' р.':a.age+' р.')+' · анкету заповнено':'ще заповнює анкету'}</div></div><button class="ib" onclick="openSheet('athlete','${a.id}')" aria-label="Анкета">${ic('user',20)}</button><button class="btn p sm" style="width:auto;flex-shrink:0" onclick="approve(this,'${a.id}')">Прийняти</button></div>`).join('')}</div></div>`;
 const wc=act.map(a=>weekCompl(a.id,0));const avg=wc.length?Math.round(wc.reduce((x,y)=>x+y.pct,0)/wc.length):0;
 h+=`<div class="grid3"><div class="tile"><div class="v">${act.length}</div><div class="l">спортсменів</div></div><div class="tile"><div class="v">${avg}%</div><div class="l">план тижня</div></div><div class="tile"><div class="v ${attn?'c-warn':''}">${attn}</div><div class="l">увага</div></div></div>`;
 h+=seg([['adult','Дорослі'],['kid','Діти']],st.ctAge,'ctAge')+chipRow([['all','Усі'],['attn','Потребують уваги'],['Шосе','Шосе'],['Тріатлон','Тріатлон'],['Новачки','Новачки'],['Діти','Діти']],st.ctFilter,'ctFilter',true);
 h+=list.length?`<div class="list">${list.map(a=>{const s=aStatus(a);const c=weekCompl(a.id,0);return `<button class="li" onclick="openSheet('athlete','${a.id}')"><span class="av sm">${esc(a.ini)}</span><div class="grow"><div class="row"><span class="sd ${s.s==='ok'?'ok':s.s}"></span><span class="t14 w6 ell">${esc(a.name)}</span></div><div class="t12 sec ell">${s.reason||a.group+' · '+lastSeen(a)}</div></div><div class="t14 num ${c.pct>=80?'c-ok':''}">${c.dn}/${c.tr}</div><span class="chev">${ic('chev',20)}</span></button>`}).join('')}</div>`:emptyBox(act.length?'Нікого в цьому фільтрі':'Спортсменів ще немає','Поділіться посиланням на застосунок: нові заявки зʼявляться тут');
 h+=`<div class="list">${li({left:`<span class="ico a">${ic('chart',20)}</span>`,t:'Тижневий звіт',s:weekRange(0)+' · виконання, пропуски, самопочуття',on:"openSheet('report')"})}${li({left:`<span class="ico">${ic('book',20)}</span>`,t:'Бібліотека тренувань',s:LIB.length+' тренувань · призначення і .zwo',on:"openSheet('lib')"})}${li({left:`<span class="ico">${ic('link',20)}</span>`,t:'Запросити в команду',s:'Скопіювати посилання на застосунок',on:"shareInvite()"})}</div>`;
 return h+'</div>'}
function ctAge(v){st.ctAge=v;render()}
function ctFilter(v){st.ctFilter=v;render()}
function shareInvite(){if(typeof openInvite==='function')openInvite();else{const url=location.origin+location.pathname;navigator.clipboard&&navigator.clipboard.writeText(url).then(()=>toast('Посилання скопійовано'))}}
async function approve(btn,id){await busy(btn,async()=>{const pr=st._pr&&st._pr.id===id?st._pr:null;
 if(pr&&(pr.member.size||pr.coach.size)){const {error}=await sb.from('profiles').update({invite_member:[...pr.member],invite_coach:[...pr.coach]}).eq('id',id);if(error)console.warn(error)}
 D(await sb.from('profiles').update({status:'active'}).eq('id',id));const a=st.athletes.find(x=>x.id===id);if(a){a.status='active';a.p.status='active'}
 if(typeof refreshPeople==='function')await refreshPeople();else{await loadMembers();await loadSections()}
 closeAll();toast((a?a.name:'Людину')+' прийнято в команду')})}
async function setAthlete(btn,id,fields,msg){await busy(btn,async()=>{const r=D(await sb.from('profiles').update(fields).eq('id',id).select().single());const a=st.athletes.find(x=>x.id===id);const p=toP(r);Object.assign(a,{name:p.name,group:p.group,status:r.status,p});await loadMembers();render();renderSheet();toast(msg||'Збережено')})}

/* athlete card */
SHEETS.athlete=id=>{const a=st.athletes.find(x=>x.id===id);if(!a)return {title:'',body:''};const p=a.p;const s=aStatus(a);
 const segs=[['plan','План'],['data','Дані'],['form','Анкета'],['notes','Нотатки']];
 let b=`<div class="stack"><div class="row12"><span class="av lg">${esc(a.ini)}</span><div class="grow"><div class="t20">${esc(a.name)}</div><div class="t14 sec">${a.age} р. · ${esc(a.group)}${p.city?' · '+esc(p.city):''} · ${a.status==='pending'?'заявка':a.status==='blocked'?'заблоковано':lastSeen(a)}</div></div></div>
 ${s.s!=='ok'&&a.status==='active'?`<div class="note ${s.s==='bad'?'warn':''}">${ic('alert',20)}<span>${esc(s.reason)}</span></div>`:''}
 ${p.health&&(p.health.inj||[]).filter(x=>x!=='Немає').length||p.health&&p.health.bp==='high'||p.health&&p.health.notes?`<div class="note warn">${ic('info',20)}<span>Здоровʼя: ${esc([(p.health.inj||[]).filter(x=>x!=='Немає').join(', '),p.health.bp==='high'?'підвищений тиск':p.health.bp==='low'?'знижений тиск':'',p.health.notes].filter(Boolean).join(' · '))}</span></div>`:''}
 ${seg(segs,st.cardSeg,'cardSeg')}`;
 if(st.cardSeg==='plan'){const wk=st._cwk||0;const {days,locked}=weekPlan(id,wk);const unl=st.unlocks[id]&&new Date(st.unlocks[id].until)>new Date();
  b+=`${seg([['0','Цей тиждень'],['1','Наступний']],String(wk),'cwk')}<div class="t12 ter">${weekRange(wk)}${locked?' · змінено тренером':''}${unl?' · спортсмену дозволено редагувати':''}</div>
  <div class="list">${days.map(d=>{const it=d.items[0];const done=isDone(id,wk,d.i),sk=isSkip(id,wk,d.i);const lg=logsOn(dayIso(wk,d.i),id).find(l=>l.status==='done');
   return `<button class="li ${d.rest?'dim':''}" onclick="openSheet('editDay',{pid:'${id}',wk:${wk},i:${d.i}})"><div class="dayc"><b>${DAYS[d.i]}</b><span>${dayDate(wk,d.i).getDate()}</span></div><div class="grow"><div class="t14 w6 ell">${d.rest?'Відпочинок':esc(d.items.map(itemName).join(' + '))}</div><div class="t12 sec ell">${d.rest?'':fmtMin(dayMin(d))}${lg?' · факт: '+fmtMin(lg.duration_min||0)+(lg.np||lg.avg_power?' · '+(lg.np||lg.avg_power)+' Вт':'')+(lg.rpe?' · RPE '+lg.rpe:''):''}${sk?' · пропуск: '+esc(sk):''}</div></div>${done?`<span class="c-ok">${ic('check',18)}</span>`:sk?tag('пропуск','warn'):`<span class="acc">${ic('edit',18)}</span>`}</button>`}).join('')}</div>
  <div class="t12 ter">Торкніться дня, щоб змінити тренування. Після ваших змін спортсмен не зможе перебудувати тиждень сам.</div>
  <button class="btn s" onclick="regenFor(this,'${id}',${wk})">${ic('refresh',20)} Згенерувати тиждень заново</button>`}
 else if(st.cardSeg==='data'){const L=st.allLogs.filter(l=>l.athlete_id===id).slice(-12).reverse();const W=st.allWell.filter(w=>w.athlete_id===id).sort((x,y)=>x.day<y.day?1:-1).slice(0,7);const wt=(st.allWeights||[]).filter(w=>w.athlete_id===id);
  b+=`<div class="grid3"><div class="tile"><div class="v">${p.form.ftp||'—'}</div><div class="l">FTP</div></div><div class="tile"><div class="v">${wt.length?String(wt[wt.length-1].kg).replace('.',','):String(p.weight).replace('.',',')}</div><div class="l">вага, кг</div></div><div class="tile"><div class="v">${weekCompl(id,0).pct}%</div><div class="l">план</div></div></div>
  <div class="over">Самопочуття</div>${W.length?`<div class="list">${W.map(w=>`<div class="li" style="min-height:44px"><div class="grow t14">${fmtDate(parseIso(w.day))}</div><div class="t12 sec">сон ${['погано','норм','добре'][w.sleep]} · енергія ${['мало','норм','багато'][w.energy]} · ноги ${['важкі','норм','свіжі'][w.legs]}</div>${wellBad(w)>=2?`<span class="sd bad"></span>`:''}</div>`).join('')}</div>`:`<div class="t14 ter">Немає відміток</div>`}
  <div class="over">Останні тренування</div>${L.length?`<div class="list">${L.map(l=>`<div class="li">${sportIco(l.sport)}<div class="grow"><div class="t14 w6 ell">${esc(l.title||'')}</div><div class="t12 sec">${fmtDate(parseIso(l.day))} · ${l.status==='skipped'?'пропуск: '+esc(l.skip_reason||''):fmtMin(l.duration_min||0)+(l.distance?' · '+l.distance+(l.sport==='swim'?' м':' км'):'')+(l.avg_hr?' · '+l.avg_hr+' уд/хв':'')+(l.note?' · «'+esc(l.note)+'»':'')}</div></div>${l.file_path?`<button class="ib" onclick="dlFile('${l.file_path}')" aria-label="Файл">${ic('download',18)}</button>`:''}</div>`).join('')}</div>`:`<div class="t14 ter">Немає тренувань</div>`}`}
 else if(st.cardSeg==='form'){const sp=Object.keys(p.sports).filter(k=>p.sports[k].on);
  b+=`<div class="list">${[['Види спорту',sp.map(k=>SPORT[k].n+' ('+LEVEL[p.sports[k].level]+(p.sports[k].own?', свій тренер':'')+')').join(', ')||'—'],['Цілі',p.goals.map(g=>GOALS[g]).join(', ')],['Цілі в цифрах',[p.targets.ftp?'FTP '+p.targets.ftp+' Вт':'',p.targets.weight?'вага '+p.targets.weight+' кг':'',p.targets.raceDate?'старт '+p.targets.raceDate:''].filter(Boolean).join(', ')||'—'],
   ['Розклад',p.days.map((d,i)=>d.acts.length?DAYS[i]+' '+fmtMin(d.min):'').filter(Boolean).join(' · ')||'—'],['Інвентар',p.equip.map(e=>EQUIP[e]).join(', ')||'—'],['Форма',[p.form.ftp?'FTP '+p.form.ftp:'',p.form.hrRest?'ЧСС спокою '+p.form.hrRest:'',p.form.hrMax?'макс. '+p.form.hrMax:'',p.form.run5k?'5 км '+p.form.run5k:'',p.form.swim1500?'1500 м '+p.form.swim1500:''].filter(Boolean).join(', ')||'невідомо, тест у 1-й тиждень'],
   ['Зріст / вага',p.height+' см / '+String(p.weight).replace('.',',')+' кг'],['Старти',(p.races||[]).map(r=>r.name+' '+r.date).join(', ')||'—']].map(x=>`<div class="li"><div class="grow"><div class="t12 ter">${x[0]}</div><div class="t14">${esc(x[1])}</div></div></div>`).join('')}</div>`}
 else{b+=`<div class="field"><label>Нотатки тренера (бачите лише ви)</label><textarea class="inp" id="cnote" rows="5" placeholder="Наприклад: втомлюється на роботі, не давити обʼємом">${esc(st.coachNote[id]||'')}</textarea></div><button class="btn s" onclick="saveNote(this,'${id}')">Зберегти нотатку</button>
  <div class="field"><label>Група</label>${seg([['Шосе','Шосе'],['Тріатлон','Тріатлон'],['Новачки','Новачки'],['Діти','Діти']],a.group,`(v=>setAthlete(null,'${id}',{group_name:v},'Групу змінено'))`)}</div>
  <div class="list">${li({left:`<span class="ico a">${ic('trophy',20)}</span>`,t:'Нагородити досягненням',s:(st.allAwards||[]).filter(x=>x.athlete_id===id).length+' нагород від вас',on:`openSheet('award','${id}')`})}${li({left:`<span class="ico">${ic('msg',20)}</span>`,t:'Написати',s:'Особисте повідомлення',on:`openSheet('dm','${id}')`})}${li({left:`<span class="ico">${ic('lock',20)}</span>`,t:'Скинути пароль',s:'Створити тимчасовий пароль для входу',on:`resetPw(this,'${id}')`})}
  ${a.status==='blocked'?li({left:`<span class="ico">${ic('unlock',20)}</span>`,t:'Розблокувати',on:`setAthlete(this,'${id}',{status:'active'},'Розблоковано')`}):li({left:`<span class="ico">${ic('x',20)}</span>`,t:a.status==='pending'?'Відхилити заявку':'Заблокувати доступ до команди',s:'Спортсмен не бачитиме стрічку і чат',on:`if(confirm('Підтвердити?'))setAthlete(this,'${id}',{status:'blocked'},'Доступ закрито')`})}</div>`}
 if(a.status==='pending'){if(!st._pr||st._pr.id!==id)st._pr={id,coach:new Set(p.inviteCoach||[]),member:new Set(p.inviteMember||[])};b+=`<div class="over">Секції після підтвердження</div>${prGrid()}<div class="t12 ter">За замовчуванням — спортсмен. Підтвердження лише вами, не автоматично.</div>`}
 return {title:esc(a.name),full:true,body:b+'</div>',foot:a.status==='pending'?`<button class="btn p" onclick="approve(this,'${id}')">Прийняти в команду</button>`:''}};
function cardSeg(v){st.cardSeg=v;renderSheet()}
async function cwk(v){st._cwk=+v;renderSheet()}
async function regenFor(btn,id,wk){if(!confirm('Перегенерувати тиждень із розкладу спортсмена?'))return;await busy(btn,async()=>{const p=athleteP(id);const g=genFor(p,wk,1);await savePlan(id,wk,g.days,{scale:g.scale,note:g.note});renderSheet();toast('План оновлено')})}
async function saveNote(btn,id){await busy(btn,async()=>{const note=$('#cnote').value;D(await sb.from('coach_notes').upsert({athlete_id:id,note,updated_at:new Date().toISOString()}));st.coachNote[id]=note;toast('Нотатку збережено')})}
async function dlFile(path){try{const {data,error}=await sb.storage.from('activity-files').createSignedUrl(path,300);if(error)throw error;window.open(data.signedUrl,'_blank')}catch(e){fail(e)}}
async function resetPw(btn,id){if(!confirm('Створити новий тимчасовий пароль? Старий перестане працювати.'))return;await busy(btn,async()=>{const {data,error}=await sb.functions.invoke('account',{body:{action:'coach_set_password',athlete_id:id}});if(error||!data.ok)throw new Error('Не вдалося');st._tempPw={id,pw:data.password};openSheet('tempPw')})}
SHEETS.tempPw=()=>({title:'Тимчасовий пароль',body:`<div class="stack"><div class="t14 sec">Передайте спортсмену ${esc(nameOf(st._tempPw.id))}. Після входу він змінить пароль у профілі.</div><div class="card"><div class="t20 num" style="user-select:all">${esc(st._tempPw.pw)}</div></div></div>`,foot:`<button class="btn s" onclick="navigator.clipboard&&navigator.clipboard.writeText('${st._tempPw?st._tempPw.pw:''}');toast('Скопійовано')">Скопіювати</button>`});

/* award */
SHEETS.award=id=>({title:'Нагородити',full:true,body:`<div class="stack"><div class="field"><label>Своє досягнення</label><input class="inp" id="awn" maxlength="60" placeholder="Наприклад: Залізна воля"></div><div class="field"><label>За що</label><input class="inp" id="awd" maxlength="140" placeholder="Проїхав Гран Фондо під дощем"></div>
 <button class="btn p" onclick="giveAward(this,'${id}')">${ic('trophy',20)} Вручити</button><div class="over">Або оберіть зі списку</div>
 <div class="list">${ACH.map(a=>`<button class="li" onclick="giveAward(this,'${id}','${a.id}')"><span class="ico sm">${ic(a.icon,18)}</span><div class="grow"><div class="t14 w6 ell">${esc(a.name)}</div><div class="t12 sec ell">${esc(a.desc)}</div></div></button>`).join('')}</div></div>`});
async function giveAward(btn,id,achId){const a=achId?ACH.find(x=>x.id===achId):null;const name=a?a.name:($('#awn').value||'').trim();if(!name)return toast('Вкажіть назву','info');
 await busy(btn,async()=>{const r=D(await sb.from('awards').insert({athlete_id:id,achievement_id:achId||null,name,description:a?a.desc:($('#awd').value||'').trim(),icon:a?a.icon:'star'}).select().single());(st.allAwards=st.allAwards||[]).push(r);closeSheet();toast('Нагороду вручено: '+name)})}

/* weekly report */
SHEETS.report=()=>{const act=st.athletes.filter(a=>a.status==='active');const rows=act.map(a=>{const c=weekCompl(a.id,0);const sk=st.allLogs.filter(l=>l.athlete_id===a.id&&l.status==='skipped'&&l.day>=dayIso(0,0)).length;const L=st.allLogs.filter(l=>l.athlete_id===a.id&&l.status==='done'&&l.day>=dayIso(0,0));const min=L.reduce((x,l)=>x+(l.duration_min||0),0);return {a,c,sk,min,ai:(st.aiUse&&st.aiUse[a.id])||{msgs:0,tokens:0},s:aStatus(a)}}).sort((x,y)=>y.c.pct-x.c.pct);
 const tot=rows.reduce((x,r)=>x+r.min,0);const aiAll=Object.values(st.aiUse||{}).reduce((x,u)=>({m:x.m+u.msgs,t:x.t+u.tokens}),{m:0,t:0});const aiCost=aiAll.t*0.0000013;const avg=rows.length?Math.round(rows.reduce((x,r)=>x+r.c.pct,0)/rows.length):0;
 const txt='Звіт '+weekRange(0)+'\n'+rows.map(r=>r.a.name+': '+r.c.dn+'/'+r.c.tr+' ('+r.c.pct+'%), '+fmtMin(r.min)+(r.sk?', пропусків '+r.sk:'')).join('\n');st._reportTxt=txt;
 return {title:'Тижневий звіт',full:true,body:`<div class="stack"><div class="t14 sec">${weekRange(0)} · станом на ${DAYS_FULL[TODAY].toLowerCase()}</div>
 <div class="grid3"><div class="tile"><div class="v">${avg}%</div><div class="l">сер. виконання</div></div><div class="tile"><div class="v">${fmtNum(tot/60)}</div><div class="l">годин разом</div></div><div class="tile"><div class="v">${rows.filter(r=>r.s.s!=='ok').length}</div><div class="l">увага</div></div></div>
 <div class="note">${ic('spark',20)}<span>АІ-асистент цього тижня: <b style="color:var(--tx)">${aiAll.m}</b> запитань, ≈ $${aiCost.toFixed(2)}</span></div>
 ${rows.length?`<div class="list">${rows.map(r=>`<button class="li" onclick="openSheet('athlete','${r.a.id}')"><span class="sd ${r.s.s==='ok'?'ok':r.s.s}"></span><div class="grow"><div class="t14 w6 ell">${esc(r.a.name)}</div><div class="t12 sec">${fmtMin(r.min)}${r.sk?' · пропусків '+r.sk:''}${r.ai.msgs?' · АІ: '+r.ai.msgs:''}${r.s.reason?' · '+esc(r.s.reason):''}</div></div><div class="t14 num">${r.c.dn}/${r.c.tr}</div></button>`).join('')}</div>`:emptyBox('Немає активних спортсменів')}</div>`,
 foot:`<button class="btn s" onclick="copyReport()">${ic('share',20)} Скопіювати звіт</button>`}};
async function copyReport(){try{if(navigator.share)await navigator.share({text:st._reportTxt});else{await navigator.clipboard.writeText(st._reportTxt);toast('Звіт скопійовано')}}catch(e){}}

/* ---------- COACH: REQUESTS ---------- */
function cReqView(){const pend=st.requests.filter(r=>r.status==='pending');const done=st.requests.filter(r=>r.status!=='pending').slice(0,20);
 let h=`<div class="stack"><div class="over">Очікують · ${pend.length}</div>`;
 h+=pend.length?pend.map(r=>{const old=Date.now()-new Date(r.created_at)>864e5;return `<div class="card s12"><div class="row12">${avOf(r.athlete_id)}<div class="grow"><div class="t14 w6">${esc(nameOf(r.athlete_id))}</div><div class="t12 ter">${ago(r.created_at)}</div></div>${old?tag('24+ год','warn'):''}</div>
  <div class="t16">${esc(r.kind)}</div>${r.body?`<div class="t14 sec">${esc(r.body)}</div>`:''}
  ${old?`<div class="note">${ic('spark',20)}<span>Спортсмену вже запропоновано безпечний варіант AI: обсяг 60%, лише зона 2.</span></div>`:''}
  <div class="row"><button class="btn s sm grow" onclick="decide(this,${r.id},'rejected')">Відхилити</button><button class="btn s sm grow" onclick="editForReq(${r.id})">Змінити план</button><button class="btn p sm grow" onclick="decide(this,${r.id},'approved')">Дозволити</button></div></div>`}).join(''):emptyBox('Нових запитів немає','Коли спортсмен попросить змінити план, запит зʼявиться тут');
 const apps=st.athletes.filter(a=>a.status==='pending');
 if(apps.length)h+=`<div class="over">Заявки в команду · ${apps.length}</div><div class="list">${apps.map(a=>{const im=(a.p&&a.p.inviteMember)||[],ic_=(a.p&&a.p.inviteCoach)||[];const sub=!a.onboarded?'анкета не заповнена':(im.length||ic_.length?SEC_ORDER.filter(s=>im.includes(s)||ic_.includes(s)).map(s=>secInfo(s).name+(ic_.includes(s)?' · тренер':'')).join(', '):'Анкету заповнено');return `<button class="li" onclick="openSheet('athlete','${a.id}')"><span class="av sm">${esc(a.ini)}</span><div class="grow"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="t16 ell">${esc(a.name)}</span>${a.onboarded?'':'<span class="rb pz">анкета не заповнена</span>'}</div><div class="t12 sec ell">${esc(sub)}</div></div><span class="chev">${ic('chev',20)}</span></button>`}).join('')}</div>`;
 if(done.length)h+=`<div class="over">Історія</div><div class="list">${done.map(r=>`<div class="li"><div class="grow"><div class="t14 w6 ell">${esc(nameOf(r.athlete_id))}: ${esc(r.kind)}</div><div class="t12 sec ell">${esc(r.body||'')}</div></div>${tag(REQ_ST[r.status][0],REQ_ST[r.status][1])}</div>`).join('')}</div>`;
 return h+'</div>'}
async function decide(btn,id,status){await busy(btn,async()=>{const r=D(await sb.from('change_requests').update({status}).eq('id',id).select().single());Object.assign(st.requests.find(x=>x.id===id),r);
 if(status==='approved'){const u=await sb.from('plan_unlocks').select('*').eq('athlete_id',r.athlete_id).maybeSingle();if(u.data)st.unlocks[r.athlete_id]=u.data}render();toast(status==='approved'?'Дозволено: спортсмен може редагувати план 7 днів':'Запит відхилено')})}
function editForReq(id){const r=st.requests.find(x=>x.id===id);st._editReq=id;st.cardSeg='plan';st._cwk=0;openSheet('athlete',r.athlete_id)}
const _saveEdit0=saveEdit;
saveEdit=async function(btn){const req=st._editReq;await _saveEdit0(btn);if(isCoach()&&req){st._editReq=null;try{const r=D(await sb.from('change_requests').update({status:'edited'}).eq('id',req).select().single());Object.assign(st.requests.find(x=>x.id===req),r);render()}catch(e){fail(e)}}};

/* ---------- COACH: LIBRARY ---------- */
function cLibView(){return libBody()}
SHEETS.assign=wid=>{const w=libById(wid);const act=st.athletes.filter(a=>a.status==='active');st._as=st._as||{day:TODAY,ids:[]};
 return {title:'Призначити: '+esc(w.name),full:true,body:`<div class="stack"><div class="field"><label>День (цей тиждень)</label><div class="chips">${DAYS.map((d,i)=>`<button class="chip ${st._as.day===i?'on':''}" onclick="st._as.day=${i};renderSheet()">${d} ${dayDate(0,i).getDate()}</button>`).join('')}</div></div>
 <div class="over">Кому</div>${act.length?`<div class="list">${act.map(a=>{const on=st._as.ids.includes(a.id);return `<button class="li" onclick="asT('${a.id}')"><span class="av sm">${esc(a.ini)}</span><div class="grow t14 w6">${esc(a.name)}</div><span class="tg ${on?'on':''}"></span></button>`}).join('')}</div>`:emptyBox('Немає активних спортсменів')}</div>`,
 foot:`<button class="btn p" ${st._as.ids.length?'':'disabled'} onclick="doAssign(this,'${wid}')">Призначити (${st._as.ids.length})</button>`}};
function asT(id){const a=st._as.ids;const k=a.indexOf(id);if(k>=0)a.splice(k,1);else a.push(id);renderSheet()}
async function doAssign(btn,wid){const w=libById(wid);await busy(btn,async()=>{for(const id of st._as.ids){const days=weekPlan(id,0).days.map(d=>({i:d.i,items:d.items.slice(),tod:d.tod}));days[st._as.day].items=[{sport:w.sport,w:w.id,min:w.dur,coach:true}];await savePlan(id,0,days)}
 const n=st._as.ids.length;st._as=null;closeAll();render();toast('Призначено '+n+' спортсменам')})}

/* ---------- COACH: EVENTS ---------- */
function cEventsView(){
 let h=`<div class="stack"><div class="list">${li({left:`<span class="ico a">${ic('plus',20)}</span>`,t:'Новий командний заїзд',on:"openSheet('newRide')"})}${li({left:`<span class="ico">${ic('flag',20)}</span>`,t:'Новий челендж місяця',on:"openSheet('newCh')"})}${li({left:`<span class="ico">${ic('mega',20)}</span>`,t:'Оголошення для всіх',s:'Прийде сповіщенням кожному',on:"openSheet('announce')"})}</div>
 <div class="over">Заїзди</div>`;
 h+=st.rides.length?st.rides.map(r=>{const g=(r.ride_participants||[]).map(x=>x.user_id);return `<div class="card s12"><div class="between"><div class="t16">${esc(r.title)}</div><button class="ib" onclick="delRide(${r.id})" aria-label="Видалити">${ic('x',18)}</button></div><div class="t14 sec">${esc(rideWhen(r))}${r.details?' · '+esc(r.details):''}</div><button class="row" style="background:none;border:0;min-height:44px;color:inherit" onclick="openSheet('ride',${r.id})"><div class="avstack">${g.slice(0,6).map(id=>avOf(id)).join('')}</div><span class="t12 sec">${g.length} їдуть</span></button><button class="btn ${g.includes(st.me.id)?'s':'p'} sm" style="align-self:flex-start" onclick="toggleRide(this,${r.id})">${g.includes(st.me.id)?ic('check',18)+' Їду':ic('plus',18)+' їду'}</button></div>`}).join(''):emptyBox('Заїздів ще немає');
 h+=`<div class="over">Челенджі</div>`+(st.challenges.length?st.challenges.map(c=>`<div class="card s12"><div class="between"><div class="t16">${esc(c.title)}</div><button class="ib" onclick="delCh(${c.id})" aria-label="Видалити">${ic('x',18)}</button></div>${bar(c.cur/c.goal*100)}<div class="t12 sec">${fmtNum(c.cur||0)} з ${fmtNum(c.goal)} ${{km:'км',days:'днів',hours:'год',workouts:'тренувань'}[c.metric]} · ${MON_GEN[parseIso(c.month).getMonth()]}</div></div>`).join(''):emptyBox('Челенджів ще немає'));
 return h+'</div>'}
SHEETS.newRide=()=>({title:'Командний заїзд',body:`<div class="stack"><div class="field"><label>Назва</label><input class="inp" id="nrt" maxlength="80" placeholder="Затока, 120 км"></div><div class="field"><label>Дата і час</label><input class="inp" id="nrd" type="datetime-local"></div><div class="field"><label>Деталі</label><input class="inp" id="nrx" maxlength="200" placeholder="Збір біля Аркадії, темп 28–30"></div></div>`,foot:`<button class="btn p" onclick="addRide(this)">Створити</button>`});
async function addRide(btn){const t=$('#nrt').value.trim(),d=$('#nrd').value;if(!t||!d)return toast('Вкажіть назву і дату','info');await busy(btn,async()=>{const r=D(await sb.from('rides').insert({title:t,details:$('#nrx').value.trim(),starts_at:new Date(d).toISOString()}).select('*, ride_participants(user_id)').single());st.rides.push(r);st.rides.sort((a,b)=>a.starts_at<b.starts_at?-1:1);
 await sb.from('messages').insert({kind:'announce',body:'Новий командний заїзд: '+t+', '+rideWhen(r)+'. Відмічайтесь «+ їду» у вкладці Події.'});closeAll();render();toast('Заїзд створено')})}
async function delRide(id){if(!confirm('Видалити заїзд?'))return;try{D(await sb.from('rides').delete().eq('id',id));st.rides=st.rides.filter(r=>r.id!==id);render()}catch(e){fail(e)}}
SHEETS.newCh=()=>{st._chg=st._chg||{metric:'km',goal:1000};return {title:'Челендж місяця',body:`<div class="stack"><div class="field"><label>Назва</label><input class="inp" id="nct" maxlength="80" placeholder="1000 км командою за ${MON_GEN[NOW.getMonth()].replace(/я$/,'ь')}"></div>
 <div class="field"><label>Що рахуємо</label>${seg([['km','Кілометри'],['hours','Години'],['workouts','Тренування'],['days','Дні']],st._chg.metric,"(v=>{st._chg.metric=v;renderSheet()})")}</div>
 ${nf({id:'ncg',label:'Мета команди',val:st._chg.goal,min:1,max:20000,step:1,set:v=>st._chg.goal=v})}</div>`,foot:`<button class="btn p" onclick="addCh(this)">Створити</button>`}};
async function addCh(btn){const t=$('#nct').value.trim();if(!t)return toast('Вкажіть назву','info');await busy(btn,async()=>{const c=D(await sb.from('challenges').insert({title:t,metric:st._chg.metric,goal:st._chg.goal}).select().single());c.cur=(await sb.rpc('challenge_progress',{cid:c.id})).data||0;st.challenges.unshift(c);st._chg=null;closeAll();render();toast('Челендж створено')})}
async function delCh(id){if(!confirm('Видалити челендж?'))return;try{D(await sb.from('challenges').delete().eq('id',id));st.challenges=st.challenges.filter(c=>c.id!==id);render()}catch(e){fail(e)}}
SHEETS.announce=()=>({title:'Оголошення',body:`<div class="stack"><textarea class="inp" id="ann" rows="4" maxlength="2000" placeholder="Субота: командний заїзд на Затоку, збір 7:45 біля Аркадії"></textarea><div class="t12 ter">Зʼявиться в командному чаті і прийде сповіщенням усім активним учасникам</div></div>`,foot:`<button class="btn p" onclick="sendAnn(this)">Надіслати всім</button>`});
async function sendAnn(btn){const t=$('#ann').value.trim();if(!t)return;await busy(btn,async()=>{const m=D(await sb.from('messages').insert({kind:'announce',body:t}).select().single());if(!st.chat.some(x=>x.id===m.id))st.chat.push(m);closeAll();render();toast('Оголошення надіслано')})}

/* ---------- COACH: CHATS ---------- */
function cChatView(){const people=st.athletes.filter(a=>a.status!=='blocked');
 let h=`<div class="stack">${seg([['team','Команда'],['dm','Особисті']],st.chatSeg==='coach'?'dm':st.chatSeg,'cChatSeg')}`;
 if(st.chatSeg==='team')return h+`<div class="s8" style="display:flex;flex-direction:column">${st.chat.length?st.chat.slice(-100).map(m=>msgBubble(m,true)).join(''):emptyBox('Командний чат порожній')}</div>
 <div class="composer"><input class="inp" id="tchat" maxlength="4000" placeholder="Повідомлення команді" onkeydown="if(event.key==='Enter')sendTeam(this)"><button class="sendb" onclick="sendTeam(this)" aria-label="Надіслати">${ic('send',20)}</button></div></div>`;
 const rows=people.map(a=>{const th=dmWith(a.id);const last=th[th.length-1];return {a,last}}).sort((x,y)=>(y.last?y.last.created_at:'')>(x.last?x.last.created_at:'')?1:-1);
 return h+(rows.length?`<div class="list">${rows.map(r=>li({left:`<span class="av sm">${esc(r.a.ini)}</span>`,t:esc(r.a.name),s:r.last?(r.last.sender_id===st.me.id?'Ви: ':'')+esc(r.last.body):'Немає повідомлень',on:`openSheet('dm','${r.a.id}')`,right:r.last?`<span class="t12 ter">${ago(r.last.created_at)}</span>`:''})).join('')}</div>`:emptyBox('Спортсменів ще немає'))+'</div>'}
function cChatSeg(v){st.chatSeg=v==='dm'?'dm':'team';render()}
