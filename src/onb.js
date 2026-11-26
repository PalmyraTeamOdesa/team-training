/* ---------- ONBOARDING ---------- */
const OB_STEPS=['Про себе','Види спорту','Цілі','Розклад','Інвентар','Поточна форма','Здоровʼя','Останній крок'];
function newOb(){const m=st.me||{};return {step:1,name:m.name&&m.name!=='Без імені'?m.name:'',sex:'m',age:'',height:'',weight:'',city:'Одеса',
 sports:{bike:{on:true,types:['road'],level:'beg',own:false},run:{on:false,level:'beg',own:false},swim:{on:false,level:'beg',own:false},gym:{on:false,level:'beg',own:false}},
 goals:[],targets:{ftp:'',weight:'',raceDate:'',raceDist:''},
 days:days([null,null,null,null,null,null,null]),
 equip:[],form:{ftp:'',ftpU:true,hrRest:'',hrRestU:true,hrMax:'',hrMaxU:true,run5k:'',run5kU:true,swim1500:'',swim1500U:true},
 health:{inj:[],bp:'norm',notes:''},remind:'07:00',consent:false}}
function startOnb(){st.ob=newOb();st.screen='onb';render();if(typeof navWrite==='function')navWrite(true)}
function obView(){return onbView()}
function onbView(){const o=st.ob;
 if(o.step===9)return obReady();
 const n=o.step,opt=n===6||n===7;
 return `<div class="steph"><button class="ib" onclick="obBack()" aria-label="Назад">${ic('back',22)}</button><div class="grow">${bar(n/8*100)}</div><div class="t12 ter" style="width:56px;text-align:center">${n} з 8</div></div>
 <main><div class="stack" style="padding-top:8px"><div><div class="t28">${OB_STEPS[n-1]}</div><div class="t14 sec" style="margin-top:4px">${['Щоб розрахувати зони і норму харчування','Оберіть усе, чим займаєтесь','Можна кілька. Цифри необовʼязкові','Торкніться дня і вкажіть, що і скільки можете. Порожній день: відпочинок','Від цього залежать тренування в плані','Не знаєте? Поставимо тест на першому тижні','Тренер врахує обмеження','Майже готово'][n-1]}</div></div>
 ${[ob1,ob2,ob3,ob4,ob5,ob6,ob7,ob8][n-1]()}</div></main>
 <div class="sh-foot">${opt?`<button class="btn s" style="width:auto" onclick="obNext()">Пропустити</button>`:''}<button class="btn p" ${obValid()?'':'disabled'} onclick="obNext()">${n===8?'Створити план':'Далі'}</button></div>`}
