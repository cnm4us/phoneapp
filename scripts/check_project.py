#!/usr/bin/env python3
"""Validate the repository's documentation foundation; no third-party dependencies."""

import ast
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "README.md",
    "AGENTS.md",
    "docs/PRD.md",
    "docs/PROJECT_STATE.md",
    "docs/ROADMAP.md",
    "docs/ARCHITECTURE.md",
    "docs/TOOLS.md",
    "docs/DATABASE.md",
    "docs/TESTING.md",
    "docs/WORK_LOG.md",
    "docs/plans/TEMPLATE.md",
    "docs/plans/0001-webrtc-poc.md",
    "docs/decisions/README.md",
    "docs/decisions/0001-project-direction.md",
    "docs/testing/DEVICE_REPORT_TEMPLATE.md",
    "docs/SETUP.md",
    "docs/decisions/0002-webrtc-implementation.md",
    "docs/testing/2026-11-16-poc-foundation.md",
    ".github/pull_request_template.md",
    "docs/templates/docs-workflow.yml",
)
REQ_ID = re.compile(r"\b(?:POC|PAT|TEAM|COM|TIME|TX|REP|OPS)-\d{2}\b")
LINK = re.compile(r"(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)")


def main() -> int:
    errors = []
    for name in REQUIRED:
        path = ROOT / name
        if not path.is_file() or not path.read_text(encoding="utf-8").strip():
            errors.append(f"Missing or empty artifact: {name}")

    documents = [ROOT / "README.md", ROOT / "AGENTS.md"]
    documents.extend(sorted((ROOT / "docs").rglob("*.md")))
    documents.append(ROOT / ".github/pull_request_template.md")
    prd = ROOT / "docs/PRD.md"
    definitions = re.findall(r"^\| ((?:POC|PAT|TEAM|COM|TIME|TX|REP|OPS)-\d{2}) \|", prd.read_text(encoding="utf-8"), re.MULTILINE) if prd.exists() else []
    if len(definitions) != len(set(definitions)):
        errors.append("Duplicate requirement IDs in PRD")

    for document in documents:
        if not document.exists():
            continue
        # Ignore fenced code examples when checking prose links/references.
        content = re.sub(r"```.*?```", "", document.read_text(encoding="utf-8"), flags=re.DOTALL)
        for target in LINK.findall(content):
            parsed = urlsplit(target.strip().strip("<>"))
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            destination = (document.parent / unquote(parsed.path)).resolve()
            if not destination.is_relative_to(ROOT) or not destination.exists():
                errors.append(f"{document.relative_to(ROOT)}: missing/outside-repo link {target}")
        for requirement in sorted(set(REQ_ID.findall(content)) - set(definitions)):
            errors.append(f"{document.relative_to(ROOT)}: undefined requirement {requirement}")

    ast.parse(Path(__file__).read_text(encoding="utf-8"))
    if errors:
        print("Documentation checks failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"PASS: {len(REQUIRED)} required artifacts, {len(documents)} Markdown files, "
          f"{len(definitions)} unique PRD requirements; local file links and requirement references valid.")
    print("Scope: documentation only; application builds, database migrations, and device tests are not covered.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
