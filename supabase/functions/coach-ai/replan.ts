// TRITON AI re-plan: pure functions (load metrics, deterministic rules, validation of LLM output).
// No I/O here so they can be unit-tested with plain node/deno.

export type Log = {
  id?: number; day: string; sport: string; status: string; duration_min: number | null; tss: number | null; rpe: number | null;
  intensity: number | null; avg_power: number | null; np: number | null; avg_hr: number | null; max_hr: number | null;
  decoupling: number | null; created_at?: string;
};
export type PDay = { date: string; i: number; wk: number; min: number; tss: number; hard: boolean; rest: boolean; prot: boolean; src?: string; text?: string; names?: string; board?: { src: string; text: string; hard: boolean } };
export type Action = { date: string; op: string; factor?: number; to?: string; reason: string };
export type Sug = { type: string; cur?: number | null; val?: number; reason: string; state?: string; date?: string; advice?: string; text?: string; section?: string };

const DAYMS = 864e5;
export const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const diffDays = (a: string, b: string) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / DAYMS);
const mondayOf = (iso: string) => addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const r1 = (x: number) => Math.round(x * 10) / 10;
export const OPS = ["keep", "scale", "easy", "recovery", "rest", "harder", "swap"];

export function logTss(l: Log): number {
  if (l.tss != null) return l.tss;
  return Math.round(((l.duration_min || 0) * (l.rpe || 5) * (l.rpe || 5)) / 60 * 1.1);
}
function logIF(l: Log): number {
  if (l.intensity && l.intensity > 0) return l.intensity;
  const d = l.duration_min || 0; if (!d) return 0;
  return clamp(Math.sqrt(Math.max(0, logTss(l) * 60 / (d * 100))), 0, 1.3);
}

export type Form = { ftp?: number; lthr?: number; hrMax?: number; hrRest?: number };

