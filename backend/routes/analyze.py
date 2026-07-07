from flask import Blueprint, request, jsonify

from database.db import db
from database.model import History
from services.github_serviecs import get_github_data
from services.kaggle_service import get_kaggle_data
from services.leetcode_services import get_leetcode_data
from services.scoring import overall_score
from services.summary import generate_summary

analyze_bp = Blueprint("analyze", __name__)

@analyze_bp.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}

    github_username = data.get("github")
    leetcode_username = data.get("leetcode")
    kaggle_username = data.get("kaggle")

    github_data = get_github_data(github_username) if github_username else None
    leetcode_data = (
        get_leetcode_data(leetcode_username) if leetcode_username else None
    )
    kaggle_data = get_kaggle_data(kaggle_username) if kaggle_username else None

    scores = [
        github_data.get("score") if github_data else None,
        leetcode_data.get("score") if leetcode_data else None,
        kaggle_data.get("score") if kaggle_data else None,
    ]

    report = {
        "github": github_data,
        "leetcode": leetcode_data,
        "kaggle": kaggle_data,
        "platforms": {
            "github": github_data,
            "leetcode": leetcode_data,
            "kaggle": kaggle_data,
        },
        "overall_score": overall_score(scores),
    }
    report["summary"] = generate_summary(report)

    history = History(
        github_username=github_username,
        leetcode_username=leetcode_username,
        kaggle_username=kaggle_username,
        github_score=(github_data or {}).get("score"),
        leetcode_score=(leetcode_data or {}).get("score"),
        kaggle_score=(kaggle_data or {}).get("score"),
        overall_score=report["overall_score"],
        summary=report["summary"],
    )
    db.session.add(history)
    db.session.commit()

    report["history_id"] = history.id
    report["message"] = "Analysis completed successfully"

    return jsonify(report)