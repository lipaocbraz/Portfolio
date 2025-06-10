document.querySelectorAll('.scroll').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault(); 
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

document.getElementById("vidapet").addEventListener('click', function() {
  window.open("https://github.com/ArthurMatias57/Vida-pet")
})

document.getElementById("gaita").addEventListener('click', function(){
  window.open("https://sites.google.com/cesar.school/g3-acessibilidade-motora/status-report-2")
})

let btnMenu = document.getElementById('btn-menu')
let menu = document.getElementById('menu-mobile')
let overlay = document.getElementById('overlay-menu')

btnMenu.addEventListener('click', ()=>{
  menu.classList.add('abre-menu')
})

menu.addEventListener('click', ()=>{
  menu.classList.remove('abre-menu')
})
overlay.addEventListener('click', ()=>{
  menu.classList.remove('abre-menu')
})

