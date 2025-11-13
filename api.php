<?php

ini_set('default_charset', 'UTF-8'); //para ver se aceita acentos nessa bomba

$dbHost = '127.0.0.1'; //alterar aqui se der problema
$dbUser = 'root';
$dbPass = '';
$dbName = 'helpdesk_db';


header('Content-Type: application/json; charset=utf-8');

$mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName);

if ($mysqli->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Erro de conexão com o banco: ' . $mysqli->connect_error]);
    exit();
}

$mysqli->set_charset("utf8mb4");
$mysqli->query("SET NAMES 'utf8mb4'");;

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
            
            $stmt = $mysqli->prepare("SELECT * FROM usuarios WHERE email = ? AND tipo = ?");
            $stmt->bind_param("ss", $email, $tipo);
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
            if ($row = $result->fetch_assoc()) {
                $response['success'] = true;
                $response['nome'] = $row['nome'];
            } else {
                $response['message'] = 'Departamento não encontrado.';
            }
            $stmt->close();
            break;

        case 'getTecnicos':

            $result = $mysqli->query("SELECT id, codigo, nome FROM usuarios WHERE tipo = 'tecnico' ORDER BY nome ASC");
            $tecnicos = [];
            while ($row = $result->fetch_assoc()) {
                $tecnicos[] = $row;
            }
            $response['success'] = true;
            $response['tecnicos'] = $tecnicos;
            break;

        case 'getMeusTickets':
            $solicitante_id = $request['solicitante_id'];

            $stmt = $mysqli->prepare("
                SELECT T.*, TEC.nome AS nomeTecnico
                FROM tickets AS T
                LEFT JOIN usuarios AS TEC ON T.tecnico_id = TEC.id
                WHERE T.solicitante_id = ? AND T.ativo = 1 
                ORDER BY T.dataAbertura DESC
            ");
            $stmt->bind_param("i", $solicitante_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $tickets = [];
            while ($row = $result->fetch_assoc()) {
                $tickets[] = $row;
            };
            $response['success'] = true;
            $response['tickets'] = $tickets;
            $stmt->close();
            break;

        case 'getFilaTecnico':
            $tecnico_id = $request['tecnico_id'];
            
            $sqlBase = "
                SELECT T.*, F.nome AS nomeSolicitante
                FROM tickets AS T
                LEFT JOIN usuarios AS F ON T.solicitante_id = F.id
                WHERE T.ativo = 1 AND T.estado NOT IN ('fechado', 'resolvido')
            ";

            $stmtAtrib = $mysqli->prepare($sqlBase . " AND T.tecnico_id = ? ORDER BY T.dataAbertura ASC");
            $stmtAtrib->bind_param("i", $tecnico_id);
            $stmtAtrib->execute();
            $resultAtrib = $stmtAtrib->get_result();
            $atribuidos = [];
            while ($row = $resultAtrib->fetch_assoc()) {
                $atribuidos[] = $row;
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
                    T.*, 
                    F.nome AS nomeSolicitante, 
                    TEC.nome AS nomeTecnico,
                    D.nome AS nomeDepartamento,
                    EXCL.nome AS nomeExcluiu, 
                    T.excluido_por_id, 
                    T.data_exclusao,
                    GROUP_CONCAT(PC.nome SEPARATOR ', ') AS palavras_chave
                FROM tickets AS T
                LEFT JOIN usuarios AS F ON T.solicitante_id = F.id
                LEFT JOIN usuarios AS TEC ON T.tecnico_id = TEC.id
                LEFT JOIN usuarios AS EXCL ON T.excluido_por_id = EXCL.id 
                LEFT JOIN departamentos AS D ON T.codDepartamentoOrigem = D.codigo
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
                $stmtTicket->bind_param(
                    "ssiiiii",
                    $request['assunto'],
                    $request['descricao'],
                    $request['solicitante_id'],
                    $request['codDepartamentoOrigem'],
                    $request['urgencia'],
                    $request['impacto'],
                    $request['prioridade']
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
                    $stmtInsertPalavra->bind_param("s", $palavraLimpa);
                    $stmtInsertPalavra->execute();
                    $stmtGetPalavraId->bind_param("s", $palavraLimpa);
                    $stmtGetPalavraId->execute();
                    $resultPalavra = $stmtGetPalavraId->get_result();
                    $palavraRow = $resultPalavra->fetch_assoc();
                    $palavraId = $palavraRow['palavra_id'];
                    $stmtLinkPalavra->bind_param("ii", $newTicketId, $palavraId);
                    $stmtLinkPalavra->execute();
                }

                $stmtInsertPalavra->close();
                $stmtGetPalavraId->close();
                $stmtLinkPalavra->close();

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
            $urgencia = (int)$request['urgencia'];
            $impacto = (int)$request['impacto'];

            $stmt = $mysqli->prepare(
                "UPDATE tickets SET 
                    estado = ?, 
                    prioridade = ?, 
                    tecnico_id = ?, 
                    urgencia = ?, 
                    impacto = ? 
                WHERE id = ?"
            );
            $stmt->bind_param(
                "siiiii",
                $request['estado'],
                $request['prioridade'],
                $tecnico_id,
                $urgencia,
                $impacto,
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
            $idUsuarioExclusao = $request['usuario_id'];
            $stmt = $mysqli->prepare("
                UPDATE tickets SET 
                    ativo = 0, 
                    excluido_por_id = ?, 
                    data_exclusao = CURRENT_TIMESTAMP
                WHERE id = ? AND ativo = 1
            ");
            $stmt->bind_param("ii", $idUsuarioExclusao, $id); 
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
               SELECT T.*, 
                       F.nome AS nomeSolicitante, 
                       TEC.nome AS nomeTecnico,
                       D.nome AS nomeDepartamento,
                       T.excluido_por_id AS excluidoPor, 
                       T.data_exclusao AS dataExclusao,
                       EXCL.nome AS nomeExcluiu
                FROM tickets AS T
                LEFT JOIN usuarios AS F ON T.solicitante_id = F.id
                LEFT JOIN usuarios AS TEC ON T.tecnico_id = TEC.id
                LEFT JOIN departamentos AS D ON T.codDepartamentoOrigem = D.codigo
                LEFT JOIN usuarios AS EXCL ON T.excluido_por_id = EXCL.id 
            ";
            
            $whereConditions = [];
            if (!$mostrarTodos) {
                $whereConditions[] = "T.ativo = 1";
            };
            switch ($filtro) {
                case 'dia':
                    $whereConditions[] = "DATE(T.dataAbertura) = CURDATE()";
                    break;
                case 'semana':
                    $whereConditions[] = "WEEK(T.dataAbertura, 1) = WEEK(CURDATE(), 1) AND YEAR(T.dataAbertura) = YEAR(CURDATE())";
                    break;
                case 'mes':
                    $whereConditions[] = "MONTH(T.dataAbertURA) = MONTH(CURDATE()) AND YEAR(T.dataAbertura) = YEAR(CURDATE())";
                    break;
                case 'ano':
                    $whereConditions[] = "YEAR(T.dataAbertura) = YEAR(CURDATE())";
                    break;
            };
            if (!empty($whereConditions)) {
                $sql .= " WHERE " . implode(' AND ', $whereConditions);
            };
            $sql .= " ORDER BY T.dataAbertura DESC";

            $result = $mysqli->query($sql);
            if (!$result) {
                $response['message'] = 'Erro na consulta SQL: ' . $mysqli->error;
                break;
            };
            $tickets = [];
            while ($row = $result->fetch_assoc()) {
                $tickets[] = $row;
            };
            $response['success'] = true;
            $response['tickets'] = $tickets;
            break;

        default:
            $response['message'] = 'Ação desconhecida.';
            break;
    }
} catch (Exception $e) {
    $response['message'] = 'Exceção no servidor: ' . $e->getMessage();
}

$mysqli->close();
echo json_encode($response, JSON_UNESCAPED_UNICODE);
?>