function obValid(){const o=st.ob;if(o.step===1)return o.name.trim()&&+o.age>4&&+o.weight>20;if(o.step===2)return Object.values(o.sports).some(s=>s.on);if(o.step===3)return o.goals.length>0;if(o.step===4)return o.days.some(d=>d.acts.length);if(o.step===8)return o.consent;return true}
function obNext(){const o=st.ob;o.step++;const m=$('main');if(m)m.scrollTop=0;render._k='';render();if(typeof navWrite==='function')navWrite(false)}
function obBack(){const o=st.ob;if(o.step===1){if(confirm('Вийти з акаунта?'))logout();return}if(history.state&&history.state.triton){history.back();return}o.step--;render._k='';render()}
function obSet(path,v){const ks=path.split('.');let t=st.ob;for(let k=0;k<ks.length-1;k++)t=t[ks[k]];t[ks[ks.length-1]]=v}
function obIn(path,v){obSet(path,v);const b=document.querySelector('.sh-foot .btn.p');if(b)b.disabled=!obValid()}
function obToggleArr(path,v){const ks=path.split('.');let t=st.ob;for(const k of ks)t=t[k];const i=t.indexOf(v);if(i>=0)t.splice(i,1);else t.push(v);render()}
function fld(label,path,val,attrs){return `<div class="field"><label>${label}</label><input class="inp" value="${esc(val)}" ${attrs||''} oninput="obIn('${path}',this.value)"></div>`}
function obNum(id,label,path,val,min,max,step,unit,extra){return nf(Object.assign({id,label,val:val===''||val==null?'':val,min,max,step,unit,empty:!!(extra&&extra.empty),set:v=>obIn(path,v),release:v=>{if(path==='age')render()}},extra||{}))}
function ob1(){const o=st.ob;const kid=+o.age&&+o.age<18;return `${fld('Імʼя і прізвище','name',o.name,'autocomplete="name"')}
 <div class="field"><label>Стать</label>${seg([['m','Чоловіча'],['f','Жіноча']],o.sex,"(v=>{st.ob.sex=v;render()})")}</div>
 ${obNum('ob-age','Вік','age',o.age,6,90,1,'р.',{empty:true,ph:'30'})}
 ${obNum('ob-height','Зріст','height',o.height,100,230,1,'см',{empty:true,ph:'175'})}
 ${obNum('ob-weight','Вага','weight',o.weight,20,200,0.1,'кг',{empty:true,ph:'75'})}
 ${fld('Місто','city',o.city)}
 ${kid?`<div class="note">${ic('info',20)}<span>До 18 років: дитяча група, окремий рейтинг і харчування без калорій.</span></div>`:''}`}
function ob2(){const o=st.ob;return Object.keys(SPORT).map(k=>{const s=o.sports[k];return `<div class="card ${s.on?'hl':''}" style="padding:0"><button class="li" style="border:0" onclick="st.ob.sports.${k}.on=!st.ob.sports.${k}.on;render()">${sportIco(k,s.on?'a':'')}<div class="grow t16">${SPORT[k].n}</div><span class="tg ${s.on?'on':''}"></span></button>
 ${s.on?`<div class="s12" style="padding:0 16px 16px">
 ${k==='bike'?`<div class="chips">${Object.keys(BIKETYPES).map(t=>`<button class="chip ${s.types.includes(t)?'on':''}" onclick="obToggleArr('sports.bike.types','${t}')">${BIKETYPES[t]}</button>`).join('')}</div>`:''}
 ${seg(Object.keys(LEVEL).map(l=>[l,LEVEL[l]]),s.level,`(v=>{st.ob.sports.${k}.level=v;render()})`)}
 <button class="tgrow" style="background:none;border:0;width:100%;text-align:left" onclick="st.ob.sports.${k}.own=!st.ob.sports.${k}.own;render()"><div class="grow"><div class="t14">Маю свого тренера</div><div class="t12 ter">Не плануємо, лише записуємо тренування</div></div><span class="tg ${s.own?'on':''}"></span></button></div>`:''}</div>`}).join('')}
function ob3(){const o=st.ob;return `<div class="chips">${Object.keys(GOALS).map(g=>`<button class="chip ${o.goals.includes(g)?'on':''}" onclick="obToggleArr('goals','${g}')">${GOALS[g]}</button>`).join('')}</div>
 ${o.goals.includes('ftp')?obNum('ob-tftp','Цільовий FTP (необовʼязково)','targets.ftp',o.targets.ftp,80,500,5,'Вт',{empty:true,ph:'300'}):''}
 ${o.goals.includes('weight')?obNum('ob-tw','Цільова вага (необовʼязково)','targets.weight',o.targets.weight,40,150,0.1,'кг',{empty:true,ph:'75'}):''}
 ${o.goals.includes('race')?`<div class="s8">${fld('Дата старту','targets.raceDate',o.targets.raceDate,'type="date"')}${obNum('ob-rdist','Дистанція','targets.raceDist',nfParse(o.targets.raceDist)||'',5,300,1,'км',{empty:true,ph:'100'})}</div>`:''}`}