export function computeMetrics(allLogs: Log[], today: string, form: Form, planRows: { week_start: string; days: any[]; planned_count?: number; planned_min?: number }[], races: { name?: string; date?: string }[]) {
  const done = allLogs.filter((l) => l.status === "done" && l.day < addDays(today, 1) && diffDays(today, l.day) <= 130);
  const byDay: Record<string, number> = {}; const mins: Record<string, number> = {};
  for (const l of done) { byDay[l.day] = (byDay[l.day] || 0) + logTss(l); mins[l.day] = (mins[l.day] || 0) + (l.duration_min || 0); }
  const first = done.length ? done.map((l) => l.day).sort()[0] : today;
  const span = Math.max(0, diffDays(today, first));
  // CTL (42 d) / ATL (7 d) EWMA up to yesterday; seeded with the mean daily TSS of the first two weeks (no cold-start)
  const end = addDays(today, -1);
  let n0 = 0, s0 = 0;
  for (let k = 0; k < Math.min(14, Math.max(1, span)); k++) { s0 += byDay[addDays(first, k)] || 0; n0++; }
  let ctl = n0 ? s0 / n0 : 0, atl = ctl, ctl7 = ctl;
  const ramp0 = addDays(today, -8);
  for (let d = first; d <= end; d = addDays(d, 1)) {
    const t = byDay[d] || 0;
    ctl += (t - ctl) / 42; atl += (t - atl) / 7;
    if (d === ramp0) ctl7 = ctl;
  }
  if (diffDays(end, first) < 8) ctl7 = ctl;
  const tsb = ctl - atl;
  // weeks (Mon..Sun): last 4 full + current
  const wkNow = mondayOf(today);
  const weeks: any[] = [];
  for (let k = 4; k >= 0; k--) {
    const ws = addDays(wkNow, -7 * k); let m = 0, t = 0, c = 0;
    for (let j = 0; j < 7; j++) { const d = addDays(ws, j); m += mins[d] || 0; t += byDay[d] || 0; if (mins[d]) c++; }
    const pr = planRows.find((r) => r.week_start === ws);
    const pm = pr ? (pr.planned_min || (pr.days || []).reduce((a: number, d: any) => a + (d.items || []).reduce((x: number, it: any) => x + (it.min || 0), 0), 0)) : null;
    weeks.push({ ws, done_min: m, tss: Math.round(t), planned_min: pm, days: c });
  }
  // compliance over the last 14 completed days
  let planned = 0, did = 0;
  for (const r of planRows) {
    (r.days || []).forEach((d: any, i: number) => {
      if (!(d.items || []).length) return; const date = addDays(r.week_start, d.i ?? i);
      if (date >= today || diffDays(today, date) > 14) return;
      planned++; if (mins[date]) did++;
    });
  }
  const compl = planned >= 3 ? did / planned : null;
  // intensity distribution, last 28 d (minutes)
  const dist = { easy: 0, mod: 0, hard: 0 }; const dist7 = { easy: 0, mod: 0, hard: 0 };
  for (const l of done) {
    const age = diffDays(today, l.day); if (age > 28 || !l.duration_min) continue;
    const f = logIF(l); const c = f < 0.75 ? "easy" : f < 0.9 ? "mod" : "hard";
    (dist as any)[c] += l.duration_min; if (age <= 7) (dist7 as any)[c] += l.duration_min;
  }
  const tot = dist.easy + dist.mod + dist.hard, tot7 = dist7.easy + dist7.mod + dist7.hard;
  const share = (d: any, t: number) => t ? { easy: r1(d.easy / t), mod: r1(d.mod / t), hard: r1(d.hard / t) } : null;
  // aerobic decoupling (from file streams) and efficiency factor trend
  const dec = done.filter((l) => l.decoupling != null && (l.duration_min || 0) >= 45 && diffDays(today, l.day) <= 42).sort((a, b) => a.day.localeCompare(b.day));
  const decLast = dec.length ? Number(dec[dec.length - 1].decoupling) : null;
  const decAvg = dec.length ? r1(dec.slice(-3).reduce((a, l) => a + Number(l.decoupling), 0) / Math.min(3, dec.length)) : null;
  const efs = done.filter((l) => l.sport === "bike" && l.np && l.avg_hr && (l.duration_min || 0) >= 30 && logIF(l) < 0.85 && diffDays(today, l.day) <= 60)
    .sort((a, b) => a.day.localeCompare(b.day)).map((l) => (l.np as number) / (l.avg_hr as number));
  let efTrend: number | null = null;
  if (efs.length >= 6) { const a = efs.slice(-3), b = efs.slice(-6, -3); const av = (x: number[]) => x.reduce((p, c) => p + c, 0) / x.length; efTrend = r1(((av(a) - av(b)) / av(b)) * 100); }
  // new bests → FTP / LTHR / HRmax proposals
  const rec = done.filter((l) => diffDays(today, l.day) <= 42);
  let ftpEst = 0, ftpFrom = "";
  for (const l of rec) {
    if (l.sport !== "bike") continue; const dm = l.duration_min || 0; let e = 0;
    if (dm >= 20 && dm <= 35 && l.avg_power) e = l.avg_power * 0.95;
    else if (dm > 35 && dm <= 90 && l.np && form.ftp && l.np / form.ftp >= 0.9) e = l.np * 0.99;
    if (e > ftpEst) { ftpEst = e; ftpFrom = `${l.day}: ${dm} хв, ${l.np && dm > 35 ? "NP " + l.np : "сер. " + l.avg_power} Вт`; }
  }
  let lthrEst = 0, lthrFrom = "";
  for (const l of rec) {
    const dm = l.duration_min || 0; if (!l.avg_hr || (l.sport !== "run" && l.sport !== "bike") || dm < 25 || dm > 70) continue;
    if ((l.rpe || 0) >= 8 && l.avg_hr > lthrEst) { lthrEst = l.avg_hr; lthrFrom = `${l.day}: ${dm} хв, пульс сер. ${l.avg_hr}`; }
  }
  const hrMaxSeen = Math.max(0, ...done.filter((l) => diffDays(today, l.day) <= 90).map((l) => l.max_hr || 0));
  const next = (races || []).map((r) => r.date).filter((d): d is string => !!d && d >= today).sort()[0];
  const lastDone = done.filter((l) => l.day === end);
  return {
    today, data_days: span, done_count: done.filter((l) => diffDays(today, l.day) <= 28).length,
    ctl: r1(ctl), atl: r1(atl), tsb: r1(tsb), ramp: r1(ctl - ctl7),
    yday_tss: Math.round(byDay[end] || 0), last3_tss: Math.round([1, 2, 3].reduce((a, k) => a + (byDay[addDays(today, -k)] || 0), 0)),
    weeks, compliance14: compl == null ? null : r1(compl), planned14: planned,
    dist28: share(dist, tot), dist7: share(dist7, tot7), hours28: r1(tot / 60),
    decoupling_last: decLast, decoupling_avg3: decAvg, ef_trend_pct: efTrend,
    ftp: form.ftp || null, lthr: form.lthr || null, hrmax: form.hrMax || null,
    ftp_est: ftpEst ? Math.round(ftpEst) : null, ftp_from: ftpFrom, lthr_est: lthrEst || null, lthr_from: lthrFrom, hrmax_seen: hrMaxSeen || null,
    race_in_days: next ? diffDays(next, today) : null, had_yesterday: lastDone.length > 0,
  };
}
export type Metrics = ReturnType<typeof computeMetrics>;

