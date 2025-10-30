var usuarioAtual = null
var tipoUsuario = null
var telaAtual = 'carregando'
var ticketSelecionadoId = null
var listaTecnicosCache = []
var telaAnterior = 'dashboard'

var ESTADOS_TICKET = [{ id: 'aberto', nome: 'Aberto' },{ id: 'em_andamento', nome: 'Em Andamento' },{ id: 'aguardando_usuario', nome: 'Aguardando Usuário' },{ id: 'resolvido', nome: 'Resolvido' },{ id: 'fechado', nome: 'Fechado' }]
var MAPA_PRIORIDADE = { 1: 'Baixa', 2: 'Média', 3: 'Alta' }
var MAPA_IMPACTO = { 1: 'Baixo', 2: 'Médio', 3: 'Alto' }
var MAPA_URGENCIA = { 1: 'Baixa', 2: 'Média', 3: 'Alta' }

var appContainer = document.getElementById('app')
var modalContainer = document.getElementById('modal-container')

function apiFetch(action, body) {
    body = body || {}
    body.action = action
    return fetch('api.php', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(body) 
    })
    .then(function(response) { 
        if (!response.ok) { throw new Error('Erro de rede ou servidor: ' + response.statusText) } 
        return response.json() 
    })
    .then(function(data) { 
        if (data.success === false) { throw new Error(data.message || 'Erro desconhecido da API') } 
        return data 
    })
}

function formatarData(stringData) { 
    if (!stringData) return 'N/A'
    var data = new Date(stringData)
    return data.toLocaleString('pt-BR') 
}

function mostrarErro(mensagem) { 
    var template = document.getElementById('template-modal-erro')
    var clone = template.content.cloneNode(true)
    clone.getElementById('modal-erro-mensagem').textContent = mensagem
    var fecharBtn = clone.getElementById('modal-erro-fechar')
    fecharBtn.addEventListener('click', fecharErro)
    modalContainer.innerHTML = ''
    modalContainer.appendChild(clone) 
}

function fecharErro() { 
    modalContainer.innerHTML = '' 
}

function preencherSelect(selectElement, options, valorPadrao, chaveId, chaveNome) { 
    if (!selectElement) return
    chaveId = chaveId || 'id'
    chaveNome = chaveNome || 'nome' 
    selectElement.innerHTML = '' 
    
    if (valorPadrao === null || valorPadrao === '' || valorPadrao === undefined) {
         if (selectElement.id === 'detalhe-tecnico') { 
             var optionVazia = document.createElement('option')
             optionVazia.value = ''
             optionVazia.textContent = 'Não atribuído'
             optionVazia.selected = true
             selectElement.appendChild(optionVazia)
         }
    }
    options.forEach(function(op) { 
        var option = document.createElement('option')
        option.value = op[chaveId] 
        option.textContent = op[chaveNome] 
        if (valorPadrao !== null && valorPadrao !== undefined && String(op[chaveId]) === String(valorPadrao)) { 
            option.selected = true 
        } 
        selectElement.appendChild(option) 
    }) 
}

function renderizarHeader() { 
    var template = document.getElementById('template-header')
    var clone = template.content.cloneNode(true)
    clone.getElementById('header-nome-usuario').textContent = usuarioAtual.nome.split(' ')[0]
    clone.getElementById('header-titulo-portal').textContent = '| ' + (tipoUsuario === 'funcionario' ? 'Portal do Funcionário' : 'Portal do Técnico')
    clone.getElementById('btn-logout').addEventListener('click', fazerLogout)
    return clone 
}
        
function navegarPara(tela, id) {
     if (telaAtual !== 'login' && telaAtual !== 'carregando') {
         telaAnterior = telaAtual
     }
    telaAtual = tela
    ticketSelecionadoId = id || null
    renderizarTela()
}

