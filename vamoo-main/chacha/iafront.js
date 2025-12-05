let textopromt = document.getElementById('textoprompt');
let valorTexto = textopromt.value;
let arquivopromt = document.getElementById('arquivo');
let acoes = document.getElementById('acoes');
let audioOuEnter = document.getElementById('audioOuEnte');

if(valorTexto !== ' '){

   audioOuEnter.textContent = 'arrow_upward_alt';

}else{

   audioOuEnter.textContent = 'graphic_eq';

}


