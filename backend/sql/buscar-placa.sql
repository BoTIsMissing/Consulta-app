-- Banco: BR_VEICULOS
-- Substitua NULL pela placa exatamente como armazenada, entre aspas
DECLARE @plate VARCHAR(50) = NULL

IF @plate IS NULL OR LTRIM(RTRIM(@plate)) = ''
BEGIN
    RAISERROR ('Preencha @plate antes de executar a busca', 16, 1)
    RETURN
END

SELECT TOP (50)
    d.id,
    d.idvehicles,
    d.plate,
    d.renavam,
    d.chassis,
    d.mark,
    d.model,
    d.year_of_manufacture,
    d.model_year,
    d.color,
    d.fuel,
    d.body_type,
    d.nationality AS nationality_code,
    n.nacionalidade AS nationality_description,
    d.state,
    d.city,
    d.origin,
    d.dt_insert,
    d.dt_edit
FROM BR_VEICULOS..br_vehicles_details AS d
LEFT JOIN BR_VEICULOS..nacionalidade AS n
    ON n.id = d.nationality
WHERE d.plate = @plate

-- A nacionalidade e um lookup compativel com os dados inspecionados
-- Nao existe chave estrangeira declarada garantindo essa correspondencia
-- Codigos desconhecidos preservam o veiculo e retornam descricao NULL
-- TOP (50) limita o retorno, mas nao garante leitura rapida sem indice em plate
-- Sem ORDER BY, as linhas sao arbitrarias caso haja mais de 50 resultados
-- br_group_vehicles nao foi incluida: nenhuma ligacao foi confirmada
-- idvehicles nao deve ser usado como chave de grupo sem evidencia adicional
