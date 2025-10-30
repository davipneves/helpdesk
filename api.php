<?php

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'helpdesk_db';


header('Content-Type: application/json');
$mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName);

if ($mysqli->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Erro de conexão com o banco: ' . $mysqli->connect_error]);
    exit();
}
$mysqli->set_charset("utf8mb4");

$jsonInput = file_get_contents('php://input');
$request = json_decode($jsonInput, true);

if (!isset($request['action'])) {
    echo json_encode(['success' => false, 'message' => 'Ação não especificada.']);
    exit();
}

$action = $request['action'];
$response = ['success' => false];

try {
    switch ($action) {

        case 'login':
            $email = $request['email'];
            $tipo = $request['tipo'];
            $tabela = ($tipo == 'funcionario') ? 'funcionarios' : 'tecnicos';
            
            $stmt = $mysqli->prepare("SELECT * FROM $tabela WHERE email = ?");
            $stmt->bind_param("s", $email);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $response['success'] = true;
                $response['usuario'] = $result->fetch_assoc();
            } else {
                $response['message'] = 'Email não encontrado ou tipo de login incorreto.';
            }
            $stmt->close();
            break;

        case 'getDepartamentos':
            $result = $mysqli->query("SELECT * FROM departamentos");
            $departamentos = [];
            while ($row = $result->fetch_assoc()) { 
                $departamentos[] = $row; 
            }
            $response['success'] = true;
            $response['departamentos'] = $departamentos;
            break;

        case 'getDepartamentoNome':
            $codigo = $request['codigo'];
            $stmt = $mysqli->prepare("SELECT nome FROM departamentos WHERE codigo = ?");
            $stmt->bind_param("i", $codigo);
            $stmt->execute();
            $result = $stmt->get_result();
            if($row = $result->fetch_assoc()){
                $response['success'] = true;
                $response['nome'] = $row['nome'];
            } else {
                $response['message'] = 'Departamento não encontrado.';
            }
            $stmt->close();
            break;
            
        case 'getTecnicos':
            $result = $mysqli->query("SELECT id, codTecnico, nome, codEquipe FROM tecnicos ORDER BY nome ASC");
            $tecnicos = [];
            while ($row = $result->fetch_assoc()) {
                $tecnicos[] = $row;
            }
            $response['success'] = true;
            $response['tecnicos'] = $tecnicos;
            break;

        case 'getMeusTickets':

            $solicitante_id = $request['solicitante_id'];


            $codFuncionario = $request['codFuncionario'];

            $solicitante_id = $request['solicitante_id'];
            

            $stmt = $mysqli->prepare("
                SELECT T.*, TEC.nome AS nomeTecnico
                FROM tickets AS T
                LEFT JOIN tecnicos AS TEC ON T.tecnico_id = TEC.id
                WHERE T.solicitante_id = ? AND T.ativo = 1 
                ORDER BY T.dataAbertura DESC
            ");
            $stmt->bind_param("i", $solicitante_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $tickets = [];
            while ($row = $result->fetch_assoc()) { $tickets[] = $row; };
            $response['success'] = true;
            $response['tickets'] = $tickets;
            $stmt->close();
            break;
            
        case 'getFilaTecnico':
            $tecnico_id = $request['tecnico_id'];
            $sqlBase = "
                SELECT T.*, F.nome AS nomeSolicitante
                FROM tickets AS T
                JOIN funcionarios AS F ON T.solicitante_id = F.id
                WHERE T.ativo = 1 AND T.estado NOT IN ('fechado', 'resolvido')
            ";
            
            $stmtAtrib = $mysqli->prepare($sqlBase . " AND T.tecnico_id = ? ORDER BY T.dataAbertura ASC");
            $stmtAtrib->bind_param("i", $tecnico_id);
            $stmtAtrib->execute();
            $resultAtrib = $stmtAtrib->get_result();
            $atribuidos = [];
            while ($row = $resultAtrib->fetch_assoc()) { 
                $atribuidos[] = $row ;
            }
            $stmtAtrib->close();
            
            $stmtNaoAtrib = $mysqli->prepare($sqlBase . " AND T.tecnico_id IS NULL ORDER BY T.dataAbertura ASC");
            $stmtNaoAtrib->execute();
            $resultNaoAtrib = $stmtNaoAtrib->get_result();
            $nao_atribuidos = [];
            while ($row = $resultNaoAtrib->fetch_assoc()) { 
                $nao_atribuidos[] = $row; 
            }
            $stmtNaoAtrib->close();

            $response['success'] = true;
            $response['atribuidos'] = $atribuidos;
            $response['nao_atribuidos'] = $nao_atribuidos;
            break;

        case 'getTicket':
            $id = $request['id'];
            $stmt = $mysqli->prepare("
                SELECT 
                    T.*, F.nome AS nomeSolicitante, TEC.nome AS nomeTecnico,
                    GROUP_CONCAT(PC.nome SEPARATOR ', ') AS palavras_chave
                FROM tickets AS T
                JOIN funcionarios AS F ON T.solicitante_id = F.id
                LEFT JOIN tecnicos AS TEC ON T.tecnico_id = TEC.id
                LEFT JOIN ticket_palavras AS TP ON T.id = TP.ticket_id
                LEFT JOIN palavras_chave AS PC ON TP.palavra_id = PC.palavra_id
                WHERE T.id = ?
                GROUP BY T.id
            ");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows > 0) {
                $response['success'] = true;
                $response['ticket'] = $result->fetch_assoc();
            } else {
                $response['message'] = 'Ticket não encontrado.';
            }
            $stmt->close();
            break;

        case 'criarTicket':
            $mysqli->begin_transaction();
            try {
                $stmtTicket = $mysqli->prepare(
                    "INSERT INTO tickets (assunto, descricao, solicitante_id, codDepartamentoOrigem, urgencia, impacto, prioridade, estado, dataAbertura) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto', CURRENT_TIMESTAMP)"
                );
                $stmtTicket->bind_param("ssiiiii", 
                    $request['assunto'], $request['descricao'], $request['solicitante_id'],
                    $request['codDepartamentoOrigem'], $request['urgencia'], $request['impacto'], $request['prioridade']
            );
                $stmtTicket->execute();
                $newTicketId = $mysqli->insert_id;
                $stmtTicket->close();
                
                $palavrasStr = $request['palavras_chave'];
                $palavrasArray = explode(',', $palavrasStr);
                $stmtInsertPalavra = $mysqli->prepare("INSERT INTO palavras_chave (nome) VALUES (?) ON DUPLICATE KEY UPDATE nome=nome");
                $stmtGetPalavraId = $mysqli->prepare("SELECT palavra_id FROM palavras_chave WHERE nome = ?");
                $stmtLinkPalavra = $mysqli->prepare("INSERT INTO ticket_palavras (ticket_id, palavra_id) VALUES (?, ?)");
                
                foreach ($palavrasArray as $palavra) {
                    $palavraLimpa = trim($palavra);
                    if (empty($palavraLimpa)) continue;
                    $stmtInsertPalavra->bind_param("s", $palavraLimpa); $stmtInsertPalavra->execute();
                    $stmtGetPalavraId->bind_param("s", $palavraLimpa); $stmtGetPalavraId->execute();
                    $resultPalavra = $stmtGetPalavraId->get_result();
                    $palavraRow = $resultPalavra->fetch_assoc(); $palavraId = $palavraRow['palavra_id'];
                    $stmtLinkPalavra->bind_param("ii", $newTicketId, $palavraId); $stmtLinkPalavra->execute();
                }
                
                $stmtInsertPalavra->close(); $stmtGetPalavraId->close(); $stmtLinkPalavra->close();

                $mysqli->commit();
                $response['success'] = true;
                $response['newId'] = $newTicketId;

            } catch (Exception $e) {
                $mysqli->rollback();
                $response['message'] = 'Erro ao criar ticket (Transação falhou): ' . $e->getMessage();
            }
            break;

        case 'atualizarTicket':
            $tecnico_id = !empty($request['tecnico_id']) ? (int)$request['tecnico_id'] : null;

            $stmt = $mysqli->prepare(
                "UPDATE tickets SET estado = ?, prioridade = ?, tecnico_id = ? WHERE id = ?"
            );
            $stmt->bind_param("siii", 
                $request['estado'],      
                $request['prioridade'],  
                $tecnico_id,             
                $request['id']       
        );
            
            if ($stmt->execute()) {
                $response['success'] = true;
            } else {
                $response['message'] = 'Erro ao atualizar ticket: ' . $stmt->error;
            }
            $stmt->close();
            break;

        case 'desativarTicket':
            $id = $request['id'];
            $codUsuarioExclusao = $request['codUsuario'] ;
            $stmt = $mysqli->prepare("
                UPDATE tickets SET ativo = 0, dataExclusao = CURRENT_TIMESTAMP(), excluidoPor = ? 
                WHERE id = ? AND ativo = 1
            ");
            $stmt->bind_param("si", $codUsuarioExclusao, $id);
            $stmt->execute();
            if ($stmt->affected_rows > 0) {
                $response['success'] = true;
                $response['message'] = 'Ticket desativado com sucesso.';
            } else {
                $response['message'] = 'Não foi possível desativar o ticket (pode já estar inativo ou ID inválido).';
            }
            $stmt->close();
            break;

        case 'getHistoricoTickets':
            $filtro = isset($request['filtro']) ? $request['filtro'] : 'todos';
            $mostrarTodos = isset($request['mostrarTodos']) ? $request['mostrarTodos'] : false;
            
            $sql = "
                SELECT T.*, F.nome AS nomeSolicitante, TEC.nome AS nomeTecnico
                FROM tickets AS T
<<<<<<< Updated upstream
                JOIN funcionarios AS F ON T.solicitante_id = F.id
                LEFT JOIN tecnicos AS TEC ON T.tecnico_id = TEC.id;
=======
<<<<<<< Updated upstream
                JOIN funcionarios AS F ON T.codSolicitante = F.codFuncionario
                LEFT JOIN tecnicos AS TEC ON T.codTecnico = TEC.codTecnico
=======
                JOIN funcionarios AS F ON T.solicitante_id = F.id
                LEFT JOIN tecnicos AS TEC ON T.tecnico_id = TEC.id
>>>>>>> Stashed changes
>>>>>>> Stashed changes
            ";
            $whereConditions = [];
            if (!$mostrarTodos) { $whereConditions[] = "T.ativo = 1"; };
            switch ($filtro) {
                case 'dia': $whereConditions[] = "DATE(T.dataAbertura) = CURDATE()"; break;
                case 'semana': $whereConditions[] = "WEEK(T.dataAbertura, 1) = WEEK(CURDATE(), 1) AND YEAR(T.dataAbertura) = YEAR(CURDATE())"; break;
                case 'mes': $whereConditions[] = "MONTH(T.dataAbertura) = MONTH(CURDATE()) AND YEAR(T.dataAbertura) = YEAR(CURDATE())"; break;
                case 'ano': $whereConditions[] = "YEAR(T.dataAbertura) = YEAR(CURDATE())"; break;
            };
            if (!empty($whereConditions)) { $sql .= " WHERE " . implode(' AND ', $whereConditions); };
            $sql .= " ORDER BY T.dataAbertura DESC";

            $result = $mysqli->query($sql);
            if (!$result) { $response['message'] = 'Erro na consulta SQL: ' . $mysqli->error; break; };
            $tickets = [];
            while ($row = $result->fetch_assoc()) { $tickets[] = $row; };
            $response['success'] = true;
            $response['tickets'] = $tickets;
            break;

        case 'getRelatorioComJoin':
            $sql = "
                SELECT T.id, T.assunto, T.estado, F.nome AS nomeSolicitante, D.nome AS nomeDepartamento 
                FROM tickets AS T
                JOIN departamentos AS D ON T.codDepartamentoOrigem = D.codigo
                JOIN funcionarios AS F ON T.solicitante_id = F.id
                WHERE T.ativo = 1 
                ORDER BY T.id DESC
            ";
            
            $result = $mysqli->query($sql);
            if (!$result) { $response['message'] = 'Erro na consulta SQL com JOIN: ' . $mysqli->error; break; }
            $relatorio = [];
            while ($row = $result->fetch_assoc()) { $relatorio[] = $row; };
            $response['success'] = true;
            $response['relatorio'] = $relatorio;
            break;

        default:
            $response['message'] = 'Ação desconhecida.';
            break;
    }
} catch (Exception $e) {
    $response['message'] = 'Exceção no servidor: ' . $e->getMessage();
}

$mysqli->close();
echo json_encode($response);

?>