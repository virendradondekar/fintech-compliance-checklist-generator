// Pure, deterministic rules engine for generating compliance checklists.
// No I/O, no external calls — safe to unit test directly.

export const REGIONS = [
  { id: 'india', name: 'India' },
  { id: 'nigeria', name: 'Nigeria' },
  { id: 'kenya', name: 'Kenya' },
  { id: 'indonesia', name: 'Indonesia' },
  { id: 'brazil', name: 'Brazil' },
  { id: 'philippines', name: 'Philippines' },
  { id: 'other', name: 'Other / Generic' }
];

export const USE_CASES = [
  { id: 'fraud_detection', name: 'Fraud Detection' },
  { id: 'credit_scoring', name: 'Credit Scoring / Underwriting' },
  { id: 'aml_kyc', name: 'AML / KYC Screening' },
  { id: 'other', name: 'Other AI/ML System' }
];

export const DATA_TYPES = [
  { id: 'transactional', name: 'Transactional Data' },
  { id: 'identity_pii', name: 'Identity / PII' },
  { id: 'biometric', name: 'Biometric Data' },
  { id: 'alternative_data', name: 'Alternative Data (social, telco, device)' },
  { id: 'behavioral', name: 'Behavioral / Clickstream Data' },
  { id: 'financial_statements', name: 'Financial Statements / Bureau Data' }
];

const CATEGORY_LABELS = {
  data_privacy: 'Data Privacy & Consent',
  model_governance: 'Model Governance & Documentation',
  explainability: 'Explainability & Adverse Action',
  bias_fairness: 'Bias & Fairness Testing',
  security: 'Data Security & Access Control',
  regulatory_reporting: 'Regulatory Reporting & Audit Trail',
  vendor_risk: 'Third-Party & Vendor Risk',
  consumer_redress: 'Consumer Redress & Complaint Handling'
};

const BASE_ITEMS = {
  data_privacy: [
    { id: 'dp1', text: 'Document the legal basis / consent mechanism for collecting each data type used by the model.', severity: 'high' },
    { id: 'dp2', text: 'Define a data retention and deletion schedule for training and inference data.', severity: 'medium' },
    { id: 'dp3', text: 'Confirm a data subject rights process (access, correction, deletion requests) is operational.', severity: 'high' }
  ],
  model_governance: [
    { id: 'mg1', text: 'Maintain a model card documenting purpose, training data, performance metrics, and known limitations.', severity: 'medium' },
    { id: 'mg2', text: 'Assign a named model owner accountable for monitoring and sign-off before deployment.', severity: 'high' },
    { id: 'mg3', text: 'Define a model retraining / revalidation cadence and trigger conditions.', severity: 'medium' }
  ],
  explainability: [
    { id: 'ex1', text: 'Verify the model can produce a reason code / explanation for each automated decision.', severity: 'high' },
    { id: 'ex2', text: 'Establish a human-review escalation path for disputed or high-impact decisions.', severity: 'medium' }
  ],
  bias_fairness: [
    { id: 'bf1', text: 'Test model outputs for disparate impact across protected or proxy attributes (e.g. gender, region, age).', severity: 'high' },
    { id: 'bf2', text: 'Document class balance and representativeness of training data (see CSV check below).', severity: 'high' }
  ],
  security: [
    { id: 'sec1', text: 'Encrypt data at rest and in transit for all model inputs/outputs.', severity: 'high' },
    { id: 'sec2', text: 'Restrict model and training-data access to authorized roles with audit logging.', severity: 'medium' },
    { id: 'sec3', text: 'Pen-test or review the inference API for injection/abuse vectors before go-live.', severity: 'medium' }
  ],
  regulatory_reporting: [
    { id: 'rr1', text: 'Identify which regulator(s) require notification or filing before deploying automated credit/fraud decisioning.', severity: 'high' },
    { id: 'rr2', text: 'Maintain an audit trail of model versions and decisions for the regulator-mandated retention period.', severity: 'medium' }
  ],
  vendor_risk: [
    { id: 'vr1', text: 'If using third-party data or model vendors, confirm their compliance certifications and data-sharing agreements.', severity: 'medium' }
  ],
  consumer_redress: [
    { id: 'cr1', text: 'Provide a clear complaint/appeal channel for users affected by automated decisions.', severity: 'high' },
    { id: 'cr2', text: 'Define an SLA for responding to disputed automated decisions.', severity: 'medium' }
  ]
};

