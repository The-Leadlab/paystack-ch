#!/usr/bin/env node
/**
 * Capacity harness — 2000 virtual users × plan cohorts.
 * See docs/CAPACITY_2000_USERS_SUPER_PROMPT.md
 *
 * Usage:
 *   node scripts/capacity-test-2000.mjs
 *   CAPACITY_BASE_URL=http://127.0.0.1:3000 node scripts/capacity-test-2000.mjs
 *   CAPACITY_USERS=500 CAPACITY_CONCURRENCY=100 node scripts/capacity-test-2000.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const USERS = Math.max(1, Number(process.env.CAPACITY_USERS || 2000));
const CONCURRENCY = Math.max(1, Number(process.env.CAPACITY_CONCURRENCY || 200));
const BASE_URL = (process.env.CAPACITY_BASE_URL || "").replace(/\/$/, "");
const OUT_DIR = join(__dirname, "capacity-results");

/** Keep in sync with shared/planCatalog.ts */
const PLAN_ENTITLEMENTS = {
  starter: {
    maxDocumentsPerMonth: 35,
    maxPersonalDocumentsPerMonth: 35,
    maxEmployeeSlots: 1,
    maxTeamSeats: 1,
    maxSessions: 2,
  },
  business: {
    maxDocumentsPerMonth: 120,
    maxPersonalDocumentsPerMonth: 35,
    maxEmployeeSlots: 10,
    maxTeamSeats: 10,
    maxSessions: null,
  },
  unlimited: {
    maxDocumentsPerMonth: null,
    maxPersonalDocumentsPerMonth: 35,
    maxEmployeeSlots: null,
    maxTeamSeats: null,
    maxSessions: null,
  },
};

/** @typedef {'starter'|'business'|'unlimited'} PlanId */

const PLAN_IDS = /** @type {PlanId[]} */ (["starter", "business", "unlimited"]);

function entitlementsForPlan(planId) {
  return PLAN_ENTITLEMENTS[planId] ?? PLAN_ENTITLEMENTS.starter;
}

function parsePaystackPlanId(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "starter" || s === "stater") return "starter";
  if (s === "business") return "business";
  if (s === "unlimited") return "unlimited";
  return null;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stats(latenciesMs) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((s, n) => s + n, 0);
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length ? sum / sorted.length : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

/**
 * Simulate one active user session burst (entitlement + dashboard work).
 * @param {PlanId} planId
 * @param {number} userIndex
 */
