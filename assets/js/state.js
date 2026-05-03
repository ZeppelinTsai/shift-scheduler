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
function staffById(id){return staff.find(s=>s.id==id)}function leavesForDate(date){return leaves.filter(l=>l.date===date)}function isHoliday(date){return holidays[date]}
function getDaySchedule(date){const mk=date.slice(0,7);schedule[mk]=schedule[mk]||{};schedule[mk][date]=schedule[mk][date]||{};shifts.forEach(s=>schedule[mk][date][s.code]=schedule[mk][date][s.code]||[]);return schedule[mk][date]}
