create database helpdesk_db;


USE helpdesk_db;


CREATE TABLE `departamentos` (
  `codigo` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(25) NOT NULL,
  PRIMARY KEY (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci


CREATE TABLE `funcionarios` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `codFuncionario` varchar(20) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `codDepartamento` tinyint(3) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_func_cod` (`codFuncionario`),
  UNIQUE KEY `idx_func_email` (`email`),
  KEY `fk_func_depto` (`codDepartamento`),
  CONSTRAINT `fk_func_depto` FOREIGN KEY (`codDepartamento`) REFERENCES `departamentos` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

CREATE TABLE `tecnicos` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `codTecnico` varchar(20) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tec_cod` (`codTecnico`),
  UNIQUE KEY `idx_tec_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

CREATE TABLE `palavras_chave` (
  `palavra_id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(50) NOT NULL,
  PRIMARY KEY (`palavra_id`),
  UNIQUE KEY `idx_palavra_nome` (`nome`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

CREATE TABLE `tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `assunto` varchar(255) NOT NULL,
  `descricao` text NOT NULL,
  `dataAbertura` datetime NOT NULL DEFAULT current_timestamp(),
  `estado` varchar(50) NOT NULL DEFAULT 'aberto',
  `solicitante_id` smallint(5) unsigned NOT NULL,
  `tecnico_id` smallint(5) unsigned DEFAULT NULL,
  `codDepartamentoOrigem` tinyint(3) unsigned NOT NULL,
  `impacto` tinyint(1) NOT NULL DEFAULT 1,
  `urgencia` tinyint(1) NOT NULL DEFAULT 1,
  `prioridade` tinyint(1) NOT NULL DEFAULT 1,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `dataExclusao` datetime DEFAULT NULL,
  `excluidoPor` varchar(20) DEFAULT NULL,
  `excluido_por_cod` varchar(50) DEFAULT NULL,
  `data_exclusao` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ticket_solicitante` (`solicitante_id`),
  KEY `fk_ticket_tecnico` (`tecnico_id`),
  KEY `fk_ticket_depto` (`codDepartamentoOrigem`),
  KEY `idx_estado` (`estado`),
  KEY `idx_ativo` (`ativo`),
  KEY `idx_dataAbertura` (`dataAbertura`),
  CONSTRAINT `fk_ticket_depto` FOREIGN KEY (`codDepartamentoOrigem`) REFERENCES `departamentos` (`codigo`),
  CONSTRAINT `fk_ticket_solicitante` FOREIGN KEY (`solicitante_id`) REFERENCES `funcionarios` (`id`),
  CONSTRAINT `fk_ticket_tecnico` FOREIGN KEY (`tecnico_id`) REFERENCES `tecnicos` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

CREATE TABLE `ticket_palavras` (
  `ticket_id` int(11) NOT NULL,
  `palavra_id` int(11) NOT NULL,
  PRIMARY KEY (`ticket_id`,`palavra_id`),
  KEY `fk_palavra` (`palavra_id`),
  CONSTRAINT `fk_palavra` FOREIGN KEY (`palavra_id`) REFERENCES `palavras_chave` (`palavra_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci

START TRANSACTION;

INSERT INTO funcionarios (codFuncionario, nome, email, codDepartamento) VALUES
('RH0001', 'Ana Silva', 'ana.silva@empresa.com', 1),
('RH0002', 'Bruno Costa', 'bruno.costa@empresa.com', 2);

INSERT INTO tecnicos (codTecnico, nome, email) VALUES
('TI0001', 'Carlos Souza', 'carlos.souza@empresa.com'),
('TI0002', 'Daniela Lima', 'daniela.lima@empresa.com');

INSERT INTO tickets (assunto, descricao, dataAbertura, estado, solicitante_id, codDepartamentoOrigem, urgencia, impacto, prioridade, tecnico_id, ativo) VALUES
('Impressora não funciona', 'A impressora do financeiro (HP-2055) não está imprimindo. Luz piscando.', '2025-10-26 14:30:00', 'aberto', 2, 2, 2, 2, 2, NULL, 1);

INSERT INTO palavras_chave (nome) VALUES ('impressora'), ('hp'), ('financeiro');

INSERT INTO ticket_palavras (ticket_id, palavra_id) VALUES (1, 1), (1, 2), (1, 3);

COMMIT;