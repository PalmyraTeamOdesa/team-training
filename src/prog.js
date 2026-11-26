/* ---------- STATS ---------- */
function doneLogs(){return st.logs.filter(l=>l.status==='done')}
function km(l){return l.distance?(l.sport==='swim'?l.distance/1000:+l.distance):0}
function statsRange(from,to){const L=doneLogs().filter(l=>l.day>=from&&l.day<=to);return {min:L.reduce((a,l)=>a+(l.duration_min||0),0),bike:L.filter(l=>l.sport==='bike').reduce((a,l)=>a+km(l),0),run:L.filter(l=>l.sport==='run').reduce((a,l)=>a+km(l),0),swim:L.filter(l=>l.sport==='swim').reduce((a,l)=>a+(+l.distance||0),0),tss:L.reduce((a,l)=>a+(l.tss||0),0),n:L.length}}
function fitness(){const map={};doneLogs().forEach(l=>map[l.day]=(map[l.day]||0)+(l.tss||0));let c=0,a=0;const ctl=[],atl=[],tsb=[];
 for(let d=-83;d<=0;d++){const day=iso(new Date(NOW.getFullYear(),NOW.getMonth(),NOW.getDate()+d));const t=map[day]||0;c+=(t-c)/42;a+=(t-a)/7;if(d>-56){ctl.push(+c.toFixed(1));atl.push(+a.toFixed(1));tsb.push(+(c-a).toFixed(1))}}return {ctl,atl,tsb}}
function streakMax(){const days=new Set(st.logs.filter(l=>l.status==='done').map(l=>l.day).concat(Object.keys(st.well)));const arr=[...days].sort();let best=0,cur=0,prev=null;
 arr.forEach(d=>{if(prev&&Math.round((parseIso(d)-parseIso(prev))/864e5)===1)cur++;else cur=1;best=Math.max(best,cur);prev=d});return best}
function fullWeeks(){let n=0;for(let wk=-26;wk<=0;wk++){const r=st.plans[st.me.id+'|'+wkIso(wk)];if(!r)continue;const days=planRowToDays(r).filter(d=>!d.rest);if(days.length&&days.every(d=>isDone(st.me.id,wk,d.i)))n++}return n}
function metrics(){const L=doneLogs();const p=me();const myPosts=st.posts.filter(x=>x.author_id===p.id);const w0=st.weights.length?+st.weights[0].kg:p.weight,w1=st.weights.length?+st.weights[st.weights.length-1].kg:p.weight;
 const weeks={};L.forEach(l=>{const k=wkOfIso(l.day);(weeks[k]=weeks[k]||new Set()).add(l.sport)});
 return {bikeKm:L.filter(l=>l.sport==='bike').reduce((a,l)=>a+km(l),0),hours:L.reduce((a,l)=>a+(l.duration_min||0),0)/60,n:L.length,streak:streakMax(),fullW:fullWeeks(),ftp:+p.form.ftp||0,wkg:p.form.ftp?p.form.ftp/p.weight:0,
  runKm:L.filter(l=>l.sport==='run').reduce((a,l)=>a+km(l),0),runN:L.filter(l=>l.sport==='run').length,swimKm:L.filter(l=>l.sport==='swim').reduce((a,l)=>a+km(l),0),swimN:L.filter(l=>l.sport==='swim').length,
  likes:myPosts.reduce((a,x)=>a+(x.post_likes||[]).length,0),comments:st.posts.reduce((a,x)=>a+(x.post_comments||[]).filter(c=>c.author_id===p.id).length,0),rides:st.rides.filter(r=>(r.ride_participants||[]).some(x=>x.user_id===p.id)).length,posts:myPosts.length,
  wellDays:Object.keys(st.well).length,waterDays:Object.values(st.cnts||{}).filter(c=>c.water>=8).length,lost:Math.max(0,w0-w1),tests:L.filter(l=>{const w=libById(l.workout_id);return w&&w.cat==='test'}).length,
  tri:Object.values(weeks).some(s=>s.has('bike')&&s.has('run')&&s.has('swim')),gym:L.filter(l=>l.sport==='gym').length}}
