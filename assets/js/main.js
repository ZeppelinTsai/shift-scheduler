

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