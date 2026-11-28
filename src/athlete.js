/* ---------- WORKOUT HELPERS ---------- */
const pct=x=>Math.round(x*100)+'%';
function wattsTxt(p,ftp){return ftp?Math.round(p*ftp)+' Вт':pct(p)}
function segText(s,w,ftp,prof){
 const bike=w.sport==='bike';const W=x=>bike?wattsTxt(x,ftp):intTxt(x,w.sport);const hrOk=prof&&(w.sport==='bike'||w.sport==='run');
 if(s.t==='w')return ['Розминка',fmtMin(s.d/60),bike?W(s.lo)+' → '+W(s.hi):'легко',hrOk?hrUpTo(s.hi,prof):''];
 if(s.t==='c')return ['Заминка',fmtMin(s.d/60),bike?W(s.lo)+' → '+W(s.hi):'легко',hrOk?hrUpTo(s.lo,prof):''];
 if(s.t==='s')return [zoneName(s.p,w.sport),fmtMin(s.d/60),W(s.p),hrOk?hrFor(s.p,prof):''];
 const dd=x=>x<60?x+' с':(x%60?Math.floor(x/60)+' хв '+x%60+' с':x/60+' хв');
 return [s.n+' × ('+dd(s.on)+' / '+dd(s.off)+')',fmtMin(s.n*(s.on+s.off)/60),W(s.onP)+' / '+W(s.offP),hrOk?hrFor(s.onP,prof):''];
}
function zoneName(p,sp){if(sp==='gym')return p<.5?'Розтяжка':'Робочі підходи';return p<.56?'Відновлення':p<.76?'Витривалість':p<.9?'Темп':p<1.05?'Поріг':p<1.2?'VO2max':'Анаеробна'}
function intTxt(p,sp){if(sp==='gym')return p>.7?'RPE 8':'RPE 6';return zoneName(p,sp).toLowerCase()}
function itemW(it){return it&&it.w?libById(it.w):null}
function itemName(it){const w=itemW(it);return w?w.name:(it.section?SPORT[it.sport].n+' · план тренера секції':it.log?SPORT[it.sport].n+' · свій тренер':it.title||SPORT[it.sport].n)}

function workoutCard(d,pid,wk,big){
 const it=d.items[0];const w=itemW(it);
 if(!w)return `<div class="card"><div class="row12">${sportIco(it.sport)}<div class="grow"><div class="t16">${esc(itemName(it))}</div><div class="t12 sec">${fmtMin(it.min)}${it.section?' · завдання на дошці секції':it.log?' · ми лише фіксуємо тренування':''}</div></div></div></div>`;
 return `<div class="card ${big?'hl':''} tapc" onclick="openSheet('wk',{pid:'${pid}',wk:${wk},i:${d.i},j:0})">
  <div class="between"><span class="tag a">${ic(SPORT[w.sport].i,14)} ${SPORT[w.sport].n} · ${catName(w.sport,w.cat)}</span><span class="t12 ter">${TOD[d.tod]||''}</span></div>
  <div class="t20" style="margin-top:12px">${esc(w.name)}</div>
  <div class="t14 sec" style="margin-top:4px">${fmtMin(it.min||w.dur)}${w.sport==='bike'?' · '+wTSS(w)+' TSS':''} · ${esc(w.goal)}</div>
  <div style="margin-top:16px">${wChart(w,big?64:44)}</div>
  ${d.items.length>1?`<div class="row t14 sec" style="margin-top:12px">${ic('plus',16)} ${d.items.slice(1).map(x=>esc(itemName(x))).join(', ')}</div>`:''}
 </div>`}

