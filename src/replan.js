/* ---------- AI re-plan: load metrics → AI/rules adjust the next 7 days ---------- */
/* The coach-ai edge function computes CTL/ATL/TSB, compliance, intensity split, HR drift and new bests from workout_logs and returns
   a list of actions + a Ukrainian explanation. Here the actions are turned into library workouts (pickW) and written to plan_weeks.
   Never touched: items of a section coach's board, workouts a coach assigned, own-trainer sports, weeks locked by the coach. */
const AI_EZ={bike:'z2',run:'easy',swim:'aer',gym:'core'};
const AI_REC={bike:'rec',run:'easy',swim:'tech',gym:'core'};
const AI_UP={bike:{rec:'z2',z2:'tempo',cad:'tempo',tempo:'ss',ss:'thr'},run:{easy:'tempo',tempo:'int'},swim:{tech:'aer',aer:'int'}};
const AI_OPL={restore:'повернуто як у плані',rest:'відпочинок',recovery:'відновлення',easy:'легше',scale:'обсяг',harder:'підсилення',swap:'перенесено'};
const AI_ST={proposed:['застосовується','a'],applied:['застосовано','ok'],suggested:['пропозиція','warn'],reverted:['повернуто',''],noop:['без змін','']};
let _aiBusy=false;
st.aiAdj=st.aiAdj||[];st.aiAll=st.aiAll||[];

function aiProt(it,cs){return !!(it.log||it.section||it.coach||(cs||[]).includes(it.sport))}
function aiHard(it){const w=itemW(it);return !!w&&HARD.includes(w.cat)}
function aiCanon(x){if(Array.isArray(x))return '['+x.map(aiCanon).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().filter(k=>x[k]!=null).map(k=>JSON.stringify(k)+':'+aiCanon(x[k])).join(',')+'}';return JSON.stringify(x)}
function aiTxt(items){return items&&items.length?items.map(it=>String(itemName(it)).replace(/\s·\s(\d+|\d+\s?год(\s\d+\s?хв)?|\d+\s?хв)$/,'')+' · '+fmtMin(it.min||0)).join(' + '):'відпочинок'}
function aiWd(date){const d=parseIso(date);return DAYS[(d.getDay()+6)%7]+' '+d.getDate()+'.'+String(d.getMonth()+1).padStart(2,'0')}
function aiLoc(date){for(const wk of [-1,0,1]){const i=Math.round((parseIso(date)-dayDate(wk,0))/864e5);if(i>=0&&i<7)return {wk,i}}return null}
function aiOffOf(ws){return Math.round((parseIso(ws)-dayDate(0,0))/864e5/7)}
function aiStored(pid,ws){const r=st.plans[pid+'|'+ws];return r&&!r._local?planRowToDays(r).map(d=>Object.assign({},d,{items:d.items.map(x=>Object.assign({},x))})):null}
function aiRow(id){return st.aiAdj.concat(st.aiAll).find(r=>r.id===id)}
function aiPut(row){[st.aiAdj,st.aiAll].forEach(L=>{const k=L.findIndex(r=>r.id===row.id);if(k>=0)L[k]=row})}

async function loadAi(){try{const r=await sb.from('ai_plan_adjustments').select('*').eq('athlete_id',st.me.id).order('created_at',{ascending:false}).limit(14);st.aiAdj=r.data||[]}catch(e){console.warn(e)}}
async function loadAiAll(){try{const r=await sb.from('ai_plan_adjustments').select('*').order('created_at',{ascending:false}).limit(120);st.aiAll=r.data||[]}catch(e){console.warn(e)}}

/* days whose items are still exactly what an AI change wrote: date → {before (the athlete's own plan), rowId}. Every run starts from that baseline, so repeated runs never stack or flip-flop. */
function aiOwned(pid){const L=pid===st.me.id?st.aiAdj:st.aiAll.filter(r=>r.athlete_id===pid);const out={},cache={};
 L.filter(r=>r.status==='applied').forEach(r=>(r.changes||[]).forEach(c=>{if(!c.applied||c.reverted||c.superseded||c.op==='restore'||out[c.date])return;
  const d=(cache[c.wk]||(cache[c.wk]=aiStored(pid,c.wk))||[])[c.i];if(d&&aiCanon(d.items)===aiCanon(c.after))out[c.date]={before:c.before,row:r.id}}));return out}

