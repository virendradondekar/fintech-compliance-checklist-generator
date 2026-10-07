// Pure CSV parsing and class-imbalance analysis. No I/O.

export function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

const LABEL_CANDIDATES = ['label', 'target', 'class', 'fraud', 'is_fraud', 'default', 'outcome', 'y'];

export function analyzeCsv(csvText, labelColumnHint) {
  const { header, rows } = parseCsv(csvText);
  if (header.length === 0 || rows.length === 0) {
    return { error: 'CSV appears empty or invalid.' };
  }

  let labelIdx = -1;
  if (labelColumnHint) {
    labelIdx = header.findIndex((h) => h.toLowerCase() === labelColumnHint.toLowerCase());
  }
  if (labelIdx === -1) {
    for (const cand of LABEL_CANDIDATES) {
      const idx = header.findIndex((h) => h.toLowerCase() === cand);
      if (idx !== -1) {
        labelIdx = idx;
        break;
      }
    }
  }
  if (labelIdx === -1) {
    labelIdx = header.length - 1;
  }

  const labelColumn = header[labelIdx];
  const counts = {};
  for (const row of rows) {
    const val = row[labelIdx] !== undefined ? row[labelIdx] : '';
    counts[val] = (counts[val] || 0) + 1;
  }
  const classEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const totalRows = rows.length;
  const majority = classEntries[0];
  const minority = classEntries[classEntries.length - 1];
  const imbalanceRatio = classEntries.length < 2 || minority[1] === 0 ? null : +(majority[1] / minority[1]).toFixed(2);

  let riskLevel;
  if (classEntries.length < 2) riskLevel = 'unknown';
  else if (imbalanceRatio >= 20) riskLevel = 'critical';
  else if (imbalanceRatio >= 10) riskLevel = 'high';
  else if (imbalanceRatio >= 3) riskLevel = 'moderate';
  else riskLevel = 'low';

  return {
    header,
    totalRows,
    labelColumn,
    classCounts: Object.fromEntries(classEntries),
    numClasses: classEntries.length,
    imbalanceRatio,
    riskLevel,
    warnings: buildWarnings(riskLevel, classEntries, totalRows)
  };
}

function buildWarnings(riskLevel, classEntries, totalRows) {
  const w = [];
  if (riskLevel === 'critical') {
    w.push('Severe class imbalance detected (ratio >= 20:1). Model likely to have poor minority-class recall; consider resampling, class weights, or anomaly-detection framing.');
  } else if (riskLevel === 'high') {
    w.push('High class imbalance (ratio >= 10:1). Evaluate with precision/recall, not just accuracy; consider SMOTE/undersampling.');
  } else if (riskLevel === 'moderate') {
    w.push('Moderate class imbalance (ratio >= 3:1). Monitor minority-class performance metrics closely.');
  } else if (riskLevel === 'low') {
    w.push('Class balance looks reasonable for standard training approaches.');
  }
  if (classEntries.length < 2) {
    w.push('Only one class value found in the label column; cannot assess imbalance.');
  }
  if (totalRows < 200) {
    w.push('Sample size is small (<200 rows); the imbalance ratio estimate may be unreliable.');
  }
  return w;
}