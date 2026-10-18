# ML Model Playground

Upload a dataset, choose a machine-learning algorithm, train a model, and see the results visually.

> Work in progress, built step by step.

## Tech stack

| Layer    | Tools                                       |
| -------- | ------------------------------------------- |
| Frontend | React, Vite (Tailwind + Framer Motion next) |
| Backend  | FastAPI, pandas, scikit-learn               |

## Run locally

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

## Roadmap

- [x] Step 1: Repo skeleton
- [ ] Step 2: Design system and landing page
- [ ] Step 3: Dataset upload
- [ ] Step 4: Data profiling
- [ ] Step 5: Preprocessing
- [ ] Step 6: Train a model
- [ ] Step 7: Evaluation
- [ ] Step 8: Model comparison
- [ ] Step 9: Feature importance
- [ ] Step 10: Prediction demo
- [ ] Step 11: Hyperparameter lab
- [ ] Step 12: Polish, tests, deploy