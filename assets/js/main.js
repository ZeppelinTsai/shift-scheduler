let currentPlan = localStorage.getItem('LumShift_plan') || 'free'
let currentToken = localStorage.getItem('LumShift_token') || ''
localStorage.setItem('LumShift_plan', currentPlan)

let currentLang=localStorage.getItem('LumShift_lang')||'zh';let T=TRANSLATIONS[currentLang];let currentView='dashboard';let cursor=new Date();cursor.setDate(1);let editingDate=null;
const FREE_LIMIT=5;const shiftClasses={AM:'s-am',PM:'s-pm',NT:'s-nt'};
let staff=JSON.parse(localStorage.getItem('LumShift_staff')||'null')||[{id:1,name:'Amy',role:'全職',roleGroup:'general'},{id:2,name:'Ben',role:'兼職',roleGroup:'general'},{id:3,name:'Chia',role:'店長',roleGroup:'manager'},{id:4,name:'Dora',role:'全職',roleGroup:'general'},{id:5,name:'Eli',role:'工讀生',roleGroup:'general'}];
let shifts=JSON.parse(localStorage.getItem('LumShift_shifts')||'null')||[{code:'AM',name:'Morning',start:'08:00',end:'16:00',required:1,roleGroup:'general'},{code:'PM',name:'Evening',start:'16:00',end:'00:00',required:1,roleGroup:'general'},{code:'NT',name:'Night',start:'00:00',end:'08:00',required:1,roleGroup:'general'}];
let holidays=JSON.parse(localStorage.getItem('LumShift_holidays')||'null')||{};let leaves=JSON.parse(localStorage.getItem('LumShift_leaves')||'null')||[];let schedule=JSON.parse(localStorage.getItem('LumShift_schedule')||'null')||{};
function pad(n){return String(n).padStart(2,'0')}function ymd(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}function daysInMonth(){return new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate()}function monthKey(){return `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}`}function saveAll(){localStorage.setItem('LumShift_staff',JSON.stringify(staff));localStorage.setItem('LumShift_shifts',JSON.stringify(shifts));localStorage.setItem('LumShift_holidays',JSON.stringify(holidays));localStorage.setItem('LumShift_leaves',JSON.stringify(leaves));localStorage.setItem('LumShift_schedule',JSON.stringify(schedule))}
function seedMonth(){const mk=monthKey();if(schedule[mk])return;schedule[mk]={};const dim=daysInMonth();for(let day=1;day<=dim;day++){const date=`${mk}-${pad(day)}`;schedule[mk][date]={};shifts.forEach((s,si)=>{schedule[mk][date][s.code]=[];if(day%7!==0&&day%6!==0){const ids=activeStaff().filter((_,idx)=>(day+idx+si)%3===0).slice(0,s.required).map(x=>x.id);schedule[mk][date][s.code]=ids}})}saveAll()}
function setLang(lang){currentLang=lang;T=TRANSLATIONS[lang];localStorage.setItem('LumShift_lang',lang);document.documentElement.lang=lang==='zh'?'zh-TW':lang;applyLang()}
function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const v=T[el.dataset.i18n];
    if(v!==undefined)el.textContent=v
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el=>{
    const v=T[el.dataset.i18nHtml];
    if(v!==undefined)el.innerHTML=v
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const v=T[el.dataset.i18nPlaceholder];
    if(v!==undefined)el.placeholder=v
  });

  // ✅ 核心修正（包含 mobile）
  document.querySelectorAll('.lang-btn, .mobile-lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === currentLang)
  );

  document.getElementById('page-title').textContent=T.page_titles[currentView];
  setAuthMode(authMode);
  refreshTopAuthUI();

  renderAll();
}
function navigate(view,el){
  currentView=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');

  document.getElementById('page-title').textContent=T.page_titles[view];
  renderAll();
}
function monthDates(includeOutside=false){const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);const startDow=first.getDay();const dim=daysInMonth();const cells=[];if(includeOutside){const prevDim=new Date(cursor.getFullYear(),cursor.getMonth(),0).getDate();for(let i=startDow-1;i>=0;i--){cells.push({date:new Date(cursor.getFullYear(),cursor.getMonth()-1,prevDim-i),muted:true})}}else{for(let i=0;i<startDow;i++)cells.push(null)}for(let d=1;d<=dim;d++)cells.push({date:new Date(cursor.getFullYear(),cursor.getMonth(),d),muted:false});while(cells.length%7!==0)cells.push(null);return cells}
function renderAll(){seedMonth();document.getElementById('month-label').textContent=`${cursor.getFullYear()} ${T.months[cursor.getMonth()]}`;renderStats();renderMonthGrid('dashboard-grid',true);renderMonthGrid('schedule-grid',false);renderStaff();renderShifts();renderHolidayList();renderLeaveList();renderLeaveStaffOptions()}
function isPro(){
  return currentPlan === 'pro'
}

