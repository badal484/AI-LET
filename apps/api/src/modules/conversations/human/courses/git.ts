import type { Curriculum } from './types.js';

/** Git and GitHub from zero to advanced. Checked against the Pro Git book and GitHub Docs (Oct 2026). */
export const git: Curriculum = {
  id: 'git',
  name: 'Git & GitHub',
  match: /\b(git|github|version control)\b/i,
  codeLang: 'bash',
  docs: 'git-scm.com/book',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What Git is',
          topics: ['version control: saving snapshots of your project', 'Git (the tool) vs GitHub (a website that hosts Git repos)', 'installing Git, git --version, git config user.name and user.email'],
        },
      ],
      project: 'install Git and set your name and email',
    },
    {
      title: 'Basics',
      lessons: [
        {
          title: 'Your first repository',
          topics: ['git init', 'working directory, staging area, commits', 'git status, git add, git commit -m', 'good commit messages'],
        },
        {
          title: 'History',
          topics: ['git log (and --oneline)', 'git diff and git diff --staged', 'git show', '.gitignore (and never committing .env or keys)'],
        },
        {
          title: 'Undoing things',
          topics: ['git restore (discard changes)', 'git restore --staged (unstage)', 'git commit --amend', 'git revert vs git reset (soft, mixed, hard) — and which is safe'],
        },
      ],
      project: 'a repo for one of your projects with 5 meaningful commits and a .gitignore',
    },
    {
      title: 'Branches',
      lessons: [
        {
          title: 'Branching',
          topics: ['what a branch is', 'git branch, git switch (-c), git checkout', 'merging (fast-forward vs merge commit)', 'deleting branches'],
        },
        {
          title: 'Merge conflicts',
          topics: ['why conflicts happen', 'reading conflict markers', 'resolving and committing', 'avoiding conflicts with small, frequent commits'],
        },
        {
          title: 'Stash and tags',
          topics: ['git stash and stash pop', 'tags for releases'],
        },
      ],
      project: 'build a feature on a branch, create a conflict on purpose and resolve it',
    },
    {
      title: 'GitHub',
      lessons: [
        {
          title: 'Remotes',
          topics: ['creating a GitHub repo', 'SSH keys or a personal access token (never share it)', 'git remote, push, pull, fetch, clone', 'what origin and upstream mean'],
        },
        {
          title: 'Collaboration',
          topics: ['forks and pull requests', 'code review and comments', 'issues and project boards', 'contributing to open source (good first issues)'],
        },
        {
          title: 'Your GitHub profile',
          topics: ['a README for each project (what, why, how to run, screenshots)', 'profile README', 'GitHub Pages for a free site'],
        },
      ],
      project: 'push 2 projects with good READMEs and open a pull request to a friend’s or an open-source repo',
    },
    {
      title: 'Advanced Git',
      lessons: [
        {
          title: 'Rewriting history',
          topics: ['git rebase vs merge', 'git rebase -i: squash and reword (only on your own branch)', 'git cherry-pick', 'the golden rule: never rewrite shared history'],
        },
        {
          title: 'Rescue tools',
          topics: ['git reflog to recover lost commits', 'git bisect to find a bad commit', 'git blame', 'if a secret was pushed: rotate it first, then clean history'],
        },
        {
          title: 'Team workflows',
          topics: ['feature-branch / GitHub flow', 'conventional commits', 'protected branches and required reviews', 'GitHub Actions: a first CI workflow'],
        },
      ],
      project: 'final project: set up a repo with branch protection, a PR template and a GitHub Actions workflow that runs tests',
    },
  ],
};
