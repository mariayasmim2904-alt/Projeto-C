using System.Text.Json.Serialization;

namespace ControleGastos.Backend.Models;

/// <summary>
/// Representa uma transação financeira (Receita ou Despesa) associada a uma pessoa.
/// </summary>
public class Transacao
{
    /// <summary>
    /// Identificador único autoincremental da transação no banco de dados.
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Descrição da transação (ex: "Salário", "Supermercado"). Campo obrigatório.
    /// </summary>
    public string Descricao { get; set; } = string.Empty;

    /// <summary>
    /// Valor monetário da transação. Deve ser sempre maior que zero.
    /// </summary>
    public decimal Valor { get; set; }

    /// <summary>
    /// Tipo da transação: "despesa" ou "receita".
    /// </summary>
    public string Tipo { get; set; } = string.Empty;

    /// <summary>
    /// Identificador da pessoa associada a esta transação (Chave Estrangeira).
    /// </summary>
    public int PessoaId { get; set; }

    /// <summary>
    /// Propriedade de navegação para a entidade Pessoa associada.
    /// [JsonIgnore] é usado para evitar loops de serialização redundante ao retornar transações.
    /// </summary>
    [JsonIgnore]
    public Pessoa? Pessoa { get; set; }
}