function daySummary(d){return d.acts.length?d.acts.map(a=>ACTS[a].n).join(' + ')+' · '+fmtMin(d.min)+(d.tod!=='any'?' · '+TOD[d.tod].toLowerCase():''):'Відпочинок'}
function dayList(arr,src){return `<div class="list">${arr.map((d,i)=>`<button class="li ${d.acts.length?'':'dim'}" onclick="openSheet('obDay',{src:'${src}',i:${i}})"><div class="dayc"><b>${DAYS[i]}</b></div><div class="grow t14 ${d.acts.length?'':'sec'}">${daySummary(d)}</div><span class="chev">${ic(d.acts.length?'edit':'plus',18)}</span></button>`).join('')}</div>`}
function ob4(){const o=st.ob;const tot=o.days.reduce((a,d)=>a+(d.acts.length?d.min:0),0);return dayList(o.days,'ob')+`<div class="t14 sec center">Разом ${fmtMin(tot)} на тиждень</div>`}
function daysArr(src){return src==='ob'?st.ob.days:me().days}
SHEETS.obDay=a=>{const d=daysArr(a.src)[a.i];
 return {title:DAYS_FULL[a.i],body:`<div class="stack">
 <div class="field"><label>Що можу робити</label><div class="chips">${Object.keys(ACTS).map(k=>`<button class="chip ${d.acts.includes(k)?'on':''}" onclick="dayAct('${a.src}',${a.i},'${k}')">${ACTS[k].n}</button>`).join('')}</div></div>
 ${d.acts.length?`${nf({id:'daymin',label:'Скільки часу',val:d.min||60,min:15,max:360,step:5,unit:'хв',plus:true,set:v=>{d.min=v;const h=document.getElementById('dayminhint');if(h)h.textContent=fmtMin(v)}})}<div class="t12 ter" id="dayminhint">${fmtMin(d.min||60)}</div>
 <div class="field"><label>Коли зручно (необовʼязково)</label>${seg(Object.keys(TOD).map(k=>[k,TOD[k]]),d.tod,`(v=>daySet('${a.src}',${a.i},'tod',v))`)}</div>`:`<div class="t14 sec">Не обрано нічого: це день відпочинку</div>`}</div>`,
 foot:`${d.acts.length?`<button class="btn s" style="width:auto" onclick="daySet('${a.src}',${a.i},'rest')">Вихідний</button>`:''}<button class="btn p" onclick="closeSheet();render()">Готово</button>`}};
function dayAct(src,i,k){const d=daysArr(src)[i];const j=d.acts.indexOf(k);if(j>=0)d.acts.splice(j,1);else d.acts.push(k);if(!d.min)d.min=60;render()}
function daySet(src,i,f,v){const d=daysArr(src)[i];if(f==='rest'){d.acts=[];closeSheet();render();return}d[f]=v;if(f!=='min')render()}
function ob5(){const o=st.ob;return `<div class="chips">${Object.keys(EQUIP).map(e=>`<button class="chip ${o.equip.includes(e)?'on':''}" onclick="obToggleArr('equip','${e}')">${EQUIP[e]}</button>`).join('')}</div>
 ${!o.equip.includes('power')&&o.sports.bike.on?`<div class="note">${ic('info',20)}<span>Без пауерметра будуємо вело-тренування за пульсом і відчуттями.</span></div>`:''}`}
function formRow(label,key,opts){
 const o=st.ob.form,unk=o[key+'U'];opts=opts||{};
 const kind=opts.kind;const val=unk?'':(o[key]===''||o[key]==null?(opts.emptyVal||''):o[key]);
 const def=opts.def;
 return `<div class="s8"><div class="between"><span class="t12 sec w6">${label}</span>
  <button class="chip ${unk?'on':''}" style="min-height:40px" onclick="st.ob.form.${key}U=!st.ob.form.${key}U;if(!st.ob.form.${key}U&&!st.ob.form.${key})st.ob.form.${key}='${def}';render()">Не знаю</button></div>
  ${nf({id:'ob-'+key,val:kind? (o[key]||def):val,min:opts.min,max:opts.max,step:opts.step,unit:opts.unit||'',kind,disabled:unk,empty:true,ph:opts.ph||def,set:v=>obIn('form.'+key,kind?(kind==='time'?nfFmtTime(v):nfFmtClock(v)):v)})}
 </div>`}
