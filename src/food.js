/* ---------- NUTRITION ---------- */
function bmr(p){return Math.round(10*p.weight+6.25*p.height-5*p.age+(p.sex==='f'?-161:5))}
function trainKcal(){const d=weekPlan(st.me.id,0).days[TODAY];const done=st.logs.filter(l=>l.day===dayIso(0,TODAY)&&l.status==='done');
 if(done.length)return done.reduce((a,l)=>a+(l.kcal||Math.round((l.duration_min||0)*7)),0);
 return d.items.reduce((a,it)=>{const w=itemW(it);return a+(w?Math.round(wKcal(w,me())*it.min/w.dur):Math.round(it.min*7))},0)}
function nutrOf(p){const n=p.nutr||{};const goal=n.goal||(p.goals.includes('weight')?'cut':'keep');return {act:n.act||1.35,goal,delta:n.delta!=null?n.delta:(goal==='keep'?0:goal==='gain'?300:500),protKg:n.protKg||1.8,fatKg:n.fatKg||.9,kcal:n.kcal||null}}
function normsFor(p,tr){const N=nutrOf(p);const b=bmr(p);const base=Math.round(b*N.act);const d=N.goal==='keep'?0:Math.round(N.delta||0);const def=N.goal==='cut'?d:N.goal==='gain'?-d:0;const auto=Math.max(1200,base+tr-def);const total=N.kcal?Math.round(N.kcal):auto;
 const prot=Math.round(p.weight*N.protKg),fat=Math.round(p.weight*N.fatKg),carb=Math.max(0,Math.round((total-prot*4-fat*9)/4));return {bmr:b,base,tr,def,auto,total,prot,fat,carb,N}}
function norms(){return normsFor(me(),trainKcal())}
function todayFood(){return st.food.filter(f=>f.day===dayIso(0,TODAY))}
function eaten(list){return (list||todayFood()).reduce((a,f)=>({kcal:a.kcal+f.kcal,p:a.p+ +f.p,f:a.f+ +f.f,c:a.c+ +f.c,alc:a.alc+(+f.alc||0)}),{kcal:0,p:0,f:0,c:0,alc:0})}
function ring(p,label,sub){const r=48,c=2*Math.PI*r;const v=Math.max(0,Math.min(1,p));return `<div class="ring"><svg width="112" height="112" viewBox="0 0 112 112"><circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--s3)" stroke-width="10"/><circle cx="56" cy="56" r="${r}" fill="none" stroke="var(--acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c*v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 56 56)"/></svg><div class="in"><div class="t20 num">${label}</div><div class="t12 ter">${sub}</div></div></div>`}
function foodView(){
 if(isKid())return kidFood();
 let h=`<div class="stack">${seg([['today','Сьогодні'],['week','Тиждень'],['plans','Раціони']],st.nutSeg,'nutSeg')}`;
 h+=({today:foodToday,week:foodWeek,plans:foodPlans})[st.nutSeg]();return h+'</div>'}