export function proposals(m: Metrics, prev: Sug[]): Sug[] {
  const out: Sug[] = [];
  const seen = (t: string, v: number) => prev.some((p) => p.type === t && p.val != null && (p.state === "dismissed" || p.state === "accepted") && Math.abs((p.val as number) - v) <= Math.max(2, v * 0.02));
  if (m.ftp_est) {
    const cap = m.ftp ? Math.min(m.ftp_est, Math.round(m.ftp * 1.1)) : m.ftp_est; const v = Math.round(cap / 5) * 5;
    if ((!m.ftp || v >= m.ftp + 5 || v >= m.ftp * 1.03) && !seen("ftp", v))
      out.push({ type: "ftp", cur: m.ftp, val: v, state: "open", reason: `Новий кращий результат (${m.ftp_from}) відповідає FTP ≈ ${v} Вт${m.ftp ? ` (зараз ${m.ftp})` : ""}.` });
  }
  if (m.lthr_est && (!m.lthr || m.lthr_est >= m.lthr + 3)) {
    const v = m.lthr ? Math.min(m.lthr_est, Math.round(m.lthr * 1.05)) : m.lthr_est;
    if (!seen("lthr", v)) out.push({ type: "lthr", cur: m.lthr, val: v, state: "open", reason: `Важке тренування (${m.lthr_from}) показує поріговий пульс ≈ ${v}${m.lthr ? ` (зараз ${m.lthr})` : ""}.` });
  }
  if (m.hrmax_seen && m.hrmax_seen >= 150 && m.hrmax_seen <= 225 && (!m.hrmax || m.hrmax_seen >= m.hrmax + 2) && !seen("hrmax", m.hrmax_seen))
    out.push({ type: "hrmax", cur: m.hrmax, val: m.hrmax_seen, state: "open", reason: `У файлах зафіксовано пульс ${m.hrmax_seen}${m.hrmax ? `, вище за ваш максимум ${m.hrmax}` : ""}.` });
  return out;
}

const fmt = (x: number) => String(x).replace("-", "−").replace(".", ",");

