import json

from conftest import (
    teach_coheres_response,
    teach_extends_response,
    teach_contradicts_response,
    rule_consistent_response,
    rule_contradictory_response,
    rule_offtopic_consistent_response,
    rule_audit_response,
    canon_text,
)

# Distinct prompt patterns so the leader ruling call and the validator's
# independent consistency audit can be mocked separately.
RULE_PAT = r"(?s).*Propose a ruling.*"
AUDIT_PAT = r"(?s).*CONSISTENCY AUDIT.*"


def _mock_rule_calls(direct_vm, rule_json, audit_consistent=True, audit_grounded=True):
    """Mock the leader ruling response and the validator's independent audit."""
    direct_vm.clear_mocks()
    direct_vm.mock_llm(AUDIT_PAT, rule_audit_response(audit_consistent, audit_grounded))
    direct_vm.mock_llm(RULE_PAT, rule_json)
    direct_vm.mock_llm(r".*", rule_json)


# ---------------------------------------------------------------------------
# boot
# ---------------------------------------------------------------------------

def test_boot_creates_understudy(deploy, direct_vm):
    summary = deploy.boot(1000)
    assert summary["booted"] is True
    assert summary["createdAt"] == 1000
    assert summary["principles"] == 0
    assert summary["coherence"] == 100


def test_boot_only_owner(deploy, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the keyholder"):
        deploy.boot(1000)


def test_boot_is_idempotent_on_created_at(deploy, direct_vm):
    deploy.boot(1000)
    summary = deploy.boot(5000)
    # Re-booting does not reset the original creation time.
    assert summary["createdAt"] == 1000


# ---------------------------------------------------------------------------
# teach
# ---------------------------------------------------------------------------

def test_teach_coherent_case_grows_a_facet(deploy, direct_vm):
    deploy.boot(1000)
    result = deploy.teach(
        "Someone asks for a deadline extension and has never missed one.",
        "Grant it once, no questions.",
        "A first slip deserves trust before scrutiny.",
        2000,
    )
    assert result["relation"] == "coheres"
    assert result["grewFacet"] is True
    assert result["principleId"] == "principle_0"

    core = deploy.get_core()
    assert core["facets"] == 1
    assert len(core["principles"]) == 1
    assert len(core["lockedPrinciples"]) == 1
    assert core["coherence"] == 100


def test_teach_only_owner(deploy, direct_vm, direct_bob):
    deploy.boot(1000)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the keyholder"):
        deploy.teach("a situation", "a call", "a reason", 2000)


def test_teach_requires_situation(deploy, direct_vm):
    deploy.boot(1000)
    with direct_vm.expect_revert("Teach a case before pulling the lever"):
        deploy.teach("   ", "a call", "a reason", 2000)


def test_teach_requires_call_and_reason(deploy, direct_vm):
    deploy.boot(1000)
    with direct_vm.expect_revert("a call and a reason"):
        deploy.teach("a situation", "   ", "", 2000)


def test_teach_contradictory_case_is_flagged_not_blended(deploy, direct_vm):
    deploy.boot(1000)
    # First, a coherent locked principle.
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    core_before = deploy.get_core()
    assert core_before["facets"] == 1

    # Now a contradictory lesson. It must be flagged as a tension, not blended.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", teach_contradicts_response())
    result = deploy.teach(
        "Someone asks for a first deadline extension.",
        "Refuse it always.",
        "No exceptions ever.",
        3000,
    )
    assert result["relation"] == "contradicts"
    assert result["grewFacet"] is False
    assert result["principleId"] is None

    core_after = deploy.get_core()
    # The core did not grow; coherence dropped; a tension was recorded.
    assert core_after["facets"] == 1
    assert len(core_after["tensions"]) == 1
    assert core_after["coherence"] < core_before["coherence"]


# ---------------------------------------------------------------------------
# submit_situation
# ---------------------------------------------------------------------------

def test_submit_situation_docks(deploy, direct_vm):
    deploy.boot(1000)
    sid = deploy.submit_situation("A contributor asks for a one week extension.", 2000)
    sits = deploy.get_situations(0, 20)
    assert len(sits) == 1
    assert sits[0]["id"] == sid
    assert sits[0]["state"] == "docked"


def test_submit_situation_requires_text(deploy, direct_vm):
    deploy.boot(1000)
    with direct_vm.expect_revert("needs a description"):
        deploy.submit_situation("   ", 2000)


# ---------------------------------------------------------------------------
# rule
# ---------------------------------------------------------------------------

def test_rule_needs_a_non_empty_core(deploy, direct_vm):
    deploy.boot(1000)
    sid = deploy.submit_situation("A contributor asks for an extension.", 2000)
    with direct_vm.expect_revert("too small to rule"):
        deploy.rule(sid, 3000)


def test_rule_consistent_becomes_canonical(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor who never missed a deadline asks for one extension.", 3000
    )

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_consistent_response())
    result = deploy.rule(sid, 4000, "0xabc123")
    assert result["consistent"] is True
    assert result["state"] == "accepted"
    assert result["decision"] != ""

    sits = deploy.get_situations(0, 20)
    assert sits[0]["state"] == "accepted"

    decisions = deploy.get_decisions(0, 20)
    assert len(decisions) == 1
    assert decisions[0]["consistent"] is True
    assert decisions[0]["state"] == "accepted"
    assert decisions[0]["mockTxHash"] == "0xabc123"

    quarantine = deploy.get_quarantine(0, 20)
    assert len(quarantine) == 0


