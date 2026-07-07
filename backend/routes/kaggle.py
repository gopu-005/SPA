from flask import Blueprint, jsonify

from services.kaggle_service import get_kaggle_data

kaggle_bp = Blueprint("kaggle", __name__)


@kaggle_bp.route("/kaggle/<username>")
def kaggle(username):
	return jsonify(get_kaggle_data(username))
