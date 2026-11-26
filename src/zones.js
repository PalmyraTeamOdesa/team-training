/* ---------- ZONES: power (FTP) + heart rate (LTHR / Karvonen / %HRmax) ---------- */
const PZ=[['Z1','Відновлення',0,.55],['Z2','Витривалість',.56,.75],['Z3','Темп',.76,.9],['Z4','Поріг',.91,1.05],['Z5','VO2max',1.06,1.2],['Z6','Анаеробна',1.21,null]];
const HZN=['Відновлення','Витривалість','Темп','Поріг','VO2max'];
function hrModel(f,age){f=f||{};const lt=+f.lthr||0,hm=+f.hrMax||0,hr=+f.hrRest||0;let Z,m,note,est=false;
 if(lt){m='lthr';Z=[[null,.81],[.81,.89],[.9,.93],[.94,.99],[1,null]].map(([a,b])=>[a?Math.round(a*lt):null,b?Math.round(b*lt)-(b===.81?1:0):null]);note='Від порогового пульсу (LTHR '+lt+'), зони за Джо Фрілом.'}
 else{const H=hm||Math.round(208-.7*(+age||30));est=!hm;const B=[.5,.6,.7,.8,.9,1];
  if(hm&&hr){m='hrr';Z=B.slice(0,5).map((b,i)=>[Math.round(hr+(H-hr)*b),Math.round(hr+(H-hr)*B[i+1])-(i<4?1:0)]);note='Від резерву пульсу (Карвонен): макс. '+H+', спокою '+hr+'.'}
  else{m=est?'est':'max';Z=B.slice(0,5).map((b,i)=>[Math.round(H*b),Math.round(H*B[i+1])-(i<4?1:0)]);note=est?'Макс. пульс оцінено з віку (208 − 0,7 × вік = '+H+'). Це приблизно: зробіть тест або внесіть свій макс. пульс.':'Від макс. пульсу '+H+'. Додайте пульс спокою або LTHR, щоб зони були точнішими.'}}
 return {m,Z,note,est}}
function hrRange(z){return z[0]==null?'до '+z[1]:z[1]==null?'від '+z[0]:z[0]+'–'+z[1]}
function pIdx(p){return p<.56?0:p<.76?1:p<.9?2:p<1.05?3:4}
function hrFor(p,prof){if(!prof)return '';const M=hrModel(prof.form,prof.age);const i=pIdx(p);return 'пульс '+hrRange(M.Z[i])+(p>=1.2?' (не встигне вирости)':'')}
function hrUpTo(p,prof){if(!prof)return '';const M=hrModel(prof.form,prof.age);const z=M.Z[pIdx(p)];return 'пульс до '+(z[1]||z[0])}
function zonesSub(p){const f=p.form||{};return [f.ftp?'FTP '+f.ftp+' Вт':'FTP невідомий',f.lthr?'LTHR '+f.lthr:f.hrMax?'Пульс макс '+f.hrMax:'пульс: оцінка з віку'].join(' · ')}
function zProf(id){if(!id||id===st.me.id)return me();const a=athleteP&&athleteP(id);if(a)return a;const r=profRow&&profRow(id);return r?toP(r):null}
function zCanEdit(id){return !id||id===st.me.id||isAdmin()}
function zonesOpen(id){const p=zProf(id);if(!p)return;st._zid=id&&id!==st.me.id?id:null;st._zf={ftp:p.form.ftp||'',lthr:p.form.lthr||'',hrMax:p.form.hrMax||'',hrRest:p.form.hrRest||''};st.zSeg=st.zSeg||'pow';openSheet('zones',st._zid)}
function zList(){const p=zProf(st._zid),f=st._zf;if(st.zSeg==='hr'){const M=hrModel(f,p.age);
  return `<div class="list">${M.Z.map((z,i)=>`<div class="li" style="min-height:52px"><span class="sd" style="width:12px;height:12px;border-radius:4px;background:${zoneCol([.5,.66,.83,.98,1.13][i])}"></span><div class="grow"><div class="t14 w6">Z${i+1} ${HZN[i]}</div><div class="t12 sec">${PZ[i][0]} за потужністю</div></div><div class="t14 num">${hrRange(z)} уд/хв</div></div>`).join('')}</div><div class="note ${M.est?'warn':''}">${ic(M.est?'alert':'info',20)}<span>${M.note}</span></div>`}
 const ftp=+f.ftp||0;return `<div class="list">${PZ.map(z=>`<div class="li" style="min-height:52px"><span class="sd" style="width:12px;height:12px;border-radius:4px;background:${zoneCol((z[2]+(z[3]||1.4))/2)}"></span><div class="grow"><div class="t14 w6">${z[0]} ${z[1]}</div><div class="t12 sec">${z[3]?Math.round(z[2]*100)+'–'+Math.round(z[3]*100)+'% FTP':'>'+Math.round(z[2]*100)+'% FTP'}</div></div><div class="t14 num">${ftp?(z[3]?Math.round(z[2]*ftp)+'–'+Math.round(z[3]*ftp):'>'+Math.round(z[2]*ftp))+' Вт':''}</div></div>`).join('')}</div>${ftp?'':`<div class="note">${ic('info',20)}<span>FTP невідомий: тренування показують відсотки. Зробіть тест FTP 20 хв і внесіть результат.</span></div>`}`}
