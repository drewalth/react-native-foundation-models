# Contributing to react-native-foundation-models

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

### Prerequisites

- Node.js >= 20.19.4
- npm
- Xcode 16.0+ (for iOS development)
- An Apple Silicon device (iPhone 15 Pro+, M-series Mac) for testing

### Getting Started

1. Fork and clone the repository:
```bash
git clone https://github.com/drewalth/react-native-foundation-models.git
cd react-native-foundation-models
```

2. Install dependencies:
```bash
npm install
```

3. Build the module:
```bash
npm run build
```

4. Run linting:
```bash
npm run lint
```

5. Run tests:
```bash
npm test
```

### Working with the Example App

The `example/` directory contains a test application:

```bash
cd example
npm install
npx expo prebuild
npm run ios  # or npm run android
```

## Code Quality

### Linting

We use ESLint for JavaScript/TypeScript and SwiftLint for Swift code:

```bash
npm run lint          # Run all linters
npm run lint:js       # JavaScript/TypeScript only
npm run lint:swift    # Swift only
```

### Formatting

We use Prettier for JavaScript/TypeScript and SwiftFormat for Swift:

```bash
npm run format        # Format all code
npm run format:js     # JavaScript/TypeScript only
npm run format:swift  # Swift only
```

### Testing

Write tests for new features and bug fixes:

```bash
npm test              # Run all tests
npm test -- --coverage  # Run with coverage report
```

## Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Build process or auxiliary tool changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `ci:` - CI configuration changes

Example:
```bash
git commit -m "feat: add streaming support for responses"
git commit -m "fix: handle tool call errors correctly"
git commit -m "docs: update README with streaming examples"
```

Commits are automatically validated using husky and commitlint.

## Pull Request Process

1. Create a feature branch:
```bash
git checkout -b feat/your-feature-name
```

2. Make your changes and commit following the commit convention

3. Ensure all tests pass and code is linted:
```bash
npm run lint
npm test
npm run build
```

4. Push your branch and create a Pull Request

5. Fill out the PR template with:
   - Description of changes
   - Related issues (if any)
   - Testing steps
   - Screenshots (if UI changes)

6. Wait for review and address feedback

## Adding New Features

### TypeScript/JavaScript Changes

1. Add your code in `src/`
2. Update types in `src/ReactNativeFoundationModels.types.ts` if needed
3. Export from `src/index.ts`
4. Add tests in `src/__tests__/`
5. Update documentation

### Swift/Native Changes

1. Add code in `ios/`
2. Follow existing patterns for module exports
3. Document native methods with comments
4. Test on a physical device (FoundationModels requires Apple Silicon)

### Config Plugin Changes

1. Modify `plugin/src/`
2. Update types in `plugin/src/types.ts`
3. Test with `npx expo prebuild` in the example app

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments to public APIs
- Include code examples for new features
- Update CHANGELOG.md (handled automatically by semantic-release)

## Release Process

Releases are automated using semantic-release:

1. Merge PRs to `main` (for stable releases)
2. semantic-release analyzes commits
3. Generates changelog
4. Publishes to npm
5. Creates GitHub release

For pre-releases:
- Merge to `beta` branch for beta releases
- Merge to `next` branch for next releases

## Questions or Issues?

- **Bug reports**: Open an [issue](https://github.com/drewalth/react-native-foundation-models/issues)
- **Feature requests**: Open an [issue](https://github.com/drewalth/react-native-foundation-models/issues) with the `enhancement` label
- **Questions**: Use [GitHub Discussions](https://github.com/drewalth/react-native-foundation-models/discussions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
