# Contributing to ClawBody

First off, thank you for considering contributing to ClawBody! Every contribution matters — whether it's a bug report, feature request, documentation improvement, or code change.

## 🚀 Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Set up** the development environment (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md))
4. **Create a branch** for your changes: `git checkout -b feat/my-feature`
5. **Make your changes** and test them
6. **Submit a pull request**

## 📋 Development Setup

```bash
# Prerequisites: Node.js 20+, Rust 1.75+
git clone https://github.com/YOUR_USERNAME/clawbody.git
cd clawbody
npm install
cargo tauri dev
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed instructions.

## 🐛 Reporting Bugs

Use the [Bug Report](https://github.com/YUJIE2002/ClawBody/issues/new?template=bug_report.md) template. Include:

- Your OS and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## 💡 Requesting Features

Use the [Feature Request](https://github.com/YUJIE2002/ClawBody/issues/new?template=feature_request.md) template. We especially welcome:

- New emotion expressions
- Animation improvements
- Platform-specific enhancements
- OpenClaw integration ideas

## 🔧 Code Guidelines

### General

- **TypeScript** for all frontend code (strict mode)
- **Rust** for all Tauri backend code
- Write meaningful commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
- Keep PRs focused — one feature or fix per PR

### Frontend (TypeScript/React)

- Functional components with hooks
- Use `const` over `let` where possible
- Document exported functions with JSDoc comments
- CSS in `src/styles/` — no inline styles except for dynamic values

### Backend (Rust)

- Follow `clippy` recommendations
- Document public functions with `///` doc comments
- Handle errors explicitly — no `.unwrap()` in production paths

### Commit Messages

```
feat: add new emotion expression for "thinking"
fix: resolve transparent window flickering on macOS
docs: update development setup guide
refactor: extract VRM loading into separate module
```

## 📝 Pull Request Process

1. Update documentation if your change affects the API or user-facing behavior
2. Ensure CI passes (build + lint)
3. Request review from a maintainer
4. Squash commits before merge if requested

## 🤝 Code of Conduct

Be kind. Be respectful. We're all here to build something cool.

## 📜 License

By contributing to ClawBody, you agree that your contributions will be licensed under the MIT License.
