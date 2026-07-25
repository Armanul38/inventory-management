/**
 * Utility functions for exporting data to CSV (Excel compatible)
 * and triggering clean printable documents (Save as PDF).
 */

export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  data: T[],
  columns: { key: keyof T | string; label: string }[]
) {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Build header row
  const headers = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(",");

  // Build data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        let val = row[col.key];
        if (val === null || val === undefined) {
          val = "";
        } else if (typeof val === "object") {
          val = JSON.stringify(val);
        } else {
          val = String(val);
        }
        // Escape quotes
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",");
  });

  const csvContent = "\uFEFF" + [headers, ...rows].join("\r\n"); // \uFEFF adding UTF-8 BOM for Excel compatibility
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printElement(elementId: string, pageTitle: string = "Document") {
  const printContent = document.getElementById(elementId);
  if (!printContent) {
    alert("Print container not found.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    alert("Please allow popups to print documents.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${pageTitle}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111; background: #fff; }
          h1, h2, h3 { color: #000; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
          th { background-color: #f4f4f5; font-weight: 600; }
          .text-right { text-align: right; }
          .font-mono { font-family: monospace; }
          .badge { padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #eee; }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
