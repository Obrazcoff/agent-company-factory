# Sequence diagram

## Happy path with one approval gate

```mermaid
sequenceDiagram
  participant User
  participant API
  participant Intake as GoalIntake
  participant Designer as TeamDesigner
  participant Planner as SkillsPlanner
  participant Orch as Orchestrator
  participant Runtime as AgentRuntime
  participant Policy as PolicyEngine
  participant Audit

  User->>API: POST /api/companies { missionPrompt, dailyBudgetUsd }
  API->>Intake: intakeAndCreateCompany
  Intake->>Intake: LLM.generateBlueprint
  Intake->>Designer: designTeam(blueprint)
  Designer->>Planner: planSkills(agents)
  Planner-->>API: { company, agents, initialTasks }
  API->>Audit: append("company.created", "agent.hired" x N, "task.enqueued" x N)

  loop tick
    User->>API: POST /api/orchestrator/tick
    API->>Orch: tick()
    Orch->>Orch: sweepExpiredApprovals + sweepStaleRuns + resumeApprovedTasks
    Orch->>Orch: pickReady + cycle/depth/backlog guards
    Orch->>Runtime: executeRun(task, agent)
    Runtime->>Policy: canSpend(estCost)
    Policy-->>Runtime: ok
    Runtime->>Runtime: roleHandler.call(connector, input)
    alt connector.requiresApproval
      Runtime->>Policy: createApproval(...)
      Policy->>Audit: append("approval.requested")
      Runtime-->>Orch: PauseForApprovalError → task=awaiting_approval
    else autonomous tool call
      Runtime->>Audit: append("tool.called", cost)
    end
    Runtime->>Audit: append("task.done")
  end

  User->>API: POST /api/approvals/:id { decision: "approved" }
  API->>Policy: decideApproval(id, "approved")
  Policy->>Audit: append("approval.decided")

  User->>API: POST /api/orchestrator/tick
  API->>Orch: tick()
  Orch->>Orch: resumeApprovedTasks → task=queued
  Orch->>Runtime: executeRun (now allowed)
  Runtime->>Audit: append("action.executed")
```

## Failure paths covered by tests

| Path                             | Test    | Outcome                                                  |
| -------------------------------- | ------- | -------------------------------------------------------- |
| handler throws 3×                | case 1  | task=failed, audit `task.dead_letter`                    |
| approval past deadline           | case 2  | approval=expired, task=failed                            |
| handler hangs (no heartbeat 60s) | case 3  | run=failed, task re-queued, audit `run.stale_recovered`  |
| two ticks claim same task        | case 4  | exactly one Run created                                  |
| cyclic deps at enqueue           | case 5  | `400 cyclic_dependency`, audit `task.rejected_cyclic`    |
| follow-up at depth > 5           | case 6  | rejected, audit `task.rejected_max_depth`                |
| handler runs > runTimeoutMs      | case 7  | run=timed_out, task retried                              |
| 50 slow tasks in tick            | case 8  | tick yields after 5s, deferred remaining                 |
| >20 tool calls in one Run        | case 9  | run=failed, audit `run.call_cap_exceeded`                |
| approve+reject same approval     | case 10 | second decision returns 409                              |
| budget hard cap reached          | case 11 | company=paused, queued cancelled, audit `company.killed` |
| parent task fails                | case 12 | dependents cascade-cancelled                             |
