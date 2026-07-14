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

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

class LeetcodeSnapshot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    easy_solved = db.Column(db.Integer, default=0)
    medium_solved = db.Column(db.Integer, default=0)
    hard_solved = db.Column(db.Integer, default=0)
    total_solved = db.Column(db.Integer, default=0)
    contest_rating = db.Column(db.Float, default=0.0)
    recorded_at = db.Column(db.Date, nullable=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

class KaggleSnapshot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    notebooks_count = db.Column(db.Integer, default=0)
    datasets_count = db.Column(db.Integer, default=0)
    competitions_count = db.Column(db.Integer, default=0)
    followers_count = db.Column(db.Integer, default=0)
    medals_competitions = db.Column(db.Integer, default=0)
    medals_notebooks = db.Column(db.Integer, default=0)
    medals_datasets = db.Column(db.Integer, default=0)
    medals_discussions = db.Column(db.Integer, default=0)
    total_notebook_votes = db.Column(db.Integer, default=0)
    total_dataset_votes = db.Column(db.Integer, default=0)
    best_competition_rank = db.Column(db.Integer, default=0)
    recorded_at = db.Column(db.Date, nullable=False)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
