import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Users,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  Receipt,
  TriangleAlert,
  UserPlus,
  User,
  Trash2,
  Landmark,
  FolderOpen
} from "lucide-react";

const API_BASE_URL = 'http://localhost:5137/api'

interface Pessoa {
  id: number
  nome: string
  idade: number
}

interface Transacao {
  id: number
  descricao: string
  valor: number
  tipo: string
  pessoaId: number
  pessoaNome: string
}

interface PessoaTotal {
  id: number
  nome: string
  idade: number
  totalReceitas: number
  totalDespesas: number
  saldo: number
}

interface TotaisData {
  pessoas: PessoaTotal[]
  totalGeralReceitas: number
  totalGeralDespesas: number
  saldoLiquidoGeral: number
}

function App() {
  // Aba ativa na navegação principal: 'totais' (dashboard), 'pessoas' ou 'transacoes'
  const [activeTab, setActiveTab] = useState<'totais' | 'pessoas' | 'transacoes'>('totais')
  
  // Estados para armazenar dados da API
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [totais, setTotais] = useState<TotaisData>({
    pessoas: [],
    totalGeralReceitas: 0,
    totalGeralDespesas: 0,
    saldoLiquidoGeral: 0,
  })

  // Estado para gerenciar banners de notificação (sucesso ou erro)
  const [notification, setNotification] = useState<{ message: string; isError: boolean } | null>(null)

  // Estados dos formulários de cadastro
  // Pessoa: Nome e Idade
  const [pessoaNome, setPessoaNome] = useState('')
  const [pessoaIdade, setPessoaIdade] = useState('')

  // Transação: Descrição, Valor, Tipo (receita/despesa) e Pessoa vinculada
  const [transDescricao, setTransDescricao] = useState('')
  const [transValor, setTransValor] = useState('')
  const [transTipo, setTransTipo] = useState<'despesa' | 'receita'>('despesa')
  const [transPessoaId, setTransPessoaId] = useState('')

  /**
   * Mostra um banner de notificação temporário na tela (duração de 5 segundos).
   * Definido primeiro para evitar erros de "uso antes da declaração".
   */
  const showNotification = useCallback((message: string, isError = false) => {
    setNotification({ message, isError })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }, [])

  /**
   * Busca todos os dados da API em paralelo (pessoas, transações e totais).
   * Envolvido em useCallback para manter a referência estável e evitar re-renders desnecessários.
   */
  const loadData = useCallback(async () => {
    try {
      const [resPessoas, resTransacoes, resTotais] = await Promise.all([
        fetch(`${API_BASE_URL}/pessoas`),
        fetch(`${API_BASE_URL}/transacoes`),
        fetch(`${API_BASE_URL}/totais`),
      ])

      if (resPessoas.ok && resTransacoes.ok && resTotais.ok) {
        const dataPessoas = await resPessoas.json()
        const dataTransacoes = await resTransacoes.json()
        const dataTotais = await resTotais.json()

        setPessoas(dataPessoas)
        setTransacoes(dataTransacoes)
        setTotais(dataTotais)
      } else {
        showNotification('Erro ao carregar dados do servidor.', true)
      }
    } catch (err) {
      console.error(err)
      showNotification('Erro de conexão com a API do backend.', true)
    }
  }, [showNotification])

  // Carrega os dados ao montar o componente
  useEffect(() => {
    // Desabilitado temporariamente o aviso do eslint sobre chamadas de setState em efeitos,
    // pois este useEffect serve exclusivamente para carregar os dados iniciais assincronamente da API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [loadData])

  /**
   * Envia uma nova pessoa para cadastro no backend.
   * Realiza validações básicas de nome vazio e idade negativa antes do envio.
   */
  const handleAddPessoa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pessoaNome.trim()) {
      showNotification('O nome é obrigatório.', true)
      return
    }
    const idadeNum = parseInt(pessoaIdade)
    if (isNaN(idadeNum) || idadeNum < 0) {
      showNotification('A idade deve ser um número maior ou igual a 0.', true)
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/pessoas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: pessoaNome, idade: idadeNum }),
      })

      if (res.ok) {
        showNotification('Pessoa cadastrada com sucesso!')
        setPessoaNome('')
        setPessoaIdade('')
        loadData()
      } else {
        const errorData = await res.json()
        showNotification(errorData.error || 'Erro ao cadastrar pessoa.', true)
      }
    } catch (err) {
      console.error(err)
      showNotification('Erro de rede ao cadastrar pessoa.', true)
    }
  }

  /**
   * Deleta uma pessoa pelo ID. O backend está configurado com cascade delete,
   * portanto todas as transações vinculadas a ela também serão removidas.
   */
  const handleDeletePessoa = async (id: number) => {
    if (!confirm('Deseja realmente excluir esta pessoa? Todas as suas transações serão apagadas.')) {
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/pessoas/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        showNotification('Pessoa e suas transações excluídas com sucesso!')
        loadData()
      } else {
        const errorData = await res.json()
        showNotification(errorData.error || 'Erro ao excluir pessoa.', true)
      }
    } catch (err) {
      console.error(err)
      showNotification('Erro de rede ao excluir pessoa.', true)
    }
  }

  /**
   * Envia uma nova transação para cadastro no backend.
   * Realiza validações de campos obrigatórios e a regra de negócio:
   * Menores de 18 anos não podem cadastrar receitas (somente despesas).
   */
  const handleAddTransacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transDescricao.trim()) {
      showNotification('A descrição é obrigatória.', true)
      return
    }
    const valorNum = parseFloat(transValor)
    if (isNaN(valorNum) || valorNum <= 0) {
      showNotification('O valor deve ser maior que 0.', true)
      return
    }
    if (!transPessoaId) {
      showNotification('Selecione uma pessoa.', true)
      return
    }

    // Validação adicional no cliente: menor de idade não pode receber receita
    const selectedPerson = pessoas.find(p => p.id === parseInt(transPessoaId))
    if (selectedPerson && selectedPerson.idade < 18 && transTipo === 'receita') {
      showNotification('Pessoas menores de 18 anos só podem registrar despesas.', true)
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/transacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao: transDescricao,
          valor: valorNum,
          tipo: transTipo,
          pessoaId: parseInt(transPessoaId)
        }),
      })

      if (res.ok) {
        showNotification('Transação registrada com sucesso!')
        setTransDescricao('')
        setTransValor('')
        setTransTipo('despesa')
        setTransPessoaId('')
        loadData()
      } else {
        const errorData = await res.json()
        showNotification(errorData.error || 'Erro ao registrar transação.', true)
      }
    } catch (err) {
      console.error(err)
      showNotification('Erro de rede ao registrar transação.', true)
    }
  }

  /**
   * Verifica se a pessoa atualmente selecionada no formulário de transação é menor de 18 anos.
   */
  const isSelectedPersonMinor = () => {
    if (!transPessoaId) return false
    const selected = pessoas.find(p => p.id === parseInt(transPessoaId))
    return selected ? selected.idade < 18 : false
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <div className="app-container">
      {/* Glassmorphic Navigation Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1>Controle de Gastos</h1>
          <p>Gerenciamento de Finanças Pessoais</p>
        </div>
        <nav className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === 'totais' ? 'active' : ''}`}
            onClick={() => setActiveTab('totais')}
          >
            <LayoutDashboard size={18} />
            Dashboard / Totais
          </button>
          <button
            className={`tab-btn ${activeTab === 'pessoas' ? 'active' : ''}`}
            onClick={() => setActiveTab('pessoas')}
          >
            <Users size={18} />
            Pessoas
          </button>
          <button
            className={`tab-btn ${activeTab === 'transacoes' ? 'active' : ''}`}
            onClick={() => setActiveTab('transacoes')}
          >
            <ArrowRightLeft size={18} />
            Transações
          </button>
        </nav>
      </header>

      {/* Notifications */}
      {notification && (
        <div className={`notification-banner ${notification.isError ? 'error' : 'success'}`}>
          <span>{notification.message}</span>
          <button className="close-btn" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* TOTAIS (DASHBOARD) TAB */}
      {activeTab === 'totais' && (
        <>
          <section className="summary-grid">
            <div className="summary-card receitas">
              <div className="summary-info">
                <h3>Total Receitas</h3>
                <div className="value">{formatCurrency(totais.totalGeralReceitas || 0)}</div>
              </div>
              <div className="summary-icon">
                <TrendingUp size={26} />
              </div>
            </div>
            <div className="summary-card despesas">
              <div className="summary-info">
                <h3>Total Despesas</h3>
                <div className="value">{formatCurrency(totais.totalGeralDespesas || 0)}</div>
              </div>
              <div className="summary-icon">
                <TrendingDown size={26} />
              </div>
            </div>
            <div className="summary-card saldo positive">
              <div className="summary-info">
                <h3>Saldo Líquido</h3>
                <div className="value">{formatCurrency(totais.saldoLiquidoGeral || 0)}</div>
              </div>
              <div className="summary-icon">
                <Wallet size={26} />
              </div>
            </div>
          </section>

          <section className="content-area">
            <div className="content-card">
              <div className="card-header">
                <h2>Consulta de Totais por Pessoa</h2>
                <button className="tab-btn" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)' }} onClick={loadData}>
                  <RefreshCw size={16} />
                  Atualizar
                </button>
              </div>

              {totais.pessoas.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <FolderOpen size={48} />
                  </div>
                  <p>Nenhuma pessoa cadastrada para calcular totais.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nome</th>
                        <th>Idade</th>
                        <th>Total Receitas</th>
                        <th>Total Despesas</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totais.pessoas.map((p) => (
                        <tr key={p.id}>
                          <td><code>#{p.id}</code></td>
                          <td style={{ fontWeight: 600 }}>{p.nome}</td>
                          <td>
                            <span className={`badge ${p.idade < 18 ? 'minor' : 'adult'}`}>
                              {p.idade} {p.idade < 18 ? 'Menor' : 'Adulto'}
                            </span>
                          </td>
                          <td className="text-success">{formatCurrency(p.totalReceitas)}</td>
                          <td className="text-danger">{formatCurrency(p.totalDespesas)}</td>
                          <td style={{ fontWeight: 700 }} className={p.saldo >= 0 ? 'text-success' : 'text-danger'}>
                            {formatCurrency(p.saldo)}
                          </td>
                        </tr>
                      ))}
                      <tr className="totals-summary-row">
                        <td colSpan={3} style={{ textAlign: 'right', paddingRight: '2rem' }}>Total Geral:</td>
                        <td className="text-success">{formatCurrency(totais.totalGeralReceitas)}</td>
                        <td className="text-danger">{formatCurrency(totais.totalGeralDespesas)}</td>
                        <td className={totais.saldoLiquidoGeral >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrency(totais.saldoLiquidoGeral)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* PESSOAS TAB */}
      {activeTab === 'pessoas' && (
        <section className="content-area">
          <div className="content-card">
            <div className="card-header">
              <h2>Gerenciamento de Pessoas</h2>
            </div>

            <div className="split-layout">
              {/* Form */}
              <form onSubmit={handleAddPessoa} className="premium-form">
                <h3>Cadastrar Nova Pessoa</h3>
                
                <div className="form-group">
                  <label htmlFor="nome">Nome Completo</label>
                  <input
                    id="nome"
                    type="text"
                    className="form-input"
                    placeholder="Ex: Maria Souza"
                    value={pessoaNome}
                    onChange={(e) => setPessoaNome(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="idade">Idade</label>
                  <input
                    id="idade"
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="Ex: 25"
                    value={pessoaIdade}
                    onChange={(e) => setPessoaIdade(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-submit">
                  <UserPlus size={18} />
                  Cadastrar Pessoa
                </button>
              </form>

              {/* List */}
              <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Pessoas Cadastradas</h3>
                {pessoas.length === 0 ? (
                  <div className="empty-state" style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>
                    <div className="empty-state-icon">
                      <User size={48} />
                    </div>
                    <p>Nenhuma pessoa cadastrada.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nome</th>
                          <th>Idade</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pessoas.map((p) => (
                          <tr key={p.id}>
                            <td><code>#{p.id}</code></td>
                            <td style={{ fontWeight: 600 }}>{p.nome}</td>
                            <td>
                              <span className={`badge ${p.idade < 18 ? 'minor' : 'adult'}`}>
                                {p.idade} anos {p.idade < 18 ? '(Menor)' : ''}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn-delete"
                                title="Excluir pessoa"
                                onClick={() => handleDeletePessoa(p.id)}
                              >
                               <Trash2 size={18} /> 
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TRANSAÇÕES TAB */}
      {activeTab === 'transacoes' && (
        <section className="content-area">
          <div className="content-card">
            <div className="card-header">
              <h2>Gerenciamento de Transações</h2>
            </div>

            <div className="split-layout">
              {/* Form */}
              <form onSubmit={handleAddTransacao} className="premium-form">
                <h3>Registrar Transação</h3>

                <div className="form-group">
                  <label htmlFor="pessoa">Pessoa Vinculada</label>
                  <select
                    id="pessoa"
                    className="form-select"
                    value={transPessoaId}
                    onChange={(e) => {
                      const val = e.target.value
                      setTransPessoaId(val)
                      // Se a pessoa selecionada for menor de idade, reseta automaticamente o tipo da transação para despesa
                      const selected = pessoas.find(p => p.id === parseInt(val))
                      if (selected && selected.idade < 18) {
                        setTransTipo('despesa')
                      }
                    }}
                    required
                  >
                    <option value="">Selecione uma pessoa...</option>
                    {pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} ({p.idade} anos)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="descricao">Descrição</label>
                  <input
                    id="descricao"
                    type="text"
                    className="form-input"
                    placeholder="Ex: Salário, Supermercado"
                    value={transDescricao}
                    onChange={(e) => setTransDescricao(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="valor">Valor (R$)</label>
                  <input
                    id="valor"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="0,00"
                    value={transValor}
                    onChange={(e) => setTransValor(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Tipo de Transação</label>
                  <div className="type-toggle-group">
                    <button
                      type="button"
                      className={`type-toggle-btn ${transTipo === 'despesa' ? 'active despesa' : ''}`}
                      onClick={() => setTransTipo('despesa')}
                    >
                      <TrendingDown size={18} />
                      Despesa
                    </button>
                    <button
                      type="button"
                      disabled={isSelectedPersonMinor()}
                      className={`type-toggle-btn ${transTipo === 'receita' ? 'active receita' : ''}`}
                      onClick={() => setTransTipo('receita')}
                      title={isSelectedPersonMinor() ? "Pessoas menores de 18 anos só podem ter despesas" : ""}
                    >
                      <TrendingUp size={18} />
                      Receita
                    </button>
                  </div>
                  {isSelectedPersonMinor() && (
                    <span style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.25rem' }}>
                      <TriangleAlert size={15} />
                      Menores de 18 anos só podem registrar despesas.
                    </span>
                  )}
                </div>

                <button type="submit" className="btn-submit">
                  <Landmark size={18} />
                  Registrar Transação
                </button>
              </form>

              {/* List */}
              <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Histórico de Transações</h3>
                {transacoes.length === 0 ? (
                  <div className="empty-state" style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>
                    <div className="empty-state-icon">
                      <Receipt size={48} />
                    </div>
                    <p>Nenhuma transação registrada.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Pessoa</th>
                          <th>Descrição</th>
                          <th>Tipo</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transacoes.map((t) => (
                          <tr key={t.id}>
                            <td><code>#{t.id}</code></td>
                            <td style={{ fontWeight: 600 }}>{t.pessoaNome}</td>
                            <td>{t.descricao}</td>
                            <td>
                              <span className={`badge ${t.tipo}`}>
                                {t.tipo === 'receita' ? 'Receita' : 'Despesa'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }} className={t.tipo === 'receita' ? 'text-success' : 'text-danger'}>
                              {t.tipo === 'receita' ? '+' : '-'} {formatCurrency(t.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