// deterministic engine; also the safety net if the LLM is unavailable or returns nonsense
export function rulesPlan(m: Metrics, days: PDay[]): { actions: Action[]; summary: string; level: string; sev: number } {
  const elig = days.filter((d) => !d.rest && !d.prot).sort((a, b) => a.date.localeCompare(b.date));
  const restDays = days.filter((d) => d.rest && !d.prot);
  const head = `Навантаження: фітнес ${Math.round(m.ctl)}, втома ${Math.round(m.atl)}, форма ${fmt(Math.round(m.tsb))}.`;
  const A: Action[] = [];
  const hard28 = m.dist28 ? m.dist28.hard : 0, hard7 = m.dist7 ? m.dist7.hard : 0;
  const raceSoon = m.race_in_days != null && m.race_in_days <= 7;
  let sev = m.tsb <= -40 ? 3 : m.tsb <= -30 ? 2 : m.tsb <= -20 ? 1 : 0;
  if (sev === 0 && m.tsb <= -15 && hard7 >= 0.4) sev = 1;
  if (m.decoupling_avg3 != null && m.decoupling_avg3 >= 7 && m.tsb < 0) sev = Math.max(sev, 1);
  if (m.ctl > 20 && m.atl / m.ctl > 1.5) sev = Math.max(sev, 2);
  const lowData = m.done_count < 4 || m.data_days < 7;
  let level = "keep", text = "";
  if (lowData) {
    sev = 0;
    text = "Даних ще замало для змін у плані: додайте кілька тренувань (імпортуйте файли), і я підлаштую навантаження.";
  } else if (sev >= 1 && elig.length) {
    level = sev >= 3 ? "rest" : sev === 2 ? "recovery" : "light";
    const tl = `форма ${fmt(Math.round(m.tsb))}`;
    const heavyYday = m.ctl > 20 && m.yday_tss >= 1.4 * m.ctl;
    let hardSeen = 0;
    elig.slice(0, 6).forEach((d, idx) => {
      if (sev >= 3 && idx === 0) { A.push({ date: d.date, op: "rest", reason: `${tl}: втома накопичилась, потрібен повний день відпочинку` }); return; }
      if (d.hard) {
        hardSeen++;
        if (idx === 0 && heavyYday && sev <= 2) {
          const tgt = restDays.find((x) => x.date > d.date && diffDays(x.date, d.date) <= 3) || elig.find((x) => !x.hard && x.date > d.date && diffDays(x.date, d.date) <= 3);
          if (tgt) { A.push({ date: d.date, op: "swap", to: tgt.date, reason: `вчора було дуже важко (TSS ${m.yday_tss}), ${tl}: інтенсивне тренування переношу на ${tgt.date.slice(8)}.${tgt.date.slice(5, 7)}` }); return; }
        }
        if (hardSeen === 1 && sev >= 2) A.push({ date: d.date, op: "recovery", reason: `${tl}: інтенсивне тренування замінено на відновлення` });
        else if (sev >= 2 || hardSeen === 1) A.push({ date: d.date, op: "easy", reason: `${tl}: інтенсивність знижено до легкої витривалості` });
      } else if (sev >= 2) {
        A.push({ date: d.date, op: "scale", factor: sev >= 3 ? 0.8 : idx === 0 ? 0.8 : 0.9, reason: `${tl}: обсяг зменшено` });
      }
    });
    text = sev >= 3 ? "Втома дуже висока: ставлю день відпочинку, інтенсивні тренування роблю легкими, обсяг знижую."
      : sev === 2 ? "Втома висока: найближче інтенсивне тренування замінено на відновлення, решту полегшено, обсяг знижено."
      : "Втома підвищена: найближче інтенсивне тренування зроблено легким, щоб не накопичувати втому.";
    if (m.decoupling_avg3 != null && m.decoupling_avg3 >= 7) text += ` Пульс «пливе» на довгих заїздах (дрейф ${fmt(m.decoupling_avg3)}%): аеробна база ще просяде без відновлення.`;
  } else if (m.tsb >= 12 && m.compliance14 != null && m.compliance14 >= 0.8 && !raceSoon && hard7 < 0.3 && m.ramp < 5 && elig.length && m.done_count >= 6) {
    level = "raise";
    const tl = `форма ${fmt(Math.round(m.tsb))}, план виконано на ${Math.round(m.compliance14 * 100)}%`;
    const firstHard = elig.find((d) => d.hard);
    if (firstHard) A.push({ date: firstHard.date, op: "harder", reason: `${tl}: підсилюю головне тренування тижня` });
    const longs = elig.filter((d) => !d.hard).sort((a, b) => b.min - a.min).slice(0, m.tsb >= 25 ? 3 : 2);
    longs.forEach((d) => A.push({ date: d.date, op: "scale", factor: m.tsb >= 25 ? 1.15 : 1.1, reason: `${tl}: додаю ~${m.tsb >= 25 ? 15 : 10}% обсягу` }));
    text = "Ви свіжі й добре виконуєте план: додаю трохи інтенсивності та обсягу, щоб форма росла.";
  } else if (m.compliance14 != null && m.compliance14 < 0.5 && m.planned14 >= 3 && m.tsb > -20 && elig.length) {
    level = "realistic";
    elig.slice(0, 4).forEach((d) => A.push({ date: d.date, op: "scale", factor: 0.85, reason: `виконано лише ${Math.round((m.compliance14 as number) * 100)}% плану за 2 тижні: робимо план реалістичнішим` }));
    text = `План за останні 2 тижні виконано лише на ${Math.round(m.compliance14 * 100)}%: зменшую обсяг на 15%, щоб його реально було виконати.`;
  } else if (hard28 >= 0.4 && elig.some((d) => d.hard)) {
    level = "polar";
    const d = elig.find((x) => x.hard)!;
    A.push({ date: d.date, op: "easy", reason: `інтенсивних хвилин за 4 тижні ${Math.round(hard28 * 100)}% (норма ≈ 20%): міняю одне на легке` });
    text = "Забагато інтенсивної роботи за останній місяць: одне найближче інтенсивне тренування роблю легким (принцип 80/20).";
  } else {
    text = "Навантаження збалансоване, план залишаю без змін.";
    if (raceSoon) text += " Наближається старт: підводку не чіпаю.";
  }
  return { actions: A, summary: `${head} ${text}`.trim(), level, sev };
}

