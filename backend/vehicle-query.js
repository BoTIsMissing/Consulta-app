// Não associar idvehicles a br_group_vehicles sem confirmar o relacionamento.
const vehicleQuery = `
  SELECT TOP (50)
    CONVERT(varchar(20), d.id) AS id,
    CONVERT(varchar(20), d.idvehicles) AS idvehicles,
    d.plate, CONVERT(varchar(50), d.renavam) AS renavam,
    d.chassis, d.mark, d.model, d.year_of_manufacture, d.model_year,
    d.color, d.fuel, d.body_type,
    d.nationality AS nationality_code,
    n.nacionalidade AS nationality_description,
    d.state, d.city, d.origin, d.dt_insert, d.dt_edit
  FROM BR_VEICULOS..br_vehicles_details AS d
  LEFT JOIN BR_VEICULOS..nacionalidade AS n ON n.id = d.nationality
  WHERE d.plate IN (@plate, @formattedPlate)
`;

module.exports = { vehicleQuery };
