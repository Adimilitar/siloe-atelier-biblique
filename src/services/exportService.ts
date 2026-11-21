import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';
import { jsPDF } from 'jspdf';
import type { StudyDocument, UILanguage } from '../types/siloe';
import { getBookName } from '../data/booksMetadata';

function cssColorToHex(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return hex
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase();
    }
    if (hex.length === 6) return hex.toUpperCase();
  }
  const rgb = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    const r = Number(rgb[1]).toString(16).padStart(2, '0');
    const g = Number(rgb[2]).toString(16).padStart(2, '0');
    const b = Number(rgb[3]).toString(16).padStart(2, '0');
    return `${r}${g}${b}`.toUpperCase();
  }
  return undefined;
}

interface InlineFormat {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  color?: string;
  highlight?: 'yellow' | 'cyan' | 'green' | 'magenta';
}

function mapBgToDocxHighlight(bg: string | undefined): InlineFormat['highlight'] | undefined {
  if (!bg) return undefined;
  const low = bg.toLowerCase();
  if (low.includes('234, 179') || low.includes('fef08a') || low.includes('eab308') || low.includes('yellow')) {
    return 'yellow';
  }
  if (low.includes('147, 197') || low.includes('bfdbfe') || low.includes('blue') || low.includes('cyan')) {
    return 'cyan';
  }
  if (low.includes('74, 222') || low.includes('bbf7d0') || low.includes('green')) {
    return 'green';
  }
  if (low.includes('251, 113') || low.includes('fecdd3') || low.includes('rose')) {
    return 'magenta';
  }
  return 'yellow';
}

function extractInlineRuns(node: Node, fmt: InlineFormat = {}): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: fmt.bold,
        italics: fmt.italics,
        underline: fmt.underline ? { type: UnderlineType.SINGLE } : undefined,
        color: fmt.color,
        highlight: fmt.highlight,
      }),
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') {
    return [new TextRun({ break: 1 })];
  }

  const nextFmt: InlineFormat = { ...fmt };
  if (tag === 'b' || tag === 'strong') nextFmt.bold = true;
  if (tag === 'i' || tag === 'em') nextFmt.italics = true;
  if (tag === 'u') nextFmt.underline = true;
  if (tag === 'mark') nextFmt.highlight = 'yellow';
  if (tag === 'a') {
    nextFmt.color = '1D3557';
    nextFmt.underline = true;
  }
  if (el.style?.color) {
    const hex = cssColorToHex(el.style.color);
    if (hex) nextFmt.color = hex;
  }
  if (el.style?.backgroundColor && el.style.backgroundColor !== 'transparent') {
    nextFmt.highlight = mapBgToDocxHighlight(el.style.backgroundColor);
  }

  const runs: TextRun[] = [];
  el.childNodes.forEach((child) => {
    runs.push(...extractInlineRuns(child, nextFmt));
  });
  return runs;
}

function htmlToDocxBlocks(html: string): Array<Paragraph | Table> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [];

  const blocks: Array<Paragraph | Table> = [];

  const processElement = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1') {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: extractInlineRuns(el, { bold: true, color: '14243E' }),
        })
      );
    } else if (tag === 'h2') {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
          children: extractInlineRuns(el, { bold: true, color: '1D3557' }),
        })
      );
    } else if (tag === 'h3') {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
          children: extractInlineRuns(el, { bold: true }),
        })
      );
    } else if (tag === 'blockquote') {
      blocks.push(
        new Paragraph({
          indent: { left: 480, right: 240 },
          spacing: { before: 120, after: 120 },
          shading: { type: ShadingType.CLEAR, fill: 'F3EEE3' },
          children: extractInlineRuns(el, { italics: true, color: '1D3557' }),
        })
      );
    } else if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.children).filter((c) => c.tagName.toLowerCase() === 'li');
      items.forEach((li, idx) => {
        const prefix = tag === 'ol' ? `${idx + 1}. ` : '• ';
        blocks.push(
          new Paragraph({
            indent: { left: 420 },
            spacing: { after: 60 },
            children: [new TextRun({ text: prefix, bold: true }), ...extractInlineRuns(li)],
          })
        );
      });
    } else if (tag === 'table') {
      const trs = Array.from(el.querySelectorAll('tr'));
      if (trs.length > 0) {
        const rows = trs.map(
          (tr) =>
            new TableRow({
              children: Array.from(tr.children).map(
                (cell) =>
                  new TableCell({
                    shading:
                      cell.tagName.toLowerCase() === 'th'
                        ? { type: ShadingType.CLEAR, fill: 'EAE4D7' }
                        : undefined,
                    children: [
                      new Paragraph({
                        children: extractInlineRuns(cell, {
                          bold: cell.tagName.toLowerCase() === 'th',
                        }),
                      }),
                    ],
                  })
              ),
            })
        );
        blocks.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
            rows,
          })
        );
      }
    } else if (tag === 'div' && el.querySelector('table, h1, h2, h3, p, ul, ol, blockquote')) {
      Array.from(el.children).forEach(processElement);
    } else {
      const runs = extractInlineRuns(el);
      if (runs.length > 0) {
        blocks.push(
          new Paragraph({
            spacing: { after: 120 },
            children: runs,
          })
        );
      }
    }
  };

  Array.from(root.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      processElement(child as Element);
    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      blocks.push(new Paragraph({ children: [new TextRun(child.textContent.trim())] }));
    }
  });

  return blocks;
}

