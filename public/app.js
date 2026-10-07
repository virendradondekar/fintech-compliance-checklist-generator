let currentRunId = null;
let metaCache = null;

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

async function loadMeta() {
  metaCache = await fetchJson('/api/meta');
  const useCaseSel = document.getElementById('useCase');
  const regionSel = document.getElementById('region');
  const dataTypesBox = document.getElementById('dataTypes');

  useCaseSel.innerHTML = metaCache.useCases.map((u) => `<option value="${u.id}">${u.name}</option>`).join('');
  regionSel.innerHTML = metaCache.regions.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
  dataTypesBox.innerHTML = metaCache.dataTypes
    .map(
      (dt, idx) =>
        `<label><input type="checkbox" value="${dt.id}" ${idx === 0 ? 'checked' : ''}/> ${dt.name}</label>`
    )
    .join('');
}

function renderChecklist(record) {
  document.getElementById('result-section').hidden = false;
  document.getElementById('providerBadge').textContent = `AI provider: ${record.provider}`;
  document.getElementById('narrativeText').textContent = record.narrative;

  const container = document.getElementById('categoriesContainer');
  container.innerHTML = '';
  for (const cat of record.checklist.categories) {
    const items = cat.items
      .map(
        (it) =>
          `<li><span class="severity ${it.severity}">${it.severity}</span>${it.text}</li>`
      )
      .join('');
    const card = el('div', { class: 'category', html: `<h3>${cat.label}</h3><ul>${items}</ul>` });
    container.appendChild(card);
  }
}

function renderCsvResult(result) {
  const box = document.getElementById('csvResultBox');
  box.hidden = false;
  if (result.error) {
    box.innerHTML = `<p class="error-text">${result.error}</p>`;
    return;
  }
  const rows = Object.entries(result.classCounts)
    .map(([k, v]) => `<tr><td>${k || '(blank)'}</td><td>${v}</td></tr>`)
    .join('');
  box.innerHTML = `
    <p>Label column detected: <strong>${result.labelColumn}</strong> (${result.totalRows} rows, ${result.numClasses} classes)</p>
    <p>Imbalance ratio (majority:minority): <strong>${result.imbalanceRatio ?? 'n/a'}</strong>
      &nbsp; <span class="risk-badge risk-${result.riskLevel}">${result.riskLevel.toUpperCase()}</span>
    </p>
    <table><thead><tr><th>Class value</th><th>Count</th></tr></thead><tbody>${rows}</tbody></table>
    <ul class="warnings">${result.warnings.map((w) => `<li>${w}</li>`).join('')}</ul>
  `;
}

async function refreshHistory() {
  const data = await fetchJson('/api/history');
  const list = document.getElementById('historyList');
  if (data.runs.length === 0) {
    list.innerHTML = '<li>No runs yet.</li>';
    return;
  }
  list.innerHTML = '';
  for (const r of data.runs) {
    const li = el('li', {
      html: `<strong>${r.companyName || '(untitled)'}</strong> — ${r.useCase} / ${r.region}
        <br/><small>${new Date(r.createdAt).toLocaleString()} · ${r.totalItems} items, ${r.highSeverityCount} high-priority ${r.hasCsv ? '· CSV attached' : ''}</small>`
    });
    li.addEventListener('click', async () => {
      const record = await fetchJson(`/api/checklist/${r.id}`);
      currentRunId = record.id;
      renderChecklist(record);
      if (record.csvAnalysis) renderCsvResult(record.csvAnalysis);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    list.appendChild(li);
  }
}

async function generateChecklistHandler() {
  const companyName = document.getElementById('companyName').value;
  const useCase = document.getElementById('useCase').value;
  const region = document.getElementById('region').value;
  const dataTypes = Array.from(document.querySelectorAll('#dataTypes input:checked')).map((i) => i.value);

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  try {
    const record = await fetchJson('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, useCase, region, dataTypes })
    });
    currentRunId = record.id;
    renderChecklist(record);
    await refreshHistory();
  } catch (e) {
    alert('Failed to generate checklist: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Checklist';
  }
}

async function analyzeCsvText(csvText) {
  const labelColumn = document.getElementById('labelColumn').value;
  try {
    const result = await fetchJson('/api/csv-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvText, labelColumn, runId: currentRunId })
    });
    renderCsvResult(result);
    if (currentRunId) await refreshHistory();
  } catch (e) {
    alert('Failed to analyze CSV: ' + e.message);
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function analyzeCsvHandler() {
  const fileInput = document.getElementById('csvFile');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Choose a CSV file first, or click "Use sample CSV".');
    return;
  }
  const text = await readFileAsText(fileInput.files[0]);
  await analyzeCsvText(text);
}

async function useSampleCsv() {
  const res = await fetch('/fixtures/sample-transactions.csv');
  const text = await res.text();
  await analyzeCsvText(text);
}

document.getElementById('generateBtn').addEventListener('click', generateChecklistHandler);
document.getElementById('analyzeCsvBtn').addEventListener('click', analyzeCsvHandler);
document.getElementById('sampleCsvBtn').addEventListener('click', useSampleCsv);

loadMeta().then(refreshHistory).catch((e) => console.error('Init failed', e));