function planStaffLimit(){
  return isPro() ? staff.length : FREE_LIMIT
}

function activeStaff(){
  return staff.slice(0, planStaffLimit())
}
function roleGroupLabel(role){
  return T.role_groups?.[role] || role || T.role_groups?.general || 'general'
}
function staffById(id){return staff.find(s=>s.id==id)}function leavesForDate(date){return leaves.filter(l=>l.date===date)}function isHoliday(date){return holidays[date]}function getDaySchedule(date){const mk=date.slice(0,7);schedule[mk]=schedule[mk]||{};schedule[mk][date]=schedule[mk][date]||{};shifts.forEach(s=>schedule[mk][date][s.code]=schedule[mk][date][s.code]||[]);return schedule[mk][date]}
function renderMonthGrid(id,compact){const el=document.getElementById(id);if(!el)return;el.innerHTML='';T.days.forEach(d=>{const h=document.createElement('div');h.className='dow';h.textContent=d;el.appendChild(h)});monthDates(false).forEach(cell=>{const div=document.createElement('div');div.className='day-card'+(!cell?' muted':'');if(!cell){el.appendChild(div);return}const date=ymd(cell.date);const ds=getDaySchedule(date);let badges='';if(isHoliday(date))badges+=`<span class="holiday-chip">${T.holiday}</span>`;const lf=leavesForDate(date);if(lf.length)badges+=`<span class="leave-chip">${T.leave} ${lf.length}</span>`;div.innerHTML=`<div class="day-head"><div class="day-num">${cell.date.getDate()}</div><div>${badges}</div></div>`;shifts.forEach(s=>{const assigned=ds[s.code]||[];
const isHol = !!isHoliday(date);
const missing = isHol ? 0 : Math.max(0, Number(s.required) - assigned.length);
  const names=assigned.map(id=>staffById(id)?.name).filter(Boolean).join(', ')||T.none;const row=document.createElement('div');
row.className = 'shift-row ' + (missing ? 'bad' : '');
row.innerHTML=`<span class="shift-name ${shiftClasses[s.code]||''}">${s.code}</span><span class="shift-people">${assigned.length}/${s.required} · ${names}</span>`;div.appendChild(row)});const btn=document.createElement('button');btn.className='mini-btn';btn.textContent=T.edit;btn.onclick=()=>openEditModal(date);div.appendChild(btn);el.appendChild(div)})}
function renderStats(){let totalReq=0,totalAss=0,shiftCount=0;const mk=monthKey();Object.keys(schedule[mk]||{}).forEach(date=>{shifts.forEach(s=>{totalReq+=Number(s.required);const n=(schedule[mk][date][s.code]||[]).length;totalAss+=Math.min(n,Number(s.required));shiftCount+=n})});const hs=Object.keys(holidays).filter(k=>k.startsWith(mk)).length;document.getElementById('d-emp').textContent =
  isPro() ? `${staff.length}` : `${Math.min(staff.length,FREE_LIMIT)}/${FREE_LIMIT}`;document.getElementById('d-shifts').textContent=shiftCount;document.getElementById('d-holidays').textContent=hs;document.getElementById('d-cover').textContent=totalReq?Math.round(totalAss/totalReq*100)+'%':'—'}
function renderStaff(){const tb=document.getElementById('staff-tbody');if(!tb)return;tb.innerHTML='';staff.forEach((s,i)=>{const roleOptions=['general','manager','cook','cashier'].map(role=>`<option value="${role}" ${s.roleGroup===role?'selected':''}>${roleGroupLabel(role)}</option>`).join('');const tr=document.createElement('tr');tr.innerHTML=`<td><div class="emp-cell"><div class="avatar">${s.name[0]||'?'}</div><div><div class="emp-name">${s.name}</div><div class="emp-role">ID ${s.id}</div></div></div></td><td><input value="${s.role||''}" onchange="staff[${i}].role=this.value;saveAll();renderAll()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"></td><td><select onchange="staff[${i}].roleGroup=this.value;saveAll();renderAll()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px">${roleOptions}</select> ${(!isPro() && i>=FREE_LIMIT)?'<span class="pro-chip">Pro</span>':''}

${(isPro() || i<FREE_LIMIT)
  ? `<span class="tag">${T.active}</span>`
  : `<span class="tag">${T.locked}</span>`}</td><td><button class="mini-btn" onclick="removeStaff(${s.id})">${T.remove}</button></td>`;tb.appendChild(tr)})}