/* ----- the next 7 days as the engine sees them ----- */
const AI_HARD_RX=/(інтервал|поріг|vo2|спринт|темп|z4|z5|×|\d\s*[xх]\s*\d|тест|интервал|порог)/i;
function aiWindow(){const pid=st.me.id,cs=coachedSports(pid),t=todayIso(),out=[],own=aiOwned(pid);const rd=st.ready&&typeof readyActive==='function'&&readyActive(st.ready);
 for(const wk of [0,1]){const r=st.plans[pid+'|'+wkIso(wk)];if(!r||r._local)continue;
  planRowToDays(r).forEach(d=>{const date=dayIso(wk,d.i);const delta=Math.round((parseIso(date)-parseIso(t))/864e5);if(delta<0||delta>6)return;
   if(isDone(pid,wk,d.i)||isSkip(pid,wk,d.i))return;if(delta===0&&rd)return;
   const base=own[date]?own[date].before:d.items;const adj=base.filter(x=>!aiProt(x,cs)),pr=base.filter(x=>aiProt(x,cs));const bl=(st.myLines||[]).filter(l=>l.post&&l.post.day===date);
   const p={date,i:d.i,wk,min:dayMin({items:adj}),tss:dayLoad({items:adj}),hard:adj.some(aiHard),rest:false,prot:false};
   if(adj.length){if(bl.length){const tx=bl.map(l=>l.text).join('; ').slice(0,120);p.board={src:bl[0].post.section_id,text:tx,hard:AI_HARD_RX.test(tx+' '+(bl[0].post.plan||''))}}}
   else if(bl.length){p.prot=true;p.src=bl[0].post.section_id;p.text=bl.map(l=>l.text).join('; ').slice(0,120);p.hard=AI_HARD_RX.test(p.text+' '+(bl[0].post.plan||''));p.min=0}
   else if(pr.length){p.prot=true;p.src=pr.some(x=>x.coach)?'coach':'own';p.names=pr.map(x=>itemName(x)).join(' + ').slice(0,120);p.hard=pr.some(x=>x.coach&&aiHard(x));p.min=dayMin({items:pr})}
   else p.rest=true;
   out.push(p)})}
 return out}

/* ----- run: ask the engine, then apply ----- */
function aiNoteAnn(row,trigger,loud){const ch=(row.changes||[]).filter(c=>c.applied&&c.role!=='to').length,sg=(row.changes||[]).filter(c=>!c.applied&&c.role!=='to').length;
 if(row.status==='applied'&&ch&&loud)toast('AI підлаштував план: змін '+ch+'. Пояснення на «Сьогодні»','spark');
 else if(row.status==='suggested'&&loud)toast(sg?'AI пропонує зміни в плані':'AI має пропозиції щодо порогів','spark');
 else if(row.status==='noop'&&loud)toast('AI перевірив навантаження: план залишається','info')}
async function aiRun(trigger){if(_aiBusy||!impCan())return null;_aiBusy=true;let res=null;
 try{await ensurePlan(st.me,0);await ensurePlan(st.me,1);
  const days=aiWindow();if(!days.length){if(trigger==='manual')toast('Немає днів для перепланування','info');return null}
  const r=await sb.functions.invoke('coach-ai',{body:{mode:'replan',trigger,days}});if(r.error)throw r.error;const d=r.data;
  if(!d||!d.row){if(trigger==='manual')toast(d&&d.skipped?'План на паузі':'Немає чого змінювати','info');return null}
  let row=d.row;const k=st.aiAdj.findIndex(x=>x.id===row.id);if(k>=0)st.aiAdj[k]=row;else st.aiAdj.unshift(row);
  if(row.status==='proposed'&&!(row.changes||[]).length)row=await aiApply(row);
  res=row;if(!d.reused||trigger==='manual')aiNoteAnn(row,trigger,trigger!=='daily'||(row.changes||[]).length>0)}
 catch(e){console.warn('replan',e);if(trigger==='manual')toast('Не вдалося перерахувати план. Спробуйте пізніше','alert')}
 finally{_aiBusy=false;try{render();if(sheetStack.length)renderSheet()}catch(e){}}
 return res}
