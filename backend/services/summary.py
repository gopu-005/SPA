def _platform_line(name, data):
	if not data or data.get("error"):
		return f"{name}: no public data could be collected."

	score = data.get("score", 0)
	return f"{name}: score {score}/100."


def generate_summary(report):
	overall_score = report.get("overall_score", 0)
	platforms = report.get("platforms", {})

	lines = [
		f"Overall performance score: {overall_score}/100.",
		_platform_line("GitHub", platforms.get("github")),
		_platform_line("LeetCode", platforms.get("leetcode")),
		_platform_line("Kaggle", platforms.get("kaggle")),
	]

	if overall_score >= 80:
		lines.append("The student is performing strongly across the tracked platforms.")
	elif overall_score >= 50:
		lines.append("The student shows moderate activity and can improve consistency.")
	else:
		lines.append("The student needs more consistent public activity and problem-solving output.")

	return " ".join(lines)