function ob6(){const o=st.ob;let h='';
 if(o.sports.bike.on)h+=formRow('FTP','ftp',{min:80,max:500,step:5,unit:'Вт',def:'200',ph:'250'});
 h+=formRow('Пульс спокою','hrRest',{min:35,max:100,step:1,unit:'уд/хв',def:'55'});
 h+=formRow('Макс. пульс','hrMax',{min:140,max:220,step:1,unit:'уд/хв',def:'185'});
 if(o.sports.run.on)h+=formRow('5 км','run5k',{kind:'time',min:12*60,max:50*60,step:5,unit:'хв:с',def:'25:00',ph:'25:00'});
 if(o.sports.swim.on)h+=formRow('1500 м','swim1500',{kind:'time',min:16*60,max:60*60,step:5,unit:'хв:с',def:'32:00',ph:'32:00'});
 const unk=(o.sports.bike.on&&o.form.ftpU)||(o.sports.run.on&&o.form.run5kU)||(o.sports.swim.on&&o.form.swim1500U);
 return h+(unk?`<div class="note">${ic('target',20)}<span>Додамо тести на перший тиждень: так зони будуть точними.</span></div>`:'')}
function ob7(){const o=st.ob;return `<div class="field"><label>Травми і обмеження</label><div class="chips">${['Коліна','Спина','Плечі','Гомілкостоп','Немає'].map(t=>`<button class="chip ${o.health.inj.includes(t)?'on':''}" onclick="obToggleArr('health.inj','${t}')">${t}</button>`).join('')}</div></div>
 <div class="field"><label>Тиск</label>${seg([['low','Знижений'],['norm','Норма'],['high','Підвищений']],o.health.bp,"(v=>{st.ob.health.bp=v;render()})")}</div>
 <div class="field"><label>Примітки для тренера</label><textarea class="inp" placeholder="Ліки, хронічні стани, операції" oninput="obIn('health.notes',this.value)">${esc(o.health.notes)}</textarea></div>
 ${o.health.bp==='high'?`<div class="note warn">${ic('alert',20)}<span>Перед інтенсивними тренуваннями порадьтеся з лікарем.</span></div>`:''}`}
function ob8(){const o=st.ob;return `${nf({id:'ob-remind',label:'Нагадування про тренування',val:(()=>{const p=(o.remind||'07:00').split(':');return +p[0]*60+(+p[1]||0)})(),min:5*60,max:22*60,step:15,kind:'clock',set:v=>obIn('remind',nfFmtClock(v))})}
 <button class="card row12" style="text-align:left;color:var(--tx);width:100%" onclick="st.ob.consent=!st.ob.consent;render()"><span class="tg ${o.consent?'on':''}"></span><span class="t14">Погоджуюсь, що тренер Дмитро бачить мої дані: анкету, тренування, самопочуття і харчування</span></button>
 <div class="t12 ter">Інші спортсмени бачать лише те, чим ви поділитесь самі</div>`}
