import type { Report } from '../types';
import { toReadableDate } from '../utils/date';

function escapeCSV(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

export function exportReportsCSV(reports: Report[], filename = 'main-courante.csv') {
  const headers = ['Heure', 'Agent', 'Site', 'Catégorie', 'Gravité', 'Message', 'Statut'];
  const rows = reports.map((r) => [
    toReadableDate(r.createdAt),
    r.agentNom,
    r.siteNom,
    r.category,
    r.severity,
    r.message,
    r.status
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printReportsPDF(reports: Report[], title = 'Export main courante') {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = reports.map((r) => `
    <tr>
      <td>${toReadableDate(r.createdAt)}</td>
      <td>${r.agentNom}</td>
      <td>${r.siteNom}</td>
      <td>${r.category}</td>
      <td>${r.severity}</td>
      <td>${r.message}</td>
    </tr>`).join('');
  win.document.write(`
    <html><head><title>${title}</title><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#0b1220} h1{margin-bottom:4px} small{color:#667085}
      table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px} th,td{border:1px solid #d0d5dd;padding:8px;text-align:left} th{background:#f2f4f7}
    </style></head><body>
      <h1>${title}</h1><small>Généré le ${new Date().toLocaleString('fr-FR')}</small>
      <table><thead><tr><th>Heure</th><th>Agent</th><th>Site</th><th>Catégorie</th><th>Gravité</th><th>Message</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
  win.document.close();
  win.print();
}
