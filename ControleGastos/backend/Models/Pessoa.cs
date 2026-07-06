using System.Text.Json.Serialization;

namespace ControleGastos.Backend.Models;

/// <summary>
/// Representa uma pessoa cadastrada no sistema de controle de gastos.
/// </summary>
public class Pessoa
{
    /// <summary>
    /// Identificador único autoincremental da pessoa no banco de dados.
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Nome completo da pessoa. Campo obrigatório.
    /// </summary>
    public string Nome { get; set; } = string.Empty;

    /// <summary>
    /// Idade da pessoa. Usada na regra de negócio (menores de 18 anos só registram despesas).
    /// </summary>
    public int Idade { get; set; }

    /// <summary>
    /// Propriedade de navegação representando a coleção de transações vinculadas a esta pessoa.
    /// [JsonIgnore] é usado para evitar ciclos de referência infinita durante a serialização JSON.
    /// </summary>
    [JsonIgnore]
    public ICollection<Transacao> Transacoes { get; set; } = new List<Transacao>();
}