function obProfile(){const o=st.ob;const f=o.form;return {id:st.me.id,created:st.me.created,onboarded:true,name:o.name.trim(),short:(cleanName(o.name)||o.name.trim()).split(' ')[0],ini:initials(o.name),sex:o.sex,age:+o.age,height:+o.height||175,weight:+String(o.weight).replace(',','.')||75,city:o.city,group:+o.age<18?'Діти':'Новачки',
 sports:JSON.parse(JSON.stringify(o.sports)),goals:o.goals.slice(),targets:{ftp:+o.targets.ftp||0,weight:+o.targets.weight||0,raceDate:o.targets.raceDate,raceDist:o.targets.raceDist},
 days:JSON.parse(JSON.stringify(o.days)),equip:o.equip.slice(),form:{ftp:f.ftpU?0:+f.ftp||0,hrRest:f.hrRestU?0:+f.hrRest,hrMax:f.hrMaxU?0:+f.hrMax,run5k:f.run5kU?'':f.run5k,swim1500:f.swim1500U?'':f.swim1500},
 health:JSON.parse(JSON.stringify(o.health)),remind:o.remind,consent:o.consent,races:o.targets.raceDate?[{name:'Мій старт',date:o.targets.raceDate,dist:o.targets.raceDist?((/км/.test(String(o.targets.raceDist))?o.targets.raceDist:o.targets.raceDist+' км')):''}]:[],weightHist:Array(8).fill(+o.weight||75),ftpHist:Array(8).fill(+f.ftp||0)}}
function obReady(){const p=obProfile();const g=genFor(p,0,1);if(weekN(p,0)===0)g.days.forEach(d=>{if(d.i<TODAY){d.items=[];d.rest=true}});const days_=g.days;const tr=days_.filter(d=>!d.rest);st._obDays=days_;
 return `<main><div class="stack" style="padding-top:24px"><div class="success"><div class="okcircle">${ic('check',28)}</div><div class="t28">Ваш план готовий</div><div class="t14 sec">${tr.length} тренувань · ${fmtMin(tr.reduce((a,d)=>a+dayMin(d),0))} · ${weekRange(0)}</div></div>
 <div class="list">${days_.map(d=>{const it=d.items[0],w=it&&itemW(it);return `<div class="li ${d.rest?'dim':''} ${d.i===TODAY?'today-mark':''}"><div class="dayc"><b>${DAYS[d.i]}</b><span>${dayDate(0,d.i).getDate()}</span></div><div class="grow"><div class="t14 w6 ell">${d.rest?'Відпочинок':esc(itemName(it))}</div>${d.rest?'':`<div class="t12 sec ell">${d.items.map(x=>{const ww=itemW(x);return ww?catName(ww.sport,ww.cat):SPORT[x.sport].n}).join(' + ')} · ${fmtMin(dayMin(d))}${d.tod!=='any'?' · '+TOD[d.tod].toLowerCase():''}</div>`}</div>${d.items.some(x=>{const ww=itemW(x);return ww&&ww.cat==='test'})?tag('тест','a'):''}</div>`}).join('')}</div>
 <div class="t12 ter center">Тренер Дмитро перегляне план і за потреби підкоригує</div></div></main>
 <div class="sh-foot"><button class="btn p" id="obgo" onclick="obFinish(this)">Почати</button></div>`}
async function obFinish(btn){await busy(btn,async()=>{const p=obProfile();const old=st.me;
 Object.assign(st.me,{name:p.name,short:p.short,ini:p.ini,sex:p.sex,age:p.age,height:p.height,weight:p.weight,city:p.city,sports:p.sports,goals:p.goals,targets:p.targets,days:p.days,equip:p.equip,form:p.form,health:p.health,remind:p.remind,races:p.races,ftpHist:p.form.ftp?[{d:dayIso(0,TODAY),v:p.form.ftp}]:[]});
 await saveMe({onboarded:true,consent:true});
 if(st.me.status!=='active'){st.ob=null;st.screen='wait';render._k='';render();waitPoll();return}
 await sb.from('weights').upsert({athlete_id:st.me.id,day:dayIso(0,TODAY),kg:p.weight},{onConflict:'athlete_id,day'});
 delete st.plans[st.me.id+'|'+wkIso(0)];
 await loadMine();await loadTeam();st.screen='app';st.tab='plan';st.wk=0;st.ob=null;render._k='';render();subscribeLive();toast('Вітаємо! Тренер отримав вашу заявку')})}
