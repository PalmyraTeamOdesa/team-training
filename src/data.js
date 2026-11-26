/* ---------- PROFILE MAPPING ---------- */
const DEF_SPORTS=()=>({bike:{on:true,types:['road'],level:'beg',own:false},run:{on:false,level:'beg',own:false},swim:{on:false,level:'beg',own:false},gym:{on:false,level:'beg',own:false}});
function toP(r){const q=r.q||{};const name=(r.full_name||'').trim()||'Без імені';
 return {id:r.id,name,short:(cleanName(name)||name).split(' ')[0],ini:initials(name),sex:r.sex||'m',age:r.age||30,height:r.height_cm||175,weight:+r.weight_kg||75,city:r.city||'',
  group:r.group_name,status:r.status,onboarded:r.onboarded,hide:r.hide_numbers,consent:r.consent,created:r.created_at,avatar:r.avatar_path,
  sports:Object.assign(DEF_SPORTS(),q.sports||{}),goals:q.goals||['endur'],targets:q.targets||{},days:q.days||days([null,null,null,null,null,null,null]),
  equip:q.equip||[],form:q.form||{},health:q.health||{inj:[],bp:'norm',notes:''},remind:q.remind||'07:00',races:q.races||[],ftpHist:q.ftpHist||[],remindOn:q.remindOn||{workout:true,morning:true,water:false,weekly:true},row:r}}
function qOf(p){return {sports:p.sports,goals:p.goals,targets:p.targets,days:p.days,equip:p.equip,form:p.form,health:p.health,remind:p.remind,races:p.races,ftpHist:p.ftpHist,remindOn:p.remindOn}}
async function saveMe(fields){const p=st.me;const row=Object.assign({full_name:p.name,sex:p.sex,age:p.age,height_cm:p.height,weight_kg:p.weight,city:p.city,q:qOf(p),hide_numbers:!!p.hide},fields||{});
 const {data,error}=await sb.from('profiles').update(row).eq('id',p.id).select().single();if(error)throw error;const np=toP(data);Object.assign(st.me,np);return st.me}