/* ---------- TODAY ---------- */
const WQ=[['Як ви спали?',['Погано','Нормально','Добре']],['Скільки енергії?',['Мало','Нормально','Багато']],['Як ноги?',['Важкі','Нормально','Свіжі']]];
function pendingBanner(){return st.me.status==='pending'?`<div class="note">${ic('clock',20)}<span>Тренер ще не підтвердив вашу участь. План і щоденник уже працюють, стрічка і чат команди відкриються після підтвердження.</span></div>`:''}
function todayView(){
 const pid=st.me.id,p=me();const {days,note}=weekPlan(pid,0);const d=days[TODAY];const tIso=dayIso(0,TODAY);
 let h=`<div class="stack"><div><div class="over">${DAYS_FULL[TODAY]}, ${fmtDate(dayDate(0,TODAY))}</div><div class="t28" style="margin-top:4px">Привіт, ${esc(p.short)}</div></div>${pendingBanner()}${typeof pushPromptHtml==='function'?pushPromptHtml():''}${todayBoardCards()}${st.me.status==='active'?todayRides():''}`;
 const wl=st.well[tIso];
 if(wl&&st.ready&&st.ready.day===tIso)h+=readyCard();
 h+=typeof aiTodayCard==='function'?aiTodayCard():'';
 if(!wl){const q=st.wellStep<3?WQ[st.wellStep]:WQ4;h+=`<div class="card"><div class="between"><div class="over">Самопочуття · ${st.wellStep+1}/4</div><span class="t12 ter">план підлаштується</span></div><div class="q" style="margin-top:8px">${q[0]}</div>
  <div class="wl">${q[1].map((o,k)=>`<button onclick="wellAns(${k})">${o}</button>`).join('')}</div></div>`}
 if(note&&note.k==='well'&&!(st.ready&&st.ready.day===tIso))h+=`<div class="note warn">${ic('info',20)}<span>${note.t}</span></div>`;
 if(d.rest)h+=`<div class="card"><div class="row12"><span class="ico a">${ic('moon',20)}</span><div><div class="t16">День відпочинку</div><div class="t14 sec">Сон, вода і легка прогулянка</div></div></div></div>`;
 else{
  const done=isDone(pid,0,TODAY),sk=isSkip(pid,0,TODAY);
  h+=`<div class="s12"><div class="over">Тренування на сьогодні</div>${workoutCard(d,pid,0,true)}`;
  if(done)h+=`<div class="card"><div class="success"><div class="okcircle">${ic('check',28)}</div><div class="t16">Тренування зараховано</div>${stravaTag(logsOn(dayIso(0,TODAY),pid).find(l=>l.status==='done'&&isStravaLog(l)),true)}<div class="t14 sec">Тренер побачить його у вашому звіті</div><button class="btn t" onclick="undoDay(this,0,${TODAY})">Скасувати</button></div></div>`;
  else if(sk)h+=`<div class="note">${ic('info',20)}<span>Пропущено: ${esc(sk)}. Тренер отримав сповіщення.</span></div><button class="btn t" style="align-self:center" onclick="undoDay(this,0,${TODAY})">Скасувати пропуск</button>`;
  else h+=`<button class="btn p" onclick="openLog(0,${TODAY})">${ic('check',20)} Виконано</button><button class="btn t" style="align-self:center" onclick="openSheet('skip',{wk:0,i:${TODAY}})">Пропустити</button>`;
  h+='</div>';
 }
 const tr=days.filter(x=>!x.rest),dn=tr.filter(x=>isDone(pid,0,x.i)).length;
 h+=`<div class="card tapc" onclick="go('plan')"><div class="between"><div class="t16">Тиждень</div><div class="t14 sec"><b class="w7" style="color:var(--tx)">${dn} з ${tr.length}</b> тренувань</div></div>
  <div style="margin-top:12px">${bar(tr.length?dn/tr.length*100:0)}</div>
  <div class="between" style="margin-top:12px">${days.map(x=>{const c=x.rest?'var(--s2)':isDone(pid,0,x.i)?'var(--acc)':isSkip(pid,0,x.i)?'var(--warn)':x.i===TODAY?'var(--acc-soft)':'var(--s3)';return `<div class="center" style="width:36px"><div class="t12 ${x.i===TODAY?'acc w7':'ter'}">${DAYS[x.i]}</div><div style="height:6px;border-radius:3px;margin-top:6px;background:${c}${x.i===TODAY&&!isDone(pid,0,x.i)?';box-shadow:inset 0 0 0 1px var(--acc)':''}"></div></div>`}).join('')}</div></div>`;
 const wt=st.weights.find(w=>w.day===tIso);const lastW=st.weights.length?st.weights[st.weights.length-1]:null;
 h+=`<div class="list">${li({left:`<span class="ico">${ic('gauge',20)}</span>`,t:'Вага',s:wt?'Сьогодні '+String(wt.kg).replace('.',',')+' кг':lastW?'Останнє: '+String(lastW.kg).replace('.',',')+' кг, '+fmtDate(parseIso(lastW.day)):'Ще не вносили',on:"openSheet('weight')",right:wt?`<span class="c-ok">${ic('check',20)}</span>`:`<span class="tag a">Внести</span>`})}
 ${li({left:`<span class="ico">${ic('upload',20)}</span>`,t:'Імпорт тренувань',s:'Файли .fit, .gpx, .tcx з годинника, Zwift, Strava… можна кілька',on:"pickActivityFile()"})}
 ${li({left:`<span class="ico">${ic('plus',20)}</span>`,t:'Додати тренування поза планом',s:'Запишіть те, чого не було в плані',on:"openExtraLog()"})}</div>`;
 return h+'</div>'}
async function wellAns(k){st.wellAns.push(k);if(st.wellStep<3){st.wellStep++;render();return}
 const a=st.wellAns;st.wellStep=0;st.wellAns=[];const row={athlete_id:st.me.id,day:dayIso(0,TODAY),sleep:a[0],energy:a[1],legs:a[2],pain:a[3]};
 try{D(await sb.from('wellness').upsert(row,{onConflict:'athlete_id,day'}));st.well[row.day]=row;
  const c=await saveReadiness(row);toast(c.level==='good'?'Готовність '+c.score+'%. Тренуємось за планом':'Готовність '+c.score+'%. План підлаштовано, тренер отримав сповіщення',c.level==='good'?'check':'info')}catch(e){fail(e)}render()}

/* ---------- LOGGING ---------- */
function avgPower(w){let t=0,e=0;w.segs.forEach(s=>{if(s.t==='i'){t+=s.n*(s.on+s.off);e+=s.n*(s.on*s.onP+s.off*s.offP)}else if(s.t==='s'){t+=s.d;e+=s.d*s.p}else{t+=s.d;e+=s.d*(s.lo+s.hi)/2}});return t?e/t:0.7}
function estLog(p,w,it){
 const sport=(w&&w.sport)||(it&&it.sport)||'bike';const min=(it&&it.min)||(w?w.dur:45);const ftp=p.form.ftp||0;const ap=w&&sport==='bike'?avgPower(w):0.65;
 const pow=sport==='bike'&&ftp?Math.round(ap*ftp):0;const np=sport==='bike'&&ftp&&w?Math.round((()=>{let t=0,e=0;w.segs.forEach(s=>{if(s.t==='i'){t+=s.n*(s.on+s.off);e+=s.n*(s.on*s.onP**4+s.off*s.offP**4)}else if(s.t==='s'){t+=s.d;e+=s.d*s.p**4}else{t+=s.d;e+=s.d*((s.lo+s.hi)/2)**4}});return t?e**(1/4)/(t**(1/4)):ap})()*ftp):0;
 const dist=sport==='bike'?(min/60*27):sport==='run'?(min/60*10):sport==='swim'?Math.round(min*35/25)*25:0;
 const pace=sport==='run'&&dist?Math.round(min/dist*60):sport==='swim'&&dist?Math.round(min/dist*100*60):0;
 const rpe=w?({rec:3,z2:4,cad:4,easy:4,tech:4,aer:5,core:5,tempo:6,ss:7,long:6,str:7,thr:8,vo2:9,int:8,ana:9,test:8}[w.cat]||6):6;
 const hr=p.form.hrMax?Math.round(p.form.hrMax*(0.55+rpe*0.04)):Math.round(120+rpe*5);
 return {sport,dur:min,dist:+(+dist).toFixed(sport==='swim'?0:1),pow,np,hr,kcal:w?Math.round(wKcal(w,p)*min/w.dur):Math.round(min*7),rpe,pace,title:w?w.name:SPORT[sport].n,workout_id:w?w.id:null,share:st.me.status==='active'}}