async function aiDaily(){if(!impCan()||_aiBusy)return;
 const pend=st.aiAdj.find(r=>r.status==='proposed'&&Date.now()-new Date(r.created_at)<2*864e5);
 if(pend){_aiBusy=true;try{await aiApply(pend)}catch(e){console.warn(e)}finally{_aiBusy=false;render()}return}
 if(st.aiAdj.some(r=>r.day===todayIso()))return;
 if((st.logs||[]).filter(l=>l.status==='done').length<3)return;
 await aiRun('daily')}
function aiNow(btn){return busy(btn,()=>aiRun('manual'))}

/* ----- turn one action into new items for a day ----- */
function aiOp(d,a,id,wk){const cs=coachedSports(st.me.id);if(!d.items.some(x=>!aiProt(x,cs)))return null;
 const lv=s=>(st.me.sports[s]&&st.me.sports[s].level)||'mid',seed=d.i+wk*7;
 const mk=(sport,cat,min,sd)=>{const w=pickW(sport,cat,min,lv(sport),sd);return w?{sport,w:w.id,min:w.dur,ai:id}:null};
 let used=false;const F={
  rest:()=>null,
  recovery:it=>{const n=mk(it.sport,AI_REC[it.sport]||'z2',Math.min(40,Math.max(20,Math.round((it.min||45)*.5))),seed);return n&&n.min<=(it.min||45)+10?Object.assign(n,{easy:true}):it},
  easy:it=>{if(!aiHard(it))return it;const n=mk(it.sport,AI_EZ[it.sport]||'z2',Math.max(25,Math.round((it.min||45)*(a.factor||1))),seed);return n&&n.min<=(it.min||45)+10?n:it},
  scale:it=>{const w0=itemW(it);if(!w0)return it;const f=a.factor||1,cur=it.min||w0.dur,min=Math.max(15,Math.round(cur*f/5)*5);
   const okd=n=>n&&n.w!==it.w&&(f<1?n.min<=cur-3:n.min>=cur+3);let n=mk(it.sport,w0.cat,min,seed);if(!okd(n))n=mk(it.sport,w0.cat,min,seed+1);if(!okd(n))n=mk(it.sport,w0.cat,min,seed+2);return okd(n)?n:it},
  harder:it=>{const w0=itemW(it);if(used||!w0||!aiHard(it))return it;used=true;const up=(AI_UP[it.sport]||{})[w0.cat];
   if(up&&up!==w0.cat){const n=mk(it.sport,up,Math.round((it.min||w0.dur)*1.05),seed);if(n&&n.w!==it.w)return n}
   const n=mk(it.sport,w0.cat,Math.round((it.min||w0.dur)*1.12/5)*5,seed);return n&&n.w!==it.w?n:it}}[a.op];
 if(!F)return null;const res=d.items.map(it=>aiProt(it,cs)?it:F(it)).filter(Boolean);
 return aiCanon(res.map(x=>[x.sport,x.w,x.min]))===aiCanon(d.items.map(x=>[x.sport,x.w,x.min]))?null:res}

