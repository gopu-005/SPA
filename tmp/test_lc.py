import requests
import json

BASE_URL = "https://leetcode.com/graphql"

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

def test_query(username="awice"):
    payload = {"query": PROFILE_QUERY, "variables": {"username": username}}
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Referer": "https://leetcode.com"
    }
    
    print("Testing without extra headers:")
    try:
        resp = requests.post(BASE_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
        print(f"Status Code 1: {resp.status_code}")
        if resp.status_code == 200:
            print("Response 1 Keys:", resp.json().keys())
            if "errors" in resp.json():
                print("Errors 1:", resp.json()["errors"][:2])
            else:
                print("Success 1!")
    except Exception as e:
        print("Error 1 Exception:", e)
        
    print("\nTesting with User-Agent & Referer:")
    try:
        resp = requests.post(BASE_URL, json=payload, headers=headers, timeout=15)
        print(f"Status Code 2: {resp.status_code}")
        with open("tmp/lc_response.json", "w", encoding="utf-8") as f:
            f.write(json.dumps(resp.json(), indent=2))
        print("Wrote response to tmp/lc_response.json")
    except Exception as e:
        print("Error 2 Exception:", e)

if __name__ == "__main__":
    test_query()