def test_rule_contradictory_is_quarantined(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor asks for an extension and the understudy wants to penalize them.", 3000
    )

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_contradictory_response())
    result = deploy.rule(sid, 4000)
    assert result["consistent"] is False
    assert result["state"] == "quarantined"

    quarantine = deploy.get_quarantine(0, 20)
    assert len(quarantine) == 1
    assert quarantine[0]["situationId"] == sid
    assert quarantine[0]["state"] == "quarantined"


def test_rule_twice_fails(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for an extension.", 3000)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_consistent_response())
    deploy.rule(sid, 4000)
    with direct_vm.expect_revert("already been ruled on"):
        deploy.rule(sid, 5000)


# ---------------------------------------------------------------------------
# step_in
# ---------------------------------------------------------------------------

def test_step_in_resolves_quarantine_and_can_teach(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for an extension.", 3000)

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_contradictory_response())
    deploy.rule(sid, 4000)

    result = deploy.step_in(
        sid,
        "Grant the extension, but ask for a short plan.",
        "When intent is unclear, grant once and request a plan.",
        True,
        5000,
    )
    assert result["state"] == "resolved-by-owner"
    assert result["principleId"] is not None

    sits = deploy.get_situations(0, 20)
    assert sits[0]["state"] == "resolved-by-owner"

    quarantine = deploy.get_quarantine(0, 20)
    assert len(quarantine) == 0

    core = deploy.get_core()
    # Original principle plus the clarifying one taught during step-in.
    assert core["facets"] == 2


def test_step_in_only_owner(deploy, direct_vm, direct_bob):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for an extension.", 3000)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_contradictory_response())
    deploy.rule(sid, 4000)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the keyholder"):
        deploy.step_in(sid, "Grant it.", "", False, 5000)


def test_step_in_requires_quarantined_situation(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for an extension.", 3000)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_consistent_response())
    deploy.rule(sid, 4000)  # accepted, not quarantined
    with direct_vm.expect_revert("Only a quarantined situation"):
        deploy.step_in(sid, "Grant it.", "", False, 5000)


# ---------------------------------------------------------------------------
# get_core / get_decisions / get_quarantine + extends path
# ---------------------------------------------------------------------------

def test_teach_extends_grows_facet(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", teach_extends_response())
    result = deploy.teach(
        "Someone with a pattern of misses asks for an extension.",
        "Ask for a plan first.",
        "Patterns need structure.",
        3000,
    )
    assert result["relation"] == "extends"
    assert result["grewFacet"] is True
    core = deploy.get_core()
    assert core["facets"] == 2


def test_get_decisions_newest_first(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_consistent_response())
    s1 = deploy.submit_situation("First situation.", 3000)
    s2 = deploy.submit_situation("Second situation.", 3100)
    deploy.rule(s1, 4000)
    deploy.rule(s2, 4100)
    decisions = deploy.get_decisions(0, 20)
    assert len(decisions) == 2
    assert decisions[0]["situationId"] == s2


# ---------------------------------------------------------------------------
# ISSUE 1: canonical outputs are consensus-backed, not the leader's alone.
#
# In direct mode gl.vm.run_nondet_unsafe runs only the leader and captures the
# validator. We drive the captured validator via direct_vm.run_validator() to
# prove validators judge the SUBSTANCE of the committed rule/decision text and
# the consistency verdict, disagreeing when the substance does not hold.
# ---------------------------------------------------------------------------

def test_teach_stores_consensus_agreed_canonical_rule(deploy, direct_vm):
    # The stored principle carries a canonical normalized form of the rule, and
    # that canonical form is exactly what the consensus algorithm produces.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    core = deploy.get_core()
    p = core["principles"][0]
    assert p["canonical"] == canon_text(p["rule"])
    assert p["canonical"] != ""

    # And a validator rerun on the same substance agrees: the exact stored rule
    # is consensus-backed, not the leader's phrasing alone.
    assert direct_vm.run_validator() is True


def test_teach_validator_rejects_divergent_rule_substance(deploy, direct_vm):
    # A leader that commits a rule whose MEANING diverges from the validator's
    # independent synthesis is rejected, so a rogue leader cannot make its own
    # rule text canonical.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    divergent_rule = "Repaint the office lobby a calming shade of blue every spring."
    leader_claim = {
        "relation": "coheres",
        "rule": divergent_rule,
        "canonical": canon_text(divergent_rule),
        "locked": True,
        "tension": "",
    }
    # The validator reruns the leader against the same mock (the grant-extension
    # rule) and compares substance; the divergent rule fails the tolerance.
    assert direct_vm.run_validator(leader_result=leader_claim) is False


def test_teach_validator_rejects_mismatched_canonical(deploy, direct_vm):
    # A leader cannot smuggle a canonical form that does not match its own rule.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    rule = "Grant a first deadline extension without questions."
    leader_claim = {
        "relation": "coheres",
        "rule": rule,
        "canonical": "totally unrelated canonical tokens",
        "locked": True,
        "tension": "",
    }
    assert direct_vm.run_validator(leader_result=leader_claim) is False


def test_rule_accepted_ruling_carries_downstream_action(deploy, direct_vm):
    # An accepted ruling records a concrete downstream action it authorizes, so
    # acceptance connects to a real effect and not just a "consistent" label.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor who never missed a deadline asks for one extension.", 3000
    )
    _mock_rule_calls(direct_vm, rule_consistent_response())
    result = deploy.rule(sid, 4000, "0xabc123")
    assert result["consistent"] is True
    assert result["state"] == "accepted"
    assert result["action"] != ""

    decisions = deploy.get_decisions(0, 20)
    assert decisions[0]["action"] == result["action"]

    # The consensus validator agrees this grounded, action-bearing ruling stands:
    # the independent audit reaches the same consistent verdict for the leader's
    # exact decision, and the deterministic grounding gates pass.
    assert direct_vm.run_validator() is True


def test_accepted_ruling_creates_downstream_action_record(deploy, direct_vm):
    # A CONCRETE DOWNSTREAM ACTION: an accepted ruling queues a canonical Action
    # record on-chain, linked back to the ruling, so acceptance does something
    # real rather than only storing a "consistent" label.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor who never missed a deadline asks for one extension.", 3000
    )
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_consistent_response())
    result = deploy.rule(sid, 4000, "0xabc123")
    assert result["consistent"] is True
    assert result["actionId"] != ""

    # The action collection has exactly one queued, inspectable effect.
    actions = deploy.get_actions(0, 20)
    assert len(actions) == 1
    a = actions[0]
    assert a["id"] == result["actionId"]
    assert a["rulingId"] == result["rulingId"]
    assert a["situationId"] == sid
    assert a["effect"] == result["action"]
    assert a["status"] == "queued"
    assert a["authorizedBy"] == result["decision"]

    # The ruling links back to its downstream action.
    decisions = deploy.get_decisions(0, 20)
    assert decisions[0]["actionId"] == a["id"]

    # The summary counts the queued action.
    summary = deploy.get_summary()
    assert summary["actions"] == 1