const USE_CASE_EXTRA = {
  fraud_detection: {
    explainability: [{ id: 'uc-fd1', text: 'Ensure false-positive fraud flags can be manually overridden without freezing legitimate funds indefinitely.', severity: 'high' }],
    regulatory_reporting: [{ id: 'uc-fd2', text: 'Confirm suspicious activity reporting (SAR/STR equivalent) workflow is linked to model flags.', severity: 'high' }]
  },
  credit_scoring: {
    explainability: [{ id: 'uc-cs1', text: 'Generate an adverse action notice with specific reason codes for every credit decline, per local lending regulation.', severity: 'high' }],
    bias_fairness: [{ id: 'uc-cs2', text: 'Run disparate-impact testing specifically on credit approval/decline rates across demographic segments.', severity: 'high' }]
  },
  aml_kyc: {
    regulatory_reporting: [{ id: 'uc-aml1', text: 'Confirm model-generated AML alerts feed into a documented investigation and filing workflow.', severity: 'high' }],
    data_privacy: [{ id: 'uc-aml2', text: 'Verify KYC document storage meets regional identity-data handling rules.', severity: 'medium' }]
  },
  other: {}
};

const DATA_TYPE_EXTRA = {
  transactional: {
    security: [{ id: 'dt-tx1', text: 'Mask or tokenize account/card numbers in logs and model features.', severity: 'medium' }]
  },
  identity_pii: {
    data_privacy: [{ id: 'dt-pii1', text: 'Apply data minimization: only collect PII fields the model demonstrably needs.', severity: 'high' }]
  },
  biometric: {
    data_privacy: [{ id: 'dt-bio1', text: 'Obtain explicit, separate consent for biometric data collection (often a distinct legal category).', severity: 'high' }],
    security: [{ id: 'dt-bio2', text: 'Store biometric templates encrypted and segregated from other identity data.', severity: 'high' }]
  },
  alternative_data: {
    bias_fairness: [{ id: 'dt-alt1', text: 'Scrutinize alternative data sources (social/telco) for proxy discrimination against protected groups.', severity: 'high' }],
    data_privacy: [{ id: 'dt-alt2', text: 'Confirm consent covers secondary use of telco/social data for credit or fraud scoring.', severity: 'high' }]
  },
  behavioral: {
    data_privacy: [{ id: 'dt-beh1', text: 'Disclose behavioral/clickstream tracking in the privacy notice with opt-out where required.', severity: 'medium' }]
  },
  financial_statements: {
    vendor_risk: [{ id: 'dt-fin1', text: 'Validate bureau/financial-statement data licensing terms permit automated decisioning use.', severity: 'medium' }]
  }
};

