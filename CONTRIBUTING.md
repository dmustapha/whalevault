# Contributing to WhaleVault

Contributions are welcome. Here is how to get involved.

## Setup

```bash
git clone https://github.com/dmustapha/whalevault.git
cd whalevault
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Veil SDK:**
```bash
cd veil
pip install -e .
pytest
```

## What is useful

Bug fixes, chain adapters, circuit improvements, and SDK extensions are all good contributions. If you want to add support for a new chain, the Solana integration sits in the application layer — the cryptographic core (circuits, Veil SDK) is chain-agnostic and does not need to change.

If it is a significant change, open an issue first to discuss the approach.

## Pull requests

1. Fork the repo and branch off `main`
2. Keep commits focused — one thing per commit
3. Make sure tests pass: `pytest` (backend/veil) and `npm test` (frontend)
4. Run the typecheck: `npm run typecheck` in the frontend directory
5. Open the PR with a clear description of what changed and why

## Code standards

TypeScript strict mode in the frontend — no `any`. Python type hints throughout the backend and SDK. Functions should stay short and do one thing. Names should be descriptive enough that a comment is not needed.

## Contact

damilolamustaphaa@gmail.com
