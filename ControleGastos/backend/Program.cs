using Microsoft.EntityFrameworkCore;
using ControleGastos.Backend.Data;
using ControleGastos.Backend.Models;

var builder = WebApplication.CreateBuilder(args);

// ----------------------------------------------------
// CONFIGURAÇÃO DOS SERVIÇOS
// ----------------------------------------------------

// Configura o DbContext com SQLite. Se não houver string de conexão "DefaultConnection" no appsettings.json,
// utiliza por padrão o banco local "controlegastos.db".
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=controlegastos.db"));

// Habilita a política de CORS para permitir requisições de qualquer origem (AllowAnyOrigin),
// cabeçalho (AllowAnyHeader) e método HTTP (AllowAnyMethod). Essencial para a comunicação com o Frontend local.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Registra os serviços necessários para a geração automatizada da especificação OpenAPI (Swagger)
builder.Services.AddOpenApi();

var app = builder.Build();

// ----------------------------------------------------
// INICIALIZAÇÃO DO BANCO DE DADOS
// ----------------------------------------------------

// Garante automaticamente que o arquivo do banco de dados SQLite e suas tabelas/esquemas
// sejam criados na inicialização da aplicação, caso ainda não existam.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// ----------------------------------------------------
// MIDDLEWARES / PIPELINE DE REQUISIÇÃO
// ----------------------------------------------------

// Habilita o endpoint do OpenAPI apenas no ambiente de desenvolvimento
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");
app.UseHttpsRedirection();

// ----------------------------------------------------
// APIs DE GERENCIAMENTO DE PESSOAS
// ----------------------------------------------------

/// <summary>
/// Endpoint para listar todas as pessoas cadastradas.
/// Retorna uma lista de objetos contendo Id, Nome e Idade.
/// </summary>
app.MapGet("/api/pessoas", async (AppDbContext db) =>
{
    return Results.Ok(await db.Pessoas.ToListAsync());
})
.WithName("GetPessoas");

/// <summary>
/// Endpoint para cadastrar uma nova pessoa.
/// Realiza validações de campos obrigatórios e idades negativas.
/// </summary>
app.MapPost("/api/pessoas", async (Pessoa pessoa, AppDbContext db) =>
{
    // Validação: Nome não pode ser vazio ou conter apenas espaços em branco
    if (string.IsNullOrWhiteSpace(pessoa.Nome))
    {
        return Results.BadRequest(new { error = "O nome é obrigatório." });
    }
    
    // Validação: Idade não pode ser inferior a zero
    if (pessoa.Idade < 0)
    {
        return Results.BadRequest(new { error = "A idade não pode ser negativa." });
    }

    db.Pessoas.Add(pessoa);
    await db.SaveChangesAsync();
    return Results.Created($"/api/pessoas/{pessoa.Id}", pessoa);
})
.WithName("CreatePessoa");

/// <summary>
/// Endpoint para deletar uma pessoa por seu ID.
/// O banco de dados está configurado para excluir em cascata (Cascade Delete)
/// todas as transações pertencentes a esta pessoa.
/// </summary>
app.MapDelete("/api/pessoas/{id:int}", async (int id, AppDbContext db) =>
{
    var pessoa = await db.Pessoas.FindAsync(id);
    if (pessoa == null)
    {
        return Results.NotFound(new { error = "Pessoa não encontrada." });
    }

    db.Pessoas.Remove(pessoa);
    await db.SaveChangesAsync();
    return Results.NoContent();
})
.WithName("DeletePessoa");

// ----------------------------------------------------
// APIs DE GERENCIAMENTO DE TRANSAÇÕES
// ----------------------------------------------------

/// <summary>
/// Endpoint para listar todas as transações registradas.
/// Projetado para incluir o nome da pessoa vinculada por meio do relacionamento (Join).
/// </summary>
app.MapGet("/api/transacoes", async (AppDbContext db) =>
{
    var transacoes = await db.Transacoes
        .Select(t => new
        {
            t.Id,
            t.Descricao,
            t.Valor,
            t.Tipo,
            t.PessoaId,
            // Otimização: Utiliza a propriedade de navegação 't.Pessoa' diretamente para obter o nome.
            // O EF Core traduzirá isso para um JOIN SQL de forma mais limpa e otimizada.
            PessoaNome = t.Pessoa != null ? t.Pessoa.Nome : "Desconhecido"
        })
        .ToListAsync();
    return Results.Ok(transacoes);
})
.WithName("GetTransacoes");