def test_quarantined_ruling_creates_no_action_record(deploy, direct_vm):
    # A quarantined ruling queues no downstream action: nothing is authorized
    # until the owner steps in.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor asks for an extension and the understudy wants to penalize them.", 3000
    )
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_contradictory_response())
    result = deploy.rule(sid, 4000)
    assert result["consistent"] is False
    assert result["actionId"] == ""

    actions = deploy.get_actions(0, 20)
    assert len(actions) == 0
    summary = deploy.get_summary()
    assert summary["actions"] == 0


def test_rule_quarantined_ruling_authorizes_no_action(deploy, direct_vm):
    # A quarantined ruling authorizes nothing until the owner steps in.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor asks for an extension and the understudy wants to penalize them.", 3000
    )
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", rule_contradictory_response())
    result = deploy.rule(sid, 4000)
    assert result["consistent"] is False
    assert result["state"] == "quarantined"
    assert result["action"] == ""

    quarantine = deploy.get_quarantine(0, 20)
    assert quarantine[0]["action"] == ""


def test_rule_validator_rejects_decision_ungrounded_in_principles(deploy, direct_vm):
    # A ruling whose decision text is not consistent with (not grounded in) the
    # principle set is rejected by validators even if it claims consistent=true.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for one extension.", 3000)
    _mock_rule_calls(direct_vm, rule_offtopic_consistent_response())
    with direct_vm.expect_revert("downstream action did not enact the decision"):
        deploy.rule(sid, 4000)
    # The deterministic persistence guard rejects the off-topic leader output
    # before any ruling or action becomes canonical state.
    assert deploy.get_decisions(0, 20) == []
    assert deploy.get_actions(0, 20) == []