function nutSeg(v){st.nutSeg=v;render()}
function foodToday(){
 const n=norms(),e=eaten();const left=n.total-e.kcal;const list=todayFood();
 let h=`<div class="card"><div class="row12" style="gap:16px">${ring(e.kcal/n.total,fmtNum(Math.abs(left)),left>=0?'ккал лишилось':'ккал понад')}
  <div class="grow s8">${[['Білки',e.p,n.prot],['Жири',e.f,n.fat],['Вуглеводи',e.c,n.carb]].map(x=>`<div><div class="between t12"><span class="sec">${x[0]}</span><span class="num">${Math.round(x[1])} / ${x[2]} г</span></div><div style="margin-top:4px">${bar(x[2]?x[1]/x[2]*100:0)}</div></div>`).join('')}</div></div>
  <button class="btn t" style="margin:8px -8px -8px" onclick="openSheet('norm')">${ic('info',18)} Як рахуємо норму ${fmtNum(n.total)} ккал</button></div>`;
 h+=`<div class="card s12"><div class="t16">Що ви зʼїли?</div><div class="composer"><input class="inp" id="foodin" placeholder="300 г свинини і 50 мл віскі" value="${esc(st._foodTxt||'')}" onkeydown="if(event.key==='Enter')parseIn()"><button class="sendb" onclick="parseIn()" aria-label="Розпізнати">${ic('plus',22)}</button></div>
  ${st.parsed?parsedBlock():`<div class="t12 ter">Пишіть як зручно: кількість, продукт, кілька страв через кому або «і»</div>`}</div>`;
 const d=weekPlan(st.me.id,0).days[TODAY];
 if(!d.rest&&n.tr>0)h+=`<div class="note">${ic('zap',20)}<span>Сьогодні тренування (≈${n.tr} ккал). Додайте 60–80 г вуглеводів за 2 год до нього і білок після.</span></div>`;
 h+=`<div class="s8">${nf({id:'c-water',label:'Вода',val:st.cnt.water,min:0,max:20,step:1,unit:'скл.',plus:true,set:v=>st.cnt.water=v,release:()=>saveCnt()})}
  ${nf({id:'c-coffee',label:'Кава',val:st.cnt.coffee,min:0,max:12,step:1,unit:'чашки',plus:true,set:v=>st.cnt.coffee=v,release:()=>saveCnt()})}
  ${nf({id:'c-alc',label:'Алкоголь',val:st.cnt.alc,min:0,max:12,step:1,unit:'порції',plus:true,set:v=>st.cnt.alc=v,release:()=>saveCnt()})}</div>`;
 if(st.cnt.water<8)h+=`<div class="note">${ic('drop',20)}<span>До кінця дня ще ${Math.max(0,10-st.cnt.water)} склянок води.${n.prot-e.p>10?' Білка бракує '+Math.round(n.prot-e.p)+' г.':''}</span></div>`;
 h+=`<div class="s8"><div class="over">Журнал</div>${list.length?`<div class="list">${list.map(f=>`<div class="li"><button class="grow" style="background:none;border:0;text-align:left;color:inherit;min-height:44px" onclick="openSheet('foodEdit',${f.id})"><div class="t14 w6">${esc(f.name)} <span class="sec" style="font-weight:400">${fmtNum(f.amount)} ${esc(f.unit)}</span>${f.per&&f.per.ai?' <span class="t12 acc" style="font-weight:400">≈ АІ</span>':''}</div><div class="t12 ter">Б ${Math.round(f.p)} · Ж ${Math.round(f.f)} · В ${Math.round(f.c)}${+f.alc?' · алкоголь '+(+f.alc).toFixed(1).replace('.',',')+' г':''}</div></button><div class="t14 num">${f.kcal}</div><button class="ib" onclick="delFood(${f.id})" aria-label="Видалити">${ic('x',18)}</button></div>`).join('')}</div>`:`<div class="t14 ter">Поки порожньо</div>`}</div>`;
 return h}
let _cntT=null;
function saveCnt(){render();clearTimeout(_cntT);_cntT=setTimeout(async()=>{const row={athlete_id:st.me.id,day:dayIso(0,TODAY),water:st.cnt.water,coffee:st.cnt.coffee,alc:st.cnt.alc};try{D(await sb.from('daily_counters').upsert(row,{onConflict:'athlete_id,day'}));st.cnts[row.day]=row;checkNewAch()}catch(e){fail(e)}},400)}
function parseIn(){const v=$('#foodin').value.trim();if(!v)return;st._foodTxt=v;const r=parseFood(v);r.notes=[];r.pending=r.unknown.length>0;st.parsed=r;render();if(r.pending)aiFood(r)}
/* unknown parts → AI estimate (cached server-side); local generic match is the fallback */
function aiItem(i,src){const g=Math.max(1,Math.round(+i.grams||100)),k=100/g;
 return {n:i.name_uk,q:g+' '+i.unit,g,unit:i.unit==='мл'?'мл':'г',kcal:Math.round(+i.kcal||0),p:+i.protein||0,f:+i.fat||0,c:+i.carbs||0,alc:+i.alcohol_g||0,coffee:0,ai:true,src,
  per:{kcal:(+i.kcal||0)*k,p:(+i.protein||0)*k,f:(+i.fat||0)*k,c:(+i.carbs||0)*k,alc:(+i.alcohol_g||0)*k,coffee:false,ai:true}}}
