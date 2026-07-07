def _clamp(value, minimum=0, maximum=100):
    return max(minimum, min(value, maximum))


def github_score(data):
    score = 0
    score += min(int(data.get("followers", 0)) // 10, 20)
    score += min(int(data.get("public_repos", 0)), 20)
    score += min(int(data.get("stars", 0)) // 20, 30)
    score += min(len(data.get("languages", {})) * 5, 15)
    score += 15
    return _clamp(score)


def leetcode_score(data):
    score = 0
    score += min(int(data.get("easy_solved", 0)) * 2, 30)
    score += min(int(data.get("medium_solved", 0)) * 3, 35)
    score += min(int(data.get("hard_solved", 0)) * 5, 25)
    contest_rating = data.get("contest_rating") or 0
    score += min(int(contest_rating) // 50, 10)
    return _clamp(score)


def kaggle_score(data):
    score = 0
    score += min(int(data.get("competitions_participated", 0)) * 8, 30)
    score += min(int(data.get("medals", 0)) * 10, 30)
    score += min(int(data.get("datasets", 0)) * 4, 15)
    score += min(int(data.get("notebooks", 0)) * 3, 15)
    score += min(int(data.get("followers", 0)) // 10, 10)
    return _clamp(score)


def overall_score(scores):
    values = [int(score) for score in scores if score is not None]
    if not values:
        return 0
    return round(sum(values) / len(values))