export function validateActions(raw: any, days: PDay[], m: Metrics): Action[] {
  const out: Action[] = []; if (!Array.isArray(raw)) return out;
  const elig = new Map(days.filter((d) => !d.rest && !d.prot).map((d) => [d.date, d]));
  const swapOk = new Map(days.filter((d) => !d.prot).map((d) => [d.date, d]));
  const raceSoon = m.race_in_days != null && m.race_in_days <= 7;
  const used = new Set<string>(); let rests = 0;
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const date = String(a.date || ""), op = String(a.op || "");
    if (!OPS.includes(op) || op === "keep" || !elig.has(date) || used.has(date)) continue;
    let f = a.factor != null ? Number(a.factor) : undefined;
    if (op === "scale") { if (!f || !isFinite(f)) continue; f = clamp(f, 0.5, 1.2); if (Math.abs(f - 1) < 0.04) continue; }
    if ((op === "harder" || (op === "scale" && (f as number) > 1)) && (m.tsb <= -10 || raceSoon || m.done_count < 6)) {
      if (op === "harder") continue; f = Math.min(1, f as number); if (f >= 0.96) continue;
    }
    if (op === "rest") { if (rests >= 1) continue; rests++; }
    let to: string | undefined;
    if (op === "swap") { to = String(a.to || ""); if (!swapOk.has(to) || to === date || used.has(to) || diffDays(to, date) > 4 || diffDays(to, date) < -2) continue; used.add(to); }
    used.add(date);
    out.push({ date, op, ...(op === "scale" ? { factor: Math.round((f as number) * 100) / 100 } : {}), ...(to ? { to } : {}), reason: String(a.reason || "").slice(0, 180) });
    if (out.length >= 7) break;
  }
  return out;
}

export const reduces = (op: string, f?: number) => op === "rest" || op === "recovery" || op === "easy" || op === "swap" || (op === "scale" && (f || 1) < 1);

// hints for days that belong to the coach (board tasks, coach-assigned workouts): never rewritten, only flagged
export function protHints(m: Metrics, days: PDay[], sev: number): Sug[] {
  if (sev < 1) return [];
  const out: Sug[] = [];
  const items = days.filter((x) => !x.rest && (x.prot || x.board)).map((x) => (x.prot ? x : { ...x, src: x.board.src, text: x.board.text, hard: !!x.board.hard })).sort((a, b) => a.date.localeCompare(b.date));
  for (const d of items) {
    if (d.src === "own" || (sev === 1 && !d.hard)) continue;
    const advice = sev >= 3 ? `форма ${fmt(Math.round(m.tsb))}: краще день відпочинку або дуже легке тренування`
      : sev === 2 ? (d.hard ? `форма ${fmt(Math.round(m.tsb))}: інтенсивну роботу варто замінити на легку витривалість` : `форма ${fmt(Math.round(m.tsb))}: скоротіть обсяг приблизно на 20%`)
      : `форма ${fmt(Math.round(m.tsb))}: інтенсивність краще зробити помірнішою`;
    out.push({ type: "board", date: d.date, text: (d.text || d.names || "").slice(0, 140), section: d.src && d.src !== "coach" ? d.src : undefined, advice, reason: "Завдання веде тренер, тому AI його не змінює, а лише радить.", state: "open" });
    if (out.length >= 3) break;
  }
  return out;
}