function renderizarTela() { 
    appContainer.innerHTML = '' 
    var templateId = 'template-' + telaAtual
    if (telaAtual === 'dashboard') {
        templateId = 'template-' + tipoUsuario + '-dashboard'
    }
    var template = document.getElementById(templateId)
    if (!template) { console.error('Template não encontrado:', templateId); mostrarErro('Template não encontrado: ' + templateId); return }
    var clone = template.content.cloneNode(true)
    if (telaAtual !== 'login' && telaAtual !== 'carregando' && usuarioAtual) {
        var headerNode = renderizarHeader()
        appContainer.appendChild(headerNode)
    }
    appContainer.appendChild(clone) 

    switch (telaAtual) {
        case 'login': setupTelaLogin(); break
        case 'dashboard':
            if (tipoUsuario === 'funcionario') setupDashboardFuncionario()
            else setupDashboardTecnico()
            break
        case 'novoTicket': setupNovoTicket(); break
        case 'detalheTicket': setupDetalheTicket(); break
        case 'historico': setupHistorico(); break
        case 'relatorio': setupRelatorio(); break
    }
}

function setupTelaLogin() {
    var tipoLoginSelecionado = 'funcionario'
    var form = document.getElementById('form-login')
    var emailInput = document.getElementById('email')
    var labelEmail = document.getElementById('label-email')
    var erroLogin = document.getElementById('erro-login')
    var btnSubmit = document.getElementById('btn-login-submit')
    var btnFunc = document.getElementById('btn-tipo-funcionario')
    var btnTec = document.getElementById('btn-tipo-tecnico')
    var emailsTeste = { func: document.getElementById('email-teste-funcionario'), tec: document.getElementById('email-teste-tecnico') }
    function selecionarTipo(tipo) {
        tipoLoginSelecionado = tipo
        if (tipo === 'funcionario') {
            labelEmail.textContent = 'Email de Funcionário'
            btnFunc.className = "w-1/2 py-3 font-semibold transition-all duration-300 bg-blue-600 text-white shadow-md rounded-l-lg"
            btnTec.className = "w-1/2 py-3 font-semibold transition-all duration-300 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-r-lg"
        } else {
            labelEmail.textContent = 'Email de Técnico'
            btnTec.className = "w-1/2 py-3 font-semibold transition-all duration-300 bg-blue-600 text-white shadow-md rounded-r-lg"
            btnFunc.className = "w-1/2 py-3 font-semibold transition-all duration-300 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-l-lg"
        }
    }
    btnFunc.addEventListener('click', function() { selecionarTipo('funcionario') })
    btnTec.addEventListener('click', function() { selecionarTipo('tecnico') })
    emailsTeste.func.addEventListener('click', function() { selecionarTipo('funcionario'); emailInput.value = emailsTeste.func.textContent })
    emailsTeste.tec.addEventListener('click', function() { selecionarTipo('tecnico'); emailInput.value = emailsTeste.tec.textContent })
    form.addEventListener('submit', function(e) {
        e.preventDefault()
        erroLogin.textContent = ''
        btnSubmit.disabled = true
        btnSubmit.innerHTML = '<div class="spinner !w-6 !h-6 !border-2"></div>'
        fazerLogin(emailInput.value, tipoLoginSelecionado)
            .catch(function(err) { console.error("Erro no login:", err); erroLogin.textContent = err.message; btnSubmit.disabled = false; btnSubmit.innerHTML = 'Entrar' })
    })
}