export async function exportStudyToDocx(study: StudyDocument, lang: UILanguage): Promise<Blob> {
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
      children: [new TextRun({ text: study.title || 'Étude biblique', bold: true, color: '14243E' })],
    })
  );

  const metaParts = [
    study.bookId ? getBookName(study.bookId, lang) : null,
    study.theme || null,
    study.folder || null,
    new Date(study.updatedAt).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'fr-FR'),
  ].filter(Boolean);

  if (metaParts.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `Siloé — Atelier biblique  ·  ${metaParts.join('  ·  ')}`,
            italics: true,
            color: '4B5B73',
            size: 20,
          }),
        ],
      })
    );
  }

  if (study.type === 'guided' || study.guided.passageRef || study.guided.startingQuestion) {
    const g = study.guided;
    const addSection = (label: string, text: string) => {
      if (!text.trim()) return;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
          children: [new TextRun({ text: label, bold: true, color: '1D3557' })],
        })
      );
      text.split(/\n+/).forEach((line) => {
        if (line.trim()) {
          children.push(new Paragraph({ spacing: { after: 90 }, children: [new TextRun(line)] }));
        }
      });
    };

    if (g.passageRef) addSection(lang === 'pt' ? 'Passagem de referência' : 'Passage de référence', g.passageRef);
    addSection(lang === 'pt' ? 'Pergunta inicial' : 'Question de départ', g.startingQuestion);

    if (g.observations.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: lang === 'pt' ? 'Observações nos versículos' : 'Observations rattachées aux versets',
              bold: true,
              color: '1D3557',
            }),
          ],
        })
      );
      g.observations.forEach((obs) => {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${obs.verseRef || '—'} : `, bold: true, color: '14243E' }),
              new TextRun(obs.note),
            ],
          })
        );
      });
    }

    addSection(lang === 'pt' ? 'Interpretação' : 'Interprétation', g.interpretation);
    addSection(lang === 'pt' ? 'Aplicação' : 'Application', g.application);
    addSection(lang === 'pt' ? 'Perguntas abertas' : 'Questions ouvertes', g.openQuestions);
    addSection(lang === 'pt' ? 'Plano de ensino' : 'Plan d’enseignement', g.teachingPlan);
  }

  if (study.contentHtml && study.contentHtml.trim()) {
    if (study.type === 'guided') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
          children: [new TextRun({ text: lang === 'pt' ? 'Notas livres e excertos' : 'Notes libres & extraits', bold: true, color: '1D3557' })],
        })
      );
    }
    children.push(...htmlToDocxBlocks(study.contentHtml));
  }

  const doc = new Document({
    creator: 'Siloé — Atelier biblique',
    title: study.title,
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

export function exportStudyToPdf(study: StudyDocument, lang: UILanguage): Blob {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 52) {
      pdf.addPage();
      y = 54;
    }
  };

  const writeWrapped = (text: string, opts: { size?: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; indent?: number; gapAfter?: number } = {}) => {
    const size = opts.size ?? 11;
    const indent = opts.indent ?? 0;
    pdf.setFont('helvetica', opts.bold && opts.italic ? 'bolditalic' : opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal');
    pdf.setFontSize(size);
    const [r, g, b] = opts.color ?? [20, 36, 62];
    pdf.setTextColor(r, g, b);
    const lines = pdf.splitTextToSize(text, maxW - indent) as string[];
    const lineH = size * 1.42;
    for (const line of lines) {
      ensureSpace(lineH);
      pdf.text(line, margin + indent, y);
      y += lineH;
    }
    y += opts.gapAfter ?? 6;
  };

  // Header
  writeWrapped(study.title || 'Étude biblique', { size: 18, bold: true, gapAfter: 4 });
  const metaParts = [
    'Siloé — Atelier biblique',
    study.bookId ? getBookName(study.bookId, lang) : null,
    study.theme || null,
    new Date(study.updatedAt).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'fr-FR'),
  ].filter(Boolean);
  writeWrapped(metaParts.join(' · '), { size: 9, italic: true, color: [75, 91, 115], gapAfter: 12 });

  pdf.setDrawColor(200, 206, 216);
  pdf.line(margin, y, pageW - margin, y);
  y += 16;

  if (study.type === 'guided' || study.guided.passageRef || study.guided.startingQuestion) {
    const g = study.guided;
    const addSec = (heading: string, val: string) => {
      if (!val.trim()) return;
      writeWrapped(heading, { size: 12, bold: true, color: [29, 53, 87], gapAfter: 3 });
      writeWrapped(val.trim(), { size: 10.5, gapAfter: 10 });
    };
    if (g.passageRef) addSec(lang === 'pt' ? 'Passagem' : 'Passage', g.passageRef);
    addSec(lang === 'pt' ? 'Pergunta inicial' : 'Question de départ', g.startingQuestion);
    if (g.observations.length > 0) {
      writeWrapped(lang === 'pt' ? 'Observações' : 'Observations', { size: 12, bold: true, color: [29, 53, 87], gapAfter: 4 });
      g.observations.forEach((o) => {
        writeWrapped(`• ${o.verseRef}: ${o.note}`, { size: 10.5, indent: 8, gapAfter: 4 });
      });
      y += 6;
    }
    addSec(lang === 'pt' ? 'Interpretação' : 'Interprétation', g.interpretation);
    addSec(lang === 'pt' ? 'Aplicação' : 'Application', g.application);
    addSec(lang === 'pt' ? 'Perguntas ouvertes' : 'Questions ouvertes', g.openQuestions);
    addSec(lang === 'pt' ? 'Plano de ensino' : 'Plan d’enseignement', g.teachingPlan);
  }

  if (study.contentHtml && study.contentHtml.trim()) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${study.contentHtml}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (root) {
      Array.from(root.children).forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt && tag !== 'table') return;
        if (tag === 'h1') writeWrapped(txt, { size: 14, bold: true, gapAfter: 6 });
        else if (tag === 'h2') writeWrapped(txt, { size: 12.5, bold: true, color: [29, 53, 87], gapAfter: 5 });
        else if (tag === 'h3') writeWrapped(txt, { size: 11.5, bold: true, gapAfter: 4 });
        else if (tag === 'blockquote') writeWrapped(`« ${txt} »`, { size: 10.5, italic: true, indent: 14, color: [29, 53, 87], gapAfter: 8 });
        else if (tag === 'ul' || tag === 'ol') {
          Array.from(el.children).forEach((li, i) => {
            const liTxt = (li.textContent || '').trim();
            if (liTxt) writeWrapped(`${tag === 'ol' ? `${i + 1}.` : '•'} ${liTxt}`, { size: 10.5, indent: 12, gapAfter: 3 });
          });
          y += 4;
        } else if (tag === 'table') {
          Array.from(el.querySelectorAll('tr')).forEach((tr) => {
            const cells = Array.from(tr.children).map((c) => (c.textContent || '').trim());
            writeWrapped(cells.join('  |  '), { size: 9.5, indent: 6, gapAfter: 3 });
          });
          y += 6;
        } else {
          writeWrapped(txt, { size: 10.5, gapAfter: 7 });
        }
      });
    }
  }

  return pdf.output('blob');
}

export function triggerDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
