# REQUIRED FIRST STEP — the preflight read

**Before touching any table, repo or surface, read what has already been ruled about it.**

```sql
select * from scin_preflight('<the thing you are about to touch>');
```

Pass a table name, a repo slug, a domain, a ticker. It returns the last twenty
rulings, incidents, findings and corrections that mention it.

## Why this exists, and it is not theoretical

On 2026-08-08, **five standing rules were broken after they had been logged.**
Not one was a knowledge gap. Every one was a **retrieval** gap — the rule was
written down, in this database, and nobody read it back. The spine was being
written to and never read from.

## The law, not the history

```sql
select * from current_rules;
```

`spine_events` is the **history** — everything ever ruled, kept forever.
`current_rules` is the **law** — the latest ruling per subject, superseded ones
excluded, small enough to load at the start of a session.

If a rule is not in `current_rules`, it is not in force. If it should be, log it.

## Which rules actually hold

```sql
select rule, kind, mechanism from rule_enforcement order by kind, rule;
```

- `CONSTRAINT` — the database refuses to break it. It will hold.
- `TEST` — CI catches it.
- `PREFERENCE` — **nothing enforces it and it will decay.** That is a forecast,
  not a complaint. It is recorded so nobody is surprised when it does.

Every rule that survived 2026-08-08 was a constraint. Every rule that lived only
in prose decayed within hours. If a rule matters, make it a constraint.

## Honest limit

**Nothing forces a session to run the preflight.** It is listed in
`rule_enforcement` as a PREFERENCE for exactly that reason. Until a gate refuses
work that skipped it, this depends on the reader — including you, now.
