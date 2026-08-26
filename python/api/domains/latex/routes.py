"""
latex/routes.py — LaTeX -> PDF compilation for the CV builder.

Node.js assembles a complete .tex string (schema/helpers/cvAssemble.js) and POSTs
it here. This module writes it into a throwaway temp directory, runs pdflatex
twice (references and section rules settle on the second pass), and streams the
PDF back. On failure it returns the tail of the TeX log so the UI can explain why.

Security (compile is arbitrary code execution — these are mandatory):
  * shell escape DISABLED (-no-shell-escape) so \\write18{...} cannot run commands
  * compilation happens only inside a tempfile.TemporaryDirectory(), never the repo
  * a hard subprocess timeout, killed on expiry
  * -interaction=nonstopmode -halt-on-error so it never blocks waiting for input

Python owns compilation and touches nothing else — no DB, no network.
"""

import io
import os
import subprocess
import tempfile

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/latex")

COMPILE_TIMEOUT = 60  # seconds, per pdflatex pass
PASSES = 2

# Confine pdflatex to its own temp directory. -no-shell-escape blocks \write18
# (command execution) but NOT \input / \openin (file reads), and stock TeX Live
# ships openin_any = a — read anything. The .tex source here is caller-authored
# (CV nodes are registered-tier), so without this a signed-in user could
# \input an arbitrary path and read it back out of the PDF or the failure log.
# 'p' = paranoid: no absolute paths, no parent directories, no dotfiles.
# See the shelling-out rule in .claude/rules/python-compute.md.
TEX_ENV = {**os.environ, "openin_any": "p", "openout_any": "p"}


class CompileRequest(BaseModel):
    latex_source: str
    filename: str = "cv.pdf"


def _log_tail(text: str, lines: int = 40) -> str:
    return "\n".join(text.splitlines()[-lines:])


@router.post("/compile")
def compile_latex(req: CompileRequest):
    with tempfile.TemporaryDirectory() as tmp:
        tex_path = os.path.join(tmp, "cv.tex")
        pdf_path = os.path.join(tmp, "cv.pdf")
        with open(tex_path, "w", encoding="utf-8") as fh:
            fh.write(req.latex_source)

        last = None
        for _ in range(PASSES):
            try:
                last = subprocess.run(
                    [
                        "pdflatex",
                        "-no-shell-escape",
                        "-interaction=nonstopmode",
                        "-halt-on-error",
                        "-output-directory", tmp,
                        tex_path,
                    ],
                    cwd=tmp,
                    env=TEX_ENV,
                    capture_output=True,
                    text=True,
                    timeout=COMPILE_TIMEOUT,
                )
            except subprocess.TimeoutExpired:
                return JSONResponse(
                    status_code=422,
                    content={"error": "LaTeX compilation timed out", "log": ""},
                )
            if last.returncode != 0:
                break

        if not os.path.exists(pdf_path):
            log = ""
            log_path = os.path.join(tmp, "cv.log")
            if os.path.exists(log_path):
                with open(log_path, "r", encoding="utf-8", errors="replace") as lf:
                    log = _log_tail(lf.read())
            elif last is not None:
                log = _log_tail((last.stdout or "") + (last.stderr or ""))
            return JSONResponse(
                status_code=422,
                content={"error": "LaTeX compilation failed", "log": log},
            )

        with open(pdf_path, "rb") as pf:
            data = pf.read()

    safe = (req.filename or "cv.pdf").replace('"', "")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe}"'},
    )
