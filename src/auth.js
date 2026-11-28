/* ---------- AUTH ---------- */

/* ---------- INVITE LINK (#i or #i=bike,run&c=swim) ---------- */
function parseInviteHash(){
 const ok=x=>SEC_ORDER.includes(x);const take=v=>(v||'').split(/[+,]/).map(x=>x.trim()).filter(ok);
 const h=(location.hash||'').slice(1);let member=[],coach=[],hit=false;
 if(h==='i'||h.startsWith('i=')||h.startsWith('i?')||h.startsWith('i&')){
  hit=true;const q=h.slice(1);const sp=new URLSearchParams(q.startsWith('=')?'m'+q:q.replace(/^\?/,''));
  member=take(sp.get('m'));coach=take(sp.get('c'));
 }
 if(hit){st._inviteIn={member,coach};try{sessionStorage.setItem('triton_invite',JSON.stringify(st._inviteIn))}catch(e){}if(!st.user)st.authMode='signup'}
 else if(!st._inviteIn){try{const j=JSON.parse(sessionStorage.getItem('triton_invite')||'');if(j&&(j.member||j.coach))st._inviteIn=j}catch(e){}}
 return st._inviteIn;
}
function inAppHintHtml(){
 if(typeof instInfo!=='function')return '';
 const i=instInfo();if(!(i.inApp||(i.iOS&&!i.iosSafari)))return '';
 const tg=/Telegram/i.test(navigator.userAgent||'');
 if(i.iOS)return `<div class="note" style="text-align:left">${ic('phone',20)}<span><b>${tg?'Ви у браузері Telegram':'Відкрийте TRITON у Safari'}.</b> На iPhone і iPad додати на екран Додому можна лише в Safari.</span></div>
  <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn p grow" onclick="instOpenSafari()">${ic('link',18)} Відкрити в Safari</button><button class="btn s grow" onclick="instCopySafari()">${ic('copy',18)} Скопіювати посилання</button></div>`;
 return `<div class="note" style="text-align:left">${ic('phone',20)}<span><b>${tg?'Ви у браузері Telegram':'Ви відкрили посилання всередині іншої програми'}.</b> Щоб потім встановити TRITON на екран, відкрийте це посилання в Chrome.</span></div>
  <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn s grow" onclick="instCopyLink()">${ic('copy',18)} Скопіювати посилання</button>${i.android?`<button class="btn s grow" onclick="instOpenChrome()">${ic('link',18)} Відкрити в Chrome</button>`:''}</div>`;
}
st.authMode='login';
function authView(){parseInviteHash();
const m=st.authMode;
 const title={login:'Вхід',signup:'Реєстрація',forgot:'Відновити пароль'}[m];
 return `<main><div class="stack" style="padding-top:40px">
 <div class="login-hero">${logoHtml()}<div class="t28">TRITON Team</div><div class="t14 sec">Тренування команди · Одеса</div></div>
 ${inAppHintHtml()}
 ${st._inviteIn&&m==='signup'?`<div class="note">${ic('link',20)}<span>Вас запросили до команди TRITON. Створіть акаунт — після підтвердження тренера відкриється кабінет.</span></div>`:''}
 <div class="card s12"><div class="t20">${title}</div>
 ${m==='signup'?`<div class="field"><label>Імʼя і прізвище</label><input class="inp" id="a-name" autocomplete="name" placeholder="Олександр Петренко"></div>`:''}
 <div class="field"><label>Email</label><input class="inp" id="a-email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" value="${esc(st._authEmail||'')}"></div>
 ${m!=='forgot'?`<div class="field"><label>Пароль</label><input class="inp" id="a-pass" type="password" autocomplete="${m==='signup'?'new-password':'current-password'}" placeholder="${m==='signup'?'Щонайменше 8 символів':''}" onkeydown="if(event.key==='Enter')authGo(this)"></div>`:''}
 ${m==='forgot'?`<div class="note">${ic('info',20)}<span>Лист для відновлення надсилається лише тренеру. Спортсменам тренер встановить тимчасовий пароль у своєму кабінеті: просто напишіть йому.</span></div>`:''}
 <div class="t14" id="a-err" style="color:var(--bad);min-height:0">${esc(st._authMsg||'')}</div>
 <button class="btn p" id="a-btn" onclick="authGo(this)">${{login:'Увійти',signup:'Створити акаунт',forgot:'Надіслати лист'}[m]}</button></div>
 <div class="center s8">${m==='login'?`<button class="btn t" onclick="authMode('signup')">Немає акаунта? Зареєструватися</button><button class="btn t" onclick="authMode('forgot')">Забули пароль?</button>`:`<button class="btn t" onclick="authMode('login')">Уже є акаунт? Увійти</button>`}</div>
 <div class="t12 ter center">Нові учасники потрапляють у команду після підтвердження тренером</div></div></main>`}
