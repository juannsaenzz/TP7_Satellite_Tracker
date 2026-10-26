const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

const docs = [
  {
    src: path.join(__dirname, '..', 'docs', 'documento_tecnico.md'),
    outPdf: path.join(__dirname, '..', 'docs', 'documento_tecnico.pdf'),
    rootPdf: path.join(__dirname, '..', '..', 'documento_tecnico.pdf'),
    title: 'Documento Técnico - Satellite Tracker SGP4',
  },
  {
    src: path.join(__dirname, '..', 'docs', 'informe_validacion.md'),
    outPdf: path.join(__dirname, '..', 'docs', 'informe_validacion.pdf'),
    rootPdf: path.join(__dirname, '..', '..', 'informe_validacion.pdf'),
    title: 'Informe de Validación Orbital - Satellite Tracker',
  },
  {
    src: path.join(__dirname, '..', 'docs', 'decisiones_fuentes_datos.md'),
    outPdf: path.join(__dirname, '..', 'docs', 'decisiones_fuentes_datos.pdf'),
    rootPdf: path.join(__dirname, '..', '..', 'decisiones_fuentes_datos.pdf'),
    title: 'Decisiones de Fuentes de Datos - Satellite Tracker',
  },
];

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const htmlTemplate = (content, title) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      color: #0f172a;
      border-bottom: 2.5px solid #6366f1;
      padding-bottom: 8px;
      margin-top: 0;
      margin-bottom: 12px;
    }
    h2 {
      font-size: 14pt;
      color: #1e1b4b;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      color: #312e81;
      margin-top: 16px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    p, li {
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
      text-align: left;
    }
    th {
      background-color: #1e1b4b;
      color: #ffffff;
      font-weight: 700;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    pre {
      background-color: #0f172a;
      color: #f1f5f9;
      padding: 12px 14px;
      border-radius: 6px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
      overflow-x: auto;
      page-break-inside: avoid;
      line-height: 1.4;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
      background-color: #f1f5f9;
      color: #4338ca;
      padding: 2px 5px;
      border-radius: 4px;
    }
    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    blockquote {
      border-left: 4px solid #6366f1;
      margin: 0;
      padding-left: 14px;
      color: #475569;
      font-style: italic;
    }
    strong {
      color: #0f172a;
    }
  </style>
</head>
<body>
${content}
</body>
</html>`;

for (const doc of docs) {
  if (!fs.existsSync(doc.src)) {
    console.error(`File not found: ${doc.src}`);
    continue;
  }

  const mdContent = fs.readFileSync(doc.src, 'utf-8');
  const htmlBody = marked.parse(mdContent);
  const fullHtml = htmlTemplate(htmlBody, doc.title);

  const tempHtml = doc.src.replace(/\.md$/, '.temp.html');
  fs.writeFileSync(tempHtml, fullHtml, 'utf-8');

  console.log(`Generating PDF for: ${path.basename(doc.src)}...`);
  try {
    const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${doc.outPdf}" "file://${tempHtml.replace(/\\/g, '/')}"`;
    execSync(cmd, { stdio: 'inherit' });

    // Copy to workspace root
    fs.copyFileSync(doc.outPdf, doc.rootPdf);
    console.log(`✓ Created: ${doc.outPdf}`);
    console.log(`✓ Created: ${doc.rootPdf}`);
  } catch (err) {
    console.error(`Error generating PDF for ${doc.src}:`, err.message);
  } finally {
    if (fs.existsSync(tempHtml)) {
      fs.unlinkSync(tempHtml);
    }
  }
}

console.log('\nAll PDF documents generated successfully!');
