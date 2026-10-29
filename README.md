# ts-logging-lab

English | [日本語](README.ja.md)

**A 12-part tutorial that develops TypeScript designs step by step, starting with a small request: add logging to existing code.**

Learn higher-order functions, Proxy/Reflect, WeakMap, the Adapter pattern, event catalogs, masking, and OpenTelemetry integration through working code and tests. Puppeteer provides practical objects to wrap; the focus is TypeScript implementation and design.

> **Status: all 12 parts are implemented.** `main` contains the completed implementation. Tags `part-01` through `part-12` capture each completed lesson. The code and bundled documentation are available under the [MIT License](LICENSE).

## Purpose and audience

This tutorial is for readers familiar with TypeScript functions and generics, Promises, and async/await who want to explore how to add logging to existing code. Detailed Puppeteer knowledge is unnecessary, and the first example runs without a browser. The code illustrates evolving designs and their limits. Before adopting it in a service, review each lesson's constraints and your application's requirements for sensitive data and failures.

- Add logging across operations while preserving their behavior and types.
- Separate events describing what happened from the mechanism that outputs them.
- Decide what to log or omit based on the meaning of an operation.
- Relate asynchronous context and object identity while keeping their responsibilities distinct.
- Test the effect of logging on behavior, safety, and performance.

## Setup and first run

Use Node.js **24.22.1** (24.x LTS) and npm **11.21.1**. With nvm, clone the repository and prepare the environment as follows. Other version managers can use the same versions.

```sh
git clone https://github.com/winuim/ts-logging-lab.git
cd ts-logging-lab
nvm install
nvm use
npm install --global npm@11.21.1
npm ci
npm run example:part-01
```

`npm ci` reproduces dependencies from the committed `package-lock.json`. Regular installation skips browser downloads through `skipDownload: true` in `.puppeteerrc.cjs`.

The first example needs no browser. It demonstrates start, success, and failure logs, along with exception handling by the caller. Examples on `main` use the completed API and include the required LogTape configuration.

### Using a browser

The project uses Puppeteer **25.16.0** and the Chrome for Testing version selected by its CLI. Run the following in a local environment that can launch a browser:

```sh
npm run browser:install
npm run example:part-02
```

Chrome is downloaded to Puppeteer's cache. Examples and integration tests use `about:blank`, `data:` URLs, local HTML, and local HTTP servers.

### Layout and toolchain

```text
src/                          Tutorial implementation (public API in src/index.ts)
examples/                     Small examples using the built code
docs/                         Implementation, constraints, and changes for all 12 parts
benchmarks/                   Benchmark script and reference measurements
LICENSE                       MIT License for the code and bundled documentation
tests/unit/                   Tests that do not need a browser
tests/integration/            Real Page tests for private fields, operations, success, and failure
vitest.config.ts              Collects unit tests only
vitest.integration.config.ts  Collects integration tests only
```

- Node.js 24.x LTS and npm 11.x are used. `.nvmrc` and `packageManager` pin the verification versions; `engines` and `.npmrc` detect incompatible major versions.
- TypeScript **6.0.3**, Vitest **5.0.5**, ESLint **10.13.0**, `@eslint/js` **10.0.1**, typescript-eslint **8.72.1**, Prettier **3.9.10**, and `@types/node` **24.19.2** are pinned exactly. The lockfile pins transitive dependencies. TypeScript stays within typescript-eslint's supported range (`<6.1.0`).
- The project uses ESM that Node.js can run directly (`type: module`, `NodeNext`), with `.js` extensions in relative imports. Builds use `tsc` alone, without a bundler or custom runner.
- Type checking enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, and checks for unused code and control flow. Tests and configuration files are also type checked; only `src/` is included in the build output.
- ESLint uses strict rules with type information and prohibits `any`, non-null assertions, and type assertions. Prettier handles formatting.
- Tests requiring Puppeteer live in `tests/integration/**/*.test.ts` and are excluded from unit test collection. Integration tests and local browser preparation were introduced in part 2. Empty test suites are not treated as successful.
- Puppeteer **25.16.0** is pinned as a development dependency. The TypeScript libraries include DOM and DOM.Iterable for Page types and DOM references inside `evaluate`; this does not make `window` or `document` available in the Node.js runtime. LogTape was introduced in part 5. OpenTelemetry API **1.10.0** and SDK/context-async-hooks **3.0.0** were introduced in part 10.

