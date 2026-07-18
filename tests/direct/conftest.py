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


def rule_consistent_response(
    decision: str = "Grant the extension once without questions, since no deadline was missed before.",
    action: str = "grant the deadline extension",
) -> str:
    # A grounded, consistent ruling: the decision shares substance with the
    # stored principle set, and it authorizes a concrete downstream action.
    return json.dumps(
        {
            "decision": decision,
            "consistent": True,
            "principles_used": ["Grant a first deadline extension without questions."],
            "action": action,
            "decision_canonical": canon_text(decision),
            "action_canonical": canon_text(action),
        }
    )


def rule_contradictory_response(decision: str = "Refuse the request outright and penalize them.") -> str:
    return json.dumps(
        {
            "decision": decision,
            "consistent": False,
            "principles_used": ["Grant a first deadline extension without questions."],
            "action": "",
            "decision_canonical": canon_text(decision),
            "action_canonical": "",
        }
    )


def rule_audit_response(consistent: bool = True, grounded: bool = True) -> str:
    """The independent consistency audit the validator runs on the leader's
    exact decision. Returns only the verdict fields the audit prompt asks for."""
    return json.dumps({"consistent": consistent, "grounded": grounded})


def rule_offtopic_consistent_response() -> str:
    """A ruling that claims to be consistent but whose decision text is not
    grounded in the principle set at all (zero overlap). A validator that judges
    the SUBSTANCE of the decision must reject this even though consistent=true."""
    return json.dumps(
        {
            "decision": "Buy a fleet of delivery trucks and repaint the lobby.",
            "consistent": True,
            "principles_used": ["Grant a first deadline extension without questions."],
            "action": "purchase trucks",
            "decision_canonical": canon_text("Buy a fleet of delivery trucks and repaint the lobby."),
            "action_canonical": canon_text("purchase trucks"),
        }
    )


# ---------------------------------------------------------------------------
# Canonicalization mirror.
#
# These mirror the contract's _canon_tokens / _canon_text exactly so tests can
# assert that the stored canonical form (the consensus-agreed substance) matches
# the algorithm the validators run. If the contract's canonicalizer changes,
# this mirror must change with it.
# ---------------------------------------------------------------------------

_STOPWORDS = frozenset(
    {
        "the", "a", "an", "to", "of", "and", "or", "for", "in", "on", "at",
        "by", "with", "is", "are", "be", "it", "its", "this", "that", "these",
        "those", "as", "from", "your", "you", "their", "them", "they", "if",
        "then", "else", "do", "does", "will", "would", "should", "must", "can",
        "may", "we", "i", "he", "she", "his", "her", "our", "but", "so",
    }
)


def canon_tokens(text: str) -> list:
    if text is None:
        return []
    s = str(text).lower()
    cleaned = []
    for ch in s:
        cleaned.append(ch if ch.isalnum() else " ")
    words = "".join(cleaned).split()
    seen = {}
    for w in words:
        if len(w) < 3 or w in _STOPWORDS:
            continue
        seen[w] = True
    return sorted(seen.keys())


def canon_text(text: str) -> str:
    return " ".join(canon_tokens(text))


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
