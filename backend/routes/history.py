from flask import Blueprint, jsonify

from database.model import History

history_bp = Blueprint("history", __name__)

@history_bp.route("/history")
def history():
    records = History.query.order_by(History.created_at.desc()).all()

    return jsonify(
        {
            "history": [
                {
                    "id": record.id,
                    "github_username": record.github_username,
                    "leetcode_username": record.leetcode_username,
                    "kaggle_username": record.kaggle_username,
                    "github_score": record.github_score,
                    "leetcode_score": record.leetcode_score,
                    "kaggle_score": record.kaggle_score,
                    "overall_score": record.overall_score,
                    "summary": record.summary,
                    "created_at": record.created_at.isoformat() if record.created_at else None,
                }
                for record in records
            ]
        }
    )