# Testing

Run deterministic tests without a paid provider:

```bash
npm install
npm test
cd ai-service && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt && .venv/Scripts/python -m pytest
```

The API decision test proves parallel Boolean, Choice, and Score evaluation and explicit missing-input behavior. For integration testing, start PostgreSQL, register two organizations, upload distinct fixture PDFs, create two assistants, and verify a token can only retrieve its own chunks. The `sample-data/questions.md` matrix supplies expected scenarios.
