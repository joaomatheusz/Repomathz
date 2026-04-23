import os

def cadastrar():
    print("\n--- NOVO CADASTRO ---")
    nome = input("Nome do aluno: ")
    matricula = input("Matrícula: ")
    turma = input("Turma: ")
    
    id_aluno = 1
    if os.path.exists("alunos.txt"):
        with open("alunos.txt", "r", encoding="utf-8") as f:
            id_aluno = len(f.readlines()) + 1

    with open("alunos.txt", "a", encoding="utf-8") as arquivo:
        linha = f"{id_aluno},{nome},{matricula},{turma}\n"
        arquivo.write(linha)
    
    print(f"Aluno {nome} cadastrado com ID {id_aluno}!")

def visualizar():
    print("\n--- TABELA DE ALUNOS ---")
    print(f"{'ID':<5} | {'NOME':<20} | {'MATRÍCULA':<15} | {'TURMA'}")
    print("-" * 55)
    
    try:
        with open("alunos.txt", "r", encoding="utf-8") as arquivo:
            for linha in arquivo:
                id_a, nome, matr, turma = linha.strip().split(",")
                print(f"{id_a:<5} | {nome:<20} | {matr:<15} | {turma}")
    except FileNotFoundError:
        print("Arquivo ainda não existe. Cadastre um aluno primeiro.")

while True:
    print("\n1. Cadastrar | 2. Visualizar | 3. Sair")
    op = input("Escolha: ")
    if op == '1': cadastrar()
    elif op == '2': visualizar()
    elif op == '3': break