async function aiApply(row){const pid=st.me.id,cs=coachedSports(pid),hold=!!(row.metrics&&row.metrics.hold);
 const own=aiOwned(pid),W={};const get=wk=>W[wk]||(W[wk]={wk,ws:wkIso(wk),days:aiStored(pid,wkIso(wk)),dirty:false,can:canEditPlan(wk)});
 const ch=[],seen=new Set();
 for(const a of row.actions||[]){const L=aiLoc(a.date);if(!L||L.wk<0)continue;const w=get(L.wk);if(!w.days)continue;const d=w.days[L.i];if(!d||seen.has(a.date))continue;
  if(a.op==='swap'){const T=aiLoc(a.to);if(!T||T.wk<0||seen.has(a.to))continue;const w2=get(T.wk);if(!w2.days)continue;const d2=w2.days[T.i];if(isDone(pid,T.wk,T.i))continue;
   const b1=own[a.date]?own[a.date].before:d.items,b2=own[a.to]?own[a.to].before:d2.items;const m1=b1.filter(x=>!aiProt(x,cs)).map(x=>Object.assign({},x,{ai:row.id})),m2=b2.filter(x=>!aiProt(x,cs)).map(x=>Object.assign({},x,{ai:row.id}));if(!m1.length)continue;
   const a1=b1.filter(x=>aiProt(x,cs)).concat(m2),a2=b2.filter(x=>aiProt(x,cs)).concat(m1);
   const ok=!hold&&w.can&&w2.can;const base={op:'swap',reason:a.reason,applied:ok};
   ch.push(Object.assign({date:a.date,wk:w.ws,i:L.i,before:b1,after:a1,bt:aiTxt(b1),at:aiTxt(a1),to:a.to},base));
   ch.push(Object.assign({date:a.to,wk:w2.ws,i:T.i,before:b2,after:a2,bt:aiTxt(b2),at:aiTxt(a2),role:'to'},base,{reason:'перенесено з '+aiWd(a.date)}));
   if(ok){d.items=a1;d.rest=!a1.length;d2.items=a2;d2.rest=!a2.length;w.dirty=w2.dirty=true}seen.add(a.date);seen.add(a.to);continue}
  const base=own[a.date]?own[a.date].before:d.items;const after=aiOp(Object.assign({},d,{items:base}),a,row.id,L.wk);if(!after)continue;const ok=!hold&&w.can;
  ch.push({date:a.date,wk:w.ws,i:L.i,op:a.op,factor:a.factor,reason:a.reason,before:base,after,bt:aiTxt(base),at:aiTxt(after),applied:ok});
  if(ok){d.items=after;d.rest=!after.length;w.dirty=true}seen.add(a.date)}
 /* days an earlier run changed that the new analysis leaves alone go back to the athlete's own plan */
 const t0=todayIso();
 for(const date of Object.keys(own)){if(seen.has(date)||date<t0)continue;const L=aiLoc(date);if(!L||L.wk<0)continue;const w=get(L.wk);if(!w.days)continue;const d=w.days[L.i];if(!d||isDone(pid,L.wk,L.i))continue;
  const base=own[date].before,ok=!hold&&w.can;ch.push({date,wk:w.ws,i:L.i,op:'restore',reason:'за новими даними ця зміна вже не потрібна: повертаю ваше тренування з плану',before:d.items,after:base,bt:aiTxt(d.items),at:aiTxt(base),applied:ok});
  if(ok){d.items=base.map(x=>Object.assign({},x));d.rest=!base.length;w.dirty=true}seen.add(date)}
 for(const w of Object.values(W)){if(!w.dirty)continue;try{await savePlan(pid,w.wk,w.days)}catch(e){console.warn('replan save',e);ch.forEach(c=>{if(c.wk===w.ws)c.applied=false})}}
 const any=ch.some(c=>c.applied);const status=any?'applied':(ch.length||(row.suggestions||[]).length)?'suggested':'noop';
 const r=await sb.rpc('ai_adj_save',{p_id:row.id,p_status:status,p_changes:ch});if(r.error)throw r.error;aiPut(r.data);
 if(any){const dates=new Set(ch.filter(c=>c.applied).map(c=>c.date));for(const o of st.aiAdj.filter(x=>x.id!==row.id&&x.status==='applied')){let hit=false;const oc=(o.changes||[]).map(c=>{if(c.applied&&!c.reverted&&!c.superseded&&dates.has(c.date)){hit=true;return Object.assign({},c,{superseded:true})}return c});
  if(hit){const u=await sb.rpc('ai_adj_save',{p_id:o.id,p_status:'applied',p_changes:oc});if(!u.error)aiPut(u.data)}}}
 return r.data}