const ACH_CATS=[['vol','Обсяг'],['streak','Регулярність'],['power','Потужність'],['run','Біг'],['swim','Плавання'],['team','Команда'],['health','Здоровʼя'],['special','Особливі']];
const ACH=[];
(function(){const add=(cat,name,desc,icon,test)=>ACH.push({id:'a'+ACH.length,cat,name,desc,icon,test});
 [100,250,500,1000,2000,3000,5000,7500,10000,15000,20000].forEach(k=>add('vol',fmtNum(k)+' км на вело','Сумарний пробіг '+fmtNum(k)+' км','bike',m=>m.bikeKm>=k));
 [10,25,50,100,200,300,500,750,1000].forEach(h=>add('vol',h+' годин тренувань','Сумарний час '+h+' год','clock',m=>m.hours>=h));
 [1,10,25,50,100,200,300,500].forEach(n=>add('vol',n===1?'Перше тренування':n+' тренувань',n===1?'Перший крок зроблено':'Зараховано '+n+' тренувань','check',m=>m.n>=n));
 [3,7,14,21,30,60,90,180,365].forEach(d=>add('streak','Серія '+d+' днів','Тренування або самопочуття '+d+' днів поспіль','flame',m=>m.streak>=d));
 [1,2,4,8,12,26,52].forEach(w=>add('streak','План 100% · '+w+' тиж.','Повністю виконаний план '+w+' тиж.','check',m=>m.fullW>=w));
 [150,200,250,300,350].forEach(f=>add('power','FTP '+f+' Вт','Функціональна порогова потужність '+f+' Вт','zap',m=>m.ftp>=f));
 [2,2.5,3,3.5,4,4.5,5].forEach(x=>add('power',String(x).replace('.',',')+' Вт/кг','FTP на кілограм ваги','gauge',m=>m.wkg>=x));
 [10,50,100,250,500,1000,2000].forEach(k=>add('run',fmtNum(k)+' км бігу','Сумарно пробігли '+fmtNum(k)+' км','run',m=>m.runKm>=k));
 [1,10,50,100].forEach(n=>add('run',n===1?'Перша пробіжка':n+' пробіжок','Бігових тренувань: '+n,'run',m=>m.runN>=n));
 [1,5,10,25,50,100].forEach(k=>add('swim',k+' км у воді','Сумарно пропливли '+k+' км','swim',m=>m.swimKm>=k));
 [1,10,50,100].forEach(n=>add('swim',n===1?'Перший басейн':n+' запливів','Тренувань з плавання: '+n,'swim',m=>m.swimN>=n));
 [1,10,50,200].forEach(n=>add('team',n===1?'Перше вподобання':n+' вподобань','Отримано '+n+' вподобань','heart',m=>m.likes>=n));
 [1,10,50].forEach(n=>add('team',n===1?'Перший коментар':n+' коментарів','Підтримали одноклубників '+n+' раз','msg',m=>m.comments>=n));
 [1,5,20].forEach(n=>add('team',n===1?'Перший командний заїзд':n+' командних заїздів','Відмітились «їду» '+n+' раз','users',m=>m.rides>=n));
 [1,25].forEach(n=>add('team',n===1?'Перший пост':n+' публікацій','Поділились тренуванням у стрічці','share',m=>m.posts>=n));
 [7,30,100].forEach(n=>add('health',n+' днів самопочуття','Ранковий чек-ін '+n+' днів','heart',m=>m.wellDays>=n));
 [7,30].forEach(n=>add('health','Вода '+n+' днів','8+ склянок води '+n+' днів','drop',m=>m.waterDays>=n));
 [3,5,10].forEach(n=>add('health','Мінус '+n+' кг','Від першого зважування в застосунку','target',m=>m.lost>=n));
 add('special','Перший тест','Відомі ваші зони','target',m=>m.tests>=1);add('special','Тріатлон за тиждень','Усі три види за тиждень','medal',m=>m.tri);add('special','25 тренувань у залі','Сила і стабільність','gym',m=>m.gym>=25);
})();
function computeAch(){const m=metrics();return ACH.map(a=>Object.assign({},a,{u:!!a.test(m)}))}
function customAch(){return st.awards.map(a=>({id:'c'+a.id,cat:'special',name:a.name,desc:'Від тренера'+(a.description?': '+a.description:''),icon:a.icon||'star',u:true,custom:true}))}
function allAch(){return customAch().concat(computeAch())}
function checkNewAch(){try{const un=computeAch().filter(a=>a.u).map(a=>a.id);const key='ach_'+st.me.id;const seen=JSON.parse(localStorage.getItem(key)||'null');localStorage.setItem(key,JSON.stringify(un));if(!seen)return;const nw=un.filter(x=>!seen.includes(x));if(nw.length){const a=ACH.find(x=>x.id===nw[0]);setTimeout(()=>toast('Нове досягнення: '+a.name,'trophy'),900)}}catch(e){}}
function badge(a){return `<button class="bdg ${a.u?'':'lock'}" onclick="openSheet('achOne','${a.id}')"><span class="bc">${ic(a.icon,24)}${a.u?'':`<i class="lk">${ic('lock',12)}</i>`}</span><span>${esc(a.name)}</span></button>`}
SHEETS.ach=()=>{const all=allAch();const list=all.filter(a=>st.achCat==='all'||a.cat===st.achCat);
 return {title:'Досягнення',full:true,body:`<div class="stack"><div class="t14 sec">Відкрито ${all.filter(a=>a.u).length} з ${all.length}</div>${chipRow([['all','Усі']].concat(ACH_CATS),st.achCat,'achCat',true)}
 <div class="badges">${list.filter(a=>a.u).concat(list.filter(a=>!a.u)).map(badge).join('')}</div></div>`}};
