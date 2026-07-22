import json
import os
from pathlib import Path

import pytest

_real_unlink = os.unlink


def _tolerant_unlink(path, *args, **kwargs):
    try:
        return _real_unlink(path, *args, **kwargs)
    except PermissionError:
        return None


os.unlink = _tolerant_unlink
CONTRACT = str(Path(__file__).resolve().parents[2] / "contracts" / "ReleaseGateContract.py")


def payload(known_risks=""):
    return json.dumps(
        {
            "release_criteria": "Build succeeds, tests pass, and canary deployment is healthy.",
            "build_evidence": "Build 842 completed successfully with signed artifacts.",
            "test_evidence": "Unit and integration suites passed: 418 of 418 tests.",
            "deployment_evidence": "Canary deployment is healthy in us-east with rollback verified.",
            "known_risks": known_risks,
        }
    )


def assessment(
    criteria="passed",
    build="passed",
    tests="passed",
    deployment="passed",
    confidence="high",
    categories=None,
    blockers=None,
):
    categories = categories or []
    blockers = blockers or []
    return json.dumps(
        {
            "confidence": confidence,
            "explanation": "Evidence was compared directly against the stated release criteria.",
            "checks": {
                "criteria": {"status": criteria, "snippet": "Build succeeds, tests pass"},
                "build": {"status": build, "snippet": "Build 842 completed successfully"},
                "tests": {"status": tests, "snippet": "418 of 418 tests"},
                "deployment": {"status": deployment, "snippet": "Canary deployment is healthy"},
            },
            "blocker_categories": categories,
            "blockers": blockers,
        }
    )


@pytest.fixture
def deploy(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.mock_llm(r".*", assessment())
    return contract
