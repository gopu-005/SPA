from datetime import datetime
from database.db import db

class History(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    github_username = db.Column(db.String(100))
    leetcode_username = db.Column(db.String(100))
    kaggle_username = db.Column(db.String(100))

    github_score = db.Column(db.Integer)
    leetcode_score = db.Column(db.Integer)
    kaggle_score = db.Column(db.Integer)
    overall_score = db.Column(db.Integer)

    summary = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class LeetcodeSnapshot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    easy_solved = db.Column(db.Integer, default=0)
    medium_solved = db.Column(db.Integer, default=0)
    hard_solved = db.Column(db.Integer, default=0)
    total_solved = db.Column(db.Integer, default=0)
    contest_rating = db.Column(db.Float, default=0.0)
    recorded_at = db.Column(db.Date, nullable=False)