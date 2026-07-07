from flask import Blueprint, request, jsonify

from services.github_serviecs import (
    get_github_dashboard,
)
from services.leetcode_services import get_leetcode_data, get_leetcode_calendar
from services.kaggle_service import get_kaggle_data, get_kaggle_activity
from services.scoring import overall_score
from services.summary import generate_summary

from database.db import db
from database.model import History

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard/<username>")
def dashboard_github(username):
    """Single-user GitHub dashboard (backwards compat)."""
    dashboard = get_github_dashboard(username)
    if dashboard["profile"].get("error"):
        return jsonify({"error": dashboard["profile"]["error"], "username": username}), 404

    return jsonify(dashboard)


@dashboard_bp.route("/dashboard/github", methods=["POST"])
def dashboard_github_only():
    """GitHub-only dashboard for a selected range."""
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("github") or "").strip()
    range_key = (data.get("range") or "12m").strip()

    if range_key not in {"6m", "12m"}:
        return jsonify({"error": "Invalid range. Use '6m' or '12m'."}), 400

    if not username:
        return jsonify({"error": "username is required"}), 400

    dashboard = get_github_dashboard(username, range_key=range_key)
    if dashboard["profile"].get("error"):
        return jsonify({"error": dashboard["profile"]["error"], "username": username, "range": range_key}), 404

    return jsonify(dashboard)


@dashboard_bp.route("/dashboard", methods=["POST"])
def dashboard_full():
    """
    Comprehensive dashboard endpoint.
    Accepts all 3 usernames and returns full data for each platform.
    """
    data = request.get_json(silent=True) or {}
    github_username = data.get("github", "").strip()
    leetcode_username = data.get("leetcode", "").strip()
    kaggle_username = data.get("kaggle", "").strip()

    result = {}

    # ── GitHub ──────────────────────────────────────────────────────
    if github_username:
        result["github"] = get_github_dashboard(github_username)
    else:
        result["github"] = None

    # ── LeetCode ────────────────────────────────────────────────────
    if leetcode_username:
        lc_profile = get_leetcode_data(leetcode_username)
        lc_calendar = get_leetcode_calendar(leetcode_username)

        result["leetcode"] = {
            "profile": lc_profile,
            "calendar": lc_calendar,
        }
    else:
        result["leetcode"] = None

    # ── Kaggle ──────────────────────────────────────────────────────
    if kaggle_username:
        kaggle_profile = get_kaggle_data(kaggle_username)
        kaggle_activity = get_kaggle_activity(kaggle_username)

        result["kaggle"] = {
            "profile": kaggle_profile,
            "activity": kaggle_activity,
        }
    else:
        result["kaggle"] = None

    # ── Scores ──────────────────────────────────────────────────────
    scores = [
        result["github"]["profile"].get("score") if result["github"] else None,
        result["leetcode"]["profile"].get("score") if result["leetcode"] else None,
        result["kaggle"]["profile"].get("score") if result["kaggle"] else None,
    ]

    result["overall_score"] = overall_score(scores)

    platforms = {
        "github": result["github"]["profile"] if result["github"] else None,
        "leetcode": result["leetcode"]["profile"] if result["leetcode"] else None,
        "kaggle": result["kaggle"]["profile"] if result["kaggle"] else None,
    }
    result["summary"] = generate_summary({
        "overall_score": result["overall_score"],
        "platforms": platforms,
    })

    # ── Save to history ─────────────────────────────────────────────
    history = History(
        github_username=github_username or None,
        leetcode_username=leetcode_username or None,
        kaggle_username=kaggle_username or None,
        github_score=(platforms.get("github") or {}).get("score"),
        leetcode_score=(platforms.get("leetcode") or {}).get("score"),
        kaggle_score=(platforms.get("kaggle") or {}).get("score"),
        overall_score=result["overall_score"],
        summary=result["summary"],
    )
    db.session.add(history)
    db.session.commit()

    result["history_id"] = history.id

    return jsonify(result)
