import json
import os
from pathlib import Path

import pytest

# Workaround for a gltest bug on Windows: the direct-mode loader redirects stdin
# to a temp file with os.dup2, then immediately calls os.unlink on it. Windows
# refuses to delete a file that is still open (the descriptor is now stdin),
# raising PermissionError [WinError 32]. We tolerate that single case; the temp
# file is harmless and gets reclaimed when the run ends.
_real_unlink = os.unlink


def _tolerant_unlink(path, *args, **kwargs):
    try:
        return _real_unlink(path, *args, **kwargs)
    except PermissionError:
        return None


os.unlink = _tolerant_unlink

CONTRACT = str(Path(__file__).resolve().parents[2] / "contracts" / "UnderstudyContract.py")


def teach_coheres_response(rule: str = "Grant a first deadline extension without questions.", locked: bool = True) -> str:
    """A coherent teaching synthesis the leader would return."""
    return json.dumps(
        {
            "relation": "coheres",
            "rule": rule,
            "locked": locked,
            "tension": "",
        }
    )


def teach_extends_response(rule: str = "Ask for a recovery plan when a pattern of misses exists.", locked: bool = True) -> str:
    return json.dumps(
        {
            "relation": "extends",
            "rule": rule,
            "locked": locked,
            "tension": "",
        }
    )


def teach_contradicts_response() -> str:
    """A contradictory teaching synthesis: must be flagged, never blended."""
    return json.dumps(
        {
            "relation": "contradicts",
            "rule": "Never grant any extension under any circumstance.",
            "locked": False,
            "tension": "Conflicts with the locked rule that grants a first extension.",
        }
    )


def rule_consistent_response(decision: str = "Grant the extension once, no questions.") -> str:
    return json.dumps(
        {
            "decision": decision,
            "consistent": True,
            "principles_used": ["Grant a first deadline extension without questions."],
        }
    )


def rule_contradictory_response(decision: str = "Refuse the request outright and penalize them.") -> str:
    return json.dumps(
        {
            "decision": decision,
            "consistent": False,
            "principles_used": ["Grant a first deadline extension without questions."],
        }
    )


@pytest.fixture
def deploy(direct_deploy, direct_vm, direct_alice):
    """Deploy the understudy with alice as owner and a sane default mock."""
    # Set the sender before deploy so the constructor records alice as owner.
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    # Default LLM mock: a coherent lesson, so tests opt in to other paths.
    direct_vm.mock_llm(r".*", teach_coheres_response())
    return contract
