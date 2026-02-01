const botao = document.getElementById('submitButton');


botao.addEventListener('click', function(e) {
    e.preventDefault();

    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const assunto = document.getElementById('assunto').value;
    const mensagem = document.getElementById('mensagem').value;

    if (nome.trim() !== "" && email.trim() !== "" && assunto.trim() !== "" && mensagem.trim() !== "") {
        alert("Formulário enviado com sucesso!");
        window.location.href = "index.html";
    } else {
        alert("Por favor, preencha todos os campos antes de enviar o formulário.");
    }
})