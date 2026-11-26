/* ---------- NUTRITION ---------- */
function bmr(p){return Math.round(10*p.weight+6.25*p.height-5*p.age+(p.sex==='f'?-161:5))}
function trainKcal(){const d=weekPlan(st.me.id,0).days[TODAY];const done=st.logs.filter(l=>l.day===dayIso(0,TODAY)&&l.status==='done');
 if(done.length)return done.reduce((a,l)=>a+(l.kcal||Math.round((l.duration_min||0)*7)),0);
 return d.items.reduce((a,it)=>{const w=itemW(it);return a+(w?Math.round(wKcal(w,me())*it.min/w.dur):Math.round(it.min*7))},0)}
function norms(){const p=me();const base=Math.round(bmr(p)*1.35);const tr=trainKcal();const def=p.goals.includes('weight')?500:0;const total=base+tr-def;
 const prot=Math.round(p.weight*1.8),fat=Math.round(p.weight*.9),carb=Math.max(0,Math.round((total-prot*4-fat*9)/4));return {base,tr,def,total,prot,fat,carb}}
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
 h+=`<div class="s8"><div class="over">Журнал</div>${list.length?`<div class="list">${list.map(f=>`<div class="li"><button class="grow" style="background:none;border:0;text-align:left;color:inherit;min-height:44px" onclick="openSheet('foodEdit',${f.id})"><div class="t14 w6">${esc(f.name)} <span class="sec" style="font-weight:400">${fmtNum(f.amount)} ${esc(f.unit)}</span></div><div class="t12 ter">Б ${Math.round(f.p)} · Ж ${Math.round(f.f)} · В ${Math.round(f.c)}${+f.alc?' · алкоголь '+(+f.alc).toFixed(1).replace('.',',')+' г':''}</div></button><div class="t14 num">${f.kcal}</div><button class="ib" onclick="delFood(${f.id})" aria-label="Видалити">${ic('x',18)}</button></div>`).join('')}</div>`:`<div class="t14 ter">Поки порожньо</div>`}</div>`;
 return h}
let _cntT=null;
function saveCnt(){render();clearTimeout(_cntT);_cntT=setTimeout(async()=>{const row={athlete_id:st.me.id,day:dayIso(0,TODAY),water:st.cnt.water,coffee:st.cnt.coffee,alc:st.cnt.alc};try{D(await sb.from('daily_counters').upsert(row,{onConflict:'athlete_id,day'}));st.cnts[row.day]=row;checkNewAch()}catch(e){fail(e)}},400)}
function parseIn(){const v=$('#foodin').value.trim();if(!v)return;st._foodTxt=v;st.parsed=parseFood(v);render()}
function scaleFood(f,g){g=Math.max(1,+g||1);const k=g/100;f.kcal=Math.round(f.per.kcal*k);f.p=f.per.p*k;f.f=f.per.f*k;f.c=f.per.c*k;f.alc=(f.per.alc||0)*k;f.coffee=f.per.coffee?Math.max(1,Math.round(g/200)):0;f.g=Math.round(g)}
function updParsedLine(i,f){const cards=document.querySelectorAll('.pf');if(cards[i]){cards[i].querySelector('.pk').textContent=f.kcal+' ккал';cards[i].querySelector('.pm').textContent='Б '+Math.round(f.p)+' · Ж '+Math.round(f.f)+' · В '+Math.round(f.c)+(f.alc?' · алкоголь '+f.alc.toFixed(1).replace('.',',')+' г':'')}
 const sum=st.parsed.out.reduce((a,x)=>({k:a.k+x.kcal,al:a.al+(x.alc||0)}),{k:0,al:0});const p=document.getElementById('psum');if(p)p.innerHTML='<b class="w7">'+sum.k+' ккал</b>'+(sum.al?' <span class="sec">· '+(sum.al/10).toFixed(1).replace('.',',')+' станд. порції алкоголю</span>':'')}
function parsedBlock(){const r=st.parsed;const sum=r.out.reduce((a,f)=>({k:a.k+f.kcal,al:a.al+f.alc}),{k:0,al:0});
 return `<div class="s12">${r.out.map((f,i)=>`<div class="card flat s8 pf"><div class="between"><div class="t14 w6">${esc(f.n)}</div><div class="t14 num pk">${f.kcal} ккал</div></div>
  <div class="t12 ter pm">Б ${Math.round(f.p)} · Ж ${Math.round(f.f)} · В ${Math.round(f.c)}${f.alc?' · алкоголь '+f.alc.toFixed(1).replace('.',',')+' г':''}</div>
  ${nf({id:'fq'+i,val:f.g,min:f.unit==='мл'?10:5,max:f.unit==='мл'?2000:1500,step:f.unit==='мл'?10:5,unit:f.unit,plus:true,set:v=>{scaleFood(f,v);updParsedLine(i,f)}})}</div>`).join('')}
 ${r.unknown.map(u=>`<div class="li" style="min-height:48px"><div class="grow t14 c-warn">Не впізнали: «${esc(u)}». Спробуйте інакше назвати продукт.</div></div>`).join('')}</div>
 <div class="between"><div class="t14" id="psum"><b class="w7">${sum.k} ккал</b>${sum.al?` <span class="sec">· ${(sum.al/10).toFixed(1).replace('.',',')} станд. порції алкоголю</span>`:''}</div></div>
 ${r.out.length?`<button class="btn p" onclick="addParsed(this)">Додати в журнал</button>`:''}`}
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
SHEETS.norm=()=>{const n=norms(),p=me();return {title:'Ваша норма',body:`<div class="stack"><div class="list">
 ${[['Базовий обмін (Міффлін)',bmr(p)],['Побутова активність ×1,35',n.base],['Тренування сьогодні','+'+n.tr],['Дефіцит для схуднення',n.def?'−'+n.def:'0']].map(x=>`<div class="li" style="min-height:48px"><div class="grow t14 sec">${x[0]}</div><div class="t14 num">${x[1]}</div></div>`).join('')}
 <div class="li" style="min-height:48px"><div class="grow t16">Норма на сьогодні</div><div class="t16 num acc">${fmtNum(n.total)} ккал</div></div></div>
 <div class="t12 ter">Рахуємо з профілю: ${p.age} років, ${p.height} см, ${String(p.weight).replace('.',',')} кг. Білок ${n.prot} г (1,8 г/кг), жири ${n.fat} г, решта вуглеводи.</div></div>`}};
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
