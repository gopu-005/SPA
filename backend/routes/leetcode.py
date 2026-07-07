from flask import Blueprint, jsonify

from services.leetcode_services import get_leetcode_data

leetcode_bp = Blueprint("leetcode", __name__)


@leetcode_bp.route("/leetcode/<username>")
def leetcode(username):
	return jsonify(get_leetcode_data(username))