function setupDashboardFuncionario() {
    document.getElementById('btn-ir-novo-ticket').addEventListener('click', function() { navegarPara('novo-ticket') })
    var tbody = document.getElementById('lista-meus-tickets')
    tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Carregando seus chamados...</td></tr>'
    apiFetch('getMeusTickets', { solicitante_id: usuarioAtual.id }) 
        .then(function(data) {
            tbody.innerHTML = '' 
            if (!data.tickets || data.tickets.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Você não possui chamados ativos.</td></tr>'; return }
            data.tickets.forEach(function(ticket) {
                var tr = document.createElement('tr')
                tr.className = "hover:bg-gray-50 cursor-pointer transition duration-150"
                var estado = ESTADOS_TICKET.find(function(e) { return e.id === ticket.estado }) || { id: ticket.estado, nome: ticket.estado }
                var corEstado = (estado.id === 'fechado' || estado.id === 'resolvido') ? 'bg-green-100 text-green-800' : estado.id === 'aberto' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                tr.innerHTML = '<td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">' + ticket.assunto + '</div><div class="text-sm text-gray-500">#' + ticket.id + '</div></td>' +
                    '<td class="px-6 py-4 whitespace-nowrap"><span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ' + corEstado + '">' + estado.nome + '</span></td>' +
                    '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">' + formatarData(ticket.dataAbertura) + '</td>' +
                    '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">' + (ticket.nomeTecnico || 'Não atribuído') + '</td>'
                tr.addEventListener('click', function() { navegarPara('detalhe-ticket', ticket.id) })
                tbody.appendChild(tr)
            })
        })
        .catch(function(err) { console.error("Erro ao buscar tickets:", err); mostrarErro("Não foi possível carregar seus chamados."); tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-red-500">Erro ao carregar chamados.</td></tr>' })
}

function setupDashboardTecnico() {
    document.getElementById('btn-ir-historico').addEventListener('click', function() { navegarPara('historico') })
    document.getElementById('btn-ir-relatorio').addEventListener('click', function() { navegarPara('relatorio') })
    var tbodyAtribuidos = document.getElementById('lista-tickets-atribuidos')
    var tbodyNaoAtribuidos = document.getElementById('lista-tickets-nao-atribuidos')
    function renderizarTabela(tbody, tickets) {
         tbody.innerHTML = ''
         if (!tickets || tickets.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Nenhum chamado ativo nesta fila.</td></tr>'; return }
         tickets.forEach(function(ticket) {
            var tr = document.createElement('tr')
            tr.className = "hover:bg-gray-50 cursor-pointer transition duration-150"
            var estado = ESTADOS_TICKET.find(function(e) { return e.id === ticket.estado }) || { id: ticket.estado, nome: ticket.estado }
            var corEstado = (estado.id === 'aberto') ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
            var prioridadeTexto = MAPA_PRIORIDADE[ticket.prioridade] || ticket.prioridade
            var corPrioridade = (ticket.prioridade >= 3) ? 'text-red-600' : (ticket.prioridade == 2) ? 'text-yellow-600' : 'text-green-600'
            tr.innerHTML = '<td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">' + ticket.assunto + '</div><div class="text-sm text-gray-500">#' + ticket.id + '</div></td>' +
                '<td class="px-6 py-4 whitespace-nowrap"><span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ' + corEstado + '">' + estado.nome + '</span></td>' +
                '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">' + (ticket.nomeSolicitante || 'N/A') + '</td>' + 
                '<td class="px-6 py-4 whitespace-nowrap text-sm font-medium ' + corPrioridade + '">' + prioridadeTexto + '</td>'
             tr.addEventListener('click', function() { navegarPara('detalhe-ticket', ticket.id) })
            tbody.appendChild(tr)
         })
     }
     tbodyAtribuidos.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Carregando...</td></tr>'
     tbodyNaoAtribuidos.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Carregando...</td></tr>'
    apiFetch('getFilaTecnico', { tecnico_id: usuarioAtual.id }) 
        .then(function(data) { renderizarTabela(tbodyAtribuidos, data.atribuidos); renderizarTabela(tbodyNaoAtribuidos, data.nao_atribuidos) })
        .catch(function(err) { console.error("Erro ao buscar filas:", err); mostrarErro("Erro ao carregar as filas de chamados.") })
}

function setupNovoTicket() {
    var form = document.getElementById('form-novo-ticket') 
    var depInput = document.getElementById('departamento')
    var selectUrgencia = document.getElementById('urgencia') 
    var selectImpacto = document.getElementById('impacto') 
    var btnSubmit = document.getElementById('btn-submit-ticket')
    
    document.getElementById('btn-cancelar-ticket').addEventListener('click', function() { navegarPara('dashboard') })

    depInput.value = 'Carregando...'
    apiFetch('getDepartamentoNome', { codigo: usuarioAtual.codDepartamento })
        .then(function(data) {
            depInput.value = data.nome || 'Não encontrado'
        })
        .catch(function(err) {
            depInput.value = 'Erro ao carregar'
            console.error("Erro ao buscar nome do departamento:", err)
        })
    
    form.addEventListener('submit', function(e) {
        e.preventDefault() 
        btnSubmit.disabled = true 
        btnSubmit.innerHTML = '<div class="spinner !w-6 !h-6 !border-2"></div>'
        
        var novoTicket = {
            assunto: document.getElementById('assunto').value, 
            descricao: document.getElementById('descricao').value, 
            palavras_chave: document.getElementById('palavras_chave').value,
            solicitante_id: usuarioAtual.id,
            codDepartamentoOrigem: usuarioAtual.codDepartamento, 
            urgencia: parseInt(selectUrgencia.value), 
            impacto: parseInt(selectImpacto.value),  
            prioridade: 2,
        }

        apiFetch('criarTicket', novoTicket)
            .then(function(data) { navegarPara('dashboard') })
            .catch(function(err) { 
                console.error("Erro ao criar ticket:", err)
                mostrarErro("Falha ao criar o ticket. Tente novamente.")
                btnSubmit.disabled = false 
                btnSubmit.innerHTML = 'Enviar Chamado' 
            })
    })
}

function setupDetalheTicket() {
    var btnVoltar = document.getElementById('btn-voltar-detalhe')
    btnVoltar.addEventListener('click', function() { navegarPara(telaAnterior) })

    var selectEstado = document.getElementById('detalhe-estado')
    var selectPrioridade = document.getElementById('detalhe-prioridade')
    var selectTecnico = document.getElementById('detalhe-tecnico')
    var alertaInativo = document.getElementById('alerta-ticket-inativo')
    
    if (!ticketSelecionadoId) {
        mostrarErro("ID do ticket não encontrado para carregar detalhes.")
        navegarPara(telaAnterior)
        return
    }

    preencherSelect(selectEstado, ESTADOS_TICKET) 
    
    var promessaTicket = apiFetch('getTicket', { id: ticketSelecionadoId })
    var promessaTecnicos = Promise.resolve(null) 

    if (tipoUsuario === 'tecnico') {
        promessaTecnicos = apiFetch('getTecnicos')
            .then(function(data) {
                listaTecnicosCache = data.tecnicos
                preencherSelect(selectTecnico, listaTecnicosCache, null, 'id', 'nome') 
                return listaTecnicosCache
            })
    }
    
    Promise.all([promessaTicket, promessaTecnicos])
        .then(function(resultados) {
            var dataTicket = resultados[0]
            if (!dataTicket || !dataTicket.ticket) { 
                mostrarErro("Ticket não encontrado ou falha ao carregar.") 
                navegarPara(telaAnterior) 
                return 
            }

            var ticket = dataTicket.ticket
            
            var elId = document.getElementById('detalhe-id')
            var elAssunto = document.getElementById('detalhe-assunto')
            var elDescricao = document.getElementById('detalhe-descricao')
            var elSolicitante = document.getElementById('detalhe-solicitante')
            var elData = document.getElementById('detalhe-data')
            var elUrgencia = document.getElementById('detalhe-urgencia')
            var elImpacto = document.getElementById('detalhe-impacto')
            var containerPalavras = document.getElementById('container-palavras-chave')
            var elPalavras = document.getElementById('detalhe-palavras-chave')

            if (elId) elId.textContent = 'Ticket #' + ticket.id
            if (elAssunto) elAssunto.textContent = ticket.assunto
            if (elDescricao) elDescricao.textContent = ticket.descricao
            if (elSolicitante) elSolicitante.textContent = ticket.nomeSolicitante
            if (elData) elData.textContent = formatarData(ticket.dataAbertura)
            if (elUrgencia) elUrgencia.textContent = MAPA_URGENCIA[ticket.urgencia] || ticket.urgencia
            if (elImpacto) elImpacto.textContent = MAPA_IMPACTO[ticket.impacto] || ticket.impacto
            
            if (ticket.palavras_chave && elPalavras && containerPalavras) { 
                elPalavras.textContent = ticket.palavras_chave
                containerPalavras.classList.remove('hidden') 
            } else if (containerPalavras) {
                containerPalavras.classList.add('hidden')
            }
            
            if(selectEstado) selectEstado.value = ticket.estado
            if(selectPrioridade) selectPrioridade.value = ticket.prioridade
            if(selectTecnico) preencherSelect(selectTecnico, listaTecnicosCache, ticket.tecnico_id, 'id', 'nome')

            var btnSalvar = document.getElementById('btn-salvar-ticket')
            
            if (ticket.ativo == 0 || ticket.ativo == false) {
                if(alertaInativo) alertaInativo.classList.remove('hidden')
                ;[selectEstado, selectPrioridade, selectTecnico].forEach(function(campo) { if(campo) campo.disabled = true })
                return 
            }

            if (tipoUsuario === 'tecnico' && btnSalvar) {
                btnSalvar.classList.remove('hidden')
                btnSalvar.disabled = false
                ;[selectEstado, selectPrioridade, selectTecnico].forEach(function(campo) {
                   if(campo) {
                        campo.disabled = false
                        campo.classList.remove('bg-gray-100', 'cursor-not-allowed')
                        campo.classList.add('bg-white')
                    }
                })
                
                btnSalvar.addEventListener('click', function() {
                     btnSalvar.disabled = true; btnSalvar.innerHTML = '<div class="spinner !w-6 !h-6 !border-2"></div>'
                    var dadosAtualizados = {
                        id: ticketSelecionadoId, estado: selectEstado.value, prioridade: parseInt(selectPrioridade.value), 
                        tecnico_id: selectTecnico.value ? parseInt(selectTecnico.value) : null 
                    }
                    apiFetch('atualizarTicket', dadosAtualizados)
                        .then(function(data) { navegarPara(telaAnterior) }) 
                        .catch(function(err) { console.error("Erro ao atualizar ticket:", err); mostrarErro("Falha ao salvar alterações."); btnSalvar.disabled = false; btnSalvar.innerHTML = 'Salvar Alterações' })
                })
            }
        })
        .catch(function(err) {
            console.error("Erro ao carregar detalhes do ticket (Promise.all):", err)
            mostrarErro("Não foi possível carregar os detalhes do ticket. Verifique o console.")
            navegarPara(telaAnterior)
        })
}

function setupHistorico() {
    var tbody = document.getElementById('lista-historico-tickets')
    var containerFiltros = document.getElementById('filtros-historico')
    var checkMostrarInativos = document.getElementById('check-mostrar-inativos')
    var thAcoes = document.getElementById('th-acoes')
    var filtroAtivo = 'todos'

    if (tipoUsuario === 'tecnico') {
        thAcoes.classList.remove('hidden')
    }

    document.getElementById('btn-voltar-dashboard-hist').addEventListener('click', function() {
        navegarPara('dashboard')
    })
    
    function renderizarTabelaHistorico(tickets) {
        tbody.innerHTML = ''
        if (!tickets || tickets.length === 0) {
            var colunas = (tipoUsuario === 'tecnico') ? 6 : 5
            tbody.innerHTML = '<tr><td colspan="' + colunas + '" class="p-8 text-center text-gray-500">Nenhum ticket encontrado para este filtro.</td></tr>'
            return
        }
        
        tickets.forEach(function(ticket) {
            var tr = document.createElement('tr')
            if (ticket.ativo == 0 || ticket.ativo == false) { tr.className = "ticket-inativo" } 
            else { tr.className = "hover:bg-gray-50 cursor-pointer transition duration-150" }

            var estado = ESTADOS_TICKET.find(function(e) { return e.id === ticket.estado }) || { id: ticket.estado, nome: ticket.estado }
            var corEstado = (estado.id === 'fechado' || estado.id === 'resolvido') ? 'bg-green-100 text-green-800' : estado.id === 'aberto' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'

            var acoesTd = ''
            if (tipoUsuario === 'tecnico') {
                var botaoDesativar = ''
                if (ticket.ativo == 1 || ticket.ativo == true) {
                    botaoDesativar = '<button data-id="' + ticket.id + '" class="btn-desativar-ticket text-red-600 hover:text-red-900 text-sm font-medium">Excluir</button>'
                }
                acoesTd = '<td class="px-6 py-4 whitespace-nowrap">' + botaoDesativar + '</td>'
            }

            var tooltipExclusao = ''
            if (ticket.dataExclusao && ticket.excluidoPor) {
                tooltipExclusao = ' title="Excluído em ' + formatarData(ticket.dataExclusao) + ' por ' + ticket.excluidoPor + '"'
            }

            tr.innerHTML =
                '<td class="px-6 py-4 whitespace-nowrap"' + tooltipExclusao + '><div class="text-sm font-medium text-gray-900">' + ticket.assunto + '</div><div class="text-sm text-gray-500">#' + ticket.id + '</div></td>' +
                '<td class="px-6 py-4 whitespace-nowrap"' + tooltipExclusao + '><span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ' + corEstado + '">' + estado.nome + '</span></td>' +
                '<td class="px-6 py-4 whitespace-nowpart-wrap text-sm text-gray-600"' + tooltipExclusao + '>' + formatarData(ticket.dataAbertura) + '</td>' +
                '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600"' + tooltipExclusao + '>' + (ticket.nomeSolicitante || 'N/A') + '</td>' + 
                '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600"' + tooltipExclusao + '>' + (ticket.nomeTecnico || 'Não atribuído') + '</td>' + 
                acoesTd
            
            tr.addEventListener('click', function(e) {
                if (!e.target.classList.contains('btn-desativar-ticket')) {
                    navegarPara('detalhe-ticket', ticket.id)
                }
            })
            tbody.appendChild(tr)
        })

        tbody.querySelectorAll('.btn-desativar-ticket').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation() 
                var idParaDesativar = e.target.getAttribute('data-id')
                if (confirm('Tem certeza que deseja "excluir" (desativar) o ticket #' + idParaDesativar + '?')) {
                    var codUsuarioAtual = (tipoUsuario === 'tecnico') ? usuarioAtual.codTecnico : usuarioAtual.codFuncionario
                    
                    apiFetch('desativarTicket', { id: idParaDesativar, codUsuario: codUsuarioAtual })
                    .then(function(data) { buscarHistorico(filtroAtivo, checkMostrarInativos.checked) })
                    .catch(function(err) { mostrarErro(err.message || "Falha ao desativar ticket.") })
                }
            })
        })
    }

    function buscarHistorico(filtro, mostrarInativos) {
        filtroAtivo = filtro
        var colunas = (tipoUsuario === 'tecnico') ? 6 : 5
        tbody.innerHTML = '<tr><td colspan="' + colunas + '" class="p-8 text-center text-gray-500"><div class="spinner mx-auto"></div></td></tr>'
        containerFiltros.querySelectorAll('.filtro-btn').forEach(function(btn) {
            if (btn.getAttribute('data-filtro') === filtroAtivo) { btn.classList.add('bg-blue-600', 'text-white'); btn.classList.remove('bg-gray-200', 'text-gray-700') } 
            else { btn.classList.remove('bg-blue-600', 'text-white'); btn.classList.add('bg-gray-200', 'text-gray-700') }
        })
        apiFetch('getHistoricoTickets', { filtro: filtroAtivo, mostrarTodos: mostrarInativos })
        .then(function(data) { renderizarTabelaHistorico(data.tickets) })
        .catch(function(err) { console.error("Erro ao buscar histórico:", err); mostrarErro("Erro ao carregar o histórico.") })
    }

    containerFiltros.addEventListener('click', function(e) { 
        if (e.target.classList.contains('filtro-btn')) { 
            var filtro = e.target.getAttribute('data-filtro'); 
            buscarHistorico(filtro, checkMostrarInativos.checked) } 
        })
        checkMostrarInativos.addEventListener('change', function() { 
        buscarHistorico(filtroAtivo, checkMostrarInativos.checked) 
    })
    buscarHistorico('todos', false)
}

