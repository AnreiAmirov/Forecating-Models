## Project Description: Time-Series Forecasting Benchmark

This repository presents a rigorous comparative analysis of time-series forecasting techniques. The project evaluates the evolution of forecasting methodologies, moving from traditional state-space models to modern additive models enhanced by Bayesian optimization.

### Technical Scope

*   **Classical Statistical Modeling**: Implementation of **ETS (Error, Trend, Seasonality)** models to establish robust statistical baselines.
*   **Modern Additive Models**: Utilizing **Facebook Prophet** for its ability to handle non-linear trends, multiple seasonalities, and holiday effects.
*   **Hyperparameter Optimization (HPO)**: Integration of **Optuna** to automate the tuning of Prophet’s hyperparameters (such as changepoint prior scale and seasonality prior scale), replacing manual grid search with efficient Parzen Estimator (TPE) sampling.
*   **Advanced Feature Engineering**: Custom preprocessing pipeline that injects exogenous regressors (e.g., specific seasonal flags) to improve model sensitivity to external factors.
*   **Evaluation Framework**: A systematic comparison using backtesting and cross-validation to assess stability and accuracy across different time horizons.
