let textoprompt = document.getElementById('textoprompt');
let arquivoprompt = document.getElementById('arquivo');
let acoes = document.getElementById('acoes');
let audioOuEnter = document.getElementById('audioOuEnter');


textoprompt.addEventListener('input',()=>{

   let valorTexto = textoprompt.value;
   
   if(valorTexto !== ""){

      audioOuEnter.classList.remove('bx-microphone');
      audioOuEnter.classList.add('bx-send');

   }else{

      audioOuEnter.classList.remove('bx-send');
      audioOuEnter.classList.add('bx-microphone');

   }

});


