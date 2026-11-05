# Setup, running and backup

## You need

- A Bash terminal: Terminal on macOS/Linux; **Git Bash** or **WSL** on Windows (PowerShell and
  Command Prompt cannot run `bash run_app.sh`).
- `git`, and Python 3.10+ (or Node.js 20+ if you and your agent choose a JavaScript app).
- An AI coding agent that can read and edit this folder and has a **Plan mode**.

## First run

1. Unzip the starter and open the folder in your agent.
2. Give it the starting prompt from the guide's *Setup & run* page. It reads `AGENT_BRIEF.md`,
   inspects the data and project, explains the setup and prepares the environment.
3. Check the data loads: `python3 load_data.py data/<your file>.csv` (on Windows Git Bash, `python` may be the command).

## Run the app (after stage 2)

```bash
bash run_app.sh
```

- Run it yourself, in a terminal whose current folder is this project.
- Open the address it prints (usually `http://localhost:` followed by a port number).
- Stop it with **Ctrl+C** in that terminal.
- If it fails, copy the **first error line** and the command you ran into your agent. On Windows,
  `\r` or "bad interpreter" errors mean Windows line endings: ask the agent to save `run_app.sh`
  with LF line endings (`.gitattributes` already asks git to keep them).

## Back up with git

Create an empty repository on GitHub (or your course's host), then in this folder:

```bash
git init -b main
git add .
git commit -m "Starter"
git remote add origin https://github.com/<username>/<repository>.git
git push -u origin main
```

Commit and push after each stage. A commit is not a backup until it is pushed. Never commit passwords or API keys.

## Publishing (optional unless your course requires it)

Running locally with `bash run_app.sh` is enough for this activity unless your instructor asks
for a public link. If they do, see the guide's *Setup & run* page. A published app must do live
sampling and user-controlled challenges itself; static exported results are not enough.
