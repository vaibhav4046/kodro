# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial repository scaffold: directory tree, `pyproject.toml`, CI workflows,
  governance files, empty module stubs with docstrings.
- Public, procedural pupil-facing API
  (`robolearn.rover_api`) with all 16 locked-in signatures from Section 4
  of the build spec — driving, sensing, acting, plus a console `log()`.
  Inputs are clamped (NaN / ±inf / out-of-range → safe default, warning
  logged); no function ever raises. Package root re-exports every public
  symbol so `from robolearn import move_forward` works alongside the
  explicit `from robolearn.rover_api import move_forward`.
