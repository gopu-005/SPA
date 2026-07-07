import json

import requests

from services.scoring import leetcode_score

BASE_URL = "https://leetcode.com/graphql"

# ── Profile + stats query ───────────────────────────────────────────────

PROFILE_QUERY = """
query userProfile($username: String!) {
    matchedUser(username: $username) {
        username
        profile {
            realName
            userAvatar
            ranking
            reputation
        }
        submitStats: submitStatsGlobal {
            acSubmissionNum {
                difficulty
                count
            }
        }
        contestBadge {
            name
        }
    }
    userContestRanking(username: $username) {
        attendedContestsCount
        rating
        topPercentage
    }
}
"""

# ── Submission calendar query ───────────────────────────────────────────

CALENDAR_QUERY = """
query userProfileCalendar($username: String!, $year: Int) {
    matchedUser(username: $username) {
        userCalendar(year: $year) {
            activeYears
            streak
            totalActiveDays
            submissionCalendar
        }
    }
}
"""


def _post_graphql(query_body):
    """Send a GraphQL query to LeetCode and return the parsed JSON."""
    try:
        resp = requests.post(
            BASE_URL,
            json=query_body,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    return resp.json()


def get_leetcode_data(username):
    payload = _post_graphql(
        {"query": PROFILE_QUERY, "variables": {"username": username}}
    )

    if not payload:
        return {"username": username, "error": "Unable to reach LeetCode", "score": 0}

    data_root = payload.get("data", {})
    matched_user = data_root.get("matchedUser")

    if not matched_user:
        return {"username": username, "error": "User not found", "score": 0}

    contest_ranking = data_root.get("userContestRanking") or {}
    ac_submission_num = matched_user.get("submitStats", {}).get("acSubmissionNum", [])
    solved = {
        item.get("difficulty", "").lower(): item.get("count", 0)
        for item in ac_submission_num
    }

    result = {
        "username": username,
        "name": matched_user.get("profile", {}).get("realName"),
        "avatar": matched_user.get("profile", {}).get("userAvatar"),
        "profile_url": f"https://leetcode.com/u/{username}/",
        "easy_solved": solved.get("easy", 0),
        "medium_solved": solved.get("medium", 0),
        "hard_solved": solved.get("hard", 0),
        "total_solved": solved.get("all", 0),
        "contest_rating": contest_ranking.get("rating", 0),
        "contests_attended": contest_ranking.get("attendedContestsCount", 0),
        "top_percentage": contest_ranking.get("topPercentage", 0),
        "ranking": matched_user.get("profile", {}).get("ranking", 0),
        "reputation": matched_user.get("profile", {}).get("reputation", 0),
    }

    result["score"] = leetcode_score(result)
    return result


def get_leetcode_calendar(username):
    """
    Fetch the LeetCode submission calendar via GraphQL.
    Returns:
      - streak, totalActiveDays, activeYears
      - daily_submissions: list of {date, count} for the past year
    """
    payload = _post_graphql(
        {"query": CALENDAR_QUERY, "variables": {"username": username}}
    )

    if not payload:
        return {
            "error": "Unable to reach LeetCode",
            "streak": 0,
            "total_active_days": 0,
            "daily_submissions": [],
        }

    matched_user = (payload.get("data", {}).get("matchedUser")) or {}
    calendar = matched_user.get("userCalendar") or {}

    streak = calendar.get("streak", 0)
    total_active_days = calendar.get("totalActiveDays", 0)
    active_years = calendar.get("activeYears", [])

    # submissionCalendar is a JSON string: {"timestamp": count, ...}
    raw_calendar = calendar.get("submissionCalendar", "{}")
    try:
        timestamp_map = json.loads(raw_calendar) if isinstance(raw_calendar, str) else (raw_calendar or {})
    except (json.JSONDecodeError, TypeError):
        timestamp_map = {}

    # Convert timestamps to ISO date strings and sort
    from datetime import datetime

    daily_submissions = []
    for ts_str, count in timestamp_map.items():
        try:
            ts = int(ts_str)
            dt = datetime.utcfromtimestamp(ts)
            daily_submissions.append(
                {
                    "date": dt.strftime("%Y-%m-%d"),
                    "count": count,
                }
            )
        except (ValueError, OSError):
            continue

    daily_submissions.sort(key=lambda d: d["date"])

    # Compute consistency metrics
    total_days_span = len(set(d["date"] for d in daily_submissions))
    total_submissions = sum(d["count"] for d in daily_submissions)

    # Weekly aggregation (for chart)
    from collections import defaultdict

    week_map = defaultdict(int)
    for d in daily_submissions:
        # Get ISO week
        dt = datetime.strptime(d["date"], "%Y-%m-%d")
        week_key = dt.strftime("%Y-W%U")
        week_map[week_key] += d["count"]

    weekly_data = [
        {"week": k, "submissions": v} for k, v in sorted(week_map.items())
    ]

    return {
        "streak": streak,
        "total_active_days": total_active_days,
        "active_years": active_years,
        "daily_submissions": daily_submissions,
        "weekly_data": weekly_data[-52:],  # Last 52 weeks
        "total_submissions": total_submissions,
    }