function achCat(v){st.achCat=v;renderSheet()}
SHEETS.achOne=id=>{const a=allAch().find(x=>x.id===id);return {title:a.u?'Отримано':'Ще попереду',body:`<div class="success" style="padding:16px 0"><span class="bdg ${a.u?'':'lock'}"><span class="bc" style="width:80px;height:80px;border-radius:40px">${ic(a.icon,36)}</span></span><div class="t20">${esc(a.name)}</div><div class="t14 sec">${esc(a.desc||'')}</div></div>`}};

/* ---------- PROGRESS VIEW ---------- */
st.progChart='vol';
function progView(){
 const p=me();const kid=isKid();const wc=weekCompl(p.id,0);const s7=statsRange(dayIso(0,0),dayIso(0,6));
 let h=`<div class="stack"><div class="card hl"><div class="over">Цей тиждень</div><div class="t20" style="margin-top:8px">${s7.n?'Зараховано '+s7.n+' тренувань, '+fmtMin(s7.min):'Тиждень тільки починається'}</div>
 <div class="grid3" style="margin-top:16px"><div><div class="t20 num">${p.form.ftp||'—'}</div><div class="t12 ter">FTP, Вт</div></div><div><div class="t20 num">${p.form.ftp?(p.form.ftp/p.weight).toFixed(2).replace('.',','):'—'}</div><div class="t12 ter">Вт/кг</div></div><div><div class="t20 num">${wc.dn} з ${wc.tr}</div><div class="t12 ter">план</div></div></div></div>`;
 const charts=[['vol','Обсяг'],['form','Форма'],['ftp','FTP'],['weight','Вага']].filter(c=>!(kid&&c[0]==='weight'));
 h+=`<div class="card s12">${chipRow(charts,st.progChart,'progChart',true)}${progChartBody()}</div>`;
 const rng={week:[dayIso(0,0),dayIso(0,6)],month:[iso(new Date(NOW.getFullYear(),NOW.getMonth(),1)),dayIso(0,6)],year:[iso(new Date(NOW.getFullYear(),0,1)),dayIso(0,6)]}[st.progSeg];const S=statsRange(rng[0],rng[1]);
 h+=`<div class="s12"><div class="t16">Статистика</div>${seg([['week','Тиждень'],['month','Місяць'],['year','Рік']],st.progSeg,'progSeg')}<div class="grid2">${[[fmtMin(S.min),'час'],[fmtNum(S.bike)+' км','вело'],[fmtNum(S.run)+' км','біг'],[S.swim?fmtNum(S.swim)+' м':fmtNum(S.tss),S.swim?'плавання':'TSS']].map(x=>`<div class="tile"><div class="v">${x[0]}</div><div class="l">${x[1]}</div></div>`).join('')}</div></div>`;
 const test=LIB.find(w=>w.cat==='test'&&w.sport==='bike');
 h+=`<div class="list">${li({left:`<span class="ico a">${ic('target',20)}</span>`,t:'Тест FTP',s:'Кожні 4–6 тижнів · оновіть FTP у профілі після тесту',on:`openSheet('wk',{id:'${test.id}'})`})}${li({left:`<span class="ico">${ic('star',20)}</span>`,t:'Особисті рекорди',s:'З ваших зарахованих тренувань',on:"openSheet('prs')"})}${li({left:`<span class="ico">${ic('list',20)}</span>`,t:'Історія тренувань',s:doneLogs().length+' зараховано',on:"openSheet('history')"})}</div>`;
 const all=allAch();const un=all.filter(a=>a.u);
 h+=`<div class="card s12 tapc" onclick="openSheet('ach')"><div class="between"><div class="t16">Досягнення</div><div class="t14 sec">${un.length} з ${all.length} ${ic('chev',16)}</div></div>
 ${un.length?`<div class="badges" style="grid-template-columns:repeat(4,1fr)">${un.slice(-4).reverse().map(badge).join('')}</div>`:`<div class="t14 ter">Перше досягнення: зарахуйте тренування</div>`}</div>`;
 return h+'</div>'}
