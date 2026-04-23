# FSS Agent System Index v2
## Model-Agnostic Strategic & Technical Agent Navigation

**Version**: 2.0  
**Created**: April 2026  
**Updated**: [Today]  

---

## System Architecture

**Two roles. Two models. Interchangeable.**

```
Strategic Agent (Claude or Codex)
├── Discovery & Requirements
├── Proposals & Commercial Terms
├── Risk Assessment & Escalation
└── Brand Voice & Decision-Making

Technical Agent (Claude or Codex)
├── Architecture & Design Docs
├── Code Implementation
├── Testing & Quality Assurance
└── Deployment & Support

Rate Limits? → Switch models without changing standards
Both agents work independently and in tight loops
All state is documented (project context, design docs, commits)
```

---

## Document Map

### AGENTS_v2.md (System Constitution)
**What it is**: The meta-system that defines how both agents work together, regardless of underlying model.

**Use when**:
- Understanding the overall system architecture
- Learning handoff protocol (Strategic > Technical, Technical > Strategic)
- Understanding quality gates and escalation rules
- Reviewing how models switch without degradation

**Key sections**:
- Section 0: Core architecture (role-based, model-agnostic)
- Section 1: Agent roles (interchangeable)
- Section 2: Interchangeability rules
- Section 3-4: Handoff protocol and design doc template
- Section 5-8: Quality standards, gates, escalation
- Section 9: Workflow integration (client services, products, rate management)

---

### STRATEGY.md (Strategic Agent Manual)
**What it is**: Operating manual for whoever is running Strategic Agent (Claude or Codex).

**Use when**:
- Running a discovery conversation
- Writing a proposal
- Making a commercial decision
- Assessing client fit
- Thinking through risk
- Identifying product opportunities
- Writing any external-facing copy

**Key sections**:
- Section 1: Core mandate (identical for Claude or Codex)
- Section 3: Complete discovery protocol
- Section 4: Proposal writing
- Section 5: Commercial clarity (pricing, scope, timeline)
- Section 6: Brand voice rules
- Section 7-9: Risk, products, financial modeling
- Section 12: Model switching protocol

---

### BUILD.md (Technical Agent Manual)
**What it is**: Operating manual for whoever is running Technical Agent (Claude or Codex).

**Use when**:
- Writing code or architecture
- Reviewing design decisions
- Establishing quality standards
- Planning build phases
- Understanding testing requirements
- Deploying or supporting a system
- Switching models mid-project

**Key sections**:
- Section 1: Core mandate (identical for Claude or Codex)
- Section 3: Architecture standards
- Section 4: Code quality standards (testing, TypeScript, security, performance, docs)
- Section 5: Project phases and milestones
- Section 8-9: Commit standards and git workflow
- Section 10: Monitoring and observability
- Section 14: Model switching protocol

---

## Common Workflows

### "A lead came in. What do I do?"

**Strategic Agent** → Read STRATEGY.md Section 3 (Discovery Protocol)

**Summary**:
1. Light intake (check fit basics)
2. Run structured discovery (five areas)
3. Decide: proceed or decline
4. If proceeding, write proposal

**Output**: Discovery document + proposal (or decline)

---

### "Design doc is done. How do I start building?"

**Technical Agent** → Read BUILD.md Section 1-3

**Summary**:
1. Review design doc for feasibility
2. Send Technical Note to Strategic Agent if gaps exist
3. Set up dev environment
4. Create architecture decision records
5. Start implementation with tests
6. Weekly demos to Strategic Agent

**Output**: Code that meets Section 4 quality standards

---

### "We need to switch models because of rate limits."

**Current Agent** → AGENTS_v2.md Section 7 (State Management)

**Summary**:
1. Finish current work
2. Update project context doc
3. Commit all code with clear messages
4. Flag anything pending
5. Next agent reads context doc and commits
6. Next agent proceeds at identical standards

**Key principle**: No quality drop. Standards are role-based, not model-based.

---

### "I'm the new agent taking over mid-project."