/* write `after` (accept) or `before` (revert) for stored changes; a day edited since is left alone */
async function aiWrite(pid,list,dir){const ok=new Set(),by={};list.forEach(c=>(by[c.wk]=by[c.wk]||[]).push(c));
 for(const ws of Object.keys(by)){let days=aiStored(pid,ws);if(!days){const r=await sb.from('plan_weeks').select('*').eq('athlete_id',pid).eq('week_start',ws).maybeSingle();if(r.data){st.plans[pid+'|'+ws]=r.data;days=aiStored(pid,ws)}}
  if(!days)continue;let dirty=false;
  by[ws].forEach(c=>{const d=days[c.i];if(!d)return;const exp=dir==='before'?c.after:c.before,tgt=dir==='before'?c.before:c.after;
   if(aiCanon(d.items)===aiCanon(exp)){d.items=tgt.map(x=>Object.assign({},x));d.rest=!tgt.length;ok.add(c);dirty=true}});
  if(dirty)await savePlan(pid,aiOffOf(ws),days)}
 return ok}
async function aiRevert(btn,id){const row=aiRow(id);if(!row)return;
 if(!confirm(row.athlete_id===st.me.id?'Повернути план, який був до змін AI?':'Повернути план спортсмена до стану до змін AI? Тиждень буде позначено як змінений тренером.'))return;
 await busy(btn,async()=>{const ch=(row.changes||[]).map(c=>Object.assign({},c));const todo=ch.filter(c=>c.applied&&!c.reverted&&!c.superseded&&c.op!=='restore');const ok=await aiWrite(row.athlete_id,todo,'before');
  todo.forEach(c=>{const o=[...ok].some(x=>x.date===c.date&&x.wk===c.wk);if(o)c.reverted=true;else c.stale=true});
  const r=await sb.rpc('ai_adj_save',{p_id:id,p_status:'reverted',p_changes:ch});if(r.error)throw r.error;aiPut(r.data);
  render();renderSheet();toast(todo.some(c=>c.stale)?'Повернуто, окрім днів, які ви вже змінили самі':'План повернуто до попереднього вигляду','check')})}
async function aiAccept(btn,id){const row=aiRow(id);if(!row)return;
 await busy(btn,async()=>{const ch=(row.changes||[]).map(c=>Object.assign({},c));const todo=ch.filter(c=>!c.applied);let ok;
  try{ok=await aiWrite(row.athlete_id,todo,'after')}catch(e){console.warn(e);throw new Error('Цей тиждень змінив тренер: зміни AI залишаються порадою')}
  todo.forEach(c=>{if([...ok].some(x=>x.date===c.date&&x.wk===c.wk))c.applied=true;else c.stale=true});
  const r=await sb.rpc('ai_adj_save',{p_id:id,p_status:ch.some(c=>c.applied)?'applied':'suggested',p_changes:ch});if(r.error)throw r.error;aiPut(r.data);
  render();renderSheet();toast(todo.some(c=>c.stale)?'Частину днів не застосовано: вони вже змінені':'Зміни застосовано','check')})}
async function aiApprove(btn,id,v){await busy(btn,async()=>{const r=await sb.rpc('ai_adj_approve',{p_id:id,p_v:v});if(r.error)throw r.error;
 const row=aiRow(id);if(row){row.approved_at=v?new Date().toISOString():null;row.approved_by=v?st.me.id:null}render();renderSheet();toast(v?'Зміни AI погоджено. Спортсмен отримав сповіщення':'Погодження знято','check')})}

/* ----- FTP / LTHR / HRmax proposals ----- */
async function aiSugSet(row,k,state){const sg=(row.suggestions||[]).map((x,j)=>j===k?Object.assign({},x,{state}):x);
 const r=await sb.rpc('ai_adj_save',{p_id:row.id,p_status:row.status==='proposed'?'suggested':row.status,p_changes:null,p_suggestions:sg});if(r.error){console.warn(r.error);row.suggestions=sg}else aiPut(r.data)}
