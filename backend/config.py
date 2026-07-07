import os
import json
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


def _load_kaggle_credentials():
    """Load Kaggle credentials from env vars or kaggle.json file."""
    username = os.getenv("KAGGLE_USERNAME")
    key = os.getenv("KAGGLE_KEY")
    if username and key:
        return username, key

    # Try standard kaggle.json locations
    for path in [
        os.path.join(BASE_DIR, "kaggle.json"),
        os.path.expanduser("~/.kaggle/kaggle.json"),
    ]:
        if os.path.isfile(path):
            with open(path, "r") as f:
                data = json.load(f)
                return data.get("username", ""), data.get("key", "")

    return "", ""


KAGGLE_USERNAME, KAGGLE_KEY = _load_kaggle_credentials()


class Config:
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(BASE_DIR, "students.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
    KAGGLE_USERNAME = KAGGLE_USERNAME
    KAGGLE_KEY = KAGGLE_KEY