function zUpd(){const el=$('#zlist');if(el)el.innerHTML=zList()}
function zSegSet(v){st.zSeg=v;renderSheet()}
SHEETS.zones=id=>{if(!st._zf||(st._zid||null)!==(id&&id!==st.me.id?id:null)){const q=zProf(id);if(!q)return {title:'',body:''};st._zid=id&&id!==st.me.id?id:null;st._zf={ftp:q.form.ftp||'',lthr:q.form.lthr||'',hrMax:q.form.hrMax||'',hrRest:q.form.hrRest||''};st.zSeg=st.zSeg||'pow'}const p=zProf(st._zid);if(!p)return {title:'',body:''};const f=st._zf,ed=zCanEdit(st._zid),dis=!ed;
 const nm=st._zid?' · '+esc(cleanName?cleanName(p.name):p.name):'';
 const fields=st.zSeg==='hr'?`${nf({id:'z-lthr',label:'Пороговий пульс (LTHR)',val:f.lthr,min:110,max:210,step:1,unit:'уд/хв',empty:true,ph:'невідомо',disabled:dis,set:v=>{f.lthr=v;zUpd()}})}
  <div class="t12 ter">LTHR: середній пульс за останні 20 хв 30-хвилинного максимального зусилля. Якщо відомий, рахуємо зони від нього.</div>
  ${nf({id:'z-hm',label:'Макс. пульс',val:f.hrMax,min:120,max:230,step:1,unit:'уд/хв',empty:true,ph:'невідомо',disabled:dis,set:v=>{f.hrMax=v;zUpd()}})}
  ${nf({id:'z-hr',label:'Пульс спокою',val:f.hrRest,min:30,max:110,step:1,unit:'уд/хв',empty:true,ph:'невідомо',disabled:dis,set:v=>{f.hrRest=v;zUpd()}})}`
 :`${nf({id:'z-ftp',label:'FTP',val:f.ftp,min:50,max:600,step:5,unit:'Вт',empty:true,ph:'невідомо',plus:true,disabled:dis,set:v=>{f.ftp=v;zUpd()}})}
  <div class="t12 ter">FTP: потужність, яку можна тримати близько години. Зазвичай 95% від середньої за 20-хвилинний тест.</div>`;
 return {title:'Зони'+nm,full:true,body:`<div class="stack">${seg([['pow','Потужність'],['hr','Пульс']],st.zSeg,'zSegSet')}${fields}<div id="zlist">${zList()}</div>${dis?`<div class="t12 ter">Змінювати зони може сам спортсмен або головний тренер.</div>`:''}</div>`,
  foot:ed?`<button class="btn p" onclick="zSave(this)">Зберегти</button>`:''}};
async function zSave(btn){const f=st._zf,id=st._zid;const n=v=>v===''||v==null?0:Math.round(+v)||0;
 await busy(btn,async()=>{if(!id){const p=me();const ftp=n(f.ftp);const h=p.ftpHist||[];if(ftp&&ftp!==p.form.ftp&&(!h.length||h[h.length-1].v!==ftp)){h.push({d:dayIso(0,TODAY),v:ftp});p.ftpHist=h}
   Object.assign(p.form,{ftp,lthr:n(f.lthr),hrMax:n(f.hrMax),hrRest:n(f.hrRest)});await saveMe()}
  else{const r=profRow(id);const q=Object.assign({},r.q||{});const form=Object.assign({},q.form||{});const ftp=n(f.ftp);const h=(q.ftpHist||[]).slice();if(ftp&&ftp!==form.ftp&&(!h.length||h[h.length-1].v!==ftp))h.push({d:dayIso(0,TODAY),v:ftp});
   Object.assign(form,{ftp,lthr:n(f.lthr),hrMax:n(f.hrMax),hrRest:n(f.hrRest)});q.form=form;q.ftpHist=h;D(await sb.from('profiles').update({q}).eq('id',id).select('id'));
   r.q=q;const a=st.athletes.find(x=>x.id===id);if(a)a.p=toP(r)}
  st._zf=null;closeSheet();render();toast('Зони збережено');if(!id)checkNewAch()})}
