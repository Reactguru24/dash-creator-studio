import type { Dict } from "./api";
import { formatCellValue, humanizeKey } from "./format";

const BRAND = {
  name: "Eurovirtuals",
  tagline: "Built to perform.",
  // Sampled directly from the Eurovirtuals logo artwork.
  teal: [12, 144, 72] as [number, number, number],
  lime: [143, 199, 64] as [number, number, number],
  ink: [10, 26, 25] as [number, number, number],
  muted: [110, 122, 126] as [number, number, number],
  line: [219, 232, 221] as [number, number, number],
};


const HIDDEN = new Set([
  "operator_id",
  "partner_id",
  "line_items",
  // Free bet won is not part of the GGR basis shown here — total voided is.
  "free_bet_won",
  "freebet_won",
]);

/** Fields excluded from the invoice PDF entirely. */
function isExcludedKey(key: string) {
  const k = key.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    /free_?bet/.test(k) ||
    /tax_?on_?(stake|win)/.test(k) ||
    /players/.test(k) ||
    /^player_count$/.test(k) ||
    /formula/.test(k) ||
    /invoice_bas/.test(k)
  );
}

async function loadLogo(): Promise<string | null> {
  try {
    const response = await fetch("/eurovirtuals-logo-light.png");
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return await new Promise<string | null>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(dataUrl);
          return;
        }

        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index];
          const green = pixels[index + 1];
          const blue = pixels[index + 2];
          const alpha = pixels[index + 3];
          const lightness = Math.max(red, green, blue);
          const chroma = lightness - Math.min(red, green, blue);
          const isBackground = alpha > 180 && lightness > 220 && chroma < 24;

          if (isBackground) {
            pixels[index + 3] = 0;
          }
        }

        context.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => resolve(null);
      image.src = dataUrl;
    });
  } catch {
    return null;
  }
}



/** Meta fields rendered in the header note instead of as summary cards. */
function isMetaKey(key: string) {
  return /^(currency|month|period)$/i.test(key) || /invoice_bas/i.test(key);
}

function isGgrKey(key: string) {
  return /^ggr$/i.test(key);
}

function metaValue(row: Dict, test: RegExp): string {
  const entry = Object.entries(row).find(([key]) => test.test(key));
  return entry ? formatCellValue(entry[1]) : "";
}

function scalarEntries(row: Dict): [string, unknown][] {
  return Object.entries(row).filter(
    ([key, value]) =>
      !HIDDEN.has(key) && !isExcludedKey(key) && (typeof value !== "object" || value === null),
  );
}

function nestedEntries(row: Dict): [string, unknown][] {
  return Object.entries(row).filter(
    ([key, value]) => !HIDDEN.has(key) && !isExcludedKey(key) && value && typeof value === "object",
  );
}

function objectTable(value: unknown, label: string): { head: string[]; body: string[][] } {
  if (Array.isArray(value)) {
    const objects = value.filter((item) => item && typeof item === "object") as Dict[];
    if (objects.length === value.length && objects.length > 0) {
      const keys: string[] = [];
      for (const item of objects) {
        for (const key of Object.keys(item)) {
          if (!HIDDEN.has(key) && !isExcludedKey(key) && !keys.includes(key)) keys.push(key);
        }
      }
      return {
        head: ["#", ...keys.map((key) => (/invoice_bas/i.test(key) ? "GGR" : humanizeKey(key)))],
        body: objects.map((item, index) => [
          String(index + 1),
          ...keys.map((key) => formatCellValue(item[key])),
        ]),
      };
    }
    return {
      head: ["#", label],
      body: value.map((item, index) => [String(index + 1), formatCellValue(item)]),
    };
  }
  return {
    head: [label, "Value"],
    body: Object.entries(value as Dict)
      .filter(([key]) => !HIDDEN.has(key) && !isExcludedKey(key))
      .map(([key, val]) => [humanizeKey(key), formatCellValue(val)]),
  };
}


const TITLE_KEYS = ["operator_name", "client_name", "operator", "client", "name", "game_name"];

/** Key holding the operator/client name the invoice is billed to. */
function billedToKey(row: Dict): string | undefined {
  const usable = (key: string) => {
    if (HIDDEN.has(key)) return false;
    const value = row[key];
    return typeof value === "string" ? value.trim() !== "" : typeof value === "number";
  };
  return (
    TITLE_KEYS.find(usable) ??
    Object.keys(row).find((key) => /(operator|client|partner)_?name$/i.test(key) && usable(key)) ??
    Object.keys(row).find((key) => /_name$/i.test(key) && usable(key))
  );
}