function openLog(wk,i){const d=weekPlan(st.me.id,wk).days[i];const it=d.items[0];st._log=Object.assign(estLog(me(),itemW(it),it),{day:dayIso(wk,i)});openSheet('log')}
function openExtraLog(){st._log=Object.assign(estLog(me(),null,{sport:'bike',min:60}),{day:dayIso(0,TODAY),extra:true,title:'',pow:'',np:''});openSheet('log')}
SHEETS.log=()=>{const L=st._log;if(!L)return {title:'Звіт',body:''};const sp=L.sport;
 let b=`<div class="stack">${L.file?`<div class="note">${ic('upload',20)}<span>Дані з файлу ${esc(L.file.name)}. Перевірте і збережіть.</span></div>`:`<div class="t14 sec">Цифри з плану — за потреби введіть свої або посуньте повзунок.</div>`}
 ${L.extra||L.file?`<div class="field"><label>Вид спорту</label>${seg(Object.keys(SPORT).map(k=>[k,SPORT[k].n]),sp,'logSport')}</div><div class="field"><label>Назва</label><input class="inp" id="ltitle" value="${esc(L.title||'')}" placeholder="Наприклад: ранковий заїзд"></div><div class="field"><label>Дата</label><input class="inp" id="lday" type="date" value="${L.day}" max="${dayIso(0,TODAY)}"></div>`:''}
 ${nf({id:'ldur',label:'Тривалість',val:L.dur,min:5,max:600,step:1,unit:'хв',plus:true,set:v=>L.dur=v})}`;
 if(sp==='bike')b+=`${nf({id:'ldist',label:'Дистанція',val:L.dist,min:0,max:400,step:0.1,unit:'км',set:v=>L.dist=v})}
  ${nf({id:'lpow',label:'Середня потужність',val:L.pow||'',min:0,max:800,step:1,unit:'Вт',empty:true,ph:'немає',set:v=>L.pow=v})}
  ${nf({id:'lnp',label:'Нормалізована потужність (NP)',val:L.np||'',min:0,max:800,step:1,unit:'Вт',empty:true,ph:'немає',set:v=>L.np=v})}`;
 else if(sp==='run')b+=`${nf({id:'ldist',label:'Дистанція',val:L.dist,min:0,max:100,step:0.1,unit:'км',set:v=>{L.dist=v;if(v>0)L.pace=Math.round(L.dur*60/v)}})}
  ${nf({id:'lpace',label:'Темп',val:L.pace||360,min:2*60+30,max:12*60,step:5,kind:'time',unit:'/км',set:v=>L.pace=v})}`;
 else if(sp==='swim')b+=`${nf({id:'ldist',label:'Дистанція',val:L.dist,min:0,max:10000,step:25,unit:'м',set:v=>L.dist=v})}
  ${nf({id:'lpace',label:'Темп',val:L.pace||150,min:60,max:4*60,step:1,kind:'time',unit:'/100 м',set:v=>L.pace=v})}`;
 b+=`${nf({id:'lhr',label:'Середній пульс',val:L.hr||'',min:50,max:220,step:1,unit:'уд/хв',empty:true,ph:'немає',set:v=>L.hr=v})}
  ${nf({id:'lkcal',label:'Калорії',val:L.kcal,min:0,max:6000,step:10,unit:'ккал',set:v=>L.kcal=v})}
  ${nf({id:'lrpe',label:'Відчуття (RPE)',val:L.rpe,min:1,max:10,step:1,unit:'/ 10',plus:true,set:v=>L.rpe=v})}
  <div class="field"><label>Коментар (необовʼязково)</label><textarea class="inp" id="lnote" placeholder="Наприклад: тримав каденс 90, вітер у спину">${esc(L.note||'')}</textarea></div>
  ${st.me.status==='active'?`<button class="tgrow" style="background:none;border:0;width:100%;text-align:left" onclick="st._log.share=!st._log.share;renderSheet()"><div class="grow"><div class="t14">Поділитися в командній стрічці</div><div class="t12 ter">${st.me.hide?'Цифри приховано налаштуваннями приватності':'Час, дистанція і потужність'}</div></div><span class="tg ${L.share?'on':''}"></span></button>
  ${L.share?`<div class="field"><label>Фото (необовʼязково)</label><input class="inp" type="file" accept="image/*" id="lphoto" onchange="logPhoto(this)">${L.photoInfo?`<div class="t12 ter">${L.photoInfo}</div>`:''}</div>`:''}`:''}</div>`;
 return {title:'Звіт про тренування',full:true,body:b,foot:`<button class="btn p" onclick="saveLog(this)">Зарахувати</button>`}};