Configuration references: [Node.js release policy](https://github.com/nodejs/Release), [TypeScript configuration](https://www.typescriptlang.org/tsconfig/), and [Vitest guide](https://vitest.dev/guide/).

## All 12 parts

**The detailed lesson documents are in Japanese.** Follow the lesson links for implementation details, examples, tests, and constraints. Each part builds on the previous one.

| Part | Lesson                                                       | Main API or command                              | Completion tag                                                     |
| ---- | ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| 01   | [Higher-order functions and generics](docs/part-01.md)       | `withLog`                                        | [`part-01`](https://github.com/winuim/ts-logging-lab/tree/part-01) |
| 02   | [Proxy, Reflect, and this](docs/part-02.md)                  | `withPageLogging`                                | [`part-02`](https://github.com/winuim/ts-logging-lab/tree/part-02) |
| 03   | [Generalizing the Proxy wrapper](docs/part-03.md)            | `createLoggingProxy`                             | [`part-03`](https://github.com/winuim/ts-logging-lab/tree/part-03) |
| 04   | [WeakMap and identity](docs/part-04.md)                      | `unwrap`                                         | [`part-04`](https://github.com/winuim/ts-logging-lab/tree/part-04) |
| 05   | [Structured events and the Adapter pattern](docs/part-05.md) | `LogEvent` / `LogAdapter` / `LogTapeAdapter`     | [`part-05`](https://github.com/winuim/ts-logging-lab/tree/part-05) |
| 06   | [Event catalogs](docs/part-06.md)                            | `eventCatalog` / `parseLevelOverrides`           | [`part-06`](https://github.com/winuim/ts-logging-lab/tree/part-06) |
| 07   | [Extensible masking](docs/part-07.md)                        | `createArgumentPolicy` / `createPuppeteerPolicy` | [`part-07`](https://github.com/winuim/ts-logging-lab/tree/part-07) |
| 08   | [Type-safe hooks](docs/part-08.md)                           | `ContextExtractor` / `navigationContext`         | [`part-08`](https://github.com/winuim/ts-logging-lab/tree/part-08) |
| 09   | [Resource identity with WeakMap](docs/part-09.md)            | `ResourceContext`                                | [`part-09`](https://github.com/winuim/ts-logging-lab/tree/part-09) |
| 10   | [Log correlation with OpenTelemetry](docs/part-10.md)        | `openTelemetryCorrelation`                       | [`part-10`](https://github.com/winuim/ts-logging-lab/tree/part-10) |
| 11   | [Event subscriptions and diagnostic logs](docs/part-11.md)   | `subscribeDiagnostics`                           | [`part-11`](https://github.com/winuim/ts-logging-lab/tree/part-11) |
| 12   | [Quality verification](docs/part-12.md)                      | `npm run benchmark`                              | [`part-12`](https://github.com/winuim/ts-logging-lab/tree/part-12) |

### Studying a particular version

`main` contains the completed implementation. To study an earlier lesson, switch to its tag with a clean working tree. For example, to explore part 1:

```sh
git switch --detach part-01
npm ci
npm run example:part-01
npm test
```

Use the README at each tag as the reference for that version's API, dependencies, and commands. Part 1 includes neither LogTape nor Puppeteer. For lessons requiring a real browser, follow that tag's README to prepare Chrome.

To return to the completed implementation, run `git switch main`, then `npm ci` again to restore its dependencies. Existing tags are preserved as historical snapshots, so older README and package.json files retain the license metadata that preceded the adoption of MIT.

## Shared design principles and responsibilities

| Implemented in this tutorial                                              | Delegated to existing infrastructure                                               |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Attaching logging through higher-order functions and Proxy                | Filtering output by log level (LogTape)                                            |
| Logger-independent LogEvent and LogAdapter contracts and event generation | Sinks, formatters, and formats such as NDJSON (LogTape)                            |
| Event IDs, categories, default levels, and fixed messages                 | Destinations, file management, and rotation (logger infrastructure)                |
| Overriding the level assigned to an event                                 | Asynchronous output and buffering when needed (LogTape)                            |
| Masking and safe attribute extraction based on operation context          | General-purpose logging functionality (LogTape)                                    |
| Reading OpenTelemetry correlation data and attaching it to logs           | Generating traceId/spanId, managing spans, and propagating context (OpenTelemetry) |
| Application-specific resource identity with WeakMap                       | Operational logging infrastructure                                                 |

The application **assigns** levels such as `info` and `error` to events. The logger decides whether those levels are **emitted**.

The tutorial does not reimplement a logging library or tracing SDK. LogEvent and LogAdapter remain **independent of any logger**, and **LogTapeAdapter is the only concrete logging adapter** implemented here. Other loggers, such as Pino, are discussed only as possible replacements. LogTape APIs and configuration stay outside the application's event contracts.

Logging preserves the original return values and rejection reasons, isolating output failures where needed. Each lesson documents its guarantees and limits, including lost logs, output completion, and Promise and Proxy identity.

Sensitive information is handled conservatively by default. Raw arguments, return values, and exceptions are not logged indiscriminately. The application chooses safe attributes, including those supplied through operation names, custom rules, and hooks. See [part 7](docs/part-07.md) and [part 8](docs/part-08.md) for the trust boundaries of custom code.

OpenTelemetry's standard API and SDK handle traceId/spanId generation, span parentage, and asynchronous context propagation. The tutorial's integration only reads a valid active SpanContext and adds its identifiers to log attributes. Resource identity managed through WeakMap has a separate responsibility from asynchronous execution context.

## Verification

Run the standard checks without a browser in this order:

```sh
npm run typecheck
npm test
npm run build
node dist/index.js
npm run lint
npm run format:check
```

GitHub Actions is not used to avoid billed workflow runs. Run checks locally and record the results in the pull request.

### Common commands

| Command                          | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`              | Type check source, tests, and Vitest configuration                   |
| `npm test` / `npm run test:unit` | Run unit tests once without a browser                                |
| `npm run test:watch`             | Watch unit tests for changes                                         |
| `npm run build`                  | Compile `src/` to ESM, declarations, and source maps in `dist/`      |
| `node dist/index.js`             | Check that the built entry point loads (API exports only; no output) |
| `npm run lint`                   | Run ESLint with type information; warnings also fail                 |
| `npm run format:check`           | Check formatting with Prettier                                       |
| `npm run format`                 | Format files with Prettier                                           |

### Integration tests and benchmarks

Unit tests live in `tests/unit/`; integration tests using real Chrome live in `tests/integration/`. When changing implementation that uses a browser, also run:

```sh
npm run browser:install
npm run test:integration
npm run example:part-02
```

See [part 12](docs/part-12.md) for regression tests, benchmark conditions, measurements, and limitations, and [reference.json](benchmarks/results/reference.json) for the raw measurements. Run the benchmark with:

```sh
npm run benchmark -- /private/tmp/ts-logging-benchmark.json
```

## License

The code and bundled documentation are provided under the [MIT License](LICENSE). Commercial use, modification, and redistribution are permitted provided the copyright and license notices are retained. The software is provided without warranty.

Third-party dependencies, including Puppeteer, LogTape, and OpenTelemetry, remain subject to their respective licenses.

`private: true` in `package.json` prevents accidental publication to npm. It is independent of GitHub repository visibility and the MIT License, so it remains enabled.
