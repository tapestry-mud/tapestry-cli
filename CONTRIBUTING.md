# Contributing to @tapestry-mud/cli

## How to contribute

1. Fork the repo and create a branch from `master`.
2. Make your changes. Add or update tests if relevant.
3. Ensure `npm test` passes.
4. Open a pull request against `master`.

## Development setup

```bash
npm ci
npm test
```

The CLI entry point is `bin/tapestry.js`. Commands live in `src/commands/`.

## Adding a command

1. Create `src/commands/my-command.js`
2. Register it in the commander setup in `src/tapestry.js`
3. Add tests in `test/`

## Coding standards

- Braces on every block -- no single-line `if` bodies.
- Use `node-fetch` for HTTP, `zod` for validation, `commander` for arg parsing.

## Reporting bugs

Use the [issue tracker](https://github.com/tapestry-mud/tapestry-cli/issues). Include the command you ran, expected behavior, and actual output.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