const REGION_EXTRA = {
  india: {
    regulatory_reporting: [{ id: 'r-in1', text: 'Confirm RBI guidelines on algorithmic/digital lending (Fair Practices Code) are addressed.', severity: 'high' }],
    data_privacy: [{ id: 'r-in2', text: 'Align data handling with the Digital Personal Data Protection Act (DPDP) 2023 — consent, purpose limitation, breach notification.', severity: 'high' }]
  },
  nigeria: {
    regulatory_reporting: [{ id: 'r-ng1', text: 'Check CBN guidelines for AI-driven credit/fraud systems in regulated financial institutions.', severity: 'high' }],
    data_privacy: [{ id: 'r-ng2', text: 'Align with the Nigeria Data Protection Act (NDPA 2023) requirements for lawful processing and DPO registration.', severity: 'high' }]
  },
  kenya: {
    regulatory_reporting: [{ id: 'r-ke1', text: 'Review CBK digital credit provider guidelines and Central Bank registration requirements.', severity: 'high' }],
    data_privacy: [{ id: 'r-ke2', text: 'Align with the Kenya Data Protection Act 2019 — registration with ODPC and consent standards.', severity: 'high' }]
  },
  indonesia: {
    regulatory_reporting: [{ id: 'r-id1', text: 'Confirm OJK (Financial Services Authority) fintech lending/credit-scoring regulations are satisfied.', severity: 'high' }],
    data_privacy: [{ id: 'r-id2', text: 'Align with the Indonesia Personal Data Protection Law (UU PDP) for cross-border and consent rules.', severity: 'high' }]
  },
  brazil: {
    regulatory_reporting: [{ id: 'r-br1', text: 'Confirm BACEN (Central Bank of Brazil) rules for automated credit decisioning are satisfied.', severity: 'high' }],
    data_privacy: [{ id: 'r-br2', text: 'Align with LGPD — legal basis, data subject rights, and ANPD breach notification timelines.', severity: 'high' }]
  },
  philippines: {
    regulatory_reporting: [{ id: 'r-ph1', text: 'Confirm BSP guidelines on digital lending and alternative-data credit scoring are satisfied.', severity: 'high' }],
    data_privacy: [{ id: 'r-ph2', text: 'Align with the Philippines Data Privacy Act 2012 — NPC registration and consent requirements.', severity: 'high' }]
  },
  other: {
    regulatory_reporting: [{ id: 'r-ot1', text: 'Identify the primary financial regulator in your operating market and confirm AI/credit-decisioning guidance.', severity: 'medium' }],
    data_privacy: [{ id: 'r-ot2', text: 'Apply a GDPR-equivalent baseline: lawful basis, data minimization, breach notification, subject rights.', severity: 'medium' }]
  }
};

function addExtra(categories, extraObj) {
  for (const [cat, items] of Object.entries(extraObj || {})) {
    if (!categories[cat]) categories[cat] = [];
    for (const item of items) {
      if (!categories[cat].some((i) => i.id === item.id)) categories[cat].push(item);
    }
  }
}

export function generateChecklist({ useCase, dataTypes, region }) {
  const categories = {};
  for (const [cat, items] of Object.entries(BASE_ITEMS)) {
    categories[cat] = [...items];
  }

  addExtra(categories, USE_CASE_EXTRA[useCase]);
  for (const dt of dataTypes || []) addExtra(categories, DATA_TYPE_EXTRA[dt]);
  addExtra(categories, REGION_EXTRA[region]);

  const categoryList = Object.entries(categories)
    .map(([id, items]) => ({ id, label: CATEGORY_LABELS[id] || id, items }))
    .filter((c) => c.items.length > 0);

  let totalItems = 0;
  let highSeverityCount = 0;
  for (const c of categoryList) {
    totalItems += c.items.length;
    highSeverityCount += c.items.filter((i) => i.severity === 'high').length;
  }

  return {
    categories: categoryList,
    summary: { totalItems, highSeverityCount, categoryCount: categoryList.length }
  };
}

// Deterministic narrative builder — used as the "rules" fallback for ai-provider.js
export function buildNarrative(input) {
  const { companyName, useCase, dataTypes, region, categories, summary } = input || {};
  const useCaseName = USE_CASES.find((u) => u.id === useCase)?.name || useCase || 'AI/ML';
  const regionName = REGIONS.find((r) => r.id === region)?.name || region || 'the target market';
  const dataTypeNames = (dataTypes || []).map((d) => DATA_TYPES.find((dt) => dt.id === d)?.name || d).join(', ');
  const who = companyName && companyName.trim() ? companyName.trim() : 'This system';

  const topCats = (categories || [])
    .map((c) => ({ label: c.label, high: c.items.filter((i) => i.severity === 'high').length }))
    .filter((c) => c.high > 0)
    .sort((a, b) => b.high - a.high)
    .slice(0, 3)
    .map((c) => c.label);

  let text = `${who} is a ${useCaseName} system processing ${dataTypeNames || 'financial'} data targeting the ${regionName} market. `;
  text += `The generated checklist contains ${summary?.totalItems ?? 0} items across ${summary?.categoryCount ?? 0} categories, including ${summary?.highSeverityCount ?? 0} high-priority items that should be resolved before launch. `;
  if (topCats.length) {
    text += `Prioritize these areas first: ${topCats.join('; ')}. `;
  }
  text += `Review each item with legal/compliance counsel familiar with ${regionName} financial regulation before deployment.`;
  return text;
}