async function aiSugAccept(btn,id,k){const row=aiRow(id),s=row&&(row.suggestions||[])[k];if(!s)return;const key={ftp:'ftp',lthr:'lthr',hrmax:'hrMax'}[s.type];if(!key)return;
 await busy(btn,async()=>{const pid=row.athlete_id;
  if(pid===st.me.id){const p=st.me;p.form=Object.assign({},p.form,{[key]:s.val});if(key==='ftp'){const h=(p.ftpHist||[]).slice();if(!h.length||h[h.length-1].v!==s.val)h.push({d:todayIso(),v:s.val});p.ftpHist=h}await saveMe()}
  else{const r=await sb.from('profiles').select('q').eq('id',pid).single();if(r.error)throw r.error;const q=Object.assign({},r.data.q||{}),form=Object.assign({},q.form||{},{[key]:s.val});q.form=form;
   if(key==='ftp'){const h=(q.ftpHist||[]).slice();if(!h.length||h[h.length-1].v!==s.val)h.push({d:todayIso(),v:s.val});q.ftpHist=h}
   D(await sb.from('profiles').update({q}).eq('id',pid).select('id'));const a=st.athletes.find(x=>x.id===pid);if(a){a.p.form=form;a.p.ftpHist=q.ftpHist||a.p.ftpHist}if(typeof profRow==='function'){const pr=profRow(pid);if(pr)pr.q=q}}
  await aiSugSet(row,k,'accepted');render();renderSheet();toast({ftp:'FTP',lthr:'Поріг пульсу',hrmax:'Максимальний пульс'}[s.type]+' оновлено: '+s.val,'check')})}
async function aiSugDismiss(btn,id,k){const row=aiRow(id);if(!row)return;await busy(btn,async()=>{await aiSugSet(row,k,'dismissed');render();renderSheet()})}

/* ----- UI ----- */
function aiShowRow(pid){const L=pid===st.me.id?st.aiAdj:st.aiAll.filter(r=>r.athlete_id===pid);const lim=Date.now()-3*864e5;
 const live=L.find(r=>['applied','suggested','proposed'].includes(r.status)&&new Date(r.created_at).getTime()>lim&&((r.changes||[]).length||(r.suggestions||[]).some(s=>s.state==='open')));
 if(live)return live;const rv=L.find(r=>r.status==='reverted'&&new Date(r.created_at).getTime()>lim);if(rv)return rv;
 const t=L[0];return t&&t.day===todayIso()?t:null}
function aiMetrics(m){if(!m||m.ctl==null)return '';const tsb=Math.round(m.tsb);const col=tsb<=-30?'c-bad':tsb<=-10?'c-warn':tsb>=12?'c-ok':'';
 const tile=(v,l,c)=>`<div class="tile"><div class="v ${c||''}">${v}</div><div class="l">${l}</div></div>`;
 return `<div class="grid3">${tile(Math.round(m.ctl),'фітнес (CTL)')}${tile(Math.round(m.atl),'втома (ATL)')}${tile((tsb>0?'+':tsb<0?'−':'')+Math.abs(tsb),'форма (TSB)',col)}</div>`}
function aiExtra(m){if(!m)return '';const a=[];if(m.compliance14!=null)a.push('виконання плану за 2 тижні '+Math.round(m.compliance14*100)+'%');
 if(m.dist28)a.push('інтенсивність за 4 тижні: легко '+Math.round(m.dist28.easy*100)+'% · помірно '+Math.round(m.dist28.mod*100)+'% · важко '+Math.round(m.dist28.hard*100)+'%');
 if(m.decoupling_avg3!=null)a.push('дрейф пульсу '+String(m.decoupling_avg3).replace('.',',')+'%');if(m.ef_trend_pct!=null&&Math.abs(m.ef_trend_pct)>=1)a.push('ефективність (Вт/уд) '+(m.ef_trend_pct>0?'+':'−')+String(Math.abs(m.ef_trend_pct)).replace('.',',')+'%');
 const w=(m.weeks||[]).slice(-2)[0];if(w&&w.done_min)a.push('минулий тиждень: '+fmtMin(w.done_min)+(w.planned_min?' із '+fmtMin(w.planned_min)+' за планом':''));
 return a.length?`<div class="t12 sec">${a.map(esc).join(' · ')}</div>`:''}
