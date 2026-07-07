# TODO - GitHub Student Performance Analytics Dashboard

## Backend (Flask)
- [x] Add GitHub-only endpoint: `POST /dashboard/github` supporting `range` = `6m` or `12m`.
- [x] Extend GitHub services to fetch development timeline (commits, PRs, issues) for the selected range.
- [x] Extend GitHub services to compute collaboration activity via GraphQL search (PRs/issues opened/merged/closed where possible).
- [x] Implement explainable project-quality scoring for top repositories (not based only on stars).
- [ ] Add GitHub snapshot persistence (JSON/text) into database model.
- [ ] Update history route to return GitHub snapshots.

## Frontend (React)
- [x] Install/enable Recharts and implement required charts:
  - [x] Development Activity Over Time (multi-series line + range selector)
  - [x] Contribution Consistency (calendar heatmap + streak stats)
  - [x] Technical Skill Distribution (donut language distribution)
  - [x] Project Quality (horizontal bar chart with explainable score)
  - [x] Collaboration Activity (grouped bar chart)
- [x] Implement teacher insight text from metrics.
- [x] Refactor UI layout to match: timeline top; 4 metrics in responsive 2-column grid.
- [x] Keep existing multi-platform `/dashboard` working.

## Validation
- [x] Manual test with a known GitHub username.
- [ ] Verify charts render with empty/fallback data.
- [ ] Verify PDF export still works (if used).

