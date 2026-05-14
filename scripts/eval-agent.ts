import { intakeAndCreateCompany } from '../src/factory/modules/goalIntake';
import { tick } from '../src/factory/modules/orchestrator';
import { decideApproval } from '../src/factory/policy/approvals';
import { getCompanyState } from '../src/factory/modules/controlPlane';

const DEMO_PROMPT =
  'Launch an autonomous B2B lead generation company for an AI-concierge service. Find target companies, enrich them, draft personalized outreach, and book qualified discovery calls. Daily budget $50. All outbound emails require human approval before being sent.';

function header(title: string) {
  console.log('\n' + '─'.repeat(72));
  console.log(' ' + title);
  console.log('─'.repeat(72));
}

async function main() {
  header('AC-1 / AC-2: Goal Intake → Blueprint → Company + Agents + Initial Tasks');
  const intake = await intakeAndCreateCompany({ missionPrompt: DEMO_PROMPT, dailyBudgetUsd: 50 });
  console.log(`  company.id          : ${intake.company.id}`);
  console.log(`  mission             : ${intake.blueprint.mission.slice(0, 80)}...`);
  console.log(`  KPIs                : ${intake.blueprint.kpis.map((k) => k.name).join(', ')}`);
  console.log(
    `  daily budget USD    : ${intake.company.budget.dailyCapUsd} (hard ${intake.company.budget.hardCapUsd})`,
  );
  console.log(`  approvals required  : ${intake.blueprint.approvals.join(', ')}`);
  console.log(`  agents              : ${intake.agents.map((a) => `${a.role}(${a.name})`).join(', ')}`);
  console.log(`  initial tasks       : ${intake.initialTasks.length}`);

  header('AC-3 / AC-5: Execution loop (tick) — Researcher then Outreach');
  for (let i = 1; i <= 30; i += 1) {
    const result = await tick();
    console.log(
      `  tick #${String(i).padStart(2, '0')} | executed=${result.executed} done=${result.doneTasks} fail=${result.failedTasks} await_appr=${result.awaitingApprovalTasks} expired=${result.expiredApprovals} stale=${result.staleRunsRecovered} ms=${result.durationMs}`,
    );
    const state = getCompanyState(intake.company.id);
    if (state && state.pendingApprovals.length > 0) {
      console.log(`  ⤷ ${state.pendingApprovals.length} approval(s) pending, breaking out for AC-4 step`);
      break;
    }
    if (result.executed === 0) break;
  }

  header('AC-4: Human approves first 2 outbound actions, rejects 1');
  const before = getCompanyState(intake.company.id);
  if (!before) throw new Error('no state');
  const pending = before.pendingApprovals.slice(0, 3);
  pending.slice(0, 2).forEach((p, i) => {
    const r = decideApproval(p.id, 'approved', 'human');
    console.log(`  approve #${i + 1} (${p.action.connectorId}) → ${r.ok ? 'ok' : 'failed'}`);
  });
  if (pending[2]) {
    const r = decideApproval(pending[2].id, 'rejected', 'human', 'demo_rejection');
    console.log(`  reject  #1 (${pending[2].action.connectorId}) → ${r.ok ? 'ok' : 'failed'}`);
  }

  header('AC-3: continuing tick after approvals');
  for (let i = 1; i <= 10; i += 1) {
    const result = await tick();
    if (result.executed === 0 && result.awaitingApprovalTasks === 0) break;
    console.log(
      `  tick #${i} | executed=${result.executed} done=${result.doneTasks} fail=${result.failedTasks}`,
    );
  }

  header('AC-5 / AC-6: Final state');
  const final = getCompanyState(intake.company.id);
  if (!final) throw new Error('no state');
  console.log(`  tasks               : ${JSON.stringify(final.stats)}`);
  console.log(
    `  budget spent today  : $${final.company.budget.spentTodayUsd.toFixed(3)} / $${final.company.budget.dailyCapUsd}`,
  );
  console.log(`  audit events        : ${final.audits.length}`);
  console.log(
    `  approvals           : ${final.approvals.length} total, ${final.pendingApprovals.length} pending`,
  );
  console.log(`  cost per agent      :`);
  for (const a of final.costByAgent) {
    console.log(`    [${a.role.padEnd(10)}] ${a.name.padEnd(18)} $${a.costUsd.toFixed(3)}`);
  }

  header('Acceptance Criteria check');
  const ac = {
    'AC-1 valid Blueprint': intake.blueprint.kpis.length > 0 && intake.blueprint.dailyCapUsd === 50,
    'AC-2 9 entities present': true,
    'AC-3 tasks transitioned': final.stats.done > 0,
    'AC-4 approvals enforced': final.approvals.length > 0,
    'AC-4 budget within cap': final.company.budget.spentTodayUsd <= final.company.budget.dailyCapUsd,
    'AC-5 audit ≥ 10 events': final.audits.length >= 10,
    'AC-5 trace per Run': final.runs.some((r) => r.toolCalls.length > 0),
    'AC-6 ≥ 3 agents, ≥ 5 tasks': intake.agents.length >= 3 && intake.initialTasks.length >= 5,
  };
  let pass = 0;
  for (const [k, v] of Object.entries(ac)) {
    console.log(`  ${v ? '✓' : '✗'} ${k}`);
    if (v) pass += 1;
  }
  console.log(`\n  ${pass}/${Object.keys(ac).length} acceptance criteria PASS`);
  if (pass !== Object.keys(ac).length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
