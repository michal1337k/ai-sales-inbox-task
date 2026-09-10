# Submission

## Assumptions

- The provided AI endpoint is treated as a deterministic fixture and no external AI provider is integrated.
- Form number fields are stored as strings in React state and converted to numbers when creating a lead.
- Empty optional `material` and `budget` values are sent as `null`.
- Re-running AI extraction only fills fields that are currently empty and preserves manual user edits.
- New lead status is controlled exclusively by the backend and always starts as `NEW`.


## AI usage

I used ChatGPT as a coding assistant while implementing the task. It was used to discuss the requirements, review implementation decisions, explain unfamiliar TypeScript/React/Zod concepts, and help identify edge cases and test scenarios.

## Verification

I carefully verified the AI-assisted lead status flow.

I tested that a newly created lead starts as `NEW`, can be changed to `CONTACTED` through `PATCH /api/leads/:leadId/status`, updates in the UI without a page reload, and remains `CONTACTED` after refreshing the page.

I also verified validation cases including invalid lead payloads, missing source messages, unsupported status values, repeated status transitions, and unexpected fields.
