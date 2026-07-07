from flask import Blueprint, jsonify
from services.github_serviecs import get_github_data

github_bp = Blueprint("github", __name__)


@github_bp.route("/github/<username>")
def github(username):
    return jsonify(get_github_data(username))