function logSport(v){const L=st._log;L.sport=v;if(v==='swim'&&L.dist<100)L.dist=Math.round(L.dur*35/25)*25;if(v!=='swim'&&L.dist>400)L.dist=+(L.dist/1000).toFixed(1);renderSheet()}
async function logPhoto(inp){const f=inp.files&&inp.files[0];if(!f)return;try{const blob=await compressImage(f);st._log.photo=blob;st._log.photoInfo='Фото стиснуто до '+Math.round(blob.size/1024)+' КБ';renderSheet()}catch(e){fail(e,'Не вдалося обробити фото')}}
function tssOf(L){const ftp=st.me.form.ftp;if(L.sport==='bike'&&ftp&&(L.np||L.pow)){const IF=(L.np||L.pow)/ftp;return Math.round(L.dur/60*IF*IF*100)}return Math.round(L.dur*(L.rpe||5)*(L.rpe||5)/60*1.1)}
async function saveLog(btn){const L=st._log;if($('#lnote'))L.note=$('#lnote').value.trim();if($('#ltitle'))L.title=$('#ltitle').value.trim()||SPORT[L.sport].n;if($('#lday'))L.day=$('#lday').value||L.day;
 await busy(btn,async()=>{
  let file_path=null;
  if(L.file){file_path=st.me.id+'/'+Date.now()+'_'+L.file.name.replace(/[^\w.\-]+/g,'_');D(await sb.storage.from('activity-files').upload(file_path,L.file,{contentType:'application/octet-stream'}))}
  const row={athlete_id:st.me.id,day:L.day,sport:L.sport,workout_id:L.workout_id||null,title:L.title||SPORT[L.sport].n,status:'done',duration_min:Math.round(L.dur),distance:L.dist||null,
   avg_power:L.pow||null,np:L.np||null,avg_hr:L.hr||null,kcal:L.kcal||null,rpe:L.rpe||null,pace_sec:(L.sport==='run'||L.sport==='swim')?L.pace||null:null,tss:tssOf(L),note:L.note||null,source:L.file?'file':'manual',file_path};
  const saved=D(await sb.from('workout_logs').insert(row).select().single());st.logs.push(saved);
  st.logs=st.logs.filter(l=>!(l.day===row.day&&l.status==='skipped'&&!L.extra&&!L.file));
  if(!L.extra&&!L.file)await sb.from('workout_logs').delete().eq('athlete_id',st.me.id).eq('day',row.day).eq('status','skipped');
  const dup=st.posts.find(p=>p.author_id===st.me.id&&p.board_post_id&&p.sport===row.sport&&iso(new Date(p.created_at))===row.day);
  if(dup&&L.share){L.share=false;toast('Це тренування вже є у стрічці з дошки секції','info')}
  if(L.share&&st.me.status==='active'){let photo_path=null;if(L.photo){photo_path=st.me.id+'/'+Date.now()+'.jpg';D(await sb.storage.from('photos').upload(photo_path,L.photo,{contentType:L.photo.type||'image/jpeg'}))}
   const stats=st.me.hide?[]:postStats(row);const post=D(await sb.from('posts').insert({kind:'workout',sport:row.sport,title:row.title,body:row.note,stats,photo_path}).select('*, post_likes(user_id), post_comments(id,author_id,body,created_at)').single());
   st.posts.unshift(post);if(photo_path)signPhotos()}
  st._log=null;closeAll();render();toast('Чудово! Тренування зараховано');checkNewAch();
 })}
function postStats(r){const s=[[fmtMin(r.duration_min),'час']];if(r.distance)s.push([r.sport==='swim'?fmtNum(r.distance)+' м':String(r.distance).replace('.',',')+' км','дистанція']);
 if(r.sport==='bike'&&(r.np||r.avg_power))s.push([(r.np||r.avg_power)+' Вт',r.np?'NP':'потужність']);else if(r.pace_sec)s.push([nfFmtTime(r.pace_sec)+(r.sport==='swim'?'/100м':'/км'),'темп']);else if(r.avg_hr)s.push([r.avg_hr+'','пульс']);return s}
async function undoDay(btn,wk,i){await busy(btn,async()=>{const day=dayIso(wk,i);const ids=st.logs.filter(l=>l.day===day&&!l.file_path).map(l=>l.id);if(!ids.length)return;D(await sb.from('workout_logs').delete().in('id',ids));st.logs=st.logs.filter(l=>!ids.includes(l.id));render()})}
SHEETS.skip=a=>({title:'Чому пропускаєте?',body:`<div class="s12"><div class="t14 sec">Тренер побачить причину і за потреби змінить план</div><div class="chips">${['Хворію','Втома','Робота','Погода','Травма','Інше'].map(r=>`<button class="chip ${st._skipR===r?'on':''}" onclick="st._skipR='${r}';renderSheet()">${r}</button>`).join('')}</div></div>`,
 foot:`<button class="btn p" ${st._skipR?'':'disabled'} onclick="doSkip(this,${a.wk},${a.i})">Пропустити</button>`});
async function doSkip(btn,wk,i){await busy(btn,async()=>{const d=weekPlan(st.me.id,wk).days[i];const it=d.items[0]||{sport:'bike'};
 const row=D(await sb.from('workout_logs').insert({athlete_id:st.me.id,day:dayIso(wk,i),sport:it.sport,workout_id:it.w||null,title:itemName(it),status:'skipped',skip_reason:st._skipR.toLowerCase()}).select().single());
 st.logs.push(row);st._skipR=null;closeAll();render();toast('Пропуск збережено. Тренер отримав сповіщення','info')})}
SHEETS.weight=()=>{const p=me();if(st._wt==null){const t=st.weights.find(w=>w.day===dayIso(0,TODAY));st._wt=t?+t.kg:p.weight}return {title:'Вага сьогодні',body:`<div class="s12"><div class="t12 ter">Зважуйтесь зранку, до сніданку</div>
 ${nf({id:'wt',val:st._wt,min:30,max:200,step:0.1,unit:'кг',plus:true,set:v=>st._wt=v})}</div>`,foot:`<button class="btn p" onclick="saveWeight(this)">Зберегти</button>`}};
async function saveWeight(btn){await busy(btn,async()=>{const row={athlete_id:st.me.id,day:dayIso(0,TODAY),kg:+st._wt};D(await sb.from('weights').upsert(row,{onConflict:'athlete_id,day'}));
 st.weights=st.weights.filter(w=>w.day!==row.day).concat([row]).sort((a,b)=>a.day<b.day?-1:1);st.me.weight=row.kg;await sb.from('profiles').update({weight_kg:row.kg}).eq('id',st.me.id);st._wt=null;closeAll();render();toast('Вагу збережено');checkNewAch()})}