function aiLive(c){return c.applied&&!c.reverted&&!c.superseded&&c.op!=='restore'}
function aiChangesHtml(row,max){const L=(row.changes||[]).filter(c=>c.role!=='to'||true).slice().sort((a,b)=>a.date.localeCompare(b.date));const sh=max?L.slice(0,max):L;
 return sh.map(c=>`<div class="aich ${c.reverted?'rev':''}"><div class="t12 ter">${aiWd(c.date)} · ${AI_OPL[c.op]||c.op}${c.factor?' ×'+String(c.factor).replace('.',','):''}${c.applied?'':c.stale?' · день уже змінено':' · пропозиція'}${c.reverted?' · повернено':''}${c.superseded?' · замінено новішим аналізом':''}</div>
  <div class="t14"><s class="sec">${esc(c.bt)}</s> → <b>${esc(c.at)}</b></div>${c.reason?`<div class="t12 sec">${esc(c.reason)}</div>`:''}</div>`).join('')+(max&&L.length>max?`<div class="t12 ter">…і ще ${L.length-max}</div>`:'')}
function aiTag(row){const s=AI_ST[row.status]||['',''];return tag(row.approved_at&&row.status!=='reverted'?'погоджено тренером':s[0],row.approved_at&&row.status!=='reverted'?'ok':s[1])}
function aiSugHtml(row,me_){return (row.suggestions||[]).map((s,k)=>{
  if(s.type==='board')return `<div class="aich"><div class="t12 ter">${aiWd(s.date)} · завдання тренера${s.section&&typeof secInfo==='function'?' · '+esc((secInfo(s.section)||{}).name||''):''}</div><div class="t14">${esc(s.text||'')}</div><div class="t12 sec">Порада AI: ${esc(s.advice||'')}. ${esc(s.reason||'')}</div></div>`;
  const nm={ftp:'FTP',lthr:'Поріг пульсу',hrmax:'Макс. пульс'}[s.type]||s.type;const u=s.type==='ftp'?' Вт':' уд/хв';
  return `<div class="aich"><div class="t14 w6">${nm}: ${s.cur?s.cur+' → ':''}<b>${s.val}${u}</b>${s.state==='accepted'?' '+tag('прийнято','ok'):s.state==='dismissed'?' '+tag('відхилено',''):''}</div><div class="t12 sec">${esc(s.reason)}</div>
   ${s.state==='open'&&row.status!=='reverted'?`<div class="row" style="gap:8px;margin-top:8px"><button class="btn p sm grow" onclick="aiSugAccept(this,${row.id},${k})">Оновити</button><button class="btn s sm grow" onclick="aiSugDismiss(this,${row.id},${k})">Не зараз</button></div>`:''}</div>`}).join('')}
function aiActions(row,coach){const ch=(row.changes||[]),app=ch.some(aiLive),pend=ch.some(c=>!c.applied&&!c.stale&&!c.reverted);let h='';
 if(row.status!=='reverted'){
  const lk=pend&&!coach&&ch.some(c=>!c.applied&&!c.stale&&!c.reverted&&!canEditPlan(aiOffOf(c.wk)));
  if(pend&&!lk)h+=`<button class="btn p sm" onclick="aiAccept(this,${row.id})">${ic('check',18)} Застосувати пропозицію</button>`;
  if(lk)h+=`<div class="t12 ter">Цей тиждень скоригував тренер, тому AI лише радить. Застосувати зміни може тренер.</div>`;
  if(app)h+=`<button class="btn s sm" onclick="aiRevert(this,${row.id})">${ic('refresh',18)} Повернути як було</button>`;
  if(coach&&app&&!row.approved_at)h+=`<button class="btn t sm" onclick="aiApprove(this,${row.id},true)">Погодити</button>`;
  if(coach&&row.approved_at)h+=`<button class="btn t sm" onclick="aiApprove(this,${row.id},false)">Зняти погодження</button>`}
 return h?`<div class="row" style="gap:8px;flex-wrap:wrap">${h}</div>`:''}
