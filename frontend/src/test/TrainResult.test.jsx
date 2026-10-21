import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrainResult from "../components/TrainResult";
import ConfusionMatrix from "../components/ConfusionMatrix";

/**
 * A classifier result, shaped exactly like the one the API returns.
 */
const classificationResult = {
    model_id: "random_forest",
    label: "Random Forest",
    task: "classification",
    train_accuracy: 100,
    test_accuracy: 90,
    baseline_accuracy: 33.3,
    precision: 88,
    recall: 90,
    f1: 89,
    correct: 27,
    test_rows: 30,
    fit_ms: 12.4,
    points_per_row: 3.3,
    confusion_matrix: [
        [10, 0, 0],
        [0, 8, 2],
        [0, 1, 9],
    ],
    class_names: ["setosa", "versicolor", "virginica"],
    cv: {
        metric: "accuracy",
        folds: [95.8, 100, 95.8, 91.7, 91.7],
        mean: 95,
        std: 3.1,
        n_splits: 5,
    },
    cv_baseline: {
        metric: "accuracy",
        folds: [33.3, 33.3, 33.3, 33.3, 33.3],
        mean: 33.3,
        std: 0,
        n_splits: 5,
    },
    verdict: {
        tone: "good",
        title: "Learned something real",
        text: "95%, well above the 33% you'd get by guessing.",
    },
};

const regressionResult = {
    model_id: "ridge",
    label: "Ridge Regression",
    task: "regression",
    train_r2: 0.9,
    test_r2: 0.7,
    mae: 1200,
    rmse: 1500,
    baseline_mae: 5000,
    baseline_r2: 0,
    test_rows: 84,
    fit_ms: 3.1,
    target_mean: 10000,
    cv: {
        metric: "r2",
        folds: [0.6, 0.64, 0.72, 0.65, 0.63],
        mean: 0.6,
        std: 0.13,
        n_splits: 5,
    },
    cv_baseline: {
        metric: "r2",
        folds: [0, 0, 0, 0, 0],
        mean: 0,
        std: 0,
        n_splits: 5,
    },
    verdict: {
        tone: "good",
        title: "Learned something real",
        text: "R-squared 0.60.",
    },
};

describe("TrainResult", () => {
    it("renders a classifier result without crashing", () => {
        expect(() => render(<TrainResult result={classificationResult} />)).not.toThrow();
    });

    it("shows the cross-validated score", () => {
        render(<TrainResult result={classificationResult} />);
        expect(screen.getByText(/95\.0%|\+ 3\.1/)).toBeTruthy();
    });

    it("shows the confusion matrix", () => {
        render(<TrainResult result={classificationResult} />);
        expect(screen.getByText("Where it goes wrong")).toBeTruthy();
    });

    it("renders a regression result without crashing", () => {
        expect(() => render(<TrainResult result={regressionResult} />)).not.toThrow();
    });

    it("survives a result with no cross-validation and no matrix", () => {
        // The API can leave these out, and a missing value must never take
        // the page down.
        const bare = {
            ...classificationResult,
            cv: null,
            cv_baseline: null,
            confusion_matrix: undefined,
        };
        expect(() => render(<TrainResult result={bare} />)).not.toThrow();
    });

    it("survives a result with missing numbers", () => {
        const halfEmpty = {
            ...classificationResult,
            test_accuracy: undefined,
            baseline_accuracy: undefined,
            cv: null,
            cv_baseline: null,
        };
        expect(() => render(<TrainResult result={halfEmpty} />)).not.toThrow();
    });
});

describe("ConfusionMatrix", () => {
    it("draws one cell per pair of classes", () => {
        render(
            <ConfusionMatrix
                matrix={classificationResult.confusion_matrix}
                classNames={classificationResult.class_names}
            />
        );
        // 3 classes, so 9 cells, plus the row and column headers.
        expect(screen.getByText("10")).toBeTruthy();
        // The class name appears as a column header, a row header and in
        // the per-class list.
        expect(screen.getAllByText("setosa").length).toBeGreaterThan(0);
    });

    it("says what the most common mistake was", () => {
        render(
            <ConfusionMatrix
                matrix={classificationResult.confusion_matrix}
                classNames={classificationResult.class_names}
            />
        );
        expect(screen.getByText(/most common mistake/i)).toBeTruthy();
    });

    it("renders nothing when there is no matrix", () => {
        const { container } = render(
            <ConfusionMatrix matrix={null} classNames={null} />
        );
        expect(container.textContent).toBe("");
    });
});