/* ---------- LOADERS ---------- */
function D(r){if(r.error)throw r.error;return r.data}
async function loadAll(){
 const uid=st.user.id;
 const prof=D(await sb.from('profiles').select('*').eq('id',uid).maybeSingle());
 st.coach=!!D(await sb.from('coaches').select('user_id').eq('user_id',uid).maybeSingle());
 if(!prof){st.me=toP({id:uid,full_name:(st.user.user_metadata||{}).full_name||'',status:'pending',onboarded:false});return}
 st.me=toP(prof);
 await loadSections().catch(e=>console.warn(e));
 if(!st.coach&&coachSecs().length&&!memberSecs().length&&st.tab==='today')st.tab='sec';
 const tasks=[loadNotifs(),loadMembers()];
 if(st.coach)tasks.push(loadCoach(),loadTeam());
 else if(st.me.onboarded)tasks.push(loadMine(),loadTeam());
 await Promise.all(tasks);
}
async function loadNotifs(){st.notifs=D(await sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(60))}
async function loadMembers(){st.members=D(await sb.rpc('team_members'))||[]}
async function loadMine(){
 const uid=st.me.id;const from=dayIso(-26,0);
 const [logs,well,wts,food,cnt,req,aw,unl,plans]=await Promise.all([
  sb.from('workout_logs').select('*').eq('athlete_id',uid).order('day'),
  sb.from('wellness').select('*').eq('athlete_id',uid).gte('day',from),
  sb.from('weights').select('*').eq('athlete_id',uid).order('day'),
  sb.from('food_entries').select('*').eq('athlete_id',uid).gte('day',dayIso(-1,0)).order('created_at'),
  sb.from('daily_counters').select('*').eq('athlete_id',uid).gte('day',dayIso(-1,0)),
  sb.from('change_requests').select('*').eq('athlete_id',uid).order('created_at',{ascending:false}).limit(30),
  sb.from('awards').select('*').eq('athlete_id',uid),
  sb.from('plan_unlocks').select('*').eq('athlete_id',uid).maybeSingle(),
  sb.from('plan_weeks').select('*').eq('athlete_id',uid).gte('week_start',wkIso(-12))]);
 st.logs=D(logs);st.well={};D(well).forEach(w=>st.well[w.day]=w);st.weights=D(wts);st.food=D(food);
 st.cnts={};D(cnt).forEach(c=>st.cnts[c.day]=c);st.cnt=st.cnts[dayIso(0,TODAY)]||{water:0,coffee:0,alc:0};
 st.requests=D(req);st.awards=D(aw);st.unlock=D(unl);
 D(plans).forEach(r=>st.plans[uid+'|'+r.week_start]=r);
 await ensurePlan(st.me,0);
}
async function loadTeam(){
 const [posts,rides,ch,chat,dms]=await Promise.all([
  sb.from('posts').select('*, post_likes(user_id), post_comments(id,author_id,body,created_at)').order('created_at',{ascending:false}).limit(60),
  sb.from('rides').select('*, ride_participants(user_id)').order('starts_at'),
  sb.from('challenges').select('*').order('month',{ascending:false}).limit(5),
  sb.from('messages').select('*').is('recipient_id',null).order('created_at',{ascending:false}).limit(150),
  sb.from('messages').select('*').not('recipient_id','is',null).order('created_at',{ascending:false}).limit(400)]);
 st.posts=D(posts)||[];st.rides=D(rides)||[];st.challenges=D(ch)||[];st.chat=(D(chat)||[]).reverse();st.dms=(D(dms)||[]).reverse();
 await Promise.all(st.challenges.map(async c=>{const r=await sb.rpc('challenge_progress',{cid:c.id});c.cur=r.data||0}));
 signPhotos();
}
async function signPhotos(){const paths=st.posts.filter(p=>p.photo_path&&!PHOTO_URL[p.photo_path]).map(p=>p.photo_path);if(!paths.length)return;
 const {data}=await sb.storage.from('photos').createSignedUrls(paths,3600);(data||[]).forEach(x=>{if(x.signedUrl)PHOTO_URL[x.path]=x.signedUrl});render()}
const PHOTO_URL={};

/* ---------- PLAN STORAGE ---------- */
function weekN(p,wk){const c=p.created?new Date(p.created):new Date();const c0=new Date(c.getFullYear(),c.getMonth(),c.getDate()-((c.getDay()+6)%7));return Math.max(0,Math.round((dayDate(wk,0)-c0)/864e5/7))}
function genFor(p,wk,scale){
 let s=scale||1,note=null;const race=raceSoon(p,wk);if(race){s*=.65;note='Підводка до старту «'+race.name+'»: обсяг знижено на 35%, інтенсивність збережено.'}
 const d=genWeek(pEff(p),weekN(p,wk),s);return {days:d,scale:s,note}}
function planRowToDays(r){return r.days.map((d,i)=>Object.assign({i,items:[],tod:'any',rest:true},d,{i,rest:!(d.items&&d.items.length)}))}
function plannedCount(days){return days.filter(d=>d.items.some(it=>!it.log||true)&&d.items.length).length}
function plannedMin(days){return days.reduce((a,d)=>a+dayMin(d),0)}
async function ensurePlan(p,wk){const key=p.id+'|'+wkIso(wk);if(st.plans[key])return st.plans[key];if(!p.onboarded)return null;
 const g=genFor(p,wk,1);if(wk===0&&weekN(p,0)===0)g.days.forEach(d=>{if(d.i<TODAY){d.items=[];d.rest=true}});const row={athlete_id:p.id,week_start:wkIso(wk),days:g.days,planned_count:plannedCount(g.days),planned_min:plannedMin(g.days),scale:g.scale,note:g.note};
 const {data,error}=await sb.from('plan_weeks').upsert(row,{onConflict:'athlete_id,week_start',ignoreDuplicates:true}).select().maybeSingle();
 if(error){console.warn(error);st.plans[key]=Object.assign({},row,{_local:true});return st.plans[key]}
 if(data)st.plans[key]=data;else{const r=await sb.from('plan_weeks').select('*').eq('athlete_id',p.id).eq('week_start',wkIso(wk)).maybeSingle();st.plans[key]=r.data||row}
 return st.plans[key]}
