-- Execute no SSMS com acesso ao banco BR_VEICULOS
-- Preencha a placa para consultar os detalhes do veiculo
DECLARE @plate VARCHAR(20) = NULL

IF @plate IS NOT NULL
BEGIN
    SELECT TOP (10)
        id, idvehicles, renavam, plate, chassis, mark, model,
        year_of_manufacture, model_year, color, fuel, body_type,
        nationality, state, city, origin, dt_insert, dt_edit
    FROM BR_VEICULOS..br_vehicles_details
    WHERE plate = @plate
END

-- Chaves declaradas: confirma quais colunas relacionam as tabelas
SELECT
    fk.name AS chave,
    so.name AS esquema_origem,
    tp.name AS tabela_origem,
    cp.name AS coluna_origem,
    sr.name AS esquema_referenciado,
    tr.name AS tabela_referenciada,
    cr.name AS coluna_referenciada,
    fk.is_disabled AS desativada,
    fk.is_not_trusted AS nao_validada
FROM BR_VEICULOS.sys.foreign_keys AS fk
INNER JOIN BR_VEICULOS.sys.foreign_key_columns AS fc
    ON fc.constraint_object_id = fk.object_id
INNER JOIN BR_VEICULOS.sys.tables AS tp
    ON tp.object_id = fc.parent_object_id
INNER JOIN BR_VEICULOS.sys.schemas AS so
    ON so.schema_id = tp.schema_id
INNER JOIN BR_VEICULOS.sys.columns AS cp
    ON cp.object_id = fc.parent_object_id
    AND cp.column_id = fc.parent_column_id
INNER JOIN BR_VEICULOS.sys.tables AS tr
    ON tr.object_id = fc.referenced_object_id
INNER JOIN BR_VEICULOS.sys.schemas AS sr
    ON sr.schema_id = tr.schema_id
INNER JOIN BR_VEICULOS.sys.columns AS cr
    ON cr.object_id = fc.referenced_object_id
    AND cr.column_id = fc.referenced_column_id
WHERE (so.name = 'dbo' AND tp.name IN (
    'br_vehicles_details', 'br_group_vehicles', 'nacionalidade'
)) OR (sr.name = 'dbo' AND tr.name IN (
    'br_vehicles_details', 'br_group_vehicles', 'nacionalidade'
))

-- Indices existentes: verificar plate e as chaves antes de criar indices
SELECT
    t.name AS tabela,
    i.name AS indice,
    i.is_unique AS unico,
    i.is_primary_key AS chave_primaria,
    i.is_disabled AS desativado,
    i.filter_definition AS filtro,
    c.name AS coluna,
    ic.key_ordinal AS ordem_na_chave,
    ic.is_included_column AS coluna_incluida
FROM BR_VEICULOS.sys.tables AS t
INNER JOIN BR_VEICULOS.sys.schemas AS s ON s.schema_id = t.schema_id
INNER JOIN BR_VEICULOS.sys.indexes AS i ON i.object_id = t.object_id
INNER JOIN BR_VEICULOS.sys.index_columns AS ic
    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
INNER JOIN BR_VEICULOS.sys.columns AS c
    ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE s.name = 'dbo'
    AND t.name IN ('br_vehicles_details', 'br_group_vehicles', 'nacionalidade')
    AND i.is_hypothetical = 0
ORDER BY t.name, i.name, ic.key_ordinal, ic.index_column_id

-- Amostras limitadas dos campos necessarios para investigar as ligacoes
-- Sem ORDER BY, estas linhas sao arbitrarias e nao provam relacionamentos
SELECT TOP (10) id, idvehicles, nationality
FROM BR_VEICULOS..br_vehicles_details

SELECT TOP (10) id, [group], type_vehicles
FROM BR_VEICULOS..br_group_vehicles

SELECT TOP (10) id, nacionalidade
FROM BR_VEICULOS..nacionalidade
