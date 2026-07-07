# syntax=docker/dockerfile:1
FROM python:3.13

ARG UID=1000
ARG GID=1000

# TeX Live for the CV builder LaTeX -> PDF compile. The curated set below
# covers the sample CV packages: fontawesome5, cfr-lm, tcolorbox, marvosym,
# multicol, titlesec, enumitem, tabularx, ragged2e.
# lmodern is required by cfr-lm — it provides the Latin Modern font descriptors
# (e.g. omllmm.fd); without it pdflatex fails with "NFSS system isn't set up
# properly / No file OMLlmm.fd". Verified: both sample CVs compile with this set.
#
# BuildKit cache mounts keep the downloaded .deb files and apt index on the host
# across builds, so editing this package list re-installs from local cache instead
# of re-downloading ~1 GB of TeX Live. The mounts are build-time only (not baked
# into the image), so the image stays small without the usual rm of apt lists.
# Removing docker-clean stops the base image from discarding the cached .debs.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base texlive-latex-recommended texlive-latex-extra \
    texlive-fonts-recommended texlive-fonts-extra lmodern \
    latexmk

# requirements.lock is the enforced pip freeze (requirements.txt states intent,
# unpinned). Regeneration procedure: .claude/rules/python-compute.md.
COPY requirements.lock .
RUN pip install -r requirements.lock

WORKDIR /src