def test_rule_validator_rejects_consistency_verdict_mismatch(deploy, direct_vm):
    # If the leader claims a ruling is consistent but the validator's independent
    # rerun finds it contradictory, the validator disagrees. The consistency
    # verdict that becomes canonical must itself be consensus-backed.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for one extension.", 3000)
    # The independent audit (what the validator runs on the leader's exact
    # decision) finds the ruling contradictory.
    _mock_rule_calls(
        direct_vm, rule_contradictory_response(), audit_consistent=False, audit_grounded=True
    )
    deploy.rule(sid, 4000)
    # A leader that instead committed "consistent: true" with an authorized action
    # is rejected because the independent audit verdict is "consistent: false".
    leader_claim = {
        "decision": "Refuse the request outright and penalize them.",
        "consistent": True,
        "principles_used": ["Grant a first deadline extension without questions."],
        "action": "penalize the contributor",
        "decision_canonical": canon_text("Refuse the request outright and penalize them."),
        "action_canonical": canon_text("penalize the contributor"),
    }
    assert direct_vm.run_validator(leader_result=leader_claim) is False


def test_rule_validator_agrees_on_canonical_decision(deploy, direct_vm):
    # The canonical stored decision is the consensus-agreed one: a validator
    # rerun on the same substance agrees.
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation(
        "A contributor who never missed a deadline asks for one extension.", 3000
    )
    _mock_rule_calls(direct_vm, rule_consistent_response())
    result = deploy.rule(sid, 4000)
    # A paraphrase of the same decision (same substance, different words) still
    # passes: the deterministic grounding gates hold on the leader's committed
    # fields and the independent audit confirms the consistent verdict. Consensus
    # is meaning-based, never byte-equal on prose.
    paraphrase = "Grant the extension one time without questions because no prior deadline was missed."
    leader_claim = {
        "decision": paraphrase,
        "consistent": True,
        "principles_used": ["Grant a first deadline extension without questions."],
        "action": "grant the deadline extension",
        "decision_canonical": canon_text(paraphrase),
        "action_canonical": canon_text("grant the deadline extension"),
    }
    assert direct_vm.run_validator(leader_result=leader_claim) is True
    assert result["consistent"] is True


def test_rule_validator_rejects_arbitrary_downstream_action(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for one extension.", 3000)
    _mock_rule_calls(direct_vm, rule_consistent_response())
    deploy.rule(sid, 4000)

    decision = "Grant the extension once without questions because this is the first miss."
    unrelated = "purchase delivery trucks and repaint the lobby"
    leader_claim = {
        "decision": decision,
        "consistent": True,
        "principles_used": ["Grant a first deadline extension without questions."],
        "action": unrelated,
        "decision_canonical": canon_text(decision),
        "action_canonical": canon_text(unrelated),
    }
    assert direct_vm.run_validator(leader_result=leader_claim) is False


def test_rule_persistence_guard_rejects_action_not_enacting_decision(deploy, direct_vm):
    deploy.boot(1000)
    deploy.teach(
        "Someone asks for a first deadline extension.",
        "Grant it once.",
        "First slips deserve trust.",
        2000,
    )
    sid = deploy.submit_situation("A contributor asks for one extension.", 3000)
    _mock_rule_calls(
        direct_vm,
        rule_consistent_response(action="purchase delivery trucks and repaint the lobby"),
    )
    with direct_vm.expect_revert("downstream action did not enact the decision"):
        deploy.rule(sid, 4000)
    assert deploy.get_actions(0, 20) == []
