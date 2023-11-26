# AI-Coder

AI-Coder is a command-line tool that uses AI to generate commit messages and pull request titles and bodies.

## Installation

Get an OpenAI API key and set it as an environment variable called `OPENAI_API_KEY`.

```bash
npm install ai-coder
```

Usage

```bash
ai-coder <command>
```

**Commands**

- `commit`: Commit staged changes with an AI generated commit message
- `pr`: Generate a pull request with an AI generated title and body

**Arguments**

- `--help`: Display help