/** Build and download a branded, human-readable PDF invoice for the given rows. */
export async function downloadInvoicePdf(
  filename: string,
  rows: Dict[],
  month: string,
  billedTo?: string,
) {
  const [{ default: JsPDF }, autoTableModule, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadLogo(),
  ]);
  const autoTable = autoTableModule.default;

  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const issued = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) doc.addPage();
    let y = margin;

    // Brand header band
    doc.setFillColor(...BRAND.teal);
    doc.rect(0, 0, pageWidth, 88, "F");
    doc.setFillColor(...BRAND.lime);
    doc.rect(0, 88, pageWidth, 4, "F");

    let logoDrawn = false;
    if (logo) {
      try {
        // Logo sits directly on the teal header band so no contrasting box shows behind it.
        doc.addImage(logo, "PNG", margin, 21.5, 150, 45.5);
        logoDrawn = true;
      } catch {
        /* logo optional */
      }
    }
    if (!logoDrawn) {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(BRAND.name, margin, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(BRAND.tagline, margin, 58);
    }


    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("INVOICE", pageWidth - margin, 42, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rowMonth = metaValue(row, /^(month|period)$/i);
    doc.text(`Month: ${month || rowMonth || "—"}`, pageWidth - margin, 58, { align: "right" });
    doc.text(`Issued: ${issued}`, pageWidth - margin, 71, { align: "right" });

    y = 120;

    // Billed-to block
    const titleKey = billedToKey(row);
    const billedToLabel = titleKey
      ? formatCellValue(row[titleKey])
      : billedTo?.trim() || `Invoice ${rowIndex + 1}`;
    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(8);
    doc.text("BILLED TO", margin, y);
    doc.setTextColor(...BRAND.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(billedToLabel, margin, y + 17);
    doc.setFont("helvetica", "normal");
    y += 44;

    // Currency note (GGR formula / invoice basis intentionally omitted)
    const currency = metaValue(row, /^currency$/i);
    const noteParts = [
      `${rowIndex + 1} invoice · ${month || rowMonth || "—"}`,
      currency ? `Note: all amounts are shown in ${currency}.` : "",
    ].filter(Boolean);

    if (noteParts.length) {
      doc.setTextColor(...BRAND.muted);
      doc.setFontSize(8);
      const noteLines = doc.splitTextToSize(noteParts.join(" · "), pageWidth - margin * 2);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 11 + 12;
    }

    // Summary cards (same figures as the on-screen cards)
    const stats = scalarEntries(row).filter(([key]) => key !== titleKey && !isMetaKey(key));
    if (stats.length) {
      doc.setTextColor(...BRAND.muted);
      doc.setFontSize(8);
      doc.text("SUMMARY", margin, y);
      y += 12;

      const columns = 3;
      const gap = 12;
      const cardWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
      const cardHeight = 54;
      stats.forEach(([key, value], index) => {
        const column = index % columns;
        if (column === 0 && index > 0) y += cardHeight + gap;
        if (y + cardHeight > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        const x = margin + column * (cardWidth + gap);
        const ggr = isGgrKey(key);
        doc.setDrawColor(...BRAND.line);
        doc.setFillColor(249, 252, 247);
        doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");
        doc.setFillColor(...BRAND.teal);
        doc.rect(x, y, cardWidth, 2, "F");
        doc.setTextColor(...(ggr ? BRAND.ink : BRAND.muted));
        doc.setFont("helvetica", ggr ? "bold" : "normal");
        doc.setFontSize(ggr ? 8.5 : 7.5);
        doc.text(doc.splitTextToSize(humanizeKey(key), cardWidth - 16)[0], x + 8, y + 18);
        doc.setTextColor(...BRAND.ink);
        doc.setFont("helvetica", "bold");
        const text = formatCellValue(value) || "—";
        // Long values (e.g. formula strings) wrap and shrink instead of being cut off.
        const fontSize = text.length > 60 ? 7.5 : text.length > 34 ? 9 : 11;
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, cardWidth - 16).slice(0, 3);
        doc.text(lines, x + 8, y + 34);
        doc.setFont("helvetica", "normal");
      });
      y += cardHeight + 24;
    }

    // Detail tables for nested data
    for (const [key, value] of nestedEntries(row)) {
      const { head, body } = objectTable(value, humanizeKey(key));
      if (!body.length) continue;
      if (head[0] === "#") {
        doc.setTextColor(...BRAND.muted);
        doc.setFontSize(8);
        doc.text(humanizeKey(key).toUpperCase(), margin, y);
        y += 8;
      }
      const columnStyles: Record<number, { fontStyle: "bold" | "normal" | "italic" }> = {};
      head.forEach((h, index) => {
        if (/ggr/i.test(h)) columnStyles[index] = { fontStyle: "bold" };
      });
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [head],
        body,
        styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: BRAND.ink },
        headStyles: { fillColor: BRAND.teal, textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles,
        alternateRowStyles: { fillColor: [246, 251, 244] },
        theme: "grid",
        tableLineColor: BRAND.line,
        didParseCell: (data) => {
          if (data.section === "body" && data.row.index >= 0) {
            const raw = data.row.raw;
            const firstCell = Array.isArray(raw) ? raw[0] : null;
            if (typeof firstCell === "string" && /^ggr$/i.test(firstCell)) {
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });
      y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 20;
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 28;
    doc.setDrawColor(...BRAND.line);
    doc.line(margin, footerY - 12, pageWidth - margin, footerY - 12);
    doc.setTextColor(...BRAND.muted);
    doc.setFontSize(8);
    doc.text(`${BRAND.name} · Generated from platform game summaries`, margin, footerY);
    doc.text(`Page ${rowIndex + 1} of ${rows.length}`, pageWidth - margin, footerY, {
      align: "right",
    });
  });

  doc.save(filename);
}
