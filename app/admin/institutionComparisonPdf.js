"use client";
import { drawCompassUBrand } from "../pdfBrand";

const safe = (v) => String(v ?? "");
const labelize = (v) =>
  safe(v)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const cleanFile = (v) =>
  safe(v)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "Institution-Comparison";
const dateLabel = (v) => {
  if (!v) return "";
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? safe(v) : d.toLocaleDateString();
};

export async function exportInstitutionComparisonPdf({
  comparison,
  startDate,
  endDate,
}) {
  const rows = comparison?.institutions || [];
  if (rows.length < 2)
    throw new Error(
      "Run a comparison of at least two institutions before exporting.",
    );
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
    compress: true,
  });
  const W = 792,
    H = 612,
    M = 42,
    CONTENT = W - M * 2,
    navy = [15, 29, 64],
    blue = [47, 111, 237],
    ink = [23, 32, 51],
    muted = [102, 112, 133],
    line = [231, 234, 240],
    soft = [247, 249, 252];
  let page = 1;
  const threshold = comparison?.privacy?.small_cell_threshold ?? 5,
    generated = comparison.generated_at
      ? new Date(comparison.generated_at)
      : new Date(),
    period = comparison.reporting_period || {},
    periodStart = period.start_date || startDate || "",
    periodEnd = period.end_date || endDate || "",
    filtered = Boolean(period.filtered || periodStart || periodEnd),
    periodText = filtered
      ? `${periodStart ? dateLabel(periodStart) : "Beginning of records"} through ${periodEnd ? dateLabel(periodEnd) : "Present"}`
      : "All available records";
  const setText = (size, color = ink, style = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const footer = () => {
    doc.setDrawColor(...line);
    doc.line(M, H - 32, W - M, H - 32);
    setText(7, muted);
    doc.text(
      "CompassU Institution Comparison | Aggregate decision-support reporting",
      M,
      H - 18,
    );
    doc.text(`Page ${page}`, W - M, H - 18, { align: "right" });
  };
  const addPage = (title) => {
    footer();
    doc.addPage();
    page++;
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, 62, "F");
    drawCompassUBrand(doc, { x: W - 124, y: 14, size: 30, onDark: true });
    setText(8, [195, 210, 255], "bold");
    doc.text("COMPARATIVE INSTITUTIONAL ANALYTICS", M, 23);
    setText(19, [255, 255, 255], "bold");
    doc.text(title, M, 46);
    return 88;
  };
  const wrapped = (
    text,
    x,
    y,
    width,
    size = 9,
    color = muted,
    lineHeight = 12,
    style = "normal",
  ) => {
    setText(size, color, style);
    const ls = doc.splitTextToSize(safe(text), width);
    doc.text(ls, x, y);
    return y + ls.length * lineHeight;
  };
  const section = (title, subtitle, y) => {
    setText(14, ink, "bold");
    doc.text(title, M, y);
    if (subtitle) y = wrapped(subtitle, M, y + 16, CONTENT, 8, muted, 11);
    return y + 12;
  };
  const cellValue = (arr, keyField, key, valueField) => {
    const x = (arr || []).find((v) => v?.[keyField] === key);
    return x && !x.suppressed ? (x[valueField] ?? "—") : "—";
  };
  const drawMatrix = (title, subtitle, labels, valueFor, y) => {
    y = section(title, subtitle, y);
    const labelW = 150,
      colW = (CONTENT - labelW) / rows.length,
      rowH = 28;
    doc.setFillColor(...soft);
    doc.rect(M, y, CONTENT, rowH, "F");
    setText(7, muted, "bold");
    doc.text("METRIC", M + 8, y + 18);
    rows.forEach((r, i) => {
      const names = doc.splitTextToSize(r.institution, colW - 12);
      doc.text(names.slice(0, 2), M + labelW + i * colW + 6, y + 12);
    });
    y += rowH;
    labels.forEach((label) => {
      if (y > H - 58) {
        y = addPage(`${title} — Continued`);
      }
      setText(8, ink, "bold");
      doc.text(label.display, M + 8, y + 18);
      rows.forEach((r, i) => {
        setText(8, ink);
        doc.text(safe(valueFor(r, label)), M + labelW + i * colW + 6, y + 18);
      });
      doc.setDrawColor(...line);
      doc.line(M, y + rowH, W - M, y + rowH);
      y += rowH;
    });
    return y + 16;
  };

  doc.setFillColor(...navy);
  doc.rect(0, 0, W, H, "F");
  drawCompassUBrand(doc, { x: M, y: 42, size: 38, onDark: true, tagline: true });
  setText(9, [195, 210, 255], "bold");
  doc.text("INSTITUTIONAL INTELLIGENCE", M, 135);
  setText(31, [255, 255, 255], "bold");
  doc.text("Institution Comparison", M, 178);
  setText(14, [205, 216, 244]);
  doc.text(`${rows.length} institutions`, M, 210);
  doc.setFillColor(31, 48, 89);
  doc.roundedRect(M, 250, CONTENT, 190, 16, 16, "F");
  setText(9, [195, 210, 255], "bold");
  doc.text("INSTITUTIONS", M + 20, 280);
  let iy = 304;
  rows.forEach((r, i) => {
    setText(11, [255, 255, 255], i < 2 ? "bold" : "normal");
    doc.text(`• ${r.institution}`, M + 20, iy);
    iy += 20;
  });
  setText(8, [195, 210, 255], "bold");
  doc.text("REPORTING PERIOD", M + 390, 280);
  setText(11, [255, 255, 255]);
  doc.text(periodText, M + 390, 304);
  setText(8, [195, 210, 255], "bold");
  doc.text("PRIVACY", M + 390, 340);
  setText(10, [255, 255, 255]);
  doc.text(
    `Cells representing fewer than ${threshold} students are suppressed.`,
    M + 390,
    362,
  );
  setText(9, [195, 210, 255]);
  doc.text(
    `Generated ${generated.toLocaleDateString()} at ${generated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    M + 390,
    402,
  );
  setText(8, [195, 210, 255]);
  doc.text("Prepared for authorized institutional use.", M, H - 42);

  let y = addPage("Participation & Completion");
  const participation = [
    { display: "Assigned accounts", key: "assigned_accounts" },
    { display: "Students started", key: "started_students" },
    { display: "Students completed", key: "completed_students" },
    { display: "Completion rate", key: "completion_rate" },
    { display: "Not completed", key: "not_completed_students" },
  ];
  y = drawMatrix(
    "Participation Comparison",
    `Side-by-side participation and completion for ${periodText}.`,
    participation,
    (r, l) =>
      l.key === "completion_rate"
        ? `${r.participation?.[l.key] ?? 0}%`
        : (r.participation?.[l.key] ?? 0),
    y,
  );
  const dimensions = [
    ...new Set(
      rows.flatMap((r) => (r.dimensions || []).map((x) => x.dimension)),
    ),
  ].map((key) => ({ key, display: labelize(key) }));
  y = drawMatrix(
    "Six-Dimension Student Profile",
    "Average normalized scores. Suppressed cells are shown as unavailable.",
    dimensions,
    (r, l) => {
      const v = cellValue(r.dimensions, "dimension", l.key, "average_score");
      return v === "—" ? v : `${v}%`;
    },
    y,
  );

  y = addPage("Career Cluster Comparison");
  const clusters = [
    ...new Set(
      rows.flatMap((r) =>
        (r.career_clusters || [])
          .filter((x) => !x.suppressed)
          .map((x) => x.cluster),
      ),
    ),
  ].map((key) => ({ key, display: labelize(key) }));
  if (clusters.length)
    y = drawMatrix(
      "Career Cluster Distribution",
      "Reportable student counts by dominant CompassU career cluster.",
      clusters,
      (r, l) => cellValue(r.career_clusters, "cluster", l.key, "student_count"),
      y,
    );
  else
    y = wrapped(
      "No career-cluster cells reach the current privacy reporting threshold.",
      M,
      y,
      CONTENT,
      10,
      muted,
      14,
    );

  const listPage = (title, field, nameField, countField, description) => {
    let yy = addPage(title);
    yy = section(title, description, yy);
    const colW = CONTENT / rows.length;
    rows.forEach((r, i) => {
      const x = M + i * colW;
      doc.setFillColor(...soft);
      doc.roundedRect(x + 4, yy, colW - 8, 28, 6, 6, "F");
      setText(8, ink, "bold");
      const h = doc.splitTextToSize(r.institution, colW - 18);
      doc.text(h.slice(0, 2), x + 10, yy + 17);
      let cy = yy + 42;
      const items = (r[field] || []).filter((v) => !v.suppressed).slice(0, 8);
      if (!items.length) {
        setText(8, muted);
        doc.text("No reportable cells", x + 10, cy);
      } else
        items.forEach((item, n) => {
          setText(8, ink, n < 3 ? "bold" : "normal");
          const text = `${n + 1}. ${item[nameField]} — ${item[countField]} students`;
          const ls = doc.splitTextToSize(text, colW - 20);
          doc.text(ls, x + 10, cy);
          cy += ls.length * 11 + 7;
        });
    });
  };
  listPage(
    "Top Recommended Majors",
    "top_majors",
    "major_name",
    "student_count",
    "Top reportable majors appearing in students' Top 10 CompassU recommendations.",
  );
  listPage(
    "Top Career Alignments",
    "top_careers",
    "occupation_name",
    "student_count",
    "Top reportable careers connected to students' Top 3 recommended majors.",
  );

  y = addPage("Methodology & Data Definitions");
  const methods = [
    ["Reporting period", periodText],
    [
      "Assessment basis",
      "Comparison results use the same institutional analytics service and privacy safeguards as the CompassU institutional dashboard.",
    ],
    [
      "Participation",
      "Assigned accounts and assessment activity are compared institution by institution.",
    ],
    [
      "Student profile",
      "Dimension scores are normalized to a 0-100 scale and averaged across reportable students.",
    ],
    [
      "Career clusters",
      "Career-cluster results summarize dominant aggregate student clusters.",
    ],
    [
      "Recommended majors",
      "Major counts reflect reportable recurrence in students' Top 10 CompassU recommendations.",
    ],
    [
      "Career alignments",
      "Career counts reflect reportable occupations connected to students' Top 3 recommended majors.",
    ],
    [
      "Privacy safeguard",
      `Aggregate categories representing fewer than ${threshold} students are suppressed.`,
    ],
    [
      "Use of report",
      "CompassU comparison analytics are aggregate educational decision-support information and should not be interpreted as deterministic student outcomes or causal institutional performance measures.",
    ],
  ];
  methods.forEach(([k, v]) => {
    setText(9, blue, "bold");
    doc.text(k, M, y);
    y = wrapped(v, M, y + 15, CONTENT, 9, ink, 12);
    y += 14;
  });
  footer();
  const suffix = filtered
      ? `${periodStart || "start"}-to-${periodEnd || "present"}`
      : generated.toISOString().slice(0, 10),
    filename = `CompassU-Institution-Comparison-${cleanFile(suffix)}.pdf`;
  doc.save(filename);
  return filename;
}