function renderShifts(){const tb=document.getElementById('shift-tbody');if(!tb)return;tb.innerHTML='';shifts.forEach((s,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input value="${s.name}" onchange="shifts[${i}].name=this.value;saveAll();renderAll()" style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"></td><td><b class="${shiftClasses[s.code]||''}">${s.code}</b></td><td><input type="time" value="${s.start}" onchange="shifts[${i}].start=this.value;saveAll();renderAll()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"></td><td><input type="time" value="${s.end}" onchange="shifts[${i}].end=this.value;saveAll();renderAll()" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"></td><td><input type="number" min="0" value="${s.required}" onchange="shifts[${i}].required=Number(this.value);saveAll();renderAll()" style="width:80px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"></td><td><select onchange="showPaidContact(T.multi_role_restrictions)" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px"><option>${roleGroupLabel(s.roleGroup||'general')}</option></select> <span class="pro-chip">Pro</span></td>`;tb.appendChild(tr)})}
function renderHolidayList(){const box=document.getElementById('holiday-list');if(!box)return;const entries=Object.entries(holidays).filter(([d])=>d.startsWith(monthKey())).sort();box.innerHTML=entries.length?'':`<div class="hint">${T.no_data}</div>`;entries.forEach(([date,name])=>{const item=document.createElement('div');item.className='issue-item';item.innerHTML=`<b>${date}</b> · ${name}<button class="mini-btn" style="float:right" onclick="delete holidays['${date}'];saveAll();renderAll();showToast(T.toast_removed)">${T.remove}</button>`;box.appendChild(item)})}
function renderLeaveStaffOptions(){const sel=document.getElementById('leave-staff');if(!sel)return;sel.innerHTML=activeStaff().map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}function renderLeaveList(){const box=document.getElementById('leave-list');if(!box)return;const entries=leaves.filter(l=>l.date.startsWith(monthKey())).sort((a,b)=>a.date.localeCompare(b.date));box.innerHTML=entries.length?'':`<div class="hint">${T.no_data}</div>`;entries.forEach(l=>{const item=document.createElement('div');item.className='issue-item';item.innerHTML=`<b>${l.date}</b> · ${staffById(l.staffId)?.name||l.staffId} · ${l.reason||T.leave}<button class="mini-btn" style="float:right" onclick="removeLeave(${l.id})">${T.remove}</button>`;box.appendChild(item)})}
function addHoliday(){const d=document.getElementById('holiday-date').value;const n=document.getElementById('holiday-name').value.trim()||T.holiday;if(!d)return showToast(T.toast_date_required);holidays[d]=n;document.getElementById('holiday-name').value='';saveAll();renderAll();showToast(T.toast_added)}function addLeave(){const d=document.getElementById('leave-date').value;const sid=Number(document.getElementById('leave-staff').value);const r=document.getElementById('leave-reason').value.trim()||T.leave;if(!d)return showToast(T.toast_date_required);leaves.push({id:Date.now(),staffId:sid,date:d,reason:r});document.getElementById('leave-reason').value='';saveAll();renderAll();showToast(T.toast_added)}function removeLeave(id){leaves=leaves.filter(l=>l.id!==id);saveAll();renderAll();showToast(T.toast_removed)}
function showStaffModal(){document.getElementById('staff-modal').classList.add('open')}function closeStaffModal(){document.getElementById('staff-modal').classList.remove('open')}function addStaff(){const name=document.getElementById('new-name').value.trim();if(!name)return showToast(T.toast_name_required);staff.push({id:Date.now(),code: "EMP-" + Date.now(),name,role:document.getElementById('new-role').value.trim()||'',roleGroup:document.getElementById('new-role-group').value,preferredShifts:[],avoidShifts:[]});document.getElementById('new-name').value='';document.getElementById('new-role').value='';closeStaffModal();saveAll();renderAll();showToast(T.toast_added)}function removeStaff(id){staff=staff.filter(s=>s.id!==id);Object.values(schedule).forEach(month=>Object.values(month).forEach(day=>Object.keys(day).forEach(code=>day[code]=day[code].filter(x=>x!==id))));leaves=leaves.filter(l=>l.staffId!==id);saveAll();renderAll();showToast(T.toast_removed)}
function openEditModal(date){editingDate=date;document.getElementById('edit-title').textContent=`${T.edit} ${date}`;document.getElementById('edit-sub').innerHTML=[isHoliday(date)?`<span class="holiday-chip">${holidays[date]}</span>`:'',...leavesForDate(date).map(l=>`<span class="leave-chip">${staffById(l.staffId)?.name||''} ${T.leave}</span>`)].join(' ');const ds=getDaySchedule(date);const form=document.getElementById('edit-form');form.innerHTML='';shifts.forEach(s=>{const wrap=document.createElement('div');wrap.className='card';wrap.style.marginBottom='10px';wrap.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b class="${shiftClasses[s.code]||''}">${s.code} ${s.start}-${s.end}</b><span class="hint">${T.required}: ${s.required}</span></div>`;for(let i=0;i<Math.max(Number(s.required),1);i++){const select=document.createElement('select');select.dataset.shift=s.code;select.style.cssText='width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px;margin-bottom:7px';select.innerHTML=`<option value="">${T.none}</option>`+activeStaff().map(emp=>`<option value="${emp.id}" ${(ds[s.code]||[])[i]===emp.id?'selected':''}>${emp.name}</option>`).join('');wrap.appendChild(select)}form.appendChild(wrap)});document.getElementById('edit-modal').classList.add('open')}function closeEditModal(){document.getElementById('edit-modal').classList.remove('open')}function saveDaySchedule(){if(!editingDate)return;const ds=getDaySchedule(editingDate);shifts.forEach(s=>ds[s.code]=[]);document.querySelectorAll('#edit-form select').forEach(sel=>{if(sel.value){const id=Number(sel.value);if(!ds[sel.dataset.shift].includes(id))ds[sel.dataset.shift].push(id)}});saveAll();closeEditModal();renderAll();showToast(T.toast_saved)}
function validateSchedule(){
  const issues=[];
  const mk=monthKey();
  let unmet=0,leaveConflict=0,holidayNotes=0;

  Object.keys(schedule[mk]||{}).forEach(date=>{
    const ds=getDaySchedule(date);

    // ✅ 假日不檢查缺班，只檢查「有沒有誤排人」
    if (isHoliday(date)) {
      shifts.forEach(s=>{
        const assigned = ds[s.code] || [];
        assigned.forEach(id=>{
          holidayNotes++;
          issues.push({
            type:'bad',
            text:`${date} ${holidays[date]} · ${staffById(id)?.name} ${s.code}`
          });
        });
      });
      return;
    }

    shifts.forEach(s=>{
      const assigned=ds[s.code]||[];
      const miss=Math.max(0,Number(s.required)-assigned.length);

      if(miss){
        unmet++;
        issues.push({type:'bad',text:`${date} ${s.code}: ${T.missing(miss)}`});
      }

      assigned.forEach(id=>{
        if(leaves.some(l=>l.date===date&&l.staffId===id)){
          leaveConflict++;
          issues.push({type:'bad',text:`${date} ${staffById(id)?.name} ${T.leave} / ${s.code}`});
        }
      });
    });
  });
      
      const hoursByWeek={};const streak={};activeStaff().forEach(emp=>{let current=0,max=0;for(let day=1;day<=daysInMonth();

  
        day++){const date=`${mk}-${pad(day)}`;const work=shifts.some(s=>(getDaySchedule(date)[s.code]||[]).includes(emp.id));if(work){current++;max=Math.max(max,current)}else current=0;const d=new Date(date);const week = `${d.getFullYear()}-W${getISOWeek(date)}`;hoursByWeek[emp.id+'-'+week]=(hoursByWeek[emp.id+'-'+week]||0)+(work?8:0)}if(max>6)issues.push({type:'bad',text:T.consecutive_days_exceeded(emp.name,max)})});Object.keys(hoursByWeek).forEach(k=>{if(hoursByWeek[k]>40){const id=Number(k.split('-')[0]);issues.push({type:'bad',text:T.weekly_hours_exceeded(staffById(id)?.name||id,hoursByWeek[k])})}});const panel=document.getElementById('issue-panel');const list=document.getElementById('issue-list');list.innerHTML='';if(!issues.length){list.innerHTML=`<div class="issue-item">${T.valid_message}</div>`;showToast(T.valid_message)}else{list.innerHTML+=unmet?`<div class="issue-item bad"><b>${T.unmet_title(unmet)}</b></div>`:'';list.innerHTML+=leaveConflict?`<div class="issue-item bad"><b>${T.leave_conflict_title(leaveConflict)}</b></div>`:'';list.innerHTML+=holidayNotes?`<div class="issue-item"><b>${T.holiday_shift_title(holidayNotes)}</b></div>`:'';issues.slice(0,120).forEach(i=>{const div=document.createElement('div');div.className='issue-item '+(i.type==='bad'?'bad':'');div.textContent=i.text;list.appendChild(div)})}panel.classList.add('open')}function closeIssuePanel(){document.getElementById('issue-panel').classList.remove('open')}


function exportCSV(){const rows=[[T.csv_date,T.csv_shift,T.csv_staff]];const mk=monthKey();Object.keys(schedule[mk]||{}).sort().forEach(date=>shifts.forEach(s=>rows.push([date,s.code,(getDaySchedule(date)[s.code]||[]).map(id=>staffById(id)?.name||id).join('|')])));const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`LumShift-${monthKey()}.csv`;a.click();URL.revokeObjectURL(a.href);showToast(T.toast_csv)}

// const API_BASE='http://127.0.0.1:8000';
const API_BASE = 'https://shift-scheduler-back.onrender.com';
function shiftCodeById(id){
  return shifts[id]?.code || 'OFF'
}
function getISOWeek(dateStr){
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}
function buildProPayload(){
  const mk=monthKey();
  const active=staff.map((emp,idx)=>({
    id:Number(emp.id),
    name:emp.name||'',
    role:emp.roleGroup||emp.role||'staff',
    status: (isPro() || idx < FREE_LIMIT) ? 'active' : 'locked',
    minShifts:Number(emp.minShifts||0),
    maxShifts:Number(emp.maxShifts||22),
    locations:emp.locations||[],
    roles:[emp.roleGroup||'general'],
    leaveDates:leaves.filter(l=>Number(l.staffId)===Number(emp.id)).map(l=>l.date),
    preferredShifts:emp.preferredShifts||[],
    avoidShifts:emp.avoidShifts||[]
  }));
  return {
    employees:active,
    shiftSettings: shifts.map((s, si) => ({
      id: si,
      code:s.code,
      name:s.name||s.code,
      start:s.start,
      end:s.end==='00:00'&&s.code==='PM'?'24:00':s.end,
      required:Number(s.required||0),
      role:s.roleGroup&&s.roleGroup!=='general'?s.roleGroup:null,
      location_id:s.locationId||null
    })),
    demands:[],
    rules:{
      country:'TW',
      year:cursor.getFullYear(),
      month:cursor.getMonth()+1,
      max_shifts:22,
      max_consecutive_days:6,
      min_rest_hours:11,
      free_limit:FREE_LIMIT,
      plan:'pro',
      locations:[],
      holidays:Object.keys(holidays).filter(d=>d.startsWith(mk))
    }
  };
}
function applyGeneratedSchedule(data){
  const mk=monthKey();
  schedule[mk]={};
  data.dates.forEach(date=>{schedule[mk][date]={};shifts.forEach(s=>schedule[mk][date][s.code]=[])});
  Object.entries(data.schedules||{}).forEach(([empId,rows])=>{
    rows.forEach((shiftId,idx)=>{
      const code=shiftCodeById(shiftId);
      const date=data.dates[idx];
      if(!date||code==='OFF')return;
      if(!schedule[mk][date])schedule[mk][date]={};
      if(!schedule[mk][date][code])schedule[mk][date][code]=[];
      schedule[mk][date][code].push(Number(empId));
    });
  });
  saveAll();renderAll();
}
async function generateSchedulePro(){
  if(!currentCompanyCode){
    openLoginModal()
    showToast(T.login_before_pro)
    return
  }

  if(currentPlan !== 'pro'){
    showPaidContact(T.generate_feature)
    return
  }
  try{
    showToast(T.auto_schedule_running);
    const res = await fetch(`${API_BASE}/api/pro/schedule/generate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(buildProPayload())
    })
    if(!res.ok)throw new Error(await res.text());
    const data=await res.json();
    applyGeneratedSchedule(data);
    showToast(T.auto_schedule_done(data.unmet?.length||0,data.violations?.length||0));
    validateSchedule();
  }catch(err){console.error(err);showToast(T.backend_connection_failed)}
}
function schedulesForBackend(){
  const mk = monthKey()
  const result = {}
  const dates = Object.keys(schedule[mk] || {}).sort()

  staff.forEach((emp, idx) => {
    if(!isPro() && idx >= FREE_LIMIT) return
    result[emp.id] = Array(daysInMonth()).fill(3)
  })

  dates.forEach((date, day) => {
    shifts.forEach((s, shiftIndex) => {
      ;(getDaySchedule(date)[s.code] || []).forEach(id => {
        if(result[id]) result[id][day] = shiftIndex
      })
    })
  })

  return result
}
async function autoFixSchedulePro(){
  if(!currentCompanyCode){
    openLoginModal()
    showToast(T.login_before_pro)
    return
  }

  if(currentPlan !== 'pro'){
    showPaidContact(T.auto_fix_feature)
    return
  }
  try{
    showToast(T.auto_fix_running)

    const payload = buildProPayload()
    payload.schedules = schedulesForBackend()

    const res = await fetch(`${API_BASE}/api/pro/schedule/autofix`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    })

    if(!res.ok) throw new Error(await res.text())

    const data = await res.json()

    applyGeneratedSchedule(data)

    showToast(T.auto_fix_done(data.unmet?.length||0,data.violations?.length||0))

    validateSchedule()
  }catch(err){
    console.error(err)
    showToast(T.auto_fix_failed)
  }
}
function showPaidContact(feature){document.getElementById('contact-sub').textContent=T.paid_feature_message(feature);document.getElementById('contact-modal').classList.add('open')}function closeContactModal(){document.getElementById('contact-modal').classList.remove('open')}function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}