// with real fatigue the engine's own plan must hold: every hard day among the next four training days is lightened,
// and with extreme fatigue the first training day is lightened too. Otherwise the LLM answer is discarded.
export function coversSafety(acts: Action[], days: PDay[], sev: number): boolean {
  if (sev < 2) return true;
  const elig = days.filter((d) => !d.rest && !d.prot).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const by = new Map<string, Action>(); acts.forEach((a) => { by.set(a.date, a); if (a.op === "swap" && a.to) by.set(a.to, a); });
  for (const d of elig.filter((x) => x.hard)) { const a = by.get(d.date); if (!a || !reduces(a.op, a.factor)) return false; }
  if (sev >= 3 && elig[0]) { const a = by.get(elig[0].date); if (!a || !reduces(a.op, a.factor)) return false; }
  return true;
}
export const latinish = (t: string) => /[A-Za-z]{4,}/.test(t.replace(/\b(TSB|CTL|ATL|FTP|TSS|LTHR|HRmax|HRMAX|IF|Z\d)\b/g, ""));
export const GENERIC_REASON: Record<string, string> = {
  rest: "день відпочинку, щоб відновитися", recovery: "замінено на відновлення", easy: "інтенсивність знижено до легкої", scale: "обсяг підлаштовано під форму", harder: "підсилено, бо форма добра", swap: "перенесено на інший день",
};

// the LLM must not go against the clear direction of the metrics (e.g. cut the load of a fresh, compliant athlete)
export function contradicts(acts: Action[], level: string): boolean {
  if (level === "raise") return acts.some((a) => reduces(a.op, a.factor));
  return false;
}

// the LLM summary may only talk about days that really changed, and must not contain internal words
const MONTHS: Record<string, string> = { "січня": "01", "лютого": "02", "березня": "03", "квітня": "04", "травня": "05", "червня": "06", "липня": "07", "серпня": "08", "вересня": "09", "жовтня": "10", "листопада": "11", "грудня": "12" };
function mentioned(t: string): string[] {
  const out: string[] = [];
  for (const m of t.matchAll(/(\d{1,2})\.(\d{2})(?!\d)/g)) out.push(m[2] + "-" + m[1].padStart(2, "0"));
  for (const m of t.matchAll(/(\d{1,2})\s+(січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)/g)) out.push(MONTHS[m[2]] + "-" + m[1].padStart(2, "0"));
  return out;
}
export function summaryMatches(sum: string, acts: Action[]): boolean {
  if (/(^|[^а-яіїєґ])прот([^а-яіїєґ]|$)|\bprot/i.test(sum)) return false;
  const ok = new Set<string>(); acts.forEach((a) => { ok.add(a.date.slice(5)); if (a.to) ok.add(a.to.slice(5)); });
  return mentioned(sum).every((d) => ok.has(d));
}
const OPN: Record<string, string> = { rest: "день відпочинку", recovery: "відновлення", easy: "легке тренування", scale: "зміна обсягу", harder: "підсилення", swap: "перенесення" };
export function describeSummary(ruleSummary: string, acts: Action[]): string {
  const head = (ruleSummary.match(/^[^.]*\./)?.[0] || "").trim();
  if (!acts.length) return (head + " Змін у плані не потрібно.").trim();
  const list = acts.slice().sort((a, b) => a.date.localeCompare(b.date)).map((a) => `${a.date.slice(8)}.${a.date.slice(5, 7)} (${a.op === "scale" ? ((a.factor || 1) < 1 ? "менший обсяг" : "більший обсяг") : OPN[a.op] || "зміна"})`).join(", ");
  return `${head} Змінюю: ${list}.`.trim();
}