function progChart(v){st.progChart=v;render()}
function progSeg(v){st.progSeg=v;render()}
function progChartBody(){const p=me();
 if(st.progChart==='vol'){const v=[],lb=[];for(let wk=-7;wk<=0;wk++){const s=statsRange(dayIso(wk,0),dayIso(wk,6));v.push(+(s.min/60).toFixed(1));lb.push(dayDate(wk,0).getDate()+'.'+(dayDate(wk,0).getMonth()+1))}
  return `<div class="between"><div><div class="t20 num">${String(v[7]).replace('.',',')} год</div><div class="t12 ter">цей тиждень · 8 тижнів</div></div></div>${barChart(v,lb,{hl:7})}`}
 if(st.progChart==='form'){const f=fitness();const t=f.tsb[f.tsb.length-1];if(!doneLogs().length)return emptyBox('Поки замало даних','Зараховуйте тренування, і тут зʼявиться модель форми');return `<div class="between"><div><div class="t20 num">${Math.round(f.ctl[f.ctl.length-1])}</div><div class="t12 ter">Фітнес (CTL) · 8 тижнів</div></div>${tag(t<-10?'Втома':t>5?'Свіжість':'Оптимально',t<-10?'warn':'ok')}</div>${multiLine([{v:f.ctl,c:'#7C95FF'},{v:f.atl,c:'#B99BF7',dash:1},{v:f.tsb,c:'#6B7384'}])}
  <div class="legend"><span><i style="background:#7C95FF"></i>Фітнес CTL</span><span><i style="background:#B99BF7"></i>Втома ATL</span><span><i style="background:#6B7384"></i>Форма TSB</span></div>`}
 if(st.progChart==='ftp'){const h=(p.ftpHist||[]).map(x=>x.v);if(h.length<2)return `<div class="t20 num">${p.form.ftp?p.form.ftp+' Вт':'FTP невідомий'}</div><div class="t14 sec">Після тесту оновіть FTP у профілі (Зони), і тут зʼявиться графік</div>`;return `<div class="between"><div><div class="t20 num">${p.form.ftp} Вт</div><div class="t12 ter">${h.length} вимірювань${p.targets.ftp?' · ціль '+p.targets.ftp+' Вт':''}</div></div>${tag((h[h.length-1]-h[0]>=0?'+':'')+(h[h.length-1]-h[0])+' Вт','ok')}</div>${lineChart(h,{target:p.targets.ftp||null})}`}
 const wh=st.weights.slice(-16).map(w=>+w.kg);if(wh.length<2)return `<div class="t20 num">${String(p.weight).replace('.',',')} кг</div><div class="t14 sec">Вносьте вагу на екрані «Сьогодні», і тут зʼявиться графік</div>`;
 return `<div class="between"><div><div class="t20 num">${String(wh[wh.length-1]).replace('.',',')} кг</div><div class="t12 ter">${wh.length} зважувань${p.targets.weight?' · ціль '+p.targets.weight+' кг':''}</div></div>${tag((wh[wh.length-1]-wh[0]).toFixed(1).replace('.',',')+' кг','ok')}</div>${lineChart(wh,{target:p.targets.weight||null})}`}
