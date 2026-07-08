import json
from datetime import datetime, date, timedelta

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
        tagProblemCounts {
            advanced {
                tagName
                tagSlug
                problemsSolved
            }
            intermediate {
                tagName
                tagSlug
                problemsSolved
            }
            fundamental {
                tagName
                tagSlug
                problemsSolved
            }
        }
    }
    userContestRanking(username: $username) {
        attendedContestsCount
        rating
        topPercentage
    }
    userContestRankingHistory(username: $username) {
        attended
        rating
        ranking
        contest {
            title
            startTime
        }
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
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Referer": "https://leetcode.com"
    }
    try:
        resp = requests.post(
            BASE_URL,
            json=query_body,
            headers=headers,
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

    # Extract topic tag distribution
    tag_counts = matched_user.get("tagProblemCounts") or {}
    topic_distribution = []
    for cat in ["fundamental", "intermediate", "advanced"]:
        tags = tag_counts.get(cat) or []
        for t in tags:
            if t:
                topic_distribution.append({
                    "tag_name": t.get("tagName"),
                    "solved_count": t.get("problemsSolved", 0)
                })

    # Extract contest ranking history trend
    raw_contest_history = data_root.get("userContestRankingHistory") or []
    attended_history = [h for h in raw_contest_history if h and h.get("attended")]
    # sort chronologically by startTime
    attended_history.sort(key=lambda h: h.get("contest", {}).get("startTime", 0))
    
    contest_trend = []
    for h in attended_history:
        start_time = h.get("contest", {}).get("startTime", 0)
        try:
            date_str = datetime.utcfromtimestamp(start_time).strftime("%Y-%m-%d")
        except (ValueError, OSError):
            date_str = ""
        contest_trend.append({
            "contest_name": h.get("contest", {}).get("title"),
            "rating": h.get("rating", 0.0),
            "ranking": h.get("ranking", 0),
            "date": date_str
        })

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
        "topic_distribution": topic_distribution,
        "contest_trend": contest_trend,
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


def sync_leetcode_snapshots(username, profile_data, calendar_data):
    """
    Ensures a student LeetCode snapshot history exists in sqlite.
    If no snapshots exist for username, it auto-generates simulated daily/weekly snapshots
    spanning the last 12 months based on calendar_data submission density.
    Also records today's snapshot.
    Returns the full sorted snapshot list for react line charts.
    """
    from database.db import db
    from database.model import LeetcodeSnapshot
    
    today_date = date.today()
    
    # 1. Query existing snapshots
    existing = LeetcodeSnapshot.query.filter_by(username=username).order_by(LeetcodeSnapshot.recorded_at.asc()).all()
    
    easy = profile_data.get("easy_solved", 0)
    medium = profile_data.get("medium_solved", 0)
    hard = profile_data.get("hard_solved", 0)
    total = profile_data.get("total_solved", 0)
    rating = profile_data.get("contest_rating", 0.0)

    if not existing:
        # Generate simulated 52-week historic snapshots using submission density
        daily_subs = calendar_data.get("daily_submissions", [])
        
        # Accumulate submissions over time
        # Let's map date to daily submission count
        sub_map = {}
        for d in daily_subs:
            try:
                dt = datetime.strptime(d["date"], "%Y-%m-%d").date()
                sub_map[dt] = d["count"]
            except ValueError:
                continue

        # Sort dates
        start_date = today_date - timedelta(days=364)
        dates_list = [start_date + timedelta(days=i) for i in range(365)]
        
        # Build cumulative submissions list
        cumulative_subs = []
        running_sum = 0
        for d in dates_list:
            running_sum += sub_map.get(d, 0)
            cumulative_subs.append((d, running_sum))
        
        total_subs = running_sum
        
        snapshots_to_add = []
        if total_subs > 0:
            # Distribute solved count based on cumulative density (sampled weekly for 52 snapshots)
            # Sample every 7 days, plus today
            sampled_dates = [dates_list[i] for i in range(0, 364, 7)]
            if today_date not in sampled_dates:
                sampled_dates.append(today_date)
            
            for sd in sampled_dates:
                # Find cumulative sum up to sd
                sub_idx = (sd - start_date).days
                idx = max(0, min(364, sub_idx))
                curr_cum = cumulative_subs[idx][1]
                ratio = curr_cum / total_subs
                
                s_easy = int(easy * ratio)
                s_medium = int(medium * ratio)
                s_hard = int(hard * ratio)
                s_total = s_easy + s_medium + s_hard
                
                # Approximate historical rating
                s_rating = rating * ratio if rating else 0.0
                
                snapshots_to_add.append(LeetcodeSnapshot(
                    username=username,
                    easy_solved=s_easy,
                    medium_solved=s_medium,
                    hard_solved=s_hard,
                    total_solved=s_total,
                    contest_rating=s_rating,
                    recorded_at=sd
                ))
        else:
            # If no calendar submissions, assume flat stagnation
            sampled_dates = [dates_list[i] for i in range(0, 364, 7)]
            if today_date not in sampled_dates:
                sampled_dates.append(today_date)
                
            for sd in sampled_dates:
                snapshots_to_add.append(LeetcodeSnapshot(
                    username=username,
                    easy_solved=easy,
                    medium_solved=medium,
                    hard_solved=hard,
                    total_solved=total,
                    contest_rating=rating,
                    recorded_at=sd
                ))
        
        for snap in snapshots_to_add:
            db.session.add(snap)
        db.session.commit()
    else:
        # Check if today's snapshot exists
        today_snap = LeetcodeSnapshot.query.filter_by(username=username, recorded_at=today_date).first()
        if today_snap:
            # Update today's snapshot
            today_snap.easy_solved = easy
            today_snap.medium_solved = medium
            today_snap.hard_solved = hard
            today_snap.total_solved = total
            today_snap.contest_rating = rating
        else:
            # Insert today's snapshot
            today_snap = LeetcodeSnapshot(
                username=username,
                easy_solved=easy,
                medium_solved=medium,
                hard_solved=hard,
                total_solved=total,
                contest_rating=rating,
                recorded_at=today_date
            )
            db.session.add(today_snap)
        db.session.commit()

    # Re-query all snapshots
    all_snaps = LeetcodeSnapshot.query.filter_by(username=username).order_by(LeetcodeSnapshot.recorded_at.asc()).all()
    
    return [
        {
            "date": s.recorded_at.strftime("%Y-%m-%d"),
            "easy": s.easy_solved,
            "medium": s.medium_solved,
            "hard": s.hard_solved,
            "total": s.total_solved,
            "rating": s.contest_rating
        }
        for s in all_snaps
    ]