/* workout detail */
SHEETS.wk=a=>{
 let w,it,inPlan=a.pid!=null;
 if(inPlan){const d=weekPlan(a.pid,a.wk).days[a.i];it=d.items[a.j||0];w=itemW(it)}else w=libById(a.id);
 const p=inPlan&&a.pid!==st.me.id?athleteP(a.pid):me();const ftp=p&&p.form.ftp;
 if(!w)return {title:esc(itemName(it)),body:emptyBox(SPORT[it.sport].n,fmtMin(it.min))};
 const segs=w.segs.map(s=>segText(s,w,ftp,p));
 const done=inPlan&&isDone(a.pid,a.wk,a.i);const mine=inPlan&&a.pid===st.me.id&&!isCoach();
 let body=`<div class="stack"><div class="row" style="flex-wrap:wrap">${tag(SPORT[w.sport].n,'a')}${tag(catName(w.sport,w.cat))}${tag(LEVEL[w.level])}</div>
 <div class="grid3"><div class="tile"><div class="v">${w.dur}</div><div class="l">хвилин</div></div><div class="tile"><div class="v">${wTSS(w)}</div><div class="l">TSS</div></div><div class="tile"><div class="v">${wKcal(w,p)}</div><div class="l">ккал</div></div></div>
 <div>${wChart(w,80)}<div class="t12 ter" style="margin-top:8px">Пунктир: ${ftp&&w.sport==='bike'?'ваш FTP '+ftp+' Вт':'поріг (100%)'}</div></div>
 <div class="s8"><div class="over">Мета</div><div class="t14">${esc(w.goal)}</div></div>
 <div class="s8"><div class="over">Структура</div><div class="list">${segs.map(s=>`<div class="li" style="min-height:48px"><div class="grow"><div class="t14 w6">${s[0]}</div><div class="t12 sec">${s[1]}</div></div><div style="text-align:right"><div class="t14 num sec">${s[2]}</div>${s[3]?`<div class="t12 ter num">${s[3]}</div>`:''}</div></div>`).join('')}</div>${(w.sport==='bike'||w.sport==='run')?`<button class="btn t sm" style="margin-top:8px;width:auto" onclick="zonesOpen(${a.pid&&a.pid!==st.me.id?`'${a.pid}'`:''})">${hrModel(p.form,p.age).est?'Пульс оцінено з віку. Уточнити зони':'Мої зони'} ›</button>`:''}</div>
 ${w.sport==='bike'?`<div class="note">${ic('info',20)}<span>На звичайному станку тримайте вати передачею і каденсом 85–95 об/хв.</span></div>`:''}</div>`;
 let foot='';
 const zwo=w.sport==='bike'?`<button class="btn s" style="width:auto;flex-shrink:0" onclick="downloadZwo('${w.id}')">${ic('download',20)} .zwo</button>`:'';
 if(mine&&a.wk===0&&a.i===TODAY&&!done)foot=`<button class="btn p" onclick="openLog(0,${TODAY})">${ic('check',20)} Виконано</button>${zwo}`;
 else if(w.sport==='bike')foot=`<button class="btn ${isCoach()&&!inPlan?'s':'p'}" onclick="downloadZwo('${w.id}')">${ic('download',20)} Експорт .zwo</button>${isCoach()&&!inPlan?`<button class="btn p" onclick="openSheet('assign','${w.id}')">Призначити</button>`:''}`;
 else if(isCoach()&&!inPlan)foot=`<button class="btn p" onclick="openSheet('assign','${w.id}')">Призначити</button>`;
 return {title:esc(w.name),body,foot,full:true}};

/* ---------- PLAN ---------- */
function unlocked(){return st.unlock&&new Date(st.unlock.until)>new Date()}
function canEditPlan(wk){const r=st.plans[st.me.id+'|'+wkIso(wk)];return unlocked()||!(r&&r.coach_locked)}
function planSegSet(v){st.planSeg=v;render._k='';render()}
function planView(){
 const ps=seg([['plan','Тренування'],['food','Їжа']],st.planSeg==='food'?'food':'plan','planSegSet');
 if(st.planSeg==='food')return `<div class="stack">${ps}${foodView()}</div>`;
 return planViewInner().replace('<div class="stack">','<div class="stack">'+ps)}
