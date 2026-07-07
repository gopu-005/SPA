import os
import math
from datetime import datetime, timedelta

import requests

from services.scoring import github_score

BASE_URL = "https://api.github.com"
GRAPHQL_URL = "https://api.github.com/graphql"
RANGE_WINDOWS = {
    "6m": 183,
    "12m": 365,
}


def _headers():
    """Build request headers, including auth token when available."""
    token = os.getenv("GITHUB_TOKEN", "")
    h = {"Accept": "application/vnd.github+json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


# ── REST: basic profile + repos ────────────────────────────────────────

def get_github_data(username):
    headers = _headers()
    user = requests.get(
        f"{BASE_URL}/users/{username}", headers=headers, timeout=10
    )
    repos = requests.get(
        f"{BASE_URL}/users/{username}/repos?per_page=100&sort=stars&direction=desc",
        headers=headers,
        timeout=10,
    )

    if user.status_code != 200:
        return {"error": "User not found", "username": username, "score": 0}

    user = user.json()
    repos = repos.json() if repos.status_code == 200 else []

    stars = sum(r.get("stargazers_count", 0) for r in repos)
    forks = sum(r.get("forks_count", 0) for r in repos)

    languages = {}
    for repo in repos:
        if repo.get("language"):
            languages[repo["language"]] = languages.get(repo["language"], 0) + 1

    top_repo = None
    if repos:
        top_repo = max(repos, key=lambda x: x.get("stargazers_count", 0))

    result = {
        "name": user.get("name"),
        "username": user.get("login"),
        "bio": user.get("bio"),
        "followers": user.get("followers", 0),
        "following": user.get("following", 0),
        "public_repos": user.get("public_repos", 0),
        "stars": stars,
        "forks": forks,
        "languages": languages,
        "top_repository": {
            "name": top_repo["name"] if top_repo else None,
            "stars": top_repo["stargazers_count"] if top_repo else 0,
        },
        "profile_url": user.get("html_url"),
        "avatar": user.get("avatar_url"),
        "created_at": user.get("created_at"),
    }

    result["score"] = github_score(result)
    return result


# ── REST: top N repos with full details ─────────────────────────────────

def get_top_repositories(username, limit=5):
    """Return the top repos by stargazers with extra metadata."""
    headers = _headers()
    resp = requests.get(
        f"{BASE_URL}/users/{username}/repos?per_page=100&sort=stars&direction=desc",
        headers=headers,
        timeout=10,
    )
    if resp.status_code != 200:
        return []

    repos = resp.json()
    # Sort by stars then by recent push
    repos.sort(
        key=lambda r: (r.get("stargazers_count", 0), r.get("pushed_at", "")),
        reverse=True,
    )

    result = []
    for r in repos[:limit]:
        result.append(
            {
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "description": r.get("description") or "",
                "language": r.get("language"),
                "stars": r.get("stargazers_count", 0),
                "forks": r.get("forks_count", 0),
                "watchers": r.get("watchers_count", 0),
                "open_issues": r.get("open_issues_count", 0),
                "url": r.get("html_url"),
                "created_at": r.get("created_at"),
                "updated_at": r.get("updated_at"),
                "pushed_at": r.get("pushed_at"),
                "size": r.get("size", 0),
            }
        )
    return result


# ── GraphQL: contribution calendar ──────────────────────────────────────

CONTRIBUTION_QUERY = """
query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
            color
          }
        }
      }
    }
  }
}
"""


def _range_window(range_key):
    days = RANGE_WINDOWS.get(range_key, RANGE_WINDOWS["12m"])
    end = datetime.utcnow()
    start = end - timedelta(days=days)
    return start.isoformat() + "Z", end.isoformat() + "Z"


def get_github_contributions(username, range_key="12m"):
    """
    Fetch the full contribution calendar via GitHub GraphQL API.
    Returns the raw calendar data plus computed consistency metrics.
    Falls back to an empty structure if no token is configured.
    """
    token = os.getenv("GITHUB_TOKEN", "")
    if not token:
        return {
            "error": "GITHUB_TOKEN not configured — cannot fetch contribution data",
            "calendar": {"weeks": []},
            "total_contributions": 0,
        }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    from_date, to_date = _range_window(range_key)

    try:
        resp = requests.post(
            GRAPHQL_URL,
            json={"query": CONTRIBUTION_QUERY, "variables": {"username": username, "from": from_date, "to": to_date}},
            headers=headers,
            timeout=15,
        )
    except requests.RequestException:
        return {
            "error": "Unable to reach GitHub GraphQL API",
            "calendar": {"weeks": []},
            "total_contributions": 0,
        }

    if resp.status_code != 200:
        return {
            "error": f"GitHub GraphQL returned {resp.status_code}",
            "calendar": {"weeks": []},
            "total_contributions": 0,
        }

    data = resp.json().get("data", {}).get("user", {})
    if not data:
        return {
            "error": "User not found",
            "calendar": {"weeks": []},
            "total_contributions": 0,
        }

    collection = data.get("contributionsCollection", {})
    calendar = collection.get("contributionCalendar", {})

    return {
        "total_contributions": calendar.get("totalContributions", 0),
        "total_commits": collection.get("totalCommitContributions", 0),
        "total_prs": collection.get("totalPullRequestContributions", 0),
        "total_issues": collection.get("totalIssueContributions", 0),
        "total_repos_created": collection.get("totalRepositoryContributions", 0),
        "calendar": calendar,
    }


def get_github_dashboard(username, range_key="12m"):
    profile = get_github_data(username)
    if profile.get("error"):
        return {
            "profile": profile,
            "contributions": {"error": profile["error"], "calendar": {"weeks": []}, "total_contributions": 0},
            "consistency": compute_consistency({"calendar": {"weeks": []}}),
            "top_repositories": [],
            "activity_timeline": [],
            "collaboration_activity": [],
            "project_quality": [],
            "range": range_key,
        }

    contributions = get_github_contributions(username, range_key=range_key)
    consistency = compute_consistency(contributions)
    top_repos = get_top_repositories(username, limit=5)
    activity_timeline = build_development_timeline(contributions, consistency)
    collaboration_activity = build_collaboration_activity(contributions)
    project_quality = build_project_quality(top_repos)

    return {
        "profile": profile,
        "contributions": contributions,
        "consistency": consistency,
        "top_repositories": top_repos,
        "activity_timeline": activity_timeline,
        "collaboration_activity": collaboration_activity,
        "project_quality": project_quality,
        "range": range_key,
    }


def build_development_timeline(contributions, consistency):
    weekly_data = consistency.get("weekly_data", [])
    if not weekly_data:
        return []

    commits = int(contributions.get("total_commits", 0))
    prs = int(contributions.get("total_prs", 0))
    issues = int(contributions.get("total_issues", 0))
    signal_total = max(commits + prs + issues, 1)

    commit_ratio = commits / signal_total
    pr_ratio = prs / signal_total
    issue_ratio = issues / signal_total

    timeline = []
    for item in weekly_data:
        total = int(item.get("contributions", 0))
        week_label = item.get("week")
        timeline.append(
            {
                "week": week_label,
                "commits": max(0, round(total * commit_ratio)),
                "prs": max(0, round(total * pr_ratio)),
                "issues": max(0, round(total * issue_ratio)),
            }
        )

    return timeline


def build_collaboration_activity(contributions):
    prs = int(contributions.get("total_prs", 0))
    issues = int(contributions.get("total_issues", 0))
    repos = int(contributions.get("total_repos_created", 0))

    if prs == 0 and issues == 0 and repos == 0:
        return []

    return [
        {
            "label": "Opened",
            "prs": max(1, math.ceil(prs * 0.55)) if prs else 0,
            "issues": max(1, math.ceil(issues * 0.7)) if issues else 0,
            "repos": repos,
        },
        {
            "label": "Resolved",
            "prs": max(0, round(prs * 0.45)),
            "issues": max(0, round(issues * 0.3)),
            "repos": max(0, round(repos * 0.25)),
        },
    ]


def build_project_quality(top_repos):
    if not top_repos:
        return []

    now = datetime.utcnow()
    project_quality = []
    for repo in top_repos:
        stars = int(repo.get("stars", 0))
        forks = int(repo.get("forks", 0))
        watchers = int(repo.get("watchers", 0))
        open_issues = int(repo.get("open_issues", 0))

        pushed_at = repo.get("pushed_at")
        freshness_score = 0
        if pushed_at:
            try:
                pushed = datetime.fromisoformat(pushed_at.replace("Z", "+00:00"))
                age_days = max((now - pushed.replace(tzinfo=None)).days, 0)
                freshness_score = max(0, 30 - min(30, age_days // 7))
            except ValueError:
                freshness_score = 10

        score = 20
        score += min(stars * 2, 30)
        score += min(forks * 3, 20)
        score += min(watchers * 1, 10)
        score += freshness_score
        score -= min(open_issues * 2, 15)
        score = max(0, min(score, 100))

        project_quality.append(
            {
                "name": repo.get("name") or "Repository",
                "score": score,
                "explanation": f"{stars} stars, {forks} forks, {watchers} watchers, {open_issues} open issues",
            }
        )

    return project_quality


# ── Consistency metrics computed from the calendar ──────────────────────

def compute_consistency(calendar_data):
    """
    Given contribution calendar data, compute consistency metrics:
    - current_streak, longest_streak, longest_gap
    - active_days, active_weeks, total_weeks
    - avg_per_week, avg_per_active_day
    - consistency_pct  (active_weeks / total_weeks * 100)
    """
    weeks = calendar_data.get("calendar", {}).get("weeks", [])

    if not weeks:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "longest_gap": 0,
            "active_days": 0,
            "total_days": 0,
            "active_weeks": 0,
            "total_weeks": 0,
            "avg_per_week": 0,
            "avg_per_active_day": 0,
            "consistency_pct": 0,
            "busiest_day": None,
            "busiest_day_count": 0,
            "weekly_data": [],
        }

    # Flatten all days
    days = []
    for week in weeks:
        for day in week.get("contributionDays", []):
            days.append(
                {
                    "date": day["date"],
                    "count": day["contributionCount"],
                }
            )

    # Sort by date ascending
    days.sort(key=lambda d: d["date"])

    total_days = len(days)
    active_days = sum(1 for d in days if d["count"] > 0)

    # Streaks & gaps
    current_streak = 0
    longest_streak = 0
    streak = 0
    longest_gap = 0
    gap = 0

    for d in days:
        if d["count"] > 0:
            streak += 1
            if gap > longest_gap:
                longest_gap = gap
            gap = 0
        else:
            if streak > longest_streak:
                longest_streak = streak
            streak = 0
            gap += 1

    # Final edge
    if streak > longest_streak:
        longest_streak = streak
    if gap > longest_gap:
        longest_gap = gap

    # Current streak: count backwards from today/most-recent day
    current_streak = 0
    for d in reversed(days):
        if d["count"] > 0:
            current_streak += 1
        else:
            break

    # Weekly aggregation
    total_weeks = len(weeks)
    active_weeks = 0
    weekly_totals = []
    for week in weeks:
        week_sum = sum(d["contributionCount"] for d in week.get("contributionDays", []))
        weekly_totals.append(week_sum)
        if week_sum > 0:
            active_weeks += 1

    total_contributions = sum(d["count"] for d in days)
    avg_per_week = round(total_contributions / max(total_weeks, 1), 1)
    avg_per_active_day = round(total_contributions / max(active_days, 1), 1)
    consistency_pct = round((active_weeks / max(total_weeks, 1)) * 100)

    # Busiest day
    busiest = max(days, key=lambda d: d["count"])

    # Weekly data for chart (week label + total)
    weekly_data = []
    for i, week in enumerate(weeks):
        first_day = week.get("contributionDays", [{}])[0]
        weekly_data.append(
            {
                "week": first_day.get("date", f"W{i+1}"),
                "contributions": weekly_totals[i],
            }
        )

    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "longest_gap": longest_gap,
        "active_days": active_days,
        "total_days": total_days,
        "active_weeks": active_weeks,
        "total_weeks": total_weeks,
        "avg_per_week": avg_per_week,
        "avg_per_active_day": avg_per_active_day,
        "consistency_pct": consistency_pct,
        "busiest_day": busiest["date"],
        "busiest_day_count": busiest["count"],
        "weekly_data": weekly_data,
    }