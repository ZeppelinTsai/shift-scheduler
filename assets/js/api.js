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