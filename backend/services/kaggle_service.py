import os
import re
import json

import requests

from services.scoring import kaggle_score

PROFILE_URL = "https://www.kaggle.com"
API_URL = "https://www.kaggle.com/api/v1"


def _kaggle_auth():
    """Return (username, key) tuple for Kaggle API auth."""
    username = os.getenv("KAGGLE_USERNAME", "")
    key = os.getenv("KAGGLE_KEY", "")
    if username and key:
        return username, key

    for path in [
        os.path.join(os.path.abspath(os.path.dirname(__file__)), "..", "kaggle.json"),
        os.path.expanduser("~/.kaggle/kaggle.json"),
    ]:
        normed = os.path.normpath(path)
        if os.path.isfile(normed):
            with open(normed, "r") as f:
                data = json.load(f)
                return data.get("username", ""), data.get("key", "")

    return "", ""


def _extract_number(pattern, text):
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return 0
    return int(match.group(1).replace(",", ""))


def get_kaggle_data(username):
    """Fetch Kaggle profile data via API or scraping."""
    kaggle_user, kaggle_key = _kaggle_auth()

    if kaggle_user and kaggle_key:
        try:
            datasets_resp = requests.get(
                f"{API_URL}/datasets/list",
                params={"user": username, "pageSize": 100},
                auth=(kaggle_user, kaggle_key),
                timeout=10,
            )
            kernels_resp = requests.get(
                f"{API_URL}/kernels/list",
                params={"user": username, "pageSize": 100},
                auth=(kaggle_user, kaggle_key),
                timeout=10,
            )

            datasets = datasets_resp.json() if datasets_resp.status_code == 200 else []
            kernels = kernels_resp.json() if kernels_resp.status_code == 200 else []

            if not isinstance(datasets, list):
                datasets = []
            if not isinstance(kernels, list):
                kernels = []

            total_dataset_votes = sum(d.get("totalVotes", 0) for d in datasets)
            total_kernel_votes = sum(k.get("totalVotes", 0) for k in kernels)

            data = {
                "username": username,
                "profile_url": f"{PROFILE_URL}/{username}",
                "name": None,
                "followers": 0,
                "competitions_participated": 0,
                "datasets": len(datasets),
                "notebooks": len(kernels),
                "medals": 0,
                "total_dataset_votes": total_dataset_votes,
                "total_notebook_votes": total_kernel_votes,
                "api_authenticated": True,
            }
            data["score"] = kaggle_score(data)
            return data
        except requests.RequestException:
            pass

    # Fallback: scrape
    url = f"{PROFILE_URL}/{username}"
    try:
        response = requests.get(
            url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10
        )
    except requests.RequestException:
        return {
            "username": username,
            "profile_url": url,
            "error": "Unable to reach Kaggle",
            "score": 0,
        }

    if response.status_code != 200:
        return {
            "username": username,
            "profile_url": url,
            "error": "User not found",
            "score": 0,
        }

    html = response.text
    data = {
        "username": username,
        "profile_url": url,
        "name": None,
        "followers": _extract_number(r"Followers[^0-9]*([0-9,]+)", html),
        "competitions_participated": _extract_number(r"Competitions[^0-9]*([0-9,]+)", html),
        "datasets": _extract_number(r"Datasets[^0-9]*([0-9,]+)", html),
        "notebooks": _extract_number(r"Notebooks[^0-9]*([0-9,]+)", html),
        "medals": _extract_number(r"Medals?[^0-9]*([0-9,]+)", html),
    }
    data["score"] = kaggle_score(data)
    return data


def get_kaggle_activity(username):
    """
    Fetch detailed Kaggle activity: datasets, notebooks with details.
    Returns structured data for visualization.
    """
    kaggle_user, kaggle_key = _kaggle_auth()

    result = {
        "datasets_list": [],
        "notebooks_list": [],
        "competitions_list": [],
        "activity_timeline": [],
    }

    if not (kaggle_user and kaggle_key):
        return result

    try:
        # Datasets
        ds_resp = requests.get(
            f"{API_URL}/datasets/list",
            params={"user": username, "pageSize": 50},
            auth=(kaggle_user, kaggle_key),
            timeout=10,
        )
        if ds_resp.status_code == 200:
            datasets = ds_resp.json()
            if isinstance(datasets, list):
                for d in datasets:
                    result["datasets_list"].append({
                        "title": d.get("title", ""),
                        "url": f"https://www.kaggle.com/datasets/{d.get('ref', '')}",
                        "votes": d.get("totalVotes", 0),
                        "downloads": d.get("downloadCount", 0),
                        "size": d.get("totalBytes", 0),
                        "last_updated": d.get("lastUpdated", ""),
                        "tags": [t.get("name", "") for t in d.get("tags", [])[:5]],
                    })

        # Notebooks/Kernels
        k_resp = requests.get(
            f"{API_URL}/kernels/list",
            params={"user": username, "pageSize": 50},
            auth=(kaggle_user, kaggle_key),
            timeout=10,
        )
        if k_resp.status_code == 200:
            kernels = k_resp.json()
            if isinstance(kernels, list):
                for k in kernels:
                    result["notebooks_list"].append({
                        "title": k.get("title", ""),
                        "url": f"https://www.kaggle.com/code/{k.get('ref', '')}",
                        "votes": k.get("totalVotes", 0),
                        "language": k.get("language", ""),
                        "last_run": k.get("lastRunTime", ""),
                        "kernel_type": k.get("kernelType", ""),
                    })

                # Build activity timeline from notebook run dates
                from collections import defaultdict

                monthly = defaultdict(int)
                for k in kernels:
                    lr = k.get("lastRunTime", "")
                    if lr and len(lr) >= 7:
                        month_key = lr[:7]  # "YYYY-MM"
                        monthly[month_key] += 1

                result["activity_timeline"] = [
                    {"month": m, "count": c} for m, c in sorted(monthly.items())
                ]

    except requests.RequestException:
        pass

    return result