function aiCardBody(row,coach,max){const m=row.metrics||{};
 return `<div class="between"><div class="over">${ic('spark',14)} AI-тренер${row.source==='rules'?' · за правилами':''}</div>${aiTag(row)}</div>
  <div class="t14" style="margin-top:6px">${esc(row.summary)}</div>${aiMetrics(m)}
  ${(row.changes||[]).length?`<div class="stack" style="gap:6px">${aiChangesHtml(row,max)}</div>`:''}
  ${aiActions(row,coach)}
  <button class="btn t sm" style="align-self:flex-start" onclick="openSheet('aiPlan',${row.id})">Докладніше${(row.suggestions||[]).some(s=>s.state==='open')?' · є пропозиції':''}</button>
  <div class="t12 ter">${ago(row.created_at)}${row.status==='applied'&&!coach?' · тренер бачить зміни і може їх скасувати':''}</div>`}
function aiTodayCard(){if(!impCan())return '';const row=aiShowRow(st.me.id);if(!row||row.status==='noop')return '';
 return `<div class="card s8 aicard">${aiCardBody(row,false,3)}</div>`}
function aiPlanCard(){if(!impCan())return '';const row=aiShowRow(st.me.id);
 return `<div class="card s8 aicard">${row&&row.status!=='noop'?aiCardBody(row,false,4):`<div class="over">${ic('spark',14)} AI-тренер</div><div class="t14">${row?esc(row.summary):'AI щодня аналізує ваші тренування (імпорт .fit/.gpx/.tcx, щоденник) і підлаштовує найближчі 7 днів плану.'}</div>${row?aiMetrics(row.metrics):''}`}
  <button class="btn s sm" style="align-self:flex-start" onclick="aiNow(this)">${ic('refresh',18)} Перерахувати зараз</button></div>`}
function aiCoachBlock(pid){const L=st.aiAll.filter(r=>r.athlete_id===pid);const row=aiShowRow(pid);
 if(!row)return L.length?`<div class="t12 ter">AI-аналіз: останній ${ago(L[0].created_at)}, змін не було</div>`:`<div class="t12 ter">AI-аналіз ще не запускався (спортсмен має відкрити застосунок після імпорту)</div>`;
 return `<div class="card s8 aicard">${aiCardBody(row,true,3)}</div>`}
SHEETS.aiPlan=id=>{const row=aiRow(id);if(!row)return {title:'AI-тренер',body:''};const coach=row.athlete_id!==st.me.id&&isCoach();
 const hist=(row.athlete_id===st.me.id?st.aiAdj:st.aiAll.filter(r=>r.athlete_id===row.athlete_id)).filter(r=>r.id!==row.id).slice(0,5);
 return {title:'AI-тренер · '+(coach?esc(shortName(row.athlete_id)):'мій план'),full:true,body:`<div class="stack">
  <div class="between"><div class="t14 sec">${row.day?fmtDate(parseIso(row.day)):''} · ${{import:'після імпорту',daily:'щоденний аналіз',manual:'за запитом'}[row.trigger]||''}</div>${aiTag(row)}</div>
  <div class="t16">${esc(row.summary)}</div>${aiMetrics(row.metrics)}${aiExtra(row.metrics)}
  ${(row.changes||[]).length?`<div class="over">Що змінено</div><div class="stack" style="gap:6px">${aiChangesHtml(row)}</div>`:''}
  ${(row.suggestions||[]).length?`<div class="over">Поради та пропозиції</div><div class="stack" style="gap:6px">${aiSugHtml(row)}</div>`:''}
  ${aiActions(row,coach)}
  <div class="note">${ic('info',20)}<span>AI змінює лише ваші власні тренування. Завдання тренера на дошці секції, призначені тренером тренування та тижні, які тренер змінив вручну, ніколи не перезаписуються: для них є лише поради. FTP і пороги змінюються тільки за вашим підтвердженням.</span></div>
  ${hist.length?`<div class="over">Попередні запуски</div><div class="list">${hist.map(r=>`<button class="li" onclick="sheetStack[sheetStack.length-1].arg=${r.id};renderSheet()"><div class="grow"><div class="t14 ell">${fmtDate(parseIso(r.day))} · ${esc((r.summary||'').slice(0,70))}</div></div>${aiTag(r)}</button>`).join('')}</div>`:''}
  </div>`,foot:coach?'':`<button class="btn s" onclick="aiNow(this)">${ic('refresh',18)} Перерахувати зараз</button>`}};