**Any Agent** → Follow session checklist at end of STRATEGY.md or BUILD.md

**Summary**:
1. Read project context document (current state, decisions, blockers)
2. Read design doc (understand architecture)
3. Read recent commits (understand what was built)
4. Check for open work (PRs, branches, escalations)
5. Confirm success criteria for this session
6. Proceed at identical standards

---

### "This client is a bad fit. How do I handle it?"

**Strategic Agent** → STRATEGY.md Section 3.4 (Decision: Proceed or Decline?)

**Summary**:
1. Be honest with the client
2. Explain why it's not a fit
3. Refer them to appropriate providers
4. Leave the door open for future

---

### "Code doesn't pass quality gate. What now?"

**Technical Agent** → BUILD.md Section 4 (Code Quality Standards)

**Summary**:
1. Review against: tests, TypeScript, security, performance, docs, deployment readiness
2. Fix the failing check
3. If it's a design issue, send Technical Note to Strategic Agent
4. Escalate only if it's unresolvable within role

---

### "We've shipped. How do we support it?"

**Both Agents** → AGENTS_v2.md Section 2.4 (Retainer/Ongoing Support)

**Summary**:
1. Strategic & Technical Agent tight loop
2. Weekly 15-min sync (blockers, scope drift)
3. Monthly retainer review (sustainable? margin? fit?)
4. All scope changes > 5 hours = discovery refresh

---

## Decision Trees

### Should we proceed with this client?

```
1. Do they have £250k+ annual revenue/budget?
   NO → Light intake first or decline
   YES → Continue

2. Do they have operational complexity?
   NO → Better served by template/tool
   YES → Continue

3. Is there a decision-maker?
   NO → Ask for intro to right person
   YES → Continue

4. Does this align with FSS values?
   NO → Decline, refer elsewhere
   YES → Continue

5. Is implied hourly rate sustainable (£150+)?
   NO → Increase price/scope or decline
   YES → Proceed to discovery
```

### Is this client a good fit after discovery?

```
1. Is the problem clear and operational?
   NO → Don't proceed (vague = scope creep)
   YES → Continue

2. Are they in ideal profile?
   (£250k+ revenue, values-driven, decision-maker)
   NO → Decline
   YES → Continue

3. Is solution within FSS capability?
   NO → Partner or decline
   YES → Continue

4. Is margin defensible (gross margin > 50%)?
   NO → Increase price, reduce scope, or decline
   YES → Continue

5. Does this align with FSS brand/values?
   NO → Decline
   YES → Propose
```

### Should we build this product?

```
Pain point observed:

1. Is this the FIRST time we've seen this?
   YES → Log it, watch for pattern
   NO → Continue

2. Is this the THIRD independent observation?
   NO → Not ready yet
   YES → Continue

3. Is there a market gap? (Competitors: yes/no?)
   NO → Crowded market
   YES → Continue

4. Could a software product solve at scale?
   NO → Service or template instead
   YES → Continue

5. What's the addressable market?
   Small (< £1M TAM) → Consider
   Large (> £5M TAM) → Prioritize

→ Escalate to formal incubation
```

---

## Quality Checkpoints by Phase

### Before Discovery
- [ ] Client qualifies (£250k+, operationally complex, decision-maker)
- [ ] FSS values alignment confirmed
- [ ] Budget/timeline expectations set

### Before Proposal
- [ ] Problem is clear and specific
- [ ] Solution scope is defensible
- [ ] Margin is sustainable (> 50% gross)
- [ ] Timeline protects quality
- [ ] Client is ideal fit

### Before Architecture
- [ ] Design doc is complete and reviewed
- [ ] Technical Agent has flagged any gaps
- [ ] Technical approach is feasible
- [ ] Risks are identified

### Before Build
- [ ] Architecture is approved
- [ ] Dev environment ready
- [ ] Testing infrastructure set up
- [ ] CI/CD configured

### Before QA
- [ ] All features implemented to spec
- [ ] All tests pass locally
- [ ] Code review complete
- [ ] No blocking technical debt

