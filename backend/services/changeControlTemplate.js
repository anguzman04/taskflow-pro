// Generación del Excel de Control de Cambios (formato SGSI IT-F-50-V1).
// Abre la plantilla en blanco e inyecta los valores en las celdas mapeadas,
// preservando logo, bordes, colores y celdas combinadas. El mapa de celdas
// fue validado contra la plantilla real (hoja "Proceso de cambio").
const ExcelJS = require('exceljs');
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'IT-F-50-V1.xlsx');
const FORM_SHEET = 'Proceso de cambio';

// Celda maestra de cada valor simple (registro.snake_case -> celda)
const FIELD_CELLS = {
  nombre_cambio: 'C4', fecha_hora_inicio: 'H4',
  objetivo: 'C5', fecha_hora_final: 'H5',
  solicitado_por: 'C6', tipo_cambio: 'H6',
  organizacion: 'C7', version: 'H7',
  descripcion: 'C10', por_que: 'C11', impacto: 'C12',
  activos: 'C13', principios_seguridad: 'H13',
  trata_datos: 'C14', bd_afectadas: 'E14',
  resultado_previsto: 'C15', tiempo_estimado: 'C16', riesgos: 'C17',
  factores_adicionales: 'C18', costos: 'C19',
  resultados: 'B76',
  rev_realizado_por: 'B87', rev_cargo: 'D87', rev_aprobador: 'F87',
};

// Filas fijas de cada tabla repetible (capacidad de la plantilla)
const PARTES_ROWS = [22, 23, 24, 25];        // C=beneficios, F=efectos
const PERSONAL_ROWS = [28, 29, 30];          // Tecnología/Estructura/Otro; C/F
const IMPLEMENT_ROWS = [35, 36, 37, 38, 39]; // B=nombre E=rol F=tel G=email
const SOPORTE_ROWS = [44, 45, 46, 47, 48];
const ANTES_ROWS = [54, 55, 56, 57, 58];     // B=id C=desc E=resp F=fecha G=hIni H=hFin
const DURANTE_ROWS = [60, 61, 62, 63, 64, 65];
const ROLLBACK_ROWS = [69, 70, 71, 72, 73];

function set(ws, addr, val) {
  if (val === undefined || val === null || val === '') return;
  ws.getCell(addr).value = val;
}

function fillImpacto(ws, rows, arr) {
  (arr || []).forEach((p, i) => {
    if (i >= rows.length || !p) return;
    const r = rows[i];
    set(ws, `C${r}`, p.beneficios);
    set(ws, `F${r}`, p.efectos);
  });
}

function fillPersonas(ws, rows, arr) {
  (arr || []).forEach((p, i) => {
    if (i >= rows.length || !p) return;
    const r = rows[i];
    set(ws, `B${r}`, p.nombre);
    set(ws, `E${r}`, p.rol);
    set(ws, `F${r}`, p.telefono);
    set(ws, `G${r}`, p.email);
  });
}

function fillActividades(ws, rows, arr) {
  (arr || []).forEach((a, i) => {
    if (i >= rows.length || !a) return;
    const r = rows[i];
    set(ws, `B${r}`, a.id != null && a.id !== '' ? a.id : i + 1);
    set(ws, `C${r}`, a.descripcion);
    set(ws, `E${r}`, a.responsable);
    set(ws, `F${r}`, a.fecha);
    set(ws, `G${r}`, a.horaInicio);
    set(ws, `H${r}`, a.horaFin);
  });
}

// Devuelve un Buffer del .xlsx diligenciado a partir de un registro ChangeControl.
async function generateChangeControlBuffer(record) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.getWorksheet(FORM_SHEET);
  if (!ws) throw new Error('La plantilla no contiene la hoja "' + FORM_SHEET + '"');

  Object.entries(FIELD_CELLS).forEach(([field, addr]) => set(ws, addr, record[field]));

  fillImpacto(ws, PARTES_ROWS, record.partes);
  fillImpacto(ws, PERSONAL_ROWS, record.personal);
  fillPersonas(ws, IMPLEMENT_ROWS, record.implementadores);
  fillPersonas(ws, SOPORTE_ROWS, record.soporte);
  fillActividades(ws, ANTES_ROWS, record.antes);
  fillActividades(ws, DURANTE_ROWS, record.durante);
  fillActividades(ws, ROLLBACK_ROWS, record.rollback);

  return wb.xlsx.writeBuffer();
}

module.exports = { generateChangeControlBuffer, TEMPLATE_PATH };