// 登入
let currentCompanyCode = localStorage.getItem('LumShift_company_code') || ''
let currentUsername = localStorage.getItem('LumShift_username') || ''

function openLoginModal(mode='login'){
  setAuthMode(mode)
  document.getElementById('login-modal').classList.add('open')
}

function closeLoginModal(){
  document.getElementById('login-modal').classList.remove('open')
}
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000){
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try{
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return res
  }finally{
    clearTimeout(timer)
  }
}
async function register(){
  const company = document.getElementById('login-company').value.trim()
  const username = document.getElementById('login-username').value.trim()
  const password = document.getElementById('login-password').value.trim()

  if(!company || !username || !password){
    showToast(T.input_auth_required)
    return
  }

  let res
  try{
    showToast(T.register_loading)

    res = await fetchWithTimeout(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        company_code: company,
        company_name: company,
        username,
        password
      })
    }, 10000)
  }catch(err){
    console.error('register error:', err)
    showToast(T.register_timeout)
    return
  }

  if(!res.ok){
    const text = await res.text()
    console.error(text)
    showToast(T.register_failed)
    return
  }

  const data = await res.json()

  currentCompanyCode = data.company_code
  currentUsername = data.username

  localStorage.setItem('LumShift_company_code', currentCompanyCode)
  localStorage.setItem('LumShift_username', currentUsername)

  currentToken = data.token || ''
  currentPlan = data.plan || 'free'

  localStorage.setItem('LumShift_token', currentToken)
  localStorage.setItem('LumShift_plan', currentPlan)

  closeLoginModal()
  refreshTopAuthUI()

  await saveScheduleToBackend()

  showToast(T.workspace_created)
}
async function login(){
  const company = document.getElementById('login-company').value.trim()
  const username = document.getElementById('login-username').value.trim()
  const password = document.getElementById('login-password').value.trim()
  const btn = document.getElementById('auth-submit-btn')

  if(!company || !username || !password){
    showToast(T.input_auth_required)
    return
  }

  try{
    btn.disabled = true
    btn.innerText = T.login_loading

    const res = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ company_code: company, username, password })
    }, 10000)

    const text = await res.text()
    let data = {}

    try{
      data = JSON.parse(text)
    }catch{
      data = { detail: text }
    }

    if(!res.ok){
      if(res.status === 401) showToast(T.invalid_credentials)
      else if(res.status === 404) showToast(T.workspace_not_found)
      else if(res.status === 500) showToast(T.system_error_retry)
      else showToast(data.detail || T.login_failed_status(res.status))
      return
    }

    currentCompanyCode = data.company_code
    currentUsername = data.username
    currentToken = data.token || ''
    currentPlan = data.plan || 'free'

    localStorage.setItem('LumShift_company_code', currentCompanyCode)
    localStorage.setItem('LumShift_username', currentUsername)
    localStorage.setItem('LumShift_token', currentToken)
    localStorage.setItem('LumShift_plan', currentPlan)

    closeLoginModal()
    refreshTopAuthUI()
    await loadScheduleFromBackend()

    showToast(T.logged_in(currentCompanyCode))
  }catch(err){
    console.error('login error:', err)
    showToast(err.name === 'AbortError' ? T.login_timeout : T.login_connection_failed)
  }finally{
    btn.disabled = false
    btn.innerText = authMode === 'login' ? T.login : T.create_continue
  }
}