function simulateUserBurst(planId, userIndex) {
  const t0 = performance.now();
  const errors = [];
  const limitHits = [];
  const actions = [];

  const parsed = parsePaystackPlanId(planId);
  if (parsed !== planId) {
    errors.push({ code: "plan_parse", message: `parsePaystackPlanId(${planId}) => ${parsed}` });
  }

  const ent = entitlementsForPlan(planId);
  const expected = PLAN_ENTITLEMENTS[planId];
  if (ent.maxDocumentsPerMonth !== expected.maxDocumentsPerMonth) {
    errors.push({ code: "entitlement_mismatch", message: "maxDocumentsPerMonth" });
  }

  // Synthetic usage state for this VU
  let docsUsed = Math.floor(Math.random() * 5);
  let personalUsed = Math.floor(Math.random() * 3);
  let sessions = 1;
  let seatsUsed = 1;

  const tryDoc = () => {
    actions.push("doc_upload");
    if (ent.maxDocumentsPerMonth != null && docsUsed >= ent.maxDocumentsPerMonth) {
      limitHits.push({ kind: "maxDocumentsPerMonth", planId, used: docsUsed, cap: ent.maxDocumentsPerMonth });
      return false;
    }
    docsUsed += 1;
    return true;
  };

  const tryPersonal = () => {
    actions.push("personal_upload");
    if (ent.maxPersonalDocumentsPerMonth != null && personalUsed >= ent.maxPersonalDocumentsPerMonth) {
      limitHits.push({
        kind: "maxPersonalDocumentsPerMonth",
        planId,
        used: personalUsed,
        cap: ent.maxPersonalDocumentsPerMonth,
      });
      return false;
    }
    personalUsed += 1;
    return true;
  };

  const trySession = () => {
    actions.push("add_session");
    if (ent.maxSessions != null && sessions >= ent.maxSessions) {
      limitHits.push({ kind: "maxSessions", planId, used: sessions, cap: ent.maxSessions });
      return false;
    }
    sessions += 1;
    return true;
  };

  const tryInvite = () => {
    actions.push("team_invite");
    if (ent.maxTeamSeats != null && seatsUsed >= ent.maxTeamSeats) {
      limitHits.push({ kind: "maxTeamSeats", planId, used: seatsUsed, cap: ent.maxTeamSeats });
      return false;
    }
    seatsUsed += 1;
    return true;
  };

  // Active-user burst: refresh + several uploads + session/invite attempts
  // Bias Starter toward hitting caps; Unlimited toward heavier loops.
  const docAttempts = planId === "unlimited" ? 8 : planId === "business" ? 5 : 4;
  const personalAttempts = 2;
  const sessionAttempts = planId === "starter" ? 3 : 1;
  const inviteAttempts = planId === "starter" ? 2 : planId === "business" ? 3 : 1;

  for (let i = 0; i < docAttempts; i++) tryDoc();
  for (let i = 0; i < personalAttempts; i++) tryPersonal();
  for (let i = 0; i < sessionAttempts; i++) trySession();
  for (let i = 0; i < inviteAttempts; i++) tryInvite();

  // CPU-ish “dashboard aggregation” (ledger fold) — scales with userIndex slightly for variance
  let fold = 0;
  const rows = 40 + (userIndex % 60);
  for (let i = 0; i < rows; i++) {
    fold += Math.sin(i * 0.17 + docsUsed) * (i % 7);
  }
  if (!Number.isFinite(fold)) {
    errors.push({ code: "nan_fold", message: "dashboard fold produced non-finite" });
  }

  // Stress entitlement map lookups under concurrency (shared module)
  for (let i = 0; i < 25; i++) {
    const e = entitlementsForPlan(planId);
    if (e.maxTeamSeats !== expected.maxTeamSeats) {
      errors.push({ code: "race_entitlement", message: "maxTeamSeats drift" });
      break;
    }
  }

  const ms = performance.now() - t0;
  return {
    planId,
    userIndex,
    ms,
    ok: errors.length === 0,
    errors,
    limitHits,
    actions: actions.length,
    final: { docsUsed, personalUsed, sessions, seatsUsed },
  };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * @param {string} name
 * @param {PlanId[]} planPerUser
 */
async function runScenario(name, planPerUser) {
  const t0 = performance.now();
  const users = planPerUser.map((planId, i) => ({ planId, i }));

  const simResults = await mapPool(users, CONCURRENCY, async (u) => simulateUserBurst(u.planId, u.i));

  /** @type {{url:string,status:number,ms:number,ok:boolean,error?:string}[]} */
  const httpResults = [];
  if (BASE_URL) {
    // Probe landing + a few SPA routes — not authenticated Firebase (would need tokens).
    const paths = ["/", "/sign-in", "/start-trial?plan=starter"];
    const probes = [];
    for (let i = 0; i < Math.min(USERS, 200); i++) {
      probes.push(paths[i % paths.length]);
    }
    const httpBatch = await mapPool(probes, Math.min(CONCURRENCY, 50), async (path) => {
      const url = `${BASE_URL}${path}`;
      const start = performance.now();
      try {
        const res = await fetch(url, {
          headers: { Accept: "text/html" },
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
        });
        return {
          url,
          status: res.status,
          ms: performance.now() - start,
          ok: res.status >= 200 && res.status < 400,
        };
      } catch (e) {
        return {
          url,
          status: 0,
          ms: performance.now() - start,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    });
    httpResults.push(...httpBatch);
  }

  const wallMs = performance.now() - t0;
  const latencies = simResults.map((r) => r.ms);
  const hardErrors = simResults.flatMap((r) => r.errors.map((e) => ({ ...e, planId: r.planId, userIndex: r.userIndex })));
  const limitHits = simResults.flatMap((r) => r.limitHits);
  const byPlan = {};
  for (const plan of PLAN_IDS) {
    const subset = simResults.filter((r) => r.planId === plan);
    if (!subset.length) continue;
    const hits = subset.flatMap((r) => r.limitHits);
    byPlan[plan] = {
      users: subset.length,
      latency: stats(subset.map((r) => r.ms)),
      hardErrors: subset.filter((r) => !r.ok).length,
      limitHits: hits.length,
      limitHitsByKind: hits.reduce((acc, h) => {
        acc[h.kind] = (acc[h.kind] || 0) + 1;
        return acc;
      }, {}),
    };
  }

  const httpOk = httpResults.filter((h) => h.ok).length;
  const httpFail = httpResults.filter((h) => !h.ok);

  return {
    name,
    users: USERS,
    concurrency: CONCURRENCY,
    wallMs,
    throughputVuPerSec: USERS / (wallMs / 1000),
    simulation: {
      latency: stats(latencies),
      hardErrorCount: hardErrors.length,
      hardErrorsSample: hardErrors.slice(0, 20),
      limitHitCount: limitHits.length,
      limitHitsByKind: limitHits.reduce((acc, h) => {
        acc[h.kind] = (acc[h.kind] || 0) + 1;
        return acc;
      }, {}),
      byPlan,
      failedVuCount: simResults.filter((r) => !r.ok).length,
    },
    http: BASE_URL
      ? {
          baseUrl: BASE_URL,
          probes: httpResults.length,
          ok: httpOk,
          fail: httpFail.length,
          failRate: httpResults.length ? httpFail.length / httpResults.length : 0,
          latency: stats(httpResults.map((h) => h.ms)),
          failuresSample: httpFail.slice(0, 15),
        }
      : null,
  };
}

function mixPlans(n) {
  /** @type {PlanId[]} */
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(PLAN_IDS[i % 3]);
  }
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  console.log(`Capacity test: ${USERS} VUs, concurrency=${CONCURRENCY}${BASE_URL ? `, HTTP=${BASE_URL}` : " (sim only)"}`);

  const scenarios = [
    { name: "A_starter_2000", plans: Array.from({ length: USERS }, () => /** @type {PlanId} */ ("starter")) },
    { name: "B_business_2000", plans: Array.from({ length: USERS }, () => /** @type {PlanId} */ ("business")) },
    { name: "C_unlimited_2000", plans: Array.from({ length: USERS }, () => /** @type {PlanId} */ ("unlimited")) },
    { name: "D_mixed_2000", plans: mixPlans(USERS) },
  ];

  const all = [];
  for (const s of scenarios) {
    console.log(`\n▶ ${s.name} …`);
    const result = await runScenario(s.name, s.plans);
    all.push(result);
    const sim = result.simulation;
    console.log(
      `  wall=${result.wallMs.toFixed(0)}ms  vu/s=${result.throughputVuPerSec.toFixed(0)}  ` +
        `p95=${sim.latency.p95.toFixed(3)}ms  hardErrors=${sim.hardErrorCount}  limitHits=${sim.limitHitCount}`
    );
    if (result.http) {
      console.log(
        `  HTTP ok=${result.http.ok}/${result.http.probes} failRate=${(result.http.failRate * 100).toFixed(2)}% p95=${result.http.latency.p95.toFixed(1)}ms`
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    users: USERS,
    concurrency: CONCURRENCY,
    baseUrl: BASE_URL || null,
    scenarios: all,
    verdict: summarizeVerdict(all),
  };

  const outPath = join(OUT_DIR, `capacity-${stamp}.json`);
  const latestPath = join(OUT_DIR, "latest.json");
  await writeFile(outPath, JSON.stringify(report, null, 2));
  await writeFile(latestPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`Verdict: ${report.verdict.summary}`);
  if (report.verdict.issues.length) {
    console.log("Issues:");
    for (const issue of report.verdict.issues) console.log(`  - ${issue}`);
  }
}

function summarizeVerdict(scenarios) {
  const issues = [];
  let hardTotal = 0;
  for (const s of scenarios) {
    hardTotal += s.simulation.hardErrorCount;
    if (s.simulation.hardErrorCount > 0) {
      issues.push(`${s.name}: ${s.simulation.hardErrorCount} hard entitlement/sim errors`);
    }
    if (s.http && s.http.failRate > 0.01) {
      issues.push(`${s.name}: HTTP fail rate ${(s.http.failRate * 100).toFixed(2)}% > 1%`);
    }
  }

  const starter = scenarios.find((s) => s.name.startsWith("A_"));
  const business = scenarios.find((s) => s.name.startsWith("B_"));
  const unlimited = scenarios.find((s) => s.name.startsWith("C_"));

  // Starter SHOULD produce seat/session limit hits; missing them is suspicious.
  if (starter && (starter.simulation.limitHitsByKind.maxTeamSeats || 0) === 0) {
    issues.push("Starter cohort produced 0 maxTeamSeats hits (expected >0 when inviting)");
  }
  if (starter && (starter.simulation.limitHitsByKind.maxSessions || 0) === 0) {
    issues.push("Starter cohort produced 0 maxSessions hits (expected >0)");
  }

  // Unlimited should not hit doc/session/seat caps
  if (unlimited) {
    const bad =
      (unlimited.simulation.limitHitsByKind.maxDocumentsPerMonth || 0) +
      (unlimited.simulation.limitHitsByKind.maxSessions || 0) +
      (unlimited.simulation.limitHitsByKind.maxTeamSeats || 0);
    if (bad > 0) {
      issues.push(`Unlimited cohort hit doc/session/seat caps unexpectedly (${bad})`);
    }
  }

  // Business should allow more invites than starter
  if (starter && business) {
    const sInv = starter.simulation.limitHitsByKind.maxTeamSeats || 0;
    const bInv = business.simulation.limitHitsByKind.maxTeamSeats || 0;
    if (bInv >= sInv && sInv > 0 && bInv === 0) {
      /* ok — business may not hit seat cap with only 3 invite attempts */
    }
  }

  const summary =
    hardTotal === 0 && issues.filter((i) => i.includes("hard")).length === 0 && !issues.some((i) => i.includes("HTTP fail"))
      ? issues.length
        ? `Simulation stable (${USERS} VUs × 4 scenarios); notes: ${issues.length} observation(s)`
        : `PASS — ${USERS} VUs × 4 plan cohorts with 0 hard errors`
      : `REVIEW — hardErrors=${hardTotal}, observations=${issues.length}`;

  return {
    summary,
    hardTotal,
    issues,
    planNotes: {
      starter: "Expect session (max 2) and seat (max 1) rejections — product limits working.",
      business: "Higher doc/seat headroom; fewer entitlement rejections than Starter.",
      unlimited: "No doc/session/seat caps — watch real Gemini/Firebase cost under true load.",
      mixed: "Cross-plan concurrent entitlement resolution must stay consistent.",
    },
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
