import json

from conftest import assessment, payload


def test_ready_result_is_persisted_with_grounded_evidence(deploy, direct_vm):
    result = deploy.submit_check("release-842", payload(), 1000)
    assert result["verdict"] == "ready"
    assert result["confidence"] == "high"
    assert len(result["evidence_excerpts"]) == 4
    assert result["checks"]["tests"]["snippet"] == "418 of 418 tests"
    assert deploy.get_result("release-842") == result
    assert direct_vm.run_validator() is True


def test_failed_check_blocks_release(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        assessment(
            tests="failed",
            categories=["test_failure"],
            blockers=["Integration tests failed."],
        ),
    )
    result = deploy.submit_check("release-failed", payload(), 2000)
    assert result["verdict"] == "blocked"
    assert result["blocker_categories"] == ["test_failure"]


def test_unclear_check_needs_review(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        assessment(
            deployment="unclear",
            confidence="low",
            categories=["insufficient_evidence"],
            blockers=["Deployment evidence is incomplete."],
        ),
    )
    assert deploy.submit_check("release-review", payload(), 3000)["verdict"] == "needs_review"


def test_known_risk_forces_review(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        assessment(
            categories=["known_risk"],
            blockers=["A known database migration risk needs approval."],
        ),
    )
    result = deploy.submit_check("release-risk", payload("Database migration rollback is manual."), 4000)
    assert result["verdict"] == "needs_review"
    assert "known_risk" in result["blocker_categories"]


def test_request_id_is_idempotent_per_sender(deploy, direct_vm):
    deploy.submit_check("same-id", payload(), 1000)
    with direct_vm.expect_revert("request_id already exists for sender"):
        deploy.submit_check("same-id", payload(), 2000)


def test_same_request_id_is_allowed_for_different_senders(deploy, direct_vm, direct_alice, direct_bob):
    first = deploy.submit_check("shared-id", payload(), 1000)
    direct_vm.sender = direct_bob
    other = deploy.submit_check("shared-id", payload(), 2000)
    assert other["request_id"] == "shared-id"
    assert other["sender"] != first["sender"]
    assert deploy.get_result("shared-id")["created_at"] == 2000


def test_get_result_is_sender_scoped(deploy, direct_vm, direct_bob):
    deploy.submit_check("private-id", payload(), 1000)
    direct_vm.sender = direct_bob
    assert deploy.get_result("private-id") is None


def test_results_are_newest_first_paginated_and_sender_scoped(
    deploy, direct_vm, direct_alice, direct_bob
):
    for index in range(3):
        deploy.submit_check(f"release-{index}", payload(), index + 1)
    assert [item["request_id"] for item in deploy.get_results(0, 2)] == ["release-2", "release-1"]
    assert [item["request_id"] for item in deploy.get_results(2, 2)] == ["release-0"]
    assert deploy.get_results(0, 0) == []

    direct_vm.sender = direct_bob
    deploy.submit_check("bob-only", payload(), 9)
    assert [item["request_id"] for item in deploy.get_results(0, 20)] == ["bob-only"]

    direct_vm.sender = direct_alice
    assert [item["request_id"] for item in deploy.get_results(0, 20)] == [
        "release-2",
        "release-1",
        "release-0",
    ]


def test_summary_tracks_verdict_counts(deploy, direct_vm):
    deploy.submit_check("ready", payload(), 1)
    direct_vm.clear_mocks()
    direct_vm.mock_llm(
        r".*",
        assessment(build="failed", categories=["build_failure"], blockers=["Build failed."]),
    )
    deploy.submit_check("blocked", payload(), 2)
    assert deploy.get_summary() == {"total": 2, "ready": 1, "blocked": 1, "needs_review": 0}


def test_rejects_malformed_payload_and_missing_fields(deploy, direct_vm):
    with direct_vm.expect_revert("payload_json is invalid JSON"):
        deploy.submit_check("bad-json", "{", 1)
    with direct_vm.expect_revert("test_evidence is required"):
        deploy.submit_check(
            "missing",
            json.dumps(
                {
                    "release_criteria": "criteria",
                    "build_evidence": "build",
                    "test_evidence": "",
                    "deployment_evidence": "deploy",
                }
            ),
            1,
        )


def test_rejects_invalid_request_id(deploy, direct_vm):
    with direct_vm.expect_revert("request_id is invalid"):
        deploy.submit_check("contains spaces", payload(), 1)


def test_rejects_malformed_llm_output(deploy, direct_vm):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", "not json")
    with direct_vm.expect_revert("Model returned no JSON object"):
        deploy.submit_check("bad-model", payload(), 1)


def test_rejects_ungrounded_model_excerpt(deploy, direct_vm):
    claim = json.loads(assessment())
    claim["checks"]["tests"]["snippet"] = "invented test evidence"
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", json.dumps(claim))
    with direct_vm.expect_revert("Evidence snippet is not grounded"):
        deploy.submit_check("ungrounded", payload(), 1)


def test_validator_rejects_verdict_mismatch(deploy, direct_vm):
    # A different load-bearing verdict must be rejected. The mocked leader below
    # normalizes to a "blocked" verdict (a failed test check), while the armed
    # validator independently reaches "ready".
    deploy.submit_check("validator", payload(), 1)
    leader = json.loads(assessment(tests="failed", categories=["test_failure"], blockers=["Tests failed."]))
    assert direct_vm.run_validator(leader_result=leader) is False


def test_validator_accepts_same_verdict_with_differing_confidence(deploy, direct_vm):
    # Consensus compares only the load-bearing verdict, so honest confidence
    # variation still agrees instead of forcing UNDETERMINED.
    deploy.submit_check("confidence", payload(), 1)
    leader = json.loads(assessment(confidence="low"))
    assert direct_vm.run_validator(leader_result=leader) is True
