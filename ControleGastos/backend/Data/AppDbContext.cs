using Microsoft.EntityFrameworkCore;
using ControleGastos.Backend.Models;

namespace ControleGastos.Backend.Data;

/// <summary>
/// Contexto do Entity Framework Core para acesso e gerenciamento do banco de dados SQLite.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    /// <summary>
    /// Tabela correspondente às pessoas cadastradas.
    /// </summary>
    public DbSet<Pessoa> Pessoas => Set<Pessoa>();

    /// <summary>
    /// Tabela correspondente às transações registradas.
    /// </summary>
    public DbSet<Transacao> Transacoes => Set<Transacao>();

    /// <summary>
    /// Configura regras de relacionamento e restrições usando o Fluent API do EF Core.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuração de exclusão em cascata (Cascade Delete):
        // Quando uma pessoa é excluída do sistema, todas as suas transações vinculadas
        // são automaticamente deletadas pelo banco de dados para evitar registros órfãos.
        modelBuilder.Entity<Pessoa>()
            .HasMany(p => p.Transacoes)
            .WithOne(t => t.Pessoa)
            .HasForeignKey(t => t.PessoaId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