function authMode(m){const e=$('#a-email');if(e)st._authEmail=e.value;st.authMode=m;render()}
function authErr(t){const e=$('#a-err');if(e)e.textContent=t||''}
async function authGo(btn){btn=btn&&btn.id==='a-btn'?btn:$('#a-btn');authErr('');
 const email=($('#a-email').value||'').trim().toLowerCase();const pass=$('#a-pass')?$('#a-pass').value:'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))return authErr('Перевірте email');
 await busy(btn,async()=>{
  if(st.authMode==='login'){const {error}=await sb.auth.signInWithPassword({email,password:pass});if(error)return authErr(/invalid/i.test(error.message)?'Невірний email або пароль':error.message)}
  else if(st.authMode==='signup'){const name=($('#a-name').value||'').trim();if(!name)return authErr('Вкажіть імʼя');if(pass.length<8)return authErr('Пароль має містити щонайменше 8 символів');
   const inv=st._inviteIn||{};const {data,error}=await sb.functions.invoke('account',{body:{action:'register',email,password:pass,full_name:name,member_sections:inv.member||[],coach_sections:inv.coach||[]}});
   if(error){let msg='Не вдалося створити акаунт';try{const j=await error.context.json();msg=j.error||msg}catch(_){}return authErr(msg)}
   const r=await sb.auth.signInWithPassword({email,password:pass});if(r.error)return authErr(r.error.message)}
  else{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   if(error)return authErr('Лист не надіслано. Попросіть тренера встановити тимчасовий пароль.');toast('Якщо це акаунт тренера, лист уже в пошті','info')}
 })}
async function logout(){await sb.auth.signOut();location.reload()}

/* ---------- BOOT ---------- */
async function startSession(session){
 if(!session){st.user=null;st.screen='auth';render();return}
 if(st.user&&st.user.id===session.user.id&&st.screen!=='auth')return;
 st.user=session.user;st.screen='boot';render();
 try{await loadAll()}catch(e){fail(e,'Не вдалося завантажити дані. Перевірте інтернет.');}
 if(!st.me){st.screen='auth';render();return}
 if(st.me.status==='blocked'&&!st.coach){st._authMsg='Доступ до команди закрито адміністратором.';await sb.auth.signOut();return}
 if(!st.coach&&!st.me.onboarded){startOnb();return}
 if(!st.coach&&st.me.status!=='active'){st.screen='wait';render();if(typeof navWrite==='function')navWrite(true);waitPoll();if(typeof maybeOfferInstall==='function')setTimeout(maybeOfferInstall,500);return}
 st.screen='app';if(st.coach)st.ctab='team';render();subscribeLive();
 if(typeof navBoot==='function')navBoot();
 if(location.hash==='#recovery')openSheet('password');
 else if(typeof pushConsumeHash==='function')pushConsumeHash();
 if(typeof impBootActions==='function')setTimeout(impBootActions,300);
 if(st._justApproved)st._justApproved=false;
 if(typeof maybeOfferInstall==='function')setTimeout(maybeOfferInstall,400);
}
function waitView(){return `<main><div class="stack" style="padding-top:72px;text-align:center">${inAppHintHtml()}<div class="okcircle" style="margin:0 auto">${ic('clock',28)}</div><div class="t28">Заявку надіслано</div><div class="t14 sec">Тренер ще не підтвердив вашу участь. Поки що в застосунку нічого не відкрито: після підтвердження зʼявляться ваш план і команда.</div><button class="btn s" onclick="waitCheck(this)">Перевірити статус</button><button class="btn t" onclick="logout()">Вийти</button></div></main>`}
let _wt=null;function waitPoll(){clearInterval(_wt);_wt=setInterval(()=>{if(st.screen!=='wait'){clearInterval(_wt);return}waitCheck(null,true)},30000)}
async function waitCheck(btn,quiet){try{const r=D(await sb.from('profiles').select('status').eq('id',st.user.id).maybeSingle());
 if(r&&r.status==='active'){clearInterval(_wt);st._justApproved=true;const {data}=await sb.auth.getSession();st.user=null;await startSession(data.session);return}
 if(r&&r.status==='blocked'){clearInterval(_wt);await sb.auth.signOut();location.reload();return}
 if(!quiet)toast('Поки що очікуємо підтвердження тренера','info')}catch(e){if(!quiet)toast('Немає звʼязку. Спробуйте пізніше','info')}}
function onTab(t){}
let _live=null;
function subscribeLive(){if(_live)return;
 _live=sb.channel('live').on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+st.user.id},p=>{st.notifs.unshift(p.new);render();toast(p.new.title,'bell')})
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},p=>{const m=p.new;const arr=m.recipient_id?st.dms:st.chat;if(arr.some(x=>x.id===m.id))return;arr.push(m);if(!st._sheetChat)render();else renderSheet()}).on('postgres_changes',{event:'*',schema:'public',table:'board_marks'},secLive).on('postgres_changes',{event:'*',schema:'public',table:'board_comments'},secLive).on('postgres_changes',{event:'*',schema:'public',table:'board_lines'},secLive).on('postgres_changes',{event:'*',schema:'public',table:'board_posts'},secLive).on('postgres_changes',{event:'INSERT',schema:'public',table:'section_messages'},p=>onSecMsg(p)).on('postgres_changes',{event:'INSERT',schema:'public',table:'mark_comments'},p=>onMarkComment(p)).on('postgres_changes',{event:'*',schema:'public',table:'alt_reviews'},p=>onAltReview(p)).subscribe()}
let _secT=null;function secLive(){clearTimeout(_secT);_secT=setTimeout(async()=>{try{st.boards={};st.secRate={};await loadMyLines();const tab=isCoach()?st.ctab:st.tab;if((tab==='sec'||tab==='team')&&st.sec&&st.sec!=='club'&&st.bDay)await loadBoard(st.sec,st.bDay,true);if(!sheetStack.length)render()}catch(e){console.warn(e)}},600)}
sb.auth.onAuthStateChange((ev,session)=>{if(ev==='PASSWORD_RECOVERY'){location.hash='recovery'}if(ev==='SIGNED_OUT'){st.user=null;st.screen='auth';render();return}
 if(ev==='INITIAL_SESSION'||ev==='SIGNED_IN')setTimeout(()=>startSession(session),0)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&iso(new Date())!==dayIso(0,TODAY))location.reload()});