function planViewInner(){
 const pid=st.me.id,p=me(),wk=st.wk;const {days,note,locked}=weekPlan(pid,wk);
 const tr=days.filter(d=>!d.rest);const mins=tr.reduce((a,d)=>a+dayMin(d),0);
 let h=`<div class="stack">${pendingBanner()}<div class="row"><button class="ib" onclick="setWk(${wk-1})" aria-label="Попередній тиждень" ${wk<=-12?'disabled':''}>${ic('back',22)}</button><div class="grow">${seg([['0','Цей тиждень'],['1','Наступний']],String(wk),'setWk')}</div></div>`;
 const r=st.plans[pid+'|'+wkIso(wk)];
 if(wk===1&&!(r&&r.coach_locked)&&!st._nextAsked)h+=`<div class="card hl"><div class="t16">Скільки часу маєте наступного тижня?</div><div class="t14 sec" style="margin-top:4px">Підлаштуємо обсяг під ваш графік</div>
  <div class="grid3" style="margin-top:16px">${[['0.8','Менше'],['1','Як завжди'],['1.2','Більше']].map(x=>`<button class="btn s" style="padding:0 8px" onclick="setNext(this,${x[0]})">${x[1]}</button>`).join('')}</div></div>`;
 if(note)h+=`<div class="note ${note.k==='well'?'warn':''}">${ic('info',20)}<span>${note.t}</span></div>`;
 if(locked)h+=`<div class="note">${ic('edit',20)}<span>Тренер Дмитро скоригував цей тиждень.</span></div>`;
 if(wk===0||wk===1)h+=typeof aiPlanCard==='function'?aiPlanCard():'';
 const unl=unlocked();
 if(unl)h+=`<div class="note">${ic('unlock',20)}<span><b style="color:var(--tx)">Тренер дозволив зміни до ${fmtDate(new Date(st.unlock.until))}.</b> Торкніться дня, щоб змінити тренування.</span></div>`;
 h+=`<div class="between"><div class="t16">${weekRange(wk)}</div><div class="t14 sec">${tr.length} тренувань · ${fmtMin(mins)}</div></div>`;
 h+=`<div class="list">${days.map(d=>{const dt=dayDate(wk,d.i);const it=d.items[0];const w=it&&itemW(it);const done=isDone(pid,wk,d.i),sk=isSkip(pid,wk,d.i);
  const right=done?`<span class="c-ok">${ic('check',20)}</span>`:sk?tag('пропуск','warn'):(unl?`<span class="acc">${ic('edit',18)}</span>`:(d.rest?'':`<span class="chev">${ic('chev',20)}</span>`));
  const title=d.rest?'Відпочинок':esc(itemName(it));
  const altL=logsOn(dayIso(wk,d.i),pid).find(l=>l.source==='board'&&l.board_post_id);
  const sub=(d.rest?'':d.items.map(x=>SPORT[x.sport].n).join(' + ')+' · '+fmtMin(dayMin(d))+(d.adapted?' · '+({light:'полегшено',recovery:'відновлення',rest:'відпочинок за самопочуттям'}[d.adapted]||'полегшено'):'')+(d.items.some(x=>x.ai)?' · ✨ AI':''))+(altL?(d.rest?'':' · ')+'🔁 зроблено інакше'+(altL.tss?' · '+altL.tss+' балів':''):'');
  const on=unl?`openSheet('editDay',{pid:'${pid}',wk:${wk},i:${d.i}})`:(w?`openSheet('wk',{pid:'${pid}',wk:${wk},i:${d.i},j:0})`:'');
  return `<button class="li ${d.rest?'dim':''} ${wk===0&&d.i===TODAY?'today-mark':''}" onclick="${on}"><div class="dayc"><b>${DAYS[d.i]}</b><span>${dt.getDate()}</span></div><div class="grow"><div class="t16 ell">${title}</div>${sub?`<div class="t12 sec ell">${sub}</div>`:''}</div>${right}</button>`}).join('')}</div>`;
 const pend=st.requests.find(r=>r.status==='pending');
 if(pend){const old=Date.now()-new Date(pend.created_at)>864e5;
  h+=old?`<div class="card hl s12"><div class="row12"><span class="ico a">${ic('spark',20)}</span><div class="t16 grow">Тренер ще не відповів на «${esc(pend.kind)}»</div></div><div class="t14 sec">${esc(safeProposal(pend))}</div><button class="btn p" onclick="acceptSafe(this,${pend.id})">Прийняти безпечний варіант</button><div class="t12 ter">Тренер отримає сповіщення і зможе змінити план пізніше</div></div>`
   :`<div class="note">${ic('clock',20)}<span>Запит «${esc(pend.kind)}» чекає на тренера. Без відповіді 24 год: AI запропонує безпечний варіант.</span></div>`}
 h+=`<div class="row"><button class="btn ${unl?'s':'p'} grow" onclick="openSheet('req')">${unl?'Новий запит':'Запросити зміну'}</button><button class="btn s" style="width:56px;padding:0;flex-shrink:0" onclick="openSheet('share')" aria-label="Поділитися">${ic('share',20)}</button></div>`;
 h+=`<div class="list">${li({left:`<span class="ico">${ic('inbox',20)}</span>`,t:'Мої запити',s:st.requests.length?st.requests.length+' запитів':'Поки немає',on:"openSheet('myReqs')"})}${li({left:`<span class="ico">${ic('flag',20)}</span>`,t:'Старти',s:(p.races||[]).length?(p.races.map(r=>esc(r.name)).join(', ')):'Додайте старт, щоб отримати підводку',on:"openSheet('races')"})}${li({left:`<span class="ico">${ic('cal',20)}</span>`,t:'Мій розклад',s:'Дні і час для тренувань',on:"openSheet('schedule')"})}${li({left:`<span class="ico">${ic('book',20)}</span>`,t:'Бібліотека тренувань',s:LIB.length+' тренувань з графіками',on:"openSheet('lib')"})}</div>`;
 return h+'</div>'}
function weekRange(wk){const a=dayDate(wk,0),b=dayDate(wk,6);return a.getMonth()===b.getMonth()?a.getDate()+'–'+fmtDate(b):fmtDate(a)+' – '+fmtDate(b)}
async function setWk(v){st.wk=Math.max(-12,Math.min(1,+v));render();if(st.wk>=0&&!st.plans[st.me.id+'|'+wkIso(st.wk)]){try{await ensurePlan(st.me,st.wk)}catch(e){}render()}}
async function setNext(btn,v){await busy(btn,async()=>{if(!canEditPlan(1))throw new Error('План на наступний тиждень уже скоригував тренер');const g=genFor(st.me,1,v);await savePlan(st.me.id,1,g.days,{scale:g.scale,note:g.note});st._nextAsked=true;render();toast(v<1?'Наступний тиждень полегшено':v>1?'Додали обсягу на наступний тиждень':'Залишаємо як зазвичай')})}
function safeProposal(r){return 'Безпечний варіант AI: до відповіді тренера обсяг решти тижня знижено до 60%, усі інтенсивні тренування замінено на легку витривалість (зона 2). Це не зашкодить і збереже форму.'}
async function acceptSafe(btn,id){await busy(btn,async()=>{
 D(await sb.from('change_requests').update({status:'ai_safe',ai_proposal:safeProposal()}).eq('id',id));
 const {days}=weekPlan(st.me.id,0);const nd=days.map(d=>d.i<TODAY?d:Object.assign({},d,{items:d.items.map(it=>{if(it.log)return it;const easy=pickW(it.sport,it.sport==='bike'?'z2':it.sport==='run'?'easy':it.sport==='swim'?'aer':'core',Math.round(it.min*.6),'beg',d.i);return {sport:it.sport,w:easy?easy.id:null,min:Math.round(it.min*.6)}})}));
 const u=await sb.from('plan_unlocks').select('*').eq('athlete_id',st.me.id).maybeSingle();st.unlock=u.data;
 await savePlan(st.me.id,0,nd,{scale:.6,note:'Безпечний варіант AI: обсяг 60%, лише легка витривалість до рішення тренера.'});
 const rq=st.requests.find(x=>x.id===id);if(rq)rq.status='ai_safe';render();toast('План полегшено. Тренер отримав сповіщення')})}