function logout(){
  localStorage.removeItem('LumShift_company_code')
  localStorage.removeItem('LumShift_username')

  currentCompanyCode = ''
  currentUsername = ''

  localStorage.removeItem('LumShift_token')
  localStorage.removeItem('LumShift_plan')
  currentToken = ''
  currentPlan = 'free'

  refreshTopAuthUI()
  renderAll()

  showToast(T.logged_out)
}

function requireLogin(actionName){
  if(currentCompanyCode) return true
  showToast(T.login_required(actionName))
  openLoginModal()
  return false
}
function authHeaders(){
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentToken}`
  }
}

async function saveScheduleToBackend(){
  if(!currentCompanyCode){
    showToast(T.login_first)
    return
  }

  const payload = {
    company_code: currentCompanyCode,
    month: monthKey(),
    data: {
      staff,
      shifts,
      holidays,
      leaves,
      schedule
    }
  }

  const res = await fetch(`${API_BASE}/api/save`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  })

  if(!res.ok){
    console.error(await res.text())
    showToast(T.cloud_save_failed)
    return
  }

  showToast(T.cloud_saved)
}

async function loadScheduleFromBackend(){
  if(!currentCompanyCode) return

  const res = await fetch(`${API_BASE}/api/load?month=${monthKey()}`, {
    headers: authHeaders()
  })

  if(!res.ok){
    console.error(await res.text())
    showToast(T.cloud_load_failed)
    return
  }

  const result = await res.json()

  if(!result.data){
    renderAll()
    return
  }

  const data = result.data

  if(data.staff) staff = data.staff
  if(data.shifts) shifts = data.shifts
  if(data.holidays) holidays = data.holidays
  if(data.leaves) leaves = data.leaves
  if(data.schedule) schedule = data.schedule

  saveAll()
  renderAll()
  showToast(T.cloud_loaded)
}
function toggleMenu(){
  const panel = document.getElementById('menu-panel')
  panel.classList.toggle('open')
}

function refreshTopAuthUI(){
  const loggedIn = !!currentCompanyCode
  document.getElementById('login-top-btn').style.display = loggedIn ? 'none' : 'inline-flex'
  document.getElementById('menu-top-btn').style.display = loggedIn ? 'inline-flex' : 'none'

  const status = document.getElementById('login-status-text')
  if(status) status.textContent = loggedIn ? T.logged_in(currentCompanyCode) : T.login_status
}
let authMode = 'login'

function setAuthMode(mode){
  authMode = mode

  document.getElementById('auth-title').textContent =
    mode === 'login' ? T.auth_title_login : T.auth_title_register

  document.getElementById('auth-sub').textContent =
    mode === 'login'
      ? T.auth_sub_login
      : T.auth_sub_register

  document.getElementById('auth-submit-btn').textContent =
    mode === 'login' ? T.login : T.create_continue

  document.getElementById('auth-switch-text').innerHTML =
    mode === 'login'
      ? T.auth_switch_register_html
      : T.auth_switch_login_html
}

function submitAuth(){
  if(authMode === 'login') login()
  else register()
}
document.addEventListener('DOMContentLoaded', () => {
  applyLang()
  renderAll()
  refreshTopAuthUI()
})
document.addEventListener('click', (e)=>{
  const panel = document.getElementById('menu-panel')
  const btn = document.getElementById('menu-top-btn')

  if(panel.classList.contains('open')){
    if(!panel.contains(e.target) && !btn.contains(e.target)){
      panel.classList.remove('open')
    }
  }
})