function setupRelatorio() {
    var tbody = document.getElementById('lista-relatorio')
    document.getElementById('btn-voltar-dashboard-relatorio').addEventListener('click', function() { navegarPara('dashboard') })
    tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500"><div class="spinner mx-auto"></div></td></tr>'
    apiFetch('getRelatorio') 
        .then(function(data) {
            tbody.innerHTML = '' 
            if (!data.relatorio || !data.relatorio.length) { tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">Nenhum ticket ativo encontrado.</td></tr>'; return }
            data.relatorio.forEach(function(item) {
                var tr = document.createElement('tr'); tr.className = "hover:bg-gray-50 cursor-pointer transition duration-150"
                var estado = ESTADOS_TICKET.find(function(e) { return e.id === item.estado }) || { id: item.estado, nome: item.estado }
                var corEstado = (estado.id === 'fechado' || estado.id === 'resolvido') ? 'bg-green-100 text-green-800' : estado.id === 'aberto' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                tr.innerHTML = '<td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-medium text-gray-900">#' + item.id + '</div></td>' +
                    '<td class="px-6 py-4 whitespace-nowrap"><div class="text-sm text-gray-900">' + item.assunto + '</div></td>' +
                    '<td class="px-6 py-4 whitespace-nowrap"><span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ' + corEstado + '">' + estado.nome + '</span></td>' +
                    '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">' + (item.nomeSolicitante || 'N/A') + '</td>' + 
                    '<td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">' + (item.nomeDepartamento || 'N/A') + '</td>'
                tr.addEventListener('click', function() { navegarPara('detalhe-ticket', item.id) }) 
                tbody.appendChild(tr)
            })
        })
        .catch(function(err) { console.error("Erro ao buscar relatório:", err); mostrarErro("Não foi possível carregar o relatório."); tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">Erro ao carregar relatório.</td></tr>' })
}

function fazerLogin(email, tipo) {
    return apiFetch('login', { email: email.toLowerCase().trim(), tipo: tipo })
        .then(function(data) {
            if (data.success && data.usuario) {
                usuarioAtual = data.usuario
                tipoUsuario = tipo
                try { localStorage.setItem('helpdesk_usuario', JSON.stringify(usuarioAtual)); localStorage.setItem('helpdesk_tipoUsuario', tipoUsuario) } catch (e) { console.error("Erro ao salvar no localStorage:", e) }
                navegarPara('dashboard')
            } else { throw new Error(data.message || "Usuário não retornado pela API") }
        })
}

function fazerLogout() {
    usuarioAtual = null
    tipoUsuario = null
    ticketSelecionadoId = null
    try { localStorage.removeItem('helpdesk_usuario'); localStorage.removeItem('helpdesk_tipoUsuario') } catch (e) { console.error("Erro ao remover do localStorage:", e) }
    navegarPara('login')
}

window.onload = function() {
    var usuarioSalvo = null
    var tipoSalvo = null
    try { 
        usuarioSalvo = localStorage.getItem('helpdesk_usuario')
        tipoSalvo = localStorage.getItem('helpdesk_tipoUsuario') 
    } catch(e) { 
        console.error("Erro ao ler localStorage:", e)
        navegarPara('login')
        return 
    }
    if (usuarioSalvo && tipoSalvo) {
        try { 
            usuarioAtual = JSON.parse(usuarioSalvo)
            tipoUsuario = tipoSalvo
            navegarPara('dashboard') 
        } catch (e) { 
            console.error('Erro ao carregar sessão salva (JSON inválido):', e)
            localStorage.removeItem('helpdesk_usuario')
            localStorage.removeItem('helpdesk_tipoUsuario')
            navegarPara('login') 
        }
    } else { 
        navegarPara('login') 
    }
}