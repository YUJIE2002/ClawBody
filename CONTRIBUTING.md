# Contributing to ClawBody

Thanks for your interest in contributing! 🎉

## How to Contribute

### Bug Reports
- Open an [Issue](https://github.com/YUJIE2002/ClawBody/issues/new) with steps to reproduce
- Include your OS, ClawBody version, and OpenClaw version

### Feature Requests
- Open an Issue with the "enhancement" label
- Describe the use case, not just the solution

### Pull Requests
1. Fork the repo
2. Create a branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run typecheck` to ensure no TS errors
5. Commit with clear messages
6. Push and open a PR

### Development Setup
```bash
git clone https://github.com/YUJIE2002/ClawBody.git
cd ClawBody
npm install
npm run tauri dev
```

Prerequisites: Node.js 20+, Rust 1.75+

### Code Style
- TypeScript strict mode
- Functional React components with hooks
- Clear comments for non-obvious logic

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
