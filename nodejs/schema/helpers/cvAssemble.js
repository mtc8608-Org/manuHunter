// cvAssemble — the single source of truth for CV LaTeX output.
// Walks a cvDocument tree and emits one complete .tex string:
//   preamble (from the template) + identity \newcommand block + doc open +
//   header + each section rendered by type + doc close.
// Field content is raw LaTeX by design (admin authored) — never escaped.
// Each node type has a small pure emitter so the same output powers the manual
// preview, the AI preview, and the compile route.
const { pool } = require('../../db');

// ── Low-level tree access ──────────────────────────────────────────────────────
const loadNode = async (id) => {
  const res = await pool.query('SELECT * FROM cv_components WHERE id = $1::uuid', [id]);
  return res.rows[0] ?? null;
};

const loadChildren = async (id) => {
  const res = await pool.query(
    `SELECT c.* FROM cv_components_relationships cr
     JOIN cv_components c ON cr.child_id = c.id
     WHERE cr.parent_id = $1::uuid ORDER BY cr.position ASC`,
    [id]
  );
  return res.rows;
};

// The per-user identity block, shared across all of that user's CVs.
const loadProfile = async (ownerId) => {
  if (!ownerId) return {};
  const res = await pool.query('SELECT data FROM user_profile WHERE owner_id = $1::uuid', [ownerId]);
  return res.rows[0]?.data ?? {};
};

// ── Identity block (profile fields + the per-CV tagline) ───────────────────────
const renderIdentity = (d = {}) => [
  `\\newcommand{\\name}{${d.name ?? ''}}`,
  `\\newcommand{\\phone}{${d.phone ?? ''}}`,
  `\\newcommand{\\emaila}{${d.email ?? ''}}`,
  `\\newcommand{\\tagline}{${d.tagline ?? ''}}`,
  `\\newcommand{\\locationx}{${d.location ?? ''}}`,
  `\\newcommand{\\linkedinurl}{${d.linkedin_url ?? ''}}`,
  `\\newcommand{\\linkedinlabel}{${d.linkedin_label ?? ''}}`,
  `\\newcommand{\\githuburl}{${d.github_url ?? ''}}`,
  `\\newcommand{\\githublabel}{${d.github_label ?? ''}}`,
].join('\n');

// ── Per-node-type emitters ─────────────────────────────────────────────────────
const renderTextRow = (d = {}) => {
  const label = d.label ? `\\textbf{${d.label}:} ` : '';
  return `${label}${d.text ?? ''}`;
};

const renderEntry = (d = {}) => {
  const raw = Array.isArray(d.bullets) ? d.bullets : (d.bullets ? [d.bullets] : []);
  const bullets = raw.map(b => (b ?? '').toString().trim()).filter(Boolean);
  const macro = d.kind === 'project' ? 'resumeProject' : 'resumeSubheading';
  const head = `\\${macro}\n{${d.title ?? ''}}{${d.location ?? ''}}\n{${d.org ?? ''}}{${d.dates ?? ''}}`;
  if (!bullets.length) return head;
  const items = bullets.map(b => `\\item {${b}}`).join('\n');
  return `${head}\n\\resumeItemListStart\n${items}\n\\resumeItemListEnd`;
};

const renderPublication = (d = {}) => {
  if (d.raw) return `\\item ${d.raw}`;
  const authors = d.authors ? `\\textbf{${d.authors}} ` : '';
  const title   = d.title   ? `\\textit{${d.title}} ` : '';
  const tail    = [d.venue, d.year].filter(Boolean).join(', ');
  return `\\item ${authors}${title}${tail}${tail ? '.' : ''}`;
};

// ── Section rendering (layout inferred from child type, or data.layout) ────────
const inferLayout = (children) => {
  if (!children.length) return 'text';
  const t = children[0].type;
  if (t === 'cvTextRow')     return 'textrows';
  if (t === 'cvEntry')       return 'entries';
  if (t === 'cvPublication') return 'publications';
  return 'text';
};

const renderSection = async (section) => {
  const d = section.data ?? {};
  const children = await loadChildren(section.id);
  const layout = d.layout || inferLayout(children);
  const heading = `\\section{\\textbf{${d.title ?? ''}}}`;

  if (layout === 'text') {
    return `${heading}\n\\small{\n${d.body ?? ''}\n}\n\\vspace{-6pt}`;
  }

  if (layout === 'textrows') {
    const rows = children.map(c => renderTextRow(c.data)).join(' \\\\[2pt]\n');
    return `${heading}\n\\small{\n${rows}\n}\n\\vspace{-2pt}`;
  }

  if (layout === 'entries') {
    const entries = children.map(c => renderEntry(c.data)).join('\n\n\\vspace{-2mm}\n\n');
    return `${heading}\n\\resumeSubHeadingListStart\n\n${entries}\n\n\\resumeSubHeadingListEnd\n\\vspace{-5mm}`;
  }

  if (layout === 'publications') {
    const intro = d.body ? `\\small{\n${d.body}\n}\n\\vspace{2pt}\n` : '';
    const items = children.map(c => renderPublication(c.data)).join('\n');
    return `${heading}\n${intro}\\resumeSubHeadingListStart\n\\item[] \\footnotesize\n` +
      `\\begin{enumerate}[leftmargin=4ex, rightmargin=1ex, noitemsep, label=\\arabic*.]\n` +
      `${items}\n\\end{enumerate}\n\\resumeSubHeadingListEnd\n\\vspace{-6mm}`;
  }

  return heading;
};

// ── Public entry point ─────────────────────────────────────────────────────────
const assembleCvLatex = async (cvDocumentId) => {
  const doc = await loadNode(cvDocumentId);
  if (!doc) throw new Error('CV document not found');
  const d = doc.data ?? {};

  // Identity comes from the owner's profile; only the tagline is per-CV.
  const profile  = await loadProfile(doc.owner_id);
  const identity = { ...profile, tagline: d.tagline ?? '' };

  const template = d.template_id ? await loadNode(d.template_id) : null;
  const t = template?.data ?? {};
  const preamble = t.preamble ?? '';
  const header   = t.header ?? '';
  const docOpen  = t.docOpen ?? '\\begin{document}';
  const docClose = t.docClose ?? '\\end{document}';

  const sections = await loadChildren(cvDocumentId);
  const rendered = [];
  for (const s of sections) {
    if (s.type === 'cvSection') rendered.push(await renderSection(s));
  }

  return [
    preamble,
    renderIdentity(identity),
    docOpen,
    header,
    rendered.join('\n\n'),
    docClose,
  ].join('\n\n');
};

module.exports = {
  assembleCvLatex,
  // exported for reuse/testing
  renderIdentity, renderTextRow, renderEntry, renderPublication, renderSection,
};
