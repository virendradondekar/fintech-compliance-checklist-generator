import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAI } from './ai-provider.js';
import { load, save } from './store.js';
import { generateChecklist, buildNarrative, REGIONS, USE_CASES, DATA_TYPES } from './checklist-rules.js';
import { analyzeCsv } from './csv-analysis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const ai = createAI({ rules: buildNarrative });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.csv': 'text/csv'
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function serveFile(baseDir, urlPath, res) {
  let rel = urlPath === '/' || urlPath === '' ? '/index.html' : urlPath;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(baseDir, rel);
  if (!full.startsWith(baseDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(full);
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

async function getDb() {
  const db = await load();
  if (!db || typeof db !== 'object') return { runs: [] };
  if (!Array.isArray(db.runs)) db.runs = [];
  return db;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/meta' && req.method === 'GET') {
      return sendJson(res, 200, { regions: REGIONS, useCases: USE_CASES, dataTypes: DATA_TYPES });
    }

    if (pathname === '/api/checklist' && req.method === 'POST') {
      const body = await readBody(req);
      const companyName = typeof body.companyName === 'string' ? body.companyName.slice(0, 200) : '';
      const useCase = USE_CASES.some((u) => u.id === body.useCase) ? body.useCase : 'other';
      const region = REGIONS.some((r) => r.id === body.region) ? body.region : 'other';
      let dataTypes = Array.isArray(body.dataTypes)
        ? body.dataTypes.filter((d) => DATA_TYPES.some((dt) => dt.id === d))
        : [];
      if (dataTypes.length === 0) dataTypes = ['transactional'];

      const checklist = generateChecklist({ useCase, dataTypes, region });
      const narrativeInput = { companyName, useCase, dataTypes, region, categories: checklist.categories, summary: checklist.summary };

      let aiResult;
      try {
        aiResult = await ai.ask({
          system: 'You are a concise fintech compliance assistant. Summarize the checklist in 3-4 sentences, highlighting the highest priority risk areas. Do not invent regulations beyond what is listed.',
          prompt: 'Summarize this fintech compliance checklist for a founder.',
          input: narrativeInput
        });
      } catch {
        aiResult = { text: buildNarrative(narrativeInput), provider: 'rules' };
      }

      const db = await getDb();
      const id = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const record = {
        id,
        companyName,
        useCase,
        region,
        dataTypes,
        createdAt: new Date().toISOString(),
        checklist,
        narrative: aiResult.text,
        provider: aiResult.provider,
        csvAnalysis: null
      };
      db.runs.unshift(record);
      await save(db);

      return sendJson(res, 200, record);
    }

    if (pathname === '/api/history' && req.method === 'GET') {
      const db = await getDb();
      const runs = db.runs.map((r) => ({
        id: r.id,
        companyName: r.companyName,
        useCase: r.useCase,
        region: r.region,
        dataTypes: r.dataTypes,
        createdAt: r.createdAt,
        totalItems: r.checklist?.summary?.totalItems,
        highSeverityCount: r.checklist?.summary?.highSeverityCount,
        hasCsv: !!r.csvAnalysis
      }));
      return sendJson(res, 200, { runs });
    }

    const runMatch = pathname.match(/^\/api\/checklist\/([a-zA-Z0-9-]+)$/);
    if (runMatch && req.method === 'GET') {
      const db = await getDb();
      const record = db.runs.find((r) => r.id === runMatch[1]);
      if (!record) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, record);
    }

    if (pathname === '/api/csv-check' && req.method === 'POST') {
      const body = await readBody(req);
      const csvText = typeof body.csvText === 'string' ? body.csvText : '';
      if (!csvText.trim()) return sendJson(res, 400, { error: 'csvText is required' });
      const labelColumn = typeof body.labelColumn === 'string' && body.labelColumn.trim() ? body.labelColumn.trim() : undefined;
      const result = analyzeCsv(csvText, labelColumn);

      if (body.runId && typeof body.runId === 'string') {
        const db = await getDb();
        const idx = db.runs.findIndex((r) => r.id === body.runId);
        if (idx !== -1) {
          db.runs[idx].csvAnalysis = result;
          await save(db);
        }
      }

      return sendJson(res, 200, result);
    }

    if (pathname.startsWith('/fixtures/') && req.method === 'GET') {
      return serveFile(FIXTURES_DIR, pathname.replace('/fixtures', ''), res);
    }

    if (req.method === 'GET') {
      return await serveFile(PUBLIC_DIR, pathname, res);
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});