### Before Launch
- [ ] All tests pass in staging
- [ ] Performance targets hit
- [ ] Security review passed
- [ ] Documentation complete
- [ ] Rollback plan tested
- [ ] Client trained

### Before Support
- [ ] Monitoring is live
- [ ] Incident runbook exists
- [ ] On-call process defined
- [ ] Client understands system

---

## Success Metrics

### Strategic Agent (model-agnostic)
- Discovery to proposal: target < 3 days
- Proposal conversion: target > 40%
- Client satisfaction: target > 85%
- Client repeat/retainer: target > 60%
- Product pipeline quality: all ideas have 3+ validated pain points

### Technical Agent (model-agnostic)
- Code review cycle: target < 24 hours
- Test coverage: target > 80%
- Production incidents: target < 1 per 100 deploys
- Build time: target < 5 minutes
- Velocity consistency: target ±10% session to session

### System (model-agnostic)
- On-time, on-budget delivery: target 90%
- Client NPS: target > 50
- Margin per project: target > 50%
- **Quality consistency across model switches: zero degradation**

---

## Model Switching Checklist

**When switching agents (same role, different model)**:

**Before you start**:
- [ ] Have you read the project context document?
- [ ] Have you read the design doc or most recent proposal?
- [ ] Have you reviewed recent commits?
- [ ] Do you understand open blockers or escalations?
- [ ] Can you confirm success criteria for this session?

**At the end**:
- [ ] Have you updated the project context document?
- [ ] Have you committed all work with clear messages?
- [ ] Have you sent a build summary or proposal to the other agent?
- [ ] Have you logged any escalations?
- [ ] Does everything meet identical standards (no shortcuts)?

**Key principle**: The handoff document is your source of truth. Not memory. Not assumptions. Always read the docs.

---

## Templates

### Project Context Document
**Store at**: `/mnt/project/[ProjectName]_Context.docx` or `.md`

**Contents**:
- Problem statement
- Current phase (Discovery/Architecture/Build/QA/Launch/Support)
- Design decisions made
- Blockers and escalations
- Next steps
- Last updated date

---

### Design Doc
**Store at**: `/mnt/project/[ProjectName]_Design.md` or `.docx`

**Sections**: See AGENTS_v2.md Section 4

---

### Technical Note (Blocker Escalation)
**Use when**: Technical Agent needs Strategic input

**Format**: See BUILD.md Section 7

---

### Commit Message
**Format**: See BUILD.md Section 8

---

## Banned Words & Style Rules

**Never use**:
Additionally (to start), align with, boasts, bolstered, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight/highlights (as verb), interplay, intricate/intricacies, key (as filler), landscape (abstract), meticulous/meticulously, pivotal, showcase, tapestry (abstract), testament, underscore (as verb), valuable, vibrant, nestled, groundbreaking, renowned, diverse array, rich heritage, natural beauty, commitment to.

**Also**: No em dashes. Ever.

---

## Glossary

**Strategic Agent**: Role responsible for discovery, proposals, commercial decisions, risk assessment. Can be Claude or Codex.

**Technical Agent**: Role responsible for architecture, code, testing, deployment. Can be Claude or Codex.

**Discovery**: Structured conversation revealing real client problems. Output: discovery document.

**Design Doc**: Architecture and planning document. Required before any build work.

**Technical Note**: Brief escalation from Technical Agent to Strategic Agent on a decision or blocker.

**Margin**: Revenue minus costs. FSS targets > 50% gross margin.

**Scope Creep**: Unpriced changes to original agreement. Kills margin.

**Model Switching**: Changing from Claude to Codex (or vice versa) within a role. Should have zero impact on quality or progress.

**Project Context Document**: Single source of truth for project state, decisions, and blockers. Updated after every session.

---

## Contact & Updates

**System Owner**: Jean-Fidele Ntagengwa, CTO FSS

**Quarterly Review**: Q2 2026

**How to propose changes**: Flag in retro or send note with: What should change? Why? What impact?

---

**End of Index v2**

Bookmark this. Use it as your entry point.