async function aiFood(r){const parts=r.unknown.slice();let data=null;
 try{const res=await sb.functions.invoke('food-estimate',{body:{parts}});if(res.error)throw res.error;data=res.data}catch(e){console.error(e)}
 if(st.parsed!==r)return; /* user started a new query */
 const left=[];const key=t=>String(t).toLowerCase().replace(/ё/g,'е').replace(/[’ʼ'`]/g,'ʼ').replace(/\s+/g,' ').trim().slice(0,200);
 for(const p of parts){const items=data&&data.results&&data.results[key(p)];
  if(items&&items.length)items.forEach(i=>r.out.push(aiItem(i,p)));
  else if(r.fallback&&r.fallback[p])r.out.push(r.fallback[p]);
  else left.push(p)}
 r.unknown=left;r.pending=false;
 if(!data)r.notes.push(left.length?'АІ-оцінка зараз недоступна. Спробуйте пізніше або назвіть продукт інакше.':'');
 else if(data.configured===false)r.notes.push('АІ ще не підключено, тому оцінюємо лише продукти з бази.');
 else if(data.limited)r.notes.push('Ліміт АІ-оцінок на сьогодні вичерпано ('+(data.limit||60)+'). Завтра знову запрацює.');
 r.notes=r.notes.filter(Boolean);render()}
function setKcal(f,v){v=Math.max(0,Math.round(+v||0));const k=f.kcal>0?v/f.kcal:1;f.kcal=v;if(f.kcal&&k!==1){f.p*=k;f.f*=k;f.c*=k}
 const r=100/Math.max(1,f.g);f.per={...f.per,kcal:v*r,p:f.p*r,f:f.f*r,c:f.c*r}}
function scaleFood(f,g){g=Math.max(1,+g||1);const k=g/100;f.kcal=Math.round(f.per.kcal*k);f.p=f.per.p*k;f.f=f.per.f*k;f.c=f.per.c*k;f.alc=(f.per.alc||0)*k;f.coffee=f.per.coffee?Math.max(1,Math.round(g/200)):0;f.g=Math.round(g)}
function updParsedLine(i,f){const cards=document.querySelectorAll('.pf');if(cards[i]){cards[i].querySelector('.pk').textContent=f.kcal+' ккал';cards[i].querySelector('.pm').textContent='Б '+Math.round(f.p)+' · Ж '+Math.round(f.f)+' · В '+Math.round(f.c)+(f.alc?' · алкоголь '+f.alc.toFixed(1).replace('.',',')+' г':'')}
 const sum=st.parsed.out.reduce((a,x)=>({k:a.k+x.kcal,al:a.al+(x.alc||0)}),{k:0,al:0});const p=document.getElementById('psum');if(p)p.innerHTML='<b class="w7">'+sum.k+' ккал</b>'+(sum.al?' <span class="sec">· '+(sum.al/10).toFixed(1).replace('.',',')+' станд. порції алкоголю</span>':'')}
function parsedBlock(){const r=st.parsed;const sum=r.out.reduce((a,f)=>({k:a.k+f.kcal,al:a.al+f.alc}),{k:0,al:0});
 return `<div class="s12">${r.out.map((f,i)=>`<div class="card flat s8 pf"><div class="between"><div class="t14 w6">${esc(f.n)}${f.ai?` <span class="tag a" style="height:20px;font-size:11px;padding:0 6px;vertical-align:1px">≈ оцінка АІ</span>`:''}</div><div class="t14 num pk">${f.kcal} ккал</div></div>
  <div class="t12 ter pm">Б ${Math.round(f.p)} · Ж ${Math.round(f.f)} · В ${Math.round(f.c)}${f.alc?' · алкоголь '+f.alc.toFixed(1).replace('.',',')+' г':''}</div>
  ${nf({id:'fq'+i,val:f.g,min:f.unit==='мл'?10:5,max:f.unit==='мл'?2000:1500,step:f.unit==='мл'?10:5,unit:f.unit,plus:true,set:v=>{scaleFood(f,v);updParsedLine(i,f);if(f.ai&&NF['fk'+i])nfSyncView('fk'+i,f.kcal,false)}})}
  ${f.ai?nf({id:'fk'+i,label:'Калорії, якщо знаєте точніше',val:f.kcal,min:0,max:3000,step:1,unit:'ккал',set:v=>{setKcal(f,v);updParsedLine(i,f)}}):''}</div>`).join('')}
 ${r.pending?`<div class="li" style="min-height:48px"><span class="spin" style="color:var(--acc)"></span><div class="grow t14 sec">Оцінюємо через АІ: «${esc(r.unknown.join('», «'))}»…</div></div>`:''}
 ${(r.notes||[]).map(t=>`<div class="note">${ic('info',20)}<span>${esc(t)}</span></div>`).join('')}
 ${r.pending?'':r.unknown.map(u=>`<div class="li" style="min-height:48px"><div class="grow t14 c-warn">Не впізнали: «${esc(u)}». Спробуйте інакше назвати продукт.</div></div>`).join('')}</div>
 <div class="between"><div class="t14" id="psum"><b class="w7">${sum.k} ккал</b>${sum.al?` <span class="sec">· ${(sum.al/10).toFixed(1).replace('.',',')} станд. порції алкоголю</span>`:''}</div></div>
 ${r.out.length?`<button class="btn p" ${r.pending?'disabled':''} onclick="addParsed(this)">Додати в журнал</button>`:''}`}
async function addParsed(btn){await busy(btn,async()=>{const day=dayIso(0,TODAY);
 const rows=st.parsed.out.map(f=>({athlete_id:st.me.id,day,name:f.n,amount:f.g,unit:f.unit,kcal:f.kcal,p:+f.p.toFixed(1),f:+f.f.toFixed(1),c:+f.c.toFixed(1),alc:+(f.alc||0).toFixed(1),per:f.per}));
 const saved=D(await sb.from('food_entries').insert(rows).select());st.food=st.food.concat(saved);
 st.parsed.out.forEach(f=>{if(f.coffee)st.cnt.coffee+=f.coffee;if(f.alc)st.cnt.alc+=Math.max(1,Math.round(f.alc/10))});st.parsed=null;st._foodTxt='';saveCnt();toast('Додано в журнал')})}
async function delFood(id){try{D(await sb.from('food_entries').delete().eq('id',id));st.food=st.food.filter(f=>f.id!==id);render()}catch(e){fail(e)}}
SHEETS.foodEdit=id=>{const f=st.food.find(x=>x.id===id);if(!f)return {title:'',body:''};const per=f.per||{kcal:f.kcal/f.amount*100,p:f.p/f.amount*100,f:f.f/f.amount*100,c:f.c/f.amount*100,alc:f.alc/f.amount*100};st._fe={g:+f.amount};
 const line=g=>{const k=g/100;return 'Б '+Math.round(per.p*k)+' · Ж '+Math.round(per.f*k)+' · В '+Math.round(per.c*k)+' · '+Math.round(per.kcal*k)+' ккал'};
 return {title:esc(f.name),body:`<div class="stack">${nf({id:'fe',label:'Кількість',val:+f.amount,min:f.unit==='мл'?10:5,max:f.unit==='мл'?2000:1500,step:f.unit==='мл'?10:5,unit:f.unit,plus:true,set:v=>{st._fe.g=v;const el=document.getElementById('feline');if(el)el.textContent=line(v)}})}
  <div class="t14 sec" id="feline">${line(+f.amount)}</div></div>`,
 foot:`<button class="btn p" onclick="saveFoodEdit(this,${id})">Зберегти</button>`}};
async function saveFoodEdit(btn,id){await busy(btn,async()=>{const f=st.food.find(x=>x.id===id);const per=f.per||{kcal:f.kcal/f.amount*100,p:f.p/f.amount*100,f:f.f/f.amount*100,c:f.c/f.amount*100,alc:f.alc/f.amount*100};const g=st._fe.g,k=g/100;
 const upd={amount:g,kcal:Math.round(per.kcal*k),p:+(per.p*k).toFixed(1),f:+(per.f*k).toFixed(1),c:+(per.c*k).toFixed(1),alc:+((per.alc||0)*k).toFixed(1)};D(await sb.from('food_entries').update(upd).eq('id',id));Object.assign(f,upd);closeAll();render();toast('Кількість оновлено')})}
const ACT_L=[[1.2,'Сидяча робота, мало руху'],[1.375,'Трохи руху: прогулянки, побут'],[1.55,'Помірно: на ногах пів дня'],[1.725,'Активно: фізична робота'],[1.9,'Дуже активно: важка фізична праця']];
function actLabel(a){return ACT_L.reduce((b,x)=>Math.abs(x[0]-a)<Math.abs(b[0]-a)?x:b)[1]}
const GOAL_L={cut:'Схуднення',keep:'Підтримка ваги',gain:'Набір маси'};
const dec=(x,d)=>String((+x).toFixed(d==null?2:d)).replace(/\.?0+$/,'').replace('.',',');
function normRows(n,p){return `<div class="list">${[['Базовий обмін (Міффлін)',fmtNum(n.bmr)],['Побутова активність ×'+dec(n.N.act),fmtNum(n.base)],['Тренування сьогодні','+'+n.tr],[n.N.goal==='gain'?'Профіцит для набору':'Дефіцит для схуднення',n.def>0?'−'+n.def:n.def<0?'+'+(-n.def):'0']].map(x=>`<div class="li" style="min-height:48px"><div class="grow t14 sec">${x[0]}</div><div class="t14 num">${x[1]}</div></div>`).join('')}
 ${n.N.kcal?`<div class="li" style="min-height:48px"><div class="grow t14 sec">Розрахунок (замінено вручну)</div><div class="t14 num ter"><s>${fmtNum(n.auto)}</s></div></div>`:''}
 <div class="li" style="min-height:48px"><div class="grow t16">Норма на сьогодні${n.N.kcal?' · вручну':''}</div><div class="t16 num acc">${fmtNum(n.total)} ккал</div></div></div>
 <div class="t12 ter">${p.age} р., ${p.height} см, ${dec(p.weight,1)} кг · ${GOAL_L[n.N.goal]}. Білок ${n.prot} г (${dec(n.N.protKg,1)} г/кг), жири ${n.fat} г (${dec(n.N.fatKg,1)} г/кг), вуглеводи ${n.carb} г.</div>`}
SHEETS.norm=()=>{const n=norms(),p=me();return {title:'Ваша норма',body:`<div class="stack">${normRows(n,p)}</div>`,foot:`<button class="btn p" onclick="normEditOpen()">${ic('edit',20)} Змінити</button>`}};
function normEditOpen(){const p=me();st._ne={weight:p.weight,height:p.height,age:p.age,sex:p.sex,...nutrOf(p)};openSheet('normEdit')}
function neP(){const e=st._ne,p=me();return Object.assign({},p,{weight:+e.weight||p.weight,height:+e.height||p.height,age:+e.age||p.age,sex:e.sex,nutr:{act:e.act,goal:e.goal,delta:e.delta,protKg:e.protKg,fatKg:e.fatKg,kcal:e.kcal||null}})}
function neUpdate(){const el=$('#neprev');if(el){const q=neP();el.innerHTML=normRows(normsFor(q,trainKcal()),q)}}
function neSet(k,v,re){st._ne[k]=v;if(re){renderSheet()}else neUpdate()}
SHEETS.normEdit=()=>{const e=st._ne;if(!e)return {title:'',body:''};const u=v=>{neUpdate()};
 return {title:'Змінити норму',full:true,body:`<div class="stack">
 <div class="over">Про вас</div>
 ${nf({id:'ne-w',label:'Вага',val:e.weight,min:25,max:200,step:.1,unit:'кг',plus:true,set:v=>{e.weight=v;u()}})}
 ${nf({id:'ne-h',label:'Зріст',val:e.height,min:100,max:230,step:1,unit:'см',set:v=>{e.height=v;u()}})}
 ${nf({id:'ne-a',label:'Вік',val:e.age,min:10,max:90,step:1,unit:'р.',set:v=>{e.age=v;u()}})}
 <div class="field"><label>Стать</label>${seg([['m','Чоловік'],['f','Жінка']],e.sex,"(v=>neSet('sex',v,true))")}</div>
 <div class="over">Активність поза тренуваннями</div>
 <div class="list">${ACT_L.map(x=>`<button class="li" style="min-height:52px" onclick="neSet('act',${x[0]},true)"><div class="grow"><div class="t14 w6">${x[1]}</div><div class="t12 ter">×${dec(x[0],3)}</div></div>${Math.abs(e.act-x[0])<.01?`<span class="acc">${ic('check',20)}</span>`:''}</button>`).join('')}</div>
 ${nf({id:'ne-act',label:'Точний коефіцієнт',val:e.act,min:1.2,max:1.9,step:.025,unit:'×',set:v=>{e.act=v;u()}})}
 <div class="t12 ter">Тренування додаються окремо щодня, тому тут враховуйте лише роботу і побут.</div>
 <div class="over">Мета</div>
 ${seg([['cut','Схуднення'],['keep','Підтримка'],['gain','Набір']],e.goal,"(v=>{st._ne.delta=v==='keep'?0:(st._ne.delta||(v==='gain'?300:500));neSet('goal',v,true)})")}
 ${e.goal==='keep'?'':nf({id:'ne-d',label:e.goal==='gain'?'Профіцит на день':'Дефіцит на день',val:e.delta,min:100,max:1000,step:50,unit:'ккал',plus:true,set:v=>{e.delta=v;u()}})}
 ${e.goal==='cut'&&e.delta>750?`<div class="note warn">${ic('alert',20)}<span>Великий дефіцит під час тренувань знижує потужність і відновлення. Безпечно: 300–600 ккал.</span></div>`:''}
 <div class="over">Макроси</div>
 ${nf({id:'ne-p',label:'Білок',val:e.protKg,min:1,max:3,step:.1,unit:'г/кг',set:v=>{e.protKg=v;u()}})}
 ${nf({id:'ne-f',label:'Жири',val:e.fatKg,min:.5,max:2,step:.1,unit:'г/кг',set:v=>{e.fatKg=v;u()}})}
 <div class="over">Своя норма (необовʼязково)</div>
 ${nf({id:'ne-k',label:'Загальна норма ккал вручну',val:e.kcal||'',min:1200,max:6000,step:50,unit:'ккал',empty:true,ph:'рахувати автоматично',set:v=>{e.kcal=v===''?null:v;u()}})}
 <div class="t12 ter">Якщо заповнити, ця цифра замінить розрахунок. Залиште порожнім, щоб рахувати автоматично.</div>
 <div class="over">Результат</div><div id="neprev">${normRows(normsFor(neP(),trainKcal()),neP())}</div>
 </div>`,foot:`<button class="btn p" onclick="normSave(this)">Зберегти</button>`}};
async function normSave(btn){const e=st._ne;await busy(btn,async()=>{const p=me();const oldW=p.weight;p.weight=Math.round((+e.weight||p.weight)*10)/10;p.height=Math.round(+e.height||p.height);p.age=Math.round(+e.age||p.age);p.sex=e.sex;
 p.nutr={act:Math.round(e.act*1000)/1000,goal:e.goal,delta:e.goal==='keep'?0:Math.round(e.delta||0),protKg:Math.round(e.protKg*10)/10,fatKg:Math.round(e.fatKg*10)/10,kcal:e.kcal?Math.round(e.kcal):null};
 await saveMe();
 if(p.weight!==oldW){const row={athlete_id:p.id,day:dayIso(0,TODAY),kg:p.weight};const r=await sb.from('weights').upsert(row,{onConflict:'athlete_id,day'});if(!r.error)st.weights=st.weights.filter(w=>w.day!==row.day).concat([row]).sort((a,b)=>a.day<b.day?-1:1)}
 st._ne=null;closeSheet();render();renderSheet();toast('Норму оновлено: '+fmtNum(norms().total)+' ккал')})}
function foodWeek(){const p=me(),n=norms();const kc=[],labels=[];
 for(let i=0;i<7;i++){const day=dayIso(0,i);kc.push(st.food.filter(f=>f.day===day).reduce((a,f)=>a+f.kcal,0));labels.push(DAYS[i])}
 const logged=kc.slice(0,TODAY+1).filter(x=>x>0);const avg=logged.length?Math.round(logged.reduce((a,b)=>a+b)/logged.length):0;
 const wh=st.weights.slice(-12).map(w=>+w.kg);
 let h=`<div class="card hl s12"><div class="over">Середнє за тиждень</div><div class="t28 num">${avg?fmtNum(avg)+' ккал':'—'}</div><div class="t14 sec">${avg?'Норма сьогодні '+fmtNum(n.total)+' ккал. Різниця '+(avg-n.total>0?'+':'')+fmtNum(avg-n.total)+' ккал на день.':'Вносьте їжу щодня, і тут зʼявиться аналіз'}</div></div>
 <div class="card s12"><div class="t16">Спожито за днями</div>${barChart(kc,labels,{hl:TODAY,h:96})}</div>`;
 if(wh.length>=2)h+=`<div class="card s12"><div class="t16">Вага</div>${lineChart(wh,{target:p.targets.weight||null,h:100})}<div class="legend"><span><i style="background:var(--acc)"></i>Вага</span>${p.targets.weight?`<span><i style="background:var(--acc2)"></i>Ціль ${String(p.targets.weight).replace('.',',')} кг</span>`:''}</div></div>`;
 return h+`<div class="note">${ic('info',20)}<span>Безпечний темп схуднення: до 0,5–0,8 кг на тиждень. Швидше худнути під час навантажень не варто: падає потужність.</span></div>`}
function foodPlans(){return `<div class="list">${MEALPLANS.map((m,k)=>li({left:`<span class="ico">${ic('list',20)}</span>`,t:m.t,s:m.items.length+' прийоми їжі',on:`openSheet('meal',${k})`})).join('')}</div>
 <div class="list">${li({left:`<span class="ico">${ic('book',20)}</span>`,t:'Рецепти',s:RECIPES.length+' рецептів для спортсменів',on:"openSheet('recipes')"})}${li({left:`<span class="ico">${ic('check',20)}</span>`,t:'Список покупок',s:SHOPPING.length+' позицій на тиждень',on:"openSheet('shop')"})}</div>`}
SHEETS.meal=k=>({title:MEALPLANS[k].t,body:`<div class="list">${MEALPLANS[k].items.map(i=>{const [a,b]=i.split(': ');return `<div class="li"><div class="grow"><div class="t14 w6">${a}</div><div class="t14 sec">${b}</div></div></div>`}).join('')}</div>`});
const RECIPES=[['Вівсянка з бананом і горіхами','10 хв · 520 ккал · Б 18'],['Курка з рисом і овочами','25 хв · 610 ккал · Б 48'],['Сирники в духовці','30 хв · 380 ккал · Б 30'],['Гречка з яловичиною','35 хв · 560 ккал · Б 40'],['Домашній енергетичний батончик','15 хв · 210 ккал · В 32'],['Скумбрія з картоплею','30 хв · 590 ккал · Б 34']];
SHEETS.recipes=()=>({title:'Рецепти',body:`<div class="list">${RECIPES.map(r=>li({left:`<span class="ico">${ic('food',20)}</span>`,t:r[0],s:r[1],right:''})).join('')}</div>`});
SHEETS.shop=()=>{const got=JSON.parse(localStorage.getItem('shop')||'[]');return {title:'Список покупок',body:`<div class="list">${SHOPPING.map((s,k)=>{const on=got.includes(k);return `<button class="li" onclick="shopT(${k})"><span class="${on?'c-ok':'ter'}">${ic(on?'check':'plus',20)}</span><div class="grow t14 ${on?'ter':''}" style="${on?'text-decoration:line-through':''}">${s}</div></button>`}).join('')}</div>`,foot:`<button class="btn s" onclick="shareShop()">${ic('share',20)} Поділитися списком</button>`}};
function shopT(k){const got=JSON.parse(localStorage.getItem('shop')||'[]');const i=got.indexOf(k);if(i>=0)got.splice(i,1);else got.push(k);localStorage.setItem('shop',JSON.stringify(got));renderSheet()}
async function shareShop(){const t='Список покупок:\n'+SHOPPING.join('\n');try{if(navigator.share)await navigator.share({text:t});else{await navigator.clipboard.writeText(t);toast('Список скопійовано')}}catch(e){}}
function kidFood(){
 return `<div class="stack"><div class="card hl s12"><div class="over">Здорове харчування</div><div class="t20">Тарілка спортсмена</div>
 <div class="t14 sec">Половина тарілки: овочі і фрукти. Чверть: каша, рис або хліб. Чверть: мʼясо, риба, яйця чи сир.</div>
 <div style="display:flex;height:16px;border-radius:8px;overflow:hidden;gap:2px"><i style="flex:2;background:var(--ok)"></i><i style="flex:1;background:var(--acc)"></i><i style="flex:1;background:var(--acc2)"></i></div>
 <div class="legend"><span><i style="background:var(--ok)"></i>Овочі і фрукти</span><span><i style="background:var(--acc)"></i>Крупи</span><span><i style="background:var(--acc2)"></i>Білок</span></div></div>
 ${nf({id:'k-water',label:'Вода',val:st.cnt.water,min:0,max:16,step:1,unit:'скл.',plus:true,set:v=>st.cnt.water=v,release:()=>saveCnt()})}
 <div class="s8"><div class="over">Поради на сьогодні</div><div class="list">${[['Перед тренуванням','Банан або бутерброд за годину до старту'],['Після тренування','Склянка молока або йогурт і фрукт'],['Солодкі напої','Краще вода: вона найкраще відновлює']].map(x=>li({left:`<span class="ico">${ic('leaf',20)}</span>`,t:x[0],s:x[1],right:''})).join('')}</div></div>
 <div class="t12 ter center">Для спортсменів до 18 років калорії і дефіцит не показуємо</div></div>`}