SHEETS.prs=()=>{const L=doneLogs();const best=(arr,f)=>arr.length?arr.reduce((a,b)=>f(b)>f(a)?b:a):null;
 const rows=[];const bp=best(L.filter(l=>l.sport==='bike'&&(l.np||l.avg_power)&&l.duration_min>=20),l=>l.np||l.avg_power);if(bp)rows.push(['Вело: найкраща потужність за тренування',(bp.np||bp.avg_power)+' Вт',bp.day]);
 const lr=best(L.filter(l=>l.sport==='bike'&&l.distance),l=>+l.distance);if(lr)rows.push(['Вело: найдовший заїзд',String(lr.distance).replace('.',',')+' км',lr.day]);
 const rp=L.filter(l=>l.sport==='run'&&l.pace_sec&&+l.distance>=5);const r5=rp.length?rp.reduce((a,b)=>b.pace_sec<a.pace_sec?b:a):null;if(r5)rows.push(['Біг: найшвидший темп (5+ км)',nfFmtTime(r5.pace_sec)+' /км',r5.day]);
 const rl=best(L.filter(l=>l.sport==='run'&&l.distance),l=>+l.distance);if(rl)rows.push(['Біг: найдовша пробіжка',String(rl.distance).replace('.',',')+' км',rl.day]);
 const sl=best(L.filter(l=>l.sport==='swim'&&l.distance),l=>+l.distance);if(sl)rows.push(['Плавання: найдовший заплив',fmtNum(sl.distance)+' м',sl.day]);
 return {title:'Особисті рекорди',body:rows.length?`<div class="list">${rows.map(x=>li({t:x[1],s:x[0]+' · '+fmtDate(parseIso(x[2])),right:''})).join('')}</div>`:emptyBox('Рекордів поки немає','Вони зʼявляться з вашими тренуваннями')}};
SHEETS.history=()=>{const L=st.logs.slice().sort((a,b)=>a.day<b.day?1:-1).slice(0,100);return {title:'Історія тренувань',full:true,body:L.length?`<div class="list">${L.map(l=>`<div class="li">${sportIco(l.sport)}<div class="grow"><div class="t14 w6 ell">${esc(l.title||SPORT[l.sport].n)}</div><div class="t12 sec">${fmtDate(parseIso(l.day))} · ${l.status==='skipped'?'пропуск: '+esc(l.skip_reason||''):fmtMin(l.duration_min||0)+(l.distance?' · '+(l.sport==='swim'?fmtNum(l.distance)+' м':String(l.distance).replace('.',',')+' км'):'')+(l.source==='file'?' · з файлу':'')}</div></div>${l.status==='done'?`<span class="c-ok">${ic('check',18)}</span>`:tag('пропуск','warn')}</div>`).join('')}</div>`:emptyBox('Ще немає тренувань')}};