SHEETS.req=()=>{
 if(st._reqSent)return {title:'Запит надіслано',body:`<div class="success" style="padding:24px 0"><div class="okcircle">${ic('check',28)}</div><div class="t20">Тренер отримав запит</div><div class="t14 sec">Після підтвердження ви зможете редагувати план 7 днів. Якщо тренер не відповість за 24 години, AI запропонує безпечний варіант.</div></div>`,foot:`<button class="btn s" onclick="st._reqSent=false;closeAll()">Готово</button>`};
 const types=['Перенести день','Замінити тренування','Менше часу','Більше часу','Хвороба або травма','Інше'];
 return {title:'Запросити зміну',body:`<div class="stack"><div class="t14 sec">План змінює тренер. Опишіть, що потрібно, і після підтвердження редагування відкриється.</div>
 <div class="field"><label>Що змінити</label><div class="chips">${types.map(t=>`<button class="chip ${st._reqT===t?'on':''}" onclick="st._reqT='${t}';renderSheet()">${t}</button>`).join('')}</div></div>
 <div class="field"><label>Коментар</label><textarea class="inp" id="reqtxt" maxlength="1000" placeholder="Наприклад: у суботу весілля, перенести довгий заїзд на неділю"></textarea></div></div>`,
 foot:`<button class="btn p" ${st._reqT?'':'disabled'} onclick="sendReq(this)">Надіслати тренеру</button>`}};
async function sendReq(btn){await busy(btn,async()=>{const t=(($('#reqtxt')||{}).value||'').trim();const r=D(await sb.from('change_requests').insert({athlete_id:st.me.id,kind:st._reqT,body:t}).select().single());st.requests.unshift(r);st._reqT=null;st._reqSent=true;renderSheet();render()})}
const REQ_ST={pending:['чекає','warn'],approved:['дозволено','ok'],rejected:['відхилено',''],edited:['тренер змінив план','ok'],ai_safe:['безпечний варіант AI','a']};
SHEETS.myReqs=()=>({title:'Мої запити',body:st.requests.length?`<div class="list">${st.requests.map(r=>`<div class="li"><div class="grow"><div class="t14 w6">${esc(r.kind)}</div><div class="t12 sec">${esc(r.body||'Без коментаря')}</div><div class="t12 ter">${ago(r.created_at)}</div></div>${tag(REQ_ST[r.status][0],REQ_ST[r.status][1])}</div>`).join('')}</div>`:emptyBox('Запитів поки немає')});
SHEETS.share=()=>({title:'Поділитися планом',body:`<div class="stack"><div class="note">${ic('lock',20)}<span>Ваш план приватний: його бачите лише ви і тренер. Поділитися можна тільки вручну.</span></div>
 ${st.me.status==='active'?`<div class="list">${li({left:`<span class="ico">${ic('users',20)}</span>`,t:'У командну стрічку',s:'Усі учасники побачать план на тиждень',on:"sharePlanFeed(this)"})}${li({left:`<span class="ico">${ic('user',20)}</span>`,t:'Одному спортсмену',s:'Особисте повідомлення з планом',on:"openSheet('sharePick')"})}</div>`:`<div class="t14 sec">Поділитися можна після підтвердження тренером.</div>`}</div>`});
function planText(wk){const {days}=weekPlan(st.me.id,wk);return 'План на '+weekRange(wk)+':\n'+days.map(d=>DAYS[d.i]+': '+(d.rest?'відпочинок':d.items.map(it=>itemName(it)+' ('+fmtMin(it.min)+')').join(' + '))).join('\n')}
async function sharePlanFeed(btn){await busy(btn,async()=>{const {days}=weekPlan(st.me.id,st.wk);const tr=days.filter(d=>!d.rest);
 const post=D(await sb.from('posts').insert({kind:'plan',sport:null,title:'Мій план на '+weekRange(st.wk),body:planText(st.wk),stats:st.me.hide?[]:[[tr.length+'','тренувань'],[fmtMin(plannedMin(days)),'разом']]}).select('*, post_likes(user_id), post_comments(id,author_id,body,created_at)').single());
 st.posts.unshift(post);closeAll();render();toast('План опубліковано в стрічці')})}
SHEETS.sharePick=()=>{const list=st.members.filter(m=>m.id!==st.me.id);return {title:'Кому надіслати',body:list.length?`<div class="list">${list.map(m=>li({left:avOf(m.id),t:esc(m.full_name),s:m.is_coach?'Тренер':m.group_name,on:`sharePlanTo(this,'${m.id}')`})).join('')}</div>`:emptyBox('Поки нікого немає')}};
async function sharePlanTo(btn,id){await busy(btn,async()=>{const m=D(await sb.from('messages').insert({kind:'dm',recipient_id:id,body:planText(st.wk)}).select().single());st.dms.push(m);closeAll();toast('План надіслано: '+nameOf(id))})}
SHEETS.races=()=>{const p=me();return {title:'Старти',body:`<div class="stack">
 ${(p.races||[]).length?`<div class="list">${p.races.map((r,k)=>li({left:`<span class="ico a">${ic('flag',20)}</span>`,t:esc(r.name),s:fmtDate(parseIso(r.date))+(r.dist?' · '+esc(r.dist):''),right:`<button class="ib" onclick="event.stopPropagation();delRace(${k})" aria-label="Видалити">${ic('x',18)}</button>`})).join('')}</div>`:emptyBox('Стартів поки немає','Додайте старт, і план за 2 тижні до нього перейде в підводку')}
 <div class="over">Новий старт</div>
 <div class="field"><label>Назва</label><input class="inp" id="rn" placeholder="Odesa Gran Fondo"></div>
 <div class="field"><label>Дата</label><input class="inp" id="rd" type="date" min="${dayIso(0,TODAY)}"></div>
 ${nf({id:'rdist',label:'Дистанція',val:st._rdist==null?100:st._rdist,min:1,max:400,step:1,unit:'км',set:v=>st._rdist=v})}</div>`,
 foot:`<button class="btn p" onclick="addRace(this)">Додати старт</button>`}};
async function addRace(btn){const n=$('#rn').value.trim(),d=$('#rd').value;if(!n||!d)return toast('Вкажіть назву і дату','info');
 await busy(btn,async()=>{const p=me();p.races=(p.races||[]).concat([{name:n,date:d,dist:(st._rdist==null?100:st._rdist)+' км'}]);await saveMe();st._rdist=null;await regenFuture();closeAll();render();toast('Старт додано, план перебудовано під підводку')})}
