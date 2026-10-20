# ML Model PlayGround

Upload a real-world CSV, and watch it get read properly: numbers pulled out of
units, prices cleaned up, spellings folded together, and a model scored
honestly against a baseline. Every step explains itself in plain language.

It works on any kind of file. There is nothing in the code that knows what
domain you are in: a spreadsheet of car listings, a survey, a sales export
and a scientific dataset all go down the same path.

> Work in progress, built step by step.

## What it actually does

The hard part of machine learning is not the model, it is the data. Most
tools assume your CSV is tidy. This one does not.

| Problem in a real file | What happens here |
| --- | --- |
| `"963 hp"`, `"$1,100,000"`, `"2.5 sec"` are read as text | They are read as **numbers**, with the units and currency symbols taken off |
| `"70-85 hp"` is a range | It becomes the midpoint, and we tell you it was a range |
| `"1,600 cc / 13.8 kwh"` mixes two measurements | The column is **split** into a cc column and a kWh column |
| `"1.6 L"` and `"1,600 cc"` are the same thing | Both are converted to one scale |
| `TOYOTA` and `Toyota` are counted as two companies | They are folded into **one** value |
| `2–6 seats` uses a Windows dash | The dash is normalised, and the range is read |
| `-` and `N/A` become a category | They are treated as **missing** and filled |
| 1,201 car names become 1,201 columns | Rare values are rolled into one `other` bucket |
| A column gives the target away | It is **detected and dropped**, with the reason explained |
| The target has 23 classes, or is a number | Any column can be the target. Classification **and** regression |

## Two things it will not let you get away with

**A feature that does not beat the baseline is not a feature.** On an
unbalanced target, a column that knows nothing still "predicts" the majority
class correctly most of the time. The leak detector compares every column
against that floor, so it only drops a column when it genuinely gives the
answer away, and keeps the ones that merely look suspicious.

**A model that scores below the baseline is not "a low score".** It is worse
than guessing, and the app says so, because that means the model found a
pattern that does not hold on new rows.

## Tech stack

| Layer    | Tools                                       |
| -------- | ------------------------------------------- |
| Frontend | React, Vite (Tailwind + Framer Motion)      |
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

## Tests

```bash
cd backend
python -m pytest tests -q
```

The suite covers the parts that are easy to get quietly wrong: reading
numbers out of messy text, folding spelling variants, spotting a leaking
column, and proving that the test rows never influenced the training.

## How the backend is arranged

| Module | What it owns |
| --- | --- |
| `textnorm.py` | Unicode clean-up: dashes, smart quotes, invisible characters, case folding |
| `units.py` | The unit table: what each unit measures, and how to convert it |
| `parsing.py` | Pulling numbers out of cells, handling ranges and compound cells |
| `infer.py` | Deciding what each column really contains, and cleaning it |
| `leakage.py` | Finding the columns that give the target away |
| `target.py` | Suggesting what to predict, and whether it is a label or a number |
| `transformers.py` | The rare-category grouper, fitted inside the pipeline |
| `preprocessing.py` | The pipeline: clean, split, then fit on the training rows only |
| `trainer.py` | Training and scoring, always against a baseline |
| `models.py` | The algorithm registry |

## Roadmap

- [x] Step 1: Repo skeleton
- [x] Step 2: Design system and landing page
- [x] Step 3: Dataset upload
- [x] Step 4: Data profiling
- [x] Step 5: Preprocessing
- [x] Step 6: Train a model
- [x] Step 7: Smart parsing: numbers, units, ranges, mixed measurements
- [x] Step 8: Leakage detection and category canonicalisation
- [x] Step 9: Regression targets and regressors
- [ ] Step 10: Evaluation: confusion matrix and per-class report in the UI
- [ ] Step 11: Model comparison across folds
- [ ] Step 12: Feature importance
- [ ] Step 13: Prediction demo
- [ ] Step 14: Hyperparameter lab
- [ ] Step 15: Polish, deploy