/// <summary>
/// Endpoint para registrar uma nova transação (Receita ou Despesa).
/// Implementa a validação da regra de negócio de idade mínima para receitas.
/// </summary>
app.MapPost("/api/transacoes", async (Transacao transacao, AppDbContext db) =>
{
    // Validação: Descrição é obrigatória
    if (string.IsNullOrWhiteSpace(transacao.Descricao))
    {
        return Results.BadRequest(new { error = "A descrição é obrigatória." });
    }
    
    // Validação: O valor financeiro da transação deve ser positivo e maior que zero
    if (transacao.Valor <= 0)
    {
        return Results.BadRequest(new { error = "O valor deve ser maior que zero." });
    }
    
    // Validação: O tipo só pode ser despesa ou receita
    if (transacao.Tipo != "despesa" && transacao.Tipo != "receita")
    {
        return Results.BadRequest(new { error = "O tipo deve ser 'despesa' ou 'receita'." });
    }

    // Validação: Verifica se a pessoa informada realmente existe no banco de dados
    var pessoa = await db.Pessoas.FindAsync(transacao.PessoaId);
    if (pessoa == null)
    {
        // Impede a criação de transação vinculada a um ID de pessoa inválido
        return Results.BadRequest(new { error = "A pessoa informada não existe no cadastro." });
    }

    // REGRA DE NEGÓCIO CRÍTICA:
    // Se a pessoa vinculada for menor de 18 anos, ela só pode registrar despesas.
    // O cadastro de receitas (tipo "receita") é bloqueado para menores de idade.
    if (pessoa.Idade < 18 && transacao.Tipo == "receita")
    {
        return Results.BadRequest(new { error = "Apenas despesas podem ser cadastradas para menores de idade." });
    }

    db.Transacoes.Add(transacao);
    await db.SaveChangesAsync();
    return Results.Created($"/api/transacoes/{transacao.Id}", transacao);
})
.WithName("CreateTransacao");

// ----------------------------------------------------
// API DE ESTATÍSTICAS E TOTAIS (DASHBOARD)
// ----------------------------------------------------

/// <summary>
/// Endpoint para obter o consolidado de totais por pessoa, além do resumo geral da aplicação.
/// Retorna o total de receitas, despesas e saldo líquido de cada pessoa e do sistema globalmente.
/// </summary>
app.MapGet("/api/totais", async (AppDbContext db) =>
{
    var pessoas = await db.Pessoas.ToListAsync();
    var transacoes = await db.Transacoes.ToListAsync();

    // Calcula os totais individuais de cada pessoa a partir da lista em memória
    var pessoasTotais = pessoas.Select(p =>
    {
        var transacoesPessoa = transacoes.Where(t => t.PessoaId == p.Id).ToList();
        var totalReceitas = transacoesPessoa.Where(t => t.Tipo == "receita").Sum(t => t.Valor);
        var totalDespesas = transacoesPessoa.Where(t => t.Tipo == "despesa").Sum(t => t.Valor);
        var saldo = totalReceitas - totalDespesas;

        return new
        {
            p.Id,
            p.Nome,
            p.Idade,
            TotalReceitas = totalReceitas,
            TotalDespesas = totalDespesas,
            Saldo = saldo
        };
    }).ToList();

    // Calcula os acumuladores gerais (do sistema inteiro)
    var totalGeralReceitas = transacoes.Where(t => t.Tipo == "receita").Sum(t => t.Valor);
    var totalGeralDespesas = transacoes.Where(t => t.Tipo == "despesa").Sum(t => t.Valor);
    var saldoLiquidoGeral = totalGeralReceitas - totalGeralDespesas;

    return Results.Ok(new
    {
        Pessoas = pessoasTotais,
        TotalGeralReceitas = totalGeralReceitas,
        TotalGeralDespesas = totalGeralDespesas,
        SaldoLiquidoGeral = saldoLiquidoGeral
    });
})
.WithName("GetTotais");

app.Run();