async function delRace(k){try{const p=me();p.races.splice(k,1);await saveMe();await regenFuture();renderSheet();render()}catch(e){fail(e)}}
async function regenFuture(){for(const wk of [0,1]){if(!canEditPlan(wk))continue;const old=st.plans[st.me.id+'|'+wkIso(wk)];const g=genFor(st.me,wk,old&&old.scale&&!old.note?old.scale:1);
 const days=wk===0&&old?planRowToDays(old).map((d,i)=>i<TODAY?d:g.days[i]):g.days;try{await savePlan(st.me.id,wk,days,{scale:g.scale,note:g.note})}catch(e){console.warn(e)}}}
SHEETS.schedule=()=>({title:'Мій розклад',full:true,body:`<div class="stack"><div class="t14 sec">Торкніться дня і вкажіть, що і скільки можете. Зміни застосуються до плану, якщо його ще не коригував тренер.</div>${dayList(me().days,'me')}</div>`,foot:`<button class="btn p" onclick="saveSchedule(this)">Зберегти і перебудувати план</button>`});
async function saveSchedule(btn){await busy(btn,async()=>{await saveMe();await regenFuture();closeAll();render();toast('Розклад збережено')})}

/* edit day (athlete after approval, and coach) */
st.edit=null;
function editDays(pid,wk){const k=pid+'|'+wk;if(!st.edit||st.edit.k!==k)st.edit={k,pid,wk,days:JSON.parse(JSON.stringify(weekPlan(pid,wk).days.map(d=>({i:d.i,items:d.items,tod:d.tod}))))};return st.edit.days}
SHEETS.editDay=a=>{const days=editDays(a.pid,a.wk);const d=days[a.i];const items=d.items;const dt=dayDate(a.wk,a.i);
 return {title:DAYS_FULL[a.i]+', '+fmtDate(dt),body:`<div class="stack">
 ${items.length?items.map((it,j)=>{const w=itemW(it);return `<div class="card"><div class="row12">${sportIco(it.sport,'a')}<div class="grow"><div class="t16 ell">${esc(itemName(it))}</div><div class="t12 sec">${w?catName(w.sport,w.cat)+' · ':''}${fmtMin(it.min)}</div></div></div>
  ${w?`<div style="margin-top:12px">${wChart(w,40)}</div>`:''}
  <div class="s8" style="margin-top:12px">${nf({id:'edur'+j,label:'Тривалість',val:it.min,min:10,max:420,step:5,unit:'хв',plus:true,set:v=>{items[j].min=v}})}</div>
  <div class="row" style="margin-top:12px"><button class="btn s sm grow" onclick="openSheet('pick',{pid:'${a.pid}',wk:${a.wk},i:${a.i},j:${j},sport:'${it.sport}'})">Замінити з бібліотеки</button><button class="btn d sm" onclick="removeItem(${a.i},${j})" aria-label="Прибрати">${ic('x',18)}</button></div></div>`}).join('')
 :emptyBox('День відпочинку','Можна додати тренування з бібліотеки')}
 <button class="btn s" onclick="openSheet('pick',{pid:'${a.pid}',wk:${a.wk},i:${a.i},j:${items.length},sport:'bike'})">${ic('plus',20)} Додати тренування</button></div>`,
 foot:`<button class="btn p" onclick="saveEdit(this)">Зберегти</button>`}};
async function saveEdit(btn){await busy(btn,async()=>{const e=st.edit;await savePlan(e.pid,e.wk,e.days.map(d=>Object.assign({},d,{rest:!d.items.length})));st.edit=null;closeAll();render();toast('Зміни збережено')})}
function pickItem(i,j,id){const w=libById(id);st.edit.days[i].items[j]={sport:w.sport,w:id,min:w.dur};closeSheet();renderSheet();toast('Тренування замінено')}
function removeItem(i,j){st.edit.days[i].items.splice(j,1);renderSheet()}
SHEETS.pick=a=>{const sp=st._pickSp||a.sport;const list=LIB.filter(w=>w.sport===sp);
 return {title:'Обрати тренування',full:true,body:`<div class="stack">${chipRow(Object.keys(SPORT).map(k=>[k,SPORT[k].n]),sp,'pickSp')}
 <div class="list">${list.map(w=>`<button class="li" onclick="st._pickSp=null;pickItem(${a.i},${a.j},'${w.id}')"><div class="grow"><div class="t16 ell">${esc(w.name)}</div><div class="t12 sec ell">${catName(w.sport,w.cat)} · ${fmtMin(w.dur)} · ${LEVEL[w.level]}</div></div><div style="width:72px;flex-shrink:0">${wChart(w,28)}</div></button>`).join('')}</div></div>`}};
function pickSp(v){st._pickSp=v;renderSheet()}

/* library (shared by athlete sheet and coach tab) */
function libBody(){
 const sp=st.libSport;const cats=[['all','Усі']].concat(CATS[sp]);const list=LIB.filter(w=>w.sport===sp&&(st.libCat==='all'||w.cat===st.libCat));
 return `<div class="stack">${seg(Object.keys(SPORT).map(k=>[k,SPORT[k].n]),sp,'libSp')}${chipRow(cats,st.libCat,'libCat',true)}
 <div class="t12 ter">${list.length} тренувань${sp==='bike'?' · кожне можна експортувати в .zwo для Zwift':''}</div>
 <div class="list">${list.map(w=>`<button class="li" onclick="openSheet('wk',{id:'${w.id}'})"><div class="grow"><div class="t16 ell">${esc(w.name)}</div><div class="t12 sec ell">${fmtMin(w.dur)} · ${LEVEL[w.level]} · ${esc(w.goal)}</div></div><div style="width:72px;flex-shrink:0">${wChart(w,28)}</div></button>`).join('')}</div></div>`}
function libSp(v){st.libSport=v;st.libCat='all';render();renderSheet()}
function libCat(v){st.libCat=v;render();renderSheet()}
SHEETS.lib=()=>({title:'Бібліотека тренувань',full:true,body:libBody()});
