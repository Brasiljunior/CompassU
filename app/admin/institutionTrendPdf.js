"use client";
import { drawCompassUBrand } from "../pdfBrand";
const safe = (v) => String(v ?? "");
const labelize = (v) =>
  safe(v)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const dateLabel = (v) => {
  if (!v) return "";
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? safe(v) : d.toLocaleDateString();
};
export async function exportInstitutionTrendPdf({ trends }) {
  const periods = trends?.periods || [];
  if (periods.length < 2)
    throw new Error("Load at least two trend periods before exporting.");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "letter",
      compress: true,
    }),
    W = 792,
    H = 612,
    M = 42,
    C = W - M * 2,
    navy = [15, 29, 64],
    blue = [47, 111, 237],
    ink = [23, 32, 51],
    muted = [102, 112, 133],
    line = [231, 234, 240],
    soft = [247, 249, 252];
  let page = 1;
  const threshold = trends?.privacy?.small_cell_threshold ?? 5,
    institution = trends?.institution || "All Institutions";
  const set = (s, c = ink, style = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(s);
    doc.setTextColor(...c);
  };
  const footer = () => {
    doc.setDrawColor(...line);
    doc.line(M, H - 32, W - M, H - 32);
    set(7, muted);
    doc.text(
      "CompassU Institutional Trends | Aggregate longitudinal decision-support reporting",
      M,
      H - 18,
    );
    doc.text(`Page ${page}`, W - M, H - 18, { align: "right" });
  };
  const addPage = (t) => {
    footer();
    doc.addPage();
    page++;
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, 62, "F");
    drawCompassUBrand(doc, { x: W - 124, y: 14, size: 30, onDark: true });
    set(8, [195, 210, 255], "bold");
    doc.text("INSTITUTIONAL TREND ANALYTICS", M, 23);
    set(19, [255, 255, 255], "bold");
    doc.text(t, M, 46);
    return 88;
  };
  const period = (p) =>
    `${dateLabel(p.period_start)} – ${dateLabel(p.period_end)}`;
  const section = (t, sub, y) => {
    set(14, ink, "bold");
    doc.text(t, M, y);
    if (sub) {
      set(8, muted);
      doc.text(doc.splitTextToSize(sub, C), M, y + 16);
      y += 18;
    }
    return y + 14;
  };
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, H, "F");
  drawCompassUBrand(doc, { x: M, y: 42, size: 38, onDark: true, tagline: true });
  set(9, [195, 210, 255], "bold");
  doc.text("INSTITUTIONAL INTELLIGENCE", M, 135);
  set(31, [255, 255, 255], "bold");
  doc.text("Institutional Trends", M, 178);
  set(14, [205, 216, 244]);
  doc.text(institution, M, 210);
  doc.setFillColor(31, 48, 89);
  doc.roundedRect(M, 250, C, 160, 16, 16, "F");
  set(9, [195, 210, 255], "bold");
  doc.text("TREND WINDOW", M + 20, 280);
  set(11, [255, 255, 255]);
  doc.text(
    `${periods.length} consecutive ${trends.period_months}-month periods through ${dateLabel(trends.through_date)}`,
    M + 20,
    304,
  );
  set(9, [195, 210, 255], "bold");
  doc.text("PRIVACY", M + 20, 344);
  set(10, [255, 255, 255]);
  doc.text(
    `Cells representing fewer than ${threshold} students are suppressed.`,
    M + 20,
    366,
  );
  set(8, [195, 210, 255]);
  doc.text(
    "Descriptive longitudinal reporting; not a causal measure of institutional performance.",
    M,
    H - 42,
  );
  let y = addPage("Participation & Completion");
  y = section(
    "Completion Trend",
    "Completion rate and completed-student volume by reporting period.",
    y,
  );
  const labelW = 155,
    colW = (C - labelW) / periods.length,
    rowH = 30;
  doc.setFillColor(...soft);
  doc.rect(M, y, C, rowH, "F");
  set(7, muted, "bold");
  doc.text("METRIC", M + 8, y + 18);
  periods.forEach((p, i) =>
    doc.text(
      doc.splitTextToSize(period(p), colW - 12).slice(0, 2),
      M + labelW + i * colW + 6,
      y + 12,
    ),
  );
  y += rowH;
  [
    ["Assigned accounts", "assigned_accounts"],
    ["Students started", "started_students"],
    ["Students completed", "completed_students"],
    ["Completion rate", "completion_rate"],
  ].forEach(([name, key]) => {
    set(8, ink, "bold");
    doc.text(name, M + 8, y + 19);
    periods.forEach((p, i) => {
      let v = p.participation?.[key] ?? 0;
      if (key === "completion_rate") v = `${v}%`;
      set(8, ink);
      doc.text(safe(v), M + labelW + i * colW + 6, y + 19);
    });
    doc.setDrawColor(...line);
    doc.line(M, y + rowH, W - M, y + rowH);
    y += rowH;
  });
  y = addPage("Six-Dimension Student Profile");
  const dims = [
    ...new Set(
      periods.flatMap((p) =>
        (p.dimensions || [])
          .filter((x) => !x.suppressed)
          .map((x) => x.dimension),
      ),
    ),
  ];
  y = section(
    "Dimension Trend",
    "Average normalized profile scores. Suppressed cells are unavailable.",
    y,
  );
  dims.forEach((d) => {
    if (y > H - 58) y = addPage("Six-Dimension Student Profile — Continued");
    set(8, ink, "bold");
    doc.text(labelize(d), M + 8, y + 19);
    periods.forEach((p, i) => {
      const x = (p.dimensions || []).find((v) => v.dimension === d);
      set(8, ink);
      doc.text(
        x && !x.suppressed && x.average_score != null
          ? `${x.average_score}%`
          : "—",
        M + labelW + i * colW + 6,
        y + 19,
      );
    });
    doc.setDrawColor(...line);
    doc.line(M, y + rowH, W - M, y + rowH);
    y += rowH;
  });
  const listPage = (title, field, name) => {
    let yy = addPage(title);
    yy = section(
      title,
      "Top reportable aggregate alignments by reporting period.",
      yy,
    );
    const cw = C / periods.length;
    periods.forEach((p, i) => {
      const x = M + i * cw;
      doc.setFillColor(...soft);
      doc.roundedRect(x + 4, yy, cw - 8, 28, 6, 6, "F");
      set(7, ink, "bold");
      doc.text(
        doc.splitTextToSize(period(p), cw - 18).slice(0, 2),
        x + 10,
        yy + 12,
      );
      let cy = yy + 45;
      const items = (p[field] || []).filter((v) => !v.suppressed).slice(0, 6);
      if (!items.length) {
        set(8, muted);
        doc.text("No reportable cells", x + 10, cy);
      } else
        items.forEach((v, n) => {
          set(8, ink, n < 3 ? "bold" : "normal");
          const ls = doc.splitTextToSize(
            `${n + 1}. ${labelize(v[name])} — ${v.student_count} students`,
            cw - 20,
          );
          doc.text(ls, x + 10, cy);
          cy += ls.length * 11 + 7;
        });
    });
  };
  listPage("Career Cluster Trends", "career_clusters", "cluster");
  listPage("Major Alignment Trends", "top_majors", "major_name");
  listPage("Career Alignment Trends", "top_careers", "occupation_name");
  y = addPage("Methodology & Interpretation");
  const notes = [
    [
      "Assessment basis",
      "Each period uses the latest completed CompassU assessment overall for each student, included only when that canonical assessment falls within the period.",
    ],
    [
      "Privacy",
      `Aggregate categories representing fewer than ${threshold} students are suppressed.`,
    ],
    [
      "Period structure",
      `${periods.length} consecutive, non-overlapping ${trends.period_months}-month reporting periods ending ${dateLabel(trends.through_date)}.`,
    ],
    [
      "Interpretation",
      "Trend results describe observed CompassU assessment patterns. They should not be treated as proof that institutional actions caused a change.",
    ],
    [
      "Recommendation engine",
      "Trend reporting does not alter CompassU scoring, recommendation weights, major rankings, or career mappings.",
    ],
  ];
  notes.forEach(([k, v]) => {
    set(9, blue, "bold");
    doc.text(k, M, y);
    set(9, ink);
    const ls = doc.splitTextToSize(v, C);
    doc.text(ls, M, y + 15);
    y += ls.length * 12 + 28;
  });
  footer();
  const filename = `CompassU-Institutional-Trends-${safe(institution).replace(/[^a-z0-9]+/gi, "-")}-${safe(trends.through_date)}.pdf`;
  doc.save(filename);
  return filename;
}
