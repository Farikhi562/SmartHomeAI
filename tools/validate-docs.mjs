#!/usr/bin/env node
/**
 * SmartHomeAI — documentation validator (T-002 evidence tool).
 * Checks, with zero dependencies:
 *   1. Required files exist.
 *   2. Every relative Markdown link resolves to a real file.
 *   3. Mermaid fences declare a known diagram type and have balanced brackets.
 *   4. FR registry: every FR in FUNCTIONAL_REQUIREMENTS appears in the traceability
 *      matrix and vice versa; every P0 FR has at least one test ID.
 *   5. Every AC ID referenced in FUNCTIONAL_REQUIREMENTS is defined in
 *      ACCEPTANCE_CRITERIA.md.
 *   6. Every US ID referenced in the traceability matrix is defined in USER_STORIES.md.
 * Usage: node tools/validate-docs.mjs  (exit 0 = pass, 1 = failures)
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const failures = [];
const warnings = [];
let filesChecked = 0;
let linksChecked = 0;
let mermaidBlocks = 0;

/** Recursively collect .md files. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

// ── 1. Required files ────────────────────────────────────────────────────────
const required = [
  "README.md", "CONTRIBUTING.md", "CHANGELOG.md", ".env.example", ".gitignore",
  "prisma/schema.prisma",
  "docs/index.md",
  "docs/product/PRD.md", "docs/product/PRODUCT_VISION.md", "docs/product/PERSONAS.md",
  "docs/product/USER_STORIES.md", "docs/product/USE_CASES.md", "docs/product/ROADMAP.md",
  "docs/requirements/FUNCTIONAL_REQUIREMENTS.md", "docs/requirements/NON_FUNCTIONAL_REQUIREMENTS.md",
  "docs/requirements/ACCEPTANCE_CRITERIA.md", "docs/requirements/BUSINESS_RULES.md",
  "docs/requirements/GLOSSARY.md",
  "docs/design/DESIGN_SPEC.md", "docs/design/DESIGN_SYSTEM.md",
  "docs/design/INFORMATION_ARCHITECTURE.md", "docs/design/USER_FLOWS.md",
  "docs/design/WIREFRAMES.md", "docs/design/ACCESSIBILITY.md",
  "docs/architecture/SYSTEM_ARCHITECTURE.md", "docs/architecture/DATABASE_SCHEMA.md",
  "docs/architecture/API_SPEC.md", "docs/architecture/AI_ARCHITECTURE.md",
  "docs/architecture/AWS_ARCHITECTURE.md", "docs/architecture/SECURITY.md",
  "docs/architecture/OBSERVABILITY.md", "docs/architecture/DEPLOYMENT.md",
  "docs/architecture/DISASTER_RECOVERY.md",
  "docs/architecture/adr/ADR-001-application-architecture.md",
  "docs/architecture/adr/ADR-002-database.md",
  "docs/architecture/adr/ADR-003-llm-provider.md",
  "docs/architecture/adr/ADR-004-deployment.md",
  "docs/agents/AGENT_SPEC.md", "docs/agents/ORCHESTRATOR_AGENT.md", "docs/agents/PRODUCT_AGENT.md",
  "docs/agents/DESIGN_AGENT.md", "docs/agents/FRONTEND_AGENT.md", "docs/agents/BACKEND_AGENT.md",
  "docs/agents/AI_AGENT.md", "docs/agents/AWS_INFRA_AGENT.md", "docs/agents/QA_AGENT.md",
  "docs/agents/SECURITY_REVIEW_AGENT.md", "docs/agents/REVIEW_AGENT.md",
  "docs/agents/AGENT_WORKFLOW.md", "docs/agents/CODING_STANDARDS.md",
  "docs/planning/IMPLEMENTATION_PLAN.md", "docs/planning/TASK_BREAKDOWN.md",
  "docs/planning/TRACEABILITY_MATRIX.md", "docs/planning/MILESTONES.md",
  "docs/planning/RISKS.md", "docs/planning/COST_ESTIMATION.md",
  "docs/planning/TEST_PLAN.md", "docs/planning/DEFINITION_OF_DONE.md",
  "docs/prompts/SYSTEM_PROMPT.md", "docs/prompts/INTENT_CLASSIFICATION.md",
  "docs/prompts/MEMORY_EXTRACTION.md", "docs/prompts/ANSWER_GENERATION.md",
  "docs/prompts/EVALUATION_CASES.md",
];
for (const f of required) {
  if (!existsSync(join(ROOT, f))) failures.push(`missing required file: ${f}`);
}

const mdFiles = walk(join(ROOT, "docs")).concat(
  ["README.md", "CONTRIBUTING.md", "CHANGELOG.md"].map((f) => join(ROOT, f)).filter(existsSync)
);
filesChecked = mdFiles.length;

const DIAGRAM_TYPES =
  /^(flowchart|sequenceDiagram|erDiagram|classDiagram|stateDiagram|stateDiagram-v2|gantt|pie|journey|mindmap|timeline|gitGraph|quadrantChart|block-beta|sankey-beta|xychart-beta|C4Context|C4Container)\b/;

for (const file of mdFiles) {
  const rel = file.slice(ROOT.length + 1).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");

  // ── 2. Relative links ────────────────────────────────────────────────────
  const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const m of text.matchAll(linkRe)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    linksChecked++;
    const clean = decodeURIComponent(target.split("#")[0]);
    const resolved = resolve(dirname(file), clean);
    if (!existsSync(resolved)) failures.push(`${rel}: broken link -> ${target}`);
    else if (statSync(resolved).isDirectory() && !existsSync(join(resolved, "index.md")))
      warnings.push(`${rel}: directory link without index.md -> ${target}`);
  }

  // ── 3. Mermaid blocks ────────────────────────────────────────────────────
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^```mermaid\s*$/.test(lines[i])) continue;
    mermaidBlocks++;
    const start = i + 1;
    let end = lines.findIndex((l, j) => j >= start && /^```\s*$/.test(l));
    if (end === -1) { failures.push(`${rel}:${start}: unterminated mermaid fence`); break; }
    const body = lines.slice(start, end).join("\n");
    if (!DIAGRAM_TYPES.test(body.trim()))
      failures.push(`${rel}:${start}: mermaid block missing known diagram type`);
    // erDiagram uses crow's-foot glyphs `o{` `}o` as notation — brace balance is a
    // false positive there, so only parentheses/brackets are checked for ERDs.
    const pairs = body.trimStart().startsWith("erDiagram")
      ? [["(", ")"], ["[", "]"]]
      : [["(", ")"], ["[", "]"], ["{", "}"]];
    for (const [open, close] of pairs) {
      const o = body.split(open).length - 1, c = body.split(close).length - 1;
      if (o !== c) warnings.push(`${rel}:${start}: mermaid unbalanced '${open}${close}' (${o}/${c}) — verify manually`);
    }
    i = end;
  }
}

// ── 4. FR registry ↔ traceability matrix ─────────────────────────────────────
const frDoc = readFileSync(join(ROOT, "docs/requirements/FUNCTIONAL_REQUIREMENTS.md"), "utf8");
const matrix = readFileSync(join(ROOT, "docs/planning/TRACEABILITY_MATRIX.md"), "utf8");
const acDoc = readFileSync(join(ROOT, "docs/requirements/ACCEPTANCE_CRITERIA.md"), "utf8");
const usDoc = readFileSync(join(ROOT, "docs/product/USER_STORIES.md"), "utf8");

const frs = new Map(); // id -> priority
for (const block of frDoc.split(/^### /m).slice(1)) {
  const id = block.match(/^(FR-\d{3})/)?.[1];
  if (!id) continue;
  const prio = block.match(/\| Priority \| (P\d) \|/)?.[1] ?? "?";
  frs.set(id, prio);
}
// P2 FRs live in a summary table rather than headings — count them as defined.
for (const m of frDoc.matchAll(/^\| (FR-\d{3}) \|[^|\n]+\|[^|\n]+\|\s*$/gm)) {
  if (!frs.has(m[1])) frs.set(m[1], "P2");
}
if (frs.size === 0) failures.push("FUNCTIONAL_REQUIREMENTS: no FR headings parsed");

for (const id of frs.keys()) {
  if (!matrix.includes(id)) failures.push(`traceability matrix missing ${id}`);
}
const matrixFrIds = new Set(matrix.match(/FR-\d{3}/g) ?? []);
for (const id of matrixFrIds) {
  if (!frs.has(id)) failures.push(`traceability matrix references unknown ${id}`);
}
// P0 FRs need a test reference in the FR doc and in the matrix row
for (const [id, prio] of frs) {
  if (prio !== "P0") continue;
  const frSection = frDoc.split(/^### /m).find((b) => b.startsWith(id)) ?? "";
  if (!/Test coverage:|Tests\b|AIE-|IT-|UT-|E2E-/.test(frSection))
    warnings.push(`${id}: no test-ID reference found in FR section`);
  const row = matrix.split("\n").find((l) => l.startsWith(`| ${id} `)) ?? "";
  if (row && !/(UT-|IT-|E2E-|AIE-)/.test(row))
    failures.push(`traceability matrix: P0 row for ${id} has no test IDs`);
}

// ── 5. AC IDs referenced vs defined ─────────────────────────────────────────
const referencedAc = new Set(frDoc.match(/AC-\d{3}-\d+/g) ?? []);
for (const ac of referencedAc) {
  if (!acDoc.includes(ac)) failures.push(`ACCEPTANCE_CRITERIA.md missing referenced ${ac}`);
}
const definedAc = new Set(acDoc.match(/AC-\d{3}-\d+/g) ?? []);
for (const ac of definedAc) {
  if (!referencedAc.has(ac)) warnings.push(`ACCEPTANCE_CRITERIA.md defines ${ac} not referenced by any FR`);
}

// ── 6. US IDs in matrix vs USER_STORIES ─────────────────────────────────────
const matrixUs = new Set(matrix.match(/\bUS-\d{3}\b/g) ?? []);
for (const us of matrixUs) {
  if (!usDoc.includes(`### ${us}`) && !usDoc.includes(`**${us}**`) && !usDoc.includes(`| ${us} `))
    failures.push(`USER_STORIES.md missing ${us} used in traceability matrix`);
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`files checked: ${filesChecked} | relative links checked: ${linksChecked} | mermaid blocks: ${mermaidBlocks}`);
console.log(`FRs parsed: ${frs.size} (P0: ${[...frs.values()].filter((p) => p === "P0").length}) | AC referenced: ${referencedAc.size} | US referenced: ${matrixUs.size}`);
for (const w of warnings) console.warn(`WARN  ${w}`);
if (failures.length) {
  for (const f of failures) console.error(`FAIL  ${f}`);
  console.error(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log("ALL CHECKS PASSED" + (warnings.length ? ` (${warnings.length} warning(s))` : ""));
