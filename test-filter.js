const fechaInicio = '2026-03-10';
const fechaFin = '2026-03-13';
const reportes = [
    {Fecha: "13/03/2026"},
    {Fecha: "06/03/2026"},
    {Fecha: "14/03/2026"}
];

const startDate = new Date(fechaInicio + 'T00:00:00');
const endDate = new Date(fechaFin + 'T23:59:59');

console.log("startDate", startDate);
console.log("endDate", endDate);

const filtered = reportes.filter(r => {
    const fechaStr = r.Fecha || '';
    if (!fechaStr) return false;
    // Parsear dd/mm/yyyy
    const parts = fechaStr.split('/');
    if (parts.length === 3) {
        const reportDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        console.log("checking", r.Fecha, "->", reportDate);
        return reportDate >= startDate && reportDate <= endDate;
    }
    return true;
});

console.log(filtered);
