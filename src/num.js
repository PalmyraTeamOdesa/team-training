/* ---------- NUMBER FIELD (type + slider) ---------- */
const NF={};
function nfParse(s){if(s==null)return NaN;s=String(s).trim().replace(/\s/g,'').replace(',','.');if(!s||s==='-'||s==='.')return NaN;const n=parseFloat(s);return isFinite(n)?n:NaN}
function nfTimeParse(s){if(s==null)return NaN;s=String(s).trim();const m=s.match(/^(\d+)\s*[:.,]\s*(\d{1,2})$/);if(m)return +m[1]*60+Math.min(59,+m[2]);const n=nfParse(s);return isFinite(n)?Math.round(n*60):NaN}
function nfClockParse(s){if(s==null)return NaN;s=String(s).trim();const m=s.match(/^(\d{1,2})\s*[:.,]\s*(\d{1,2})$/);if(m)return +m[1]*60+Math.min(59,+m[2]);const n=nfParse(s);return isFinite(n)?Math.round(n<24?n*60:n):NaN}
function nfFmtTime(sec){sec=Math.max(0,Math.round(sec));const m=Math.floor(sec/60),s=sec%60;return m+':'+(s<10?'0':'')+s}
function nfFmtClock(min){min=Math.max(0,Math.round(min));const h=Math.floor(min/60),m=min%60;return (h<10?'0':'')+h+':'+(m<10?'0':'')+m}
function nfDec(step){const t=String(step);return t.includes('.')?t.split('.')[1].length:0}
function nfFmt(n,o){if(o.kind==='time')return nfFmtTime(n);if(o.kind==='clock')return nfFmtClock(n);const d=nfDec(o.step==null?1:o.step);let x=(+n).toFixed(d);if(d)x=x.replace('.',',');return x}
function nfClamp(n,o){const step=o.step==null?1:o.step;if(!isFinite(n))return o.min;n=Math.min(o.max,Math.max(o.min,n));const k=Math.round((n-o.min)/step);n=+(o.min+k*step).toFixed(8);return Math.min(o.max,Math.max(o.min,n))}
function nfRead(s,o){return o.kind==='time'?nfTimeParse(s):o.kind==='clock'?nfClockParse(s):nfParse(s)}
function nfFill(el,o){if(!el)return;const v=+el.value,p=o.max===o.min?0:(v-o.min)/(o.max-o.min)*100;el.style.setProperty('--p',p+'%')}
function nf(o){
  const id=o.id,step=o.step==null?1:o.step;o.step=step;NF[id]=o;
  const raw=o.val;const has=raw!==''&&raw!=null&&isFinite(o.kind==='time'||o.kind==='clock'?+raw||nfRead(raw,o):nfParse(raw));
  let num='';if(has)num=o.kind==='time'||o.kind==='clock'?(isFinite(+raw)&&String(raw).indexOf(':')<0?+raw:nfRead(raw,o)):nfParse(raw);
  if(has&&!isFinite(num))num='';
  const shown=has&&isFinite(num)?nfFmt(num,o):(o.raw||'');
  const sl=has&&isFinite(num)?nfClamp(num,o):o.min;
  const p=o.max===o.min?0:(sl-o.min)/(o.max-o.min)*100;
  const dis=o.disabled?'disabled':'';
  const pm=o.plus?`<button type="button" class="nf-pm" ${dis} onclick="nfStep('${id}',-1)" aria-label="Менше">${ic('minus',16)}</button>`:'';
  const pp=o.plus?`<button type="button" class="nf-pm" ${dis} onclick="nfStep('${id}',1)" aria-label="Більше">${ic('plus',16)}</button>`:'';
  return `<div class="nf ${o.disabled?'dis':''}" id="nf-${id}">${o.label?`<label>${o.label}</label>`:''}
  <div class="nf-row">${pm}<div class="nf-box"><input class="nf-inp" id="nfi-${id}" inputmode="${o.kind?'text':(step<1?'decimal':'numeric')}" value="${esc(shown)}" ${dis} placeholder="${esc(o.ph||'')}" aria-label="${esc(o.label||o.unit||'Число')}" oninput="nfType('${id}',this.value)" onblur="nfBlur('${id}')">${o.unit?`<span class="nf-u">${o.unit}</span>`:''}</div>${pp}</div>
  <input type="range" class="nf-sl" id="nfs-${id}" min="${o.min}" max="${o.max}" step="${step}" value="${sl}" ${dis} style="--p:${p}%" oninput="nfSlide('${id}',this.value)" onchange="nfRelease('${id}')"></div>`;
}
function nfSyncView(id,n,typed){const o=NF[id],inp=$('#nfi-'+id),sl=$('#nfs-'+id);if(sl&&isFinite(n)){sl.value=nfClamp(n,o);nfFill(sl,o)}if(inp&&!typed&&isFinite(n))inp.value=nfFmt(n,o)}
function nfType(id,v){const o=NF[id];if(!o)return;const n=nfRead(v,o);if(isFinite(n)){nfSyncView(id,n,true);nfCommit(id,nfClamp(n,o),false)}else if(o.empty&&!String(v).trim())nfCommit(id,'',false)}
function nfBlur(id){const o=NF[id],inp=$('#nfi-'+id);if(!o||!inp)return;const raw=inp.value.trim();if(!raw&&o.empty){const sl=$('#nfs-'+id);if(sl){sl.value=o.min;nfFill(sl,o)}nfCommit(id,'',true);return}let n=nfRead(raw,o);if(!isFinite(n))n=isFinite(nfParse(String(o.val)))?nfParse(String(o.val)):o.min;n=nfClamp(n,o);inp.value=nfFmt(n,o);nfSyncView(id,n,false);nfCommit(id,n,true)}
function nfSlide(id,v){const o=NF[id];if(!o)return;const n=nfClamp(+v,o);nfSyncView(id,n,false);nfCommit(id,n,false)}
function nfStep(id,dir){const o=NF[id];if(!o)return;let n=nfRead(($('#nfi-'+id)||{}).value,o);if(!isFinite(n))n=o.min;n=nfClamp(n+dir*o.step,o);nfSyncView(id,n,false);nfCommit(id,n,true)}
function nfRelease(id){const o=NF[id];if(o&&o.release)o.release(NF[id]._last)}
function nfCommit(id,v,final){const o=NF[id];if(!o)return;o._last=v;if(o.set)o.set(v);if(final&&o.release)o.release(v)}
