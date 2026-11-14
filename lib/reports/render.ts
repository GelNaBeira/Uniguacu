import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { ReportDocument } from "./schema.ts";

export async function renderReport(document: ReportDocument, format: "pdf" | "xlsx") {
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Almoxarifado Uniguaçu";
    workbook.created = new Date(document.generatedAt);
    const info = workbook.addWorksheet("Informações");
    info.addRows([[document.title], ["Gerado em UTC", document.generatedAt], [document.summary]]);
    info.getColumn(1).width = 80;
    info.getColumn(2).width = 30;
    for (const table of document.tables) {
      const sheet = workbook.addWorksheet(table.name);
      sheet.addRow(table.columns);
      // Strings são células de texto, nunca objetos formula/hyperlink.
      sheet.addRows(table.rows);
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: table.columns.length } };
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174536" } };
      sheet.columns.forEach((column, index) => { column.width = index === 0 ? 38 : 25; });
    }
    return { base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"), mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  const pdf = new jsPDF({ orientation: "landscape", format: "a3", compress: true });
  pdf.setProperties({ title: document.title, author: "Almoxarifado Uniguaçu" });
  document.tables.forEach((table, index) => {
    if (index) pdf.addPage();
    pdf.setFontSize(16);
    pdf.text(document.title, 14, 16);
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(`${document.summary}\nGerado em UTC: ${document.generatedAt}\n${table.name}: ${table.rows.length} registro(s)`, 390);
    pdf.text(lines, 14, 23);
    autoTable(pdf, { startY: 26 + lines.length * 4, head: [table.columns], body: table.rows.length ? table.rows : [[{ content: "Nenhum registro encontrado.", colSpan: table.columns.length }]],
      styles: { fontSize: 7, overflow: "linebreak", cellPadding: 2 }, headStyles: { fillColor: [23, 69, 54] }, margin: { top: 14, bottom: 16 },
      didDrawPage: () => { pdf.setFontSize(8); pdf.text(`Página ${pdf.getNumberOfPages()} · Datas em UTC`, 14, 289); },
    });
  });
  return { base64: Buffer.from(pdf.output("arraybuffer")).toString("base64"), mime: "application/pdf" };
}