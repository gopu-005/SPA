from flask import Flask
from flask_cors import CORS

from config import Config
from database.db import db

from routes.analyze import analyze_bp
from routes.history import history_bp
from routes.github import github_bp
from routes.kaggle import kaggle_bp
from routes.leetcode import leetcode_bp
from routes.dashboard import dashboard_bp

app = Flask(__name__)

app.config.from_object(Config)

CORS(app)

db.init_app(app)

with app.app_context():
    db.create_all()

app.register_blueprint(analyze_bp)
app.register_blueprint(history_bp)
app.register_blueprint(github_bp)
app.register_blueprint(kaggle_bp)
app.register_blueprint(leetcode_bp)
app.register_blueprint(dashboard_bp)

@app.route("/")
def home():
    return {
        "message":"Student Performance Analyzer API",
        "status":"running"
    }

if __name__ == "__main__":
    app.run(debug=True)