async function savePlan(pid,wk,days,extra){const row=Object.assign({athlete_id:pid,week_start:wkIso(wk),days:days.map(d=>({i:d.i,items:d.items,tod:d.tod||'any'})),planned_count:plannedCount(days),planned_min:plannedMin(days)},extra||{});
 const {data,error}=await sb.from('plan_weeks').upsert(row,{onConflict:'athlete_id,week_start'}).select().single();if(error)throw error;st.plans[pid+'|'+row.week_start]=data;return data}
/* plan with today's wellness adaptation (display only) */
function weekPlan(pid,wk){
 const p=pid===st.me.id?st.me:athleteP(pid);const r=st.plans[pid+'|'+wkIso(wk)];
 let days,note=null,stored=!!r,locked=false;
 if(r){days=planRowToDays(r);note=r.note?{k:'race',t:r.note}:null;locked=r.coach_locked;if(r.scale&&r.scale<1&&!r.note)note={k:'scale',t:'План полегшено: обсяг '+Math.round(r.scale*100)+'%.'}}
 else if(p&&p.onboarded){const g=genFor(p,wk,1);days=g.days;note=g.note?{k:'race',t:g.note}:null}
 else days=Array.from({length:7},(_,i)=>({i,items:[],tod:'any',rest:true}));
 const cs=coachedSports(pid);if(cs.length)days=days.map(d=>{if(d.rest||!d.items.some(it=>cs.includes(it.sport)&&!it.log&&!it.coach))return d;return Object.assign({},d,{items:d.items.map(it=>cs.includes(it.sport)&&!it.log&&!it.coach?{sport:it.sport,log:true,section:true,min:it.min}:it)})});
 const wl=pid===st.me.id?st.well[dayIso(0,TODAY)]:null;
 if(wk===0&&wl&&wellBad(wl)>=2){const t=days[TODAY];if(t&&!t.rest&&!t.items.some(x=>x.coach)){const w=LIB.find(x=>x.sport==='bike'&&x.cat==='rec')||LIB[0];days[TODAY]=Object.assign({},t,{items:[{sport:t.items[0].sport==='bike'?'bike':t.items[0].sport,w:t.items[0].sport==='bike'?w.id:null,min:Math.min(40,t.items[0].min),easy:true}],adapted:true})}note={k:'well',t:'План на сьогодні полегшено через погане самопочуття. Тренер отримав сповіщення.'}}
 return {days,note,stored,locked};
}
function wellBad(w){return (w.sleep===0)+(w.energy===0)+(w.legs===0)}
function athleteP(id){const a=st.athletes.find(x=>x.id===id);return a?a.p:null}

/* ---------- LOG HELPERS ---------- */
function logsOn(iso_,pid){return (pid&&pid!==st.me.id?st.allLogs.filter(l=>l.athlete_id===pid):st.logs).filter(l=>l.day===iso_)}
function isDone(pid,wk,i){return logsOn(dayIso(wk,i),pid).some(l=>l.status==='done')}
function isSkip(pid,wk,i){const l=logsOn(dayIso(wk,i),pid).find(l=>l.status==='skipped');return l?(l.skip_reason||'без причини'):null}
function weekCompl(pid,wk){const {days}=weekPlan(pid,wk);const tr=days.filter(d=>!d.rest);const dn=tr.filter(d=>isDone(pid,wk,d.i)).length;return {tr:tr.length,dn,pct:tr.length?Math.round(dn/tr.length*100):0}}
function days(spec){return spec.map(x=>x?{acts:x[0],min:x[1],tod:x[2]}:{acts:[],min:0,tod:'any'})}
function raceSoon(p,wk){const start=dayDate(wk,0);return (p.races||[]).find(r=>{const d=parseIso(r.date);const diff=(d-start)/864e5;return diff>=0&&diff<14})}
