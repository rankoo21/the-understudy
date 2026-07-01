import json

from conftest import (
    teach_coheres_response,
    teach_extends_response,
    teach_contradicts_response,
    rule_consistent_response,
    rule_contradictory_response,
)


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
