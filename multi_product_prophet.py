"""
Multi-product forecasting — three INDEPENDENT parts:

    STEP 0   Data upload (edit the read_excel lines; nothing else touches files)
    PART 1   FORECAST : Prophet + Optuna + booster  ->  df_forecast_combined
    PART 2   COMPARISON: merge with fact -> metrics, charts, Excel
             (fully separate from Prophet — works on dataframes only)
"""

# =============================================================================
# Imports
# =============================================================================
import contextlib
import logging
import os
import warnings

import holidays
import matplotlib.pyplot as plt
import numpy as np
import optuna
import pandas as pd
from optuna.samplers import TPESampler
from prophet import Prophet
from sklearn.metrics import (mean_absolute_error,
                             mean_absolute_percentage_error, r2_score)

try:
    from lightgbm import LGBMRegressor as BoosterModel
    BOOSTER_BACKEND = "lightgbm"
except ImportError:
    from sklearn.ensemble import HistGradientBoostingRegressor as BoosterModel
    BOOSTER_BACKEND = "sklearn"

warnings.filterwarnings("ignore")
optuna.logging.set_verbosity(optuna.logging.WARNING)
for _n in ("prophet", "cmdstanpy"):
    logging.getLogger(_n).setLevel(logging.CRITICAL)


@contextlib.contextmanager
def _silence():
    with open(os.devnull, "w") as devnull:
        fd1, fd2 = os.dup(1), os.dup(2)
        try:
            os.dup2(devnull.fileno(), 1)
            os.dup2(devnull.fileno(), 2)
            yield
        finally:
            os.dup2(fd1, 1); os.dup2(fd2, 2)
            os.close(fd1);   os.close(fd2)


# =============================================================================
# STEP 0 — DATA UPLOAD (independent; edit these lines for your files)
# =============================================================================
df_train = pd.read_excel("data_train.xlsx")      # training data
df_fact  = pd.read_excel("data_fact.xlsx")       # full data with fact

# normalise column names once
for _df in (df_train, df_fact):
    _df.rename(columns={"VALUE_DAY": "ds", "FEE_RUR_AMT_SUM": "y",
                        "PRODUCT": "product"}, inplace=True)
    _df["ds"] = pd.to_datetime(_df["ds"])

df_train = (df_train.groupby(["product", "ds"], as_index=False)["y"].sum()
                    .sort_values(["product", "ds"]))
df_fact  = (df_fact.groupby(["product", "ds"], as_index=False)["y"].sum()
                   .sort_values(["product", "ds"]))

print(f"df_train: {len(df_train):,} rows, "
      f"{df_train['ds'].min().date()} → {df_train['ds'].max().date()}")
print(f"df_fact : {len(df_fact):,} rows, "
      f"{df_fact['ds'].min().date()} → {df_fact['ds'].max().date()}\n")


# =============================================================================
# PART 1 — FORECAST (Prophet + Optuna + booster)
# =============================================================================
# ---- settings ----
FUTURE_START = "2024-01-01"
FUTURE_END   = "2026-12-31"
VAL_DAYS     = 92        # validation tail inside train (Optuna + booster guard)
N_TRIALS     = 40
MIN_HISTORY  = 180
SEED         = 42

REGRESSOR_COLS = ["is_month_end", "is_month_start", "payday_proxy", "is_weekend"]


def build_regressors(df):
    df = df.copy()
    df["ds"] = pd.to_datetime(df["ds"])
    df["is_month_end"]   = df["ds"].dt.is_month_end.astype(int)
    df["is_month_start"] = df["ds"].dt.is_month_start.astype(int)
    df["payday_proxy"]   = df["ds"].dt.day.isin([5, 10, 25]).astype(int)
    df["is_weekend"]     = (df["ds"].dt.dayofweek >= 5).astype(int)
    return df


def booster_features(ds):
    ds = pd.to_datetime(ds)
    return pd.DataFrame({
        "dow":            ds.dt.dayofweek.values,
        "day":            ds.dt.day.values,
        "month":          ds.dt.month.values,
        "weekofyear":     ds.dt.isocalendar().week.astype(int).values,
        "is_month_end":   ds.dt.is_month_end.astype(int).values,
        "is_month_start": ds.dt.is_month_start.astype(int).values,
    })


def build_holidays(start_year, end_year):
    ru = holidays.Russia(years=list(range(start_year, end_year + 1)))
    return pd.DataFrame(
        [{"ds": pd.to_datetime(d), "holiday": n,
          "lower_window": 0, "upper_window": 3} for d, n in ru.items()])


def clip_outliers(df, iqr_mult=3.0):
    """Per-weekday IQR clipping — for fitting only."""
    out = df.copy()
    dow = out["ds"].dt.dayofweek
    for d in range(7):
        vals = out.loc[dow == d, "y"]
        if len(vals) < 10:
            continue
        q1, q3 = vals.quantile([0.25, 0.75])
        lo, hi = q1 - iqr_mult * (q3 - q1), q3 + iqr_mult * (q3 - q1)
        out.loc[dow == d, "y"] = vals.clip(lo, hi)
    return out


def fit_predict_prophet(train, predict_ds, params, holidays_df):
    """Fit Prophet on log1p(y), predict, back-transform."""
    tr = build_regressors(train)
    tr["y"] = np.log1p(tr["y"].clip(lower=0))
    model = Prophet(holidays=holidays_df, daily_seasonality=False,
                    weekly_seasonality=True, yearly_seasonality=True,
                    interval_width=0.95, **params)
    for col in REGRESSOR_COLS:
        model.add_regressor(col)
    with _silence():
        model.fit(tr)
        pred = model.predict(build_regressors(predict_ds.copy()))
    for col in ("yhat", "yhat_lower", "yhat_upper"):
        pred[col] = np.expm1(pred[col])
    return model, pred


def tune(train, val, holidays_df):
    """Optuna: train on `train`, score each trial by MAE on `val`."""
    def objective(trial):
        params = {
            "changepoint_prior_scale": trial.suggest_float(
                "changepoint_prior_scale", 1e-3, 0.5, log=True),
            "seasonality_prior_scale": trial.suggest_float(
                "seasonality_prior_scale", 0.01, 10.0, log=True),
            "holidays_prior_scale": trial.suggest_float(
                "holidays_prior_scale", 0.01, 10.0, log=True),
            "seasonality_mode": trial.suggest_categorical(
                "seasonality_mode", ["additive", "multiplicative"]),
            "changepoint_range": trial.suggest_float(
                "changepoint_range", 0.80, 0.95),
        }
        _, pred = fit_predict_prophet(train, val[["ds"]], params, holidays_df)
        return mean_absolute_error(val["y"].values, pred["yhat"].values)

    study = optuna.create_study(direction="minimize",
                                sampler=TPESampler(seed=SEED))
    study.optimize(objective, n_trials=N_TRIALS, show_progress_bar=False)
    return study.best_params


def make_booster():
    if BOOSTER_BACKEND == "lightgbm":
        return BoosterModel(n_estimators=300, learning_rate=0.05,
                            num_leaves=31, verbose=-1)
    return BoosterModel(max_iter=300, learning_rate=0.05)


def forecast_one_product(train_prod):
    """Prophet + Optuna + guarded booster for one product. Returns forecast df."""
    df = train_prod.sort_values("ds").reset_index(drop=True)
    holidays_df = build_holidays(int(df["ds"].dt.year.min()),
                                 pd.Timestamp(FUTURE_END).year)

    # validation tail inside train
    val_cutoff = df["ds"].max() - pd.Timedelta(days=VAL_DAYS)
    tr  = clip_outliers(df[df["ds"] <= val_cutoff])
    val = df[df["ds"] > val_cutoff]

    best = tune(tr, val, holidays_df)

    # booster guard on the validation tail
    model_v, val_pred = fit_predict_prophet(tr, val[["ds"]], dict(best), holidays_df)
    with _silence():
        tr_pred = model_v.predict(build_regressors(tr[["ds"]].copy()))
    resid = tr["y"].values - np.expm1(tr_pred["yhat"].values)
    booster = make_booster()
    booster.fit(booster_features(tr["ds"]), resid)
    val_boosted = val_pred["yhat"].values + booster.predict(booster_features(val["ds"]))
    use_booster = (mean_absolute_error(val["y"], val_boosted)
                   < mean_absolute_error(val["y"], val_pred["yhat"]))

    # final fit on all train, forecast future window
    full = clip_outliers(df)
    future = pd.DataFrame({"ds": pd.date_range(FUTURE_START, FUTURE_END, freq="D")})
    model, forecast = fit_predict_prophet(full, future, dict(best), holidays_df)
    if use_booster:
        with _silence():
            full_pred = model.predict(build_regressors(full[["ds"]].copy()))
        resid_full = full["y"].values - np.expm1(full_pred["yhat"].values)
        booster_full = make_booster()
        booster_full.fit(booster_features(full["ds"]), resid_full)
        forecast["yhat"] = (forecast["yhat"].values
                            + booster_full.predict(booster_features(forecast["ds"])))

    out = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
    out["booster"] = f"yes ({BOOSTER_BACKEND})" if use_booster else "no"
    return out


# ---- run the forecast for every product ----
print(f"Booster backend: {BOOSTER_BACKEND}\n")
frames = []
train_ends = {}
for prod in sorted(df_train["product"].dropna().unique()):
    tr = df_train[df_train["product"] == prod]
    if tr["ds"].nunique() < MIN_HISTORY:
        print(f"— {prod}: skipped (insufficient history)")
        continue
    print(f"▶ {prod}: tuning + forecast ...")
    fc = forecast_one_product(tr)
    fc.insert(0, "product", prod)
    frames.append(fc)
    train_ends[prod] = tr["ds"].max()

df_forecast_combined = pd.concat(frames, ignore_index=True)
print(f"\ndf_forecast_combined: {len(df_forecast_combined):,} rows, "
      f"{df_forecast_combined['product'].nunique()} products\n")


# =============================================================================
# PART 2 — COMPARISON (independent of Prophet; dataframes only)
# =============================================================================
PLOTS_DIR = "charts"
OUT_XLSX  = "df_forecast_combined.xlsx"


def metrics(y_true, y_pred):
    return {
        "R2":   r2_score(y_true, y_pred),
        "MAE":  mean_absolute_error(y_true, y_pred),
        "MAPE": mean_absolute_percentage_error(y_true, y_pred) * 100,
        "RMSE": float(np.sqrt(np.mean((np.asarray(y_pred) - np.asarray(y_true)) ** 2))),
    }


# ---- 2.1 merge forecast with fact ----
df_merged = df_forecast_combined.merge(
    df_fact[["product", "ds", "y"]], on=["product", "ds"], how="left")

# ---- 2.2 out-of-sample metrics: fact AFTER each product's train end ----
all_metrics = {}
for prod, train_end in train_ends.items():
    d = df_merged[df_merged["product"] == prod]
    oos = d[(d["ds"] > train_end) & d["y"].notna()]
    if len(oos) >= 7:
        met = metrics(oos["y"].values, oos["yhat"].values)
    else:
        met = {k: float("nan") for k in ("R2", "MAE", "MAPE", "RMSE")}
    met["oos_days"] = len(oos)
    met["booster"]  = d["booster"].iloc[0]
    all_metrics[prod] = met
    print(f"{prod}: OOS ({met['oos_days']} days)  R2={met['R2']:.3f}  "
          f"MAE={met['MAE']/1000:,.0f}k  MAPE={met['MAPE']:.1f}%")

comparison_table = pd.DataFrame(all_metrics).T
for c in ("MAE", "RMSE"):
    comparison_table[c] = comparison_table[c] / 1000
comparison_table = comparison_table.round(2)
print("\n", comparison_table.to_string(), "\n")

# ---- 2.3 comparison charts: daily / monthly / residual histogram ----
os.makedirs(PLOTS_DIR, exist_ok=True)
FCST_CLR, FACT_CLR = "#C8102E", "#21364B"

for prod, train_end in train_ends.items():
    d = df_merged[df_merged["product"] == prod]
    met = all_metrics[prod]

    fig, axes = plt.subplots(1, 3, figsize=(22, 6),
                             gridspec_kw={"width_ratios": [3, 3, 1.4]})
    fig.suptitle(f"{prod} — Факт vs Прогноз", fontsize=17,
                 fontweight="bold", x=0.01, ha="left")

    # (1) daily
    ax = axes[0]
    ax.plot(d["ds"], d["yhat"], color=FCST_CLR, lw=1.0, label="Прогноз")
    fact = d.dropna(subset=["y"])
    ax.plot(fact["ds"], fact["y"], color=FACT_CLR, lw=0.8, alpha=0.75, label="Факт")
    ax.axvline(train_end, color="gray", ls=":", lw=1.5)
    ax.text(train_end, 0.98, " конец train", transform=ax.get_xaxis_transform(),
            fontsize=9, color="gray", va="top")
    ax.set_title("Дневная динамика")
    ax.legend(loc="upper left", frameon=True, fontsize=10)
    ax.grid(alpha=0.3)

    # (2) monthly
    ax = axes[1]
    m = d.copy()
    m["ym"] = m["ds"].dt.to_period("M").dt.to_timestamp()
    mm = m.groupby("ym").agg(yhat=("yhat", "sum"),
                             y=("y", lambda s: s.sum(min_count=1))).reset_index()
    ax.plot(mm["ym"], mm["yhat"] / 1e9, color=FCST_CLR, lw=2.2, ls="--",
            marker="s", ms=4, label="Прогноз")
    mf = mm.dropna(subset=["y"])
    ax.plot(mf["ym"], mf["y"] / 1e9, color=FACT_CLR, lw=2.2, marker="o", ms=4,
            label="Факт")
    ax.axvline(train_end, color="gray", ls=":", lw=1.5)
    ax.set_title("Помесячно, млрд ₽")
    ax.legend(loc="upper left", frameon=True, fontsize=10)
    ax.grid(alpha=0.3)

    # (3) OOS residual histogram + metrics box
    ax = axes[2]
    oos = d[(d["ds"] > train_end) & d["y"].notna()]
    if len(oos) >= 7:
        ax.hist((oos["y"] - oos["yhat"]) / 1e6, bins=25,
                color=FCST_CLR, alpha=0.75, edgecolor="white")
        ax.axvline(0, color=FACT_CLR, lw=1.5)
        ax.set_title("Ошибки OOS, млн ₽")
    else:
        ax.set_axis_off()
    ax.text(0.97, 0.97,
            (f"OOS ({met['oos_days']} дн.)\n"
             f"R² = {met['R2']:.3f}\n"
             f"MAE = {met['MAE']/1e6:,.1f} млн\n"
             f"MAPE = {met['MAPE']:.1f}%\n"
             f"RMSE = {met['RMSE']/1e6:,.1f} млн"),
            transform=ax.transAxes, fontsize=10, va="top", ha="right",
            bbox=dict(boxstyle="round", fc="white", ec="#CCCCCC"))

    for ax in axes[:2]:
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

    fig.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(os.path.join(PLOTS_DIR, f"compare_{prod}.png"),
                dpi=150, bbox_inches="tight")
    plt.show()

# ---- 2.4 save ----
with pd.ExcelWriter(OUT_XLSX) as xl:
    df_merged.drop(columns=["booster"]).to_excel(xl, sheet_name="forecast", index=False)
    comparison_table.to_excel(xl, sheet_name="metrics")

print(f"Saved: {OUT_XLSX} (sheets: 'forecast', 'metrics')")
print(f"Charts: {PLOTS_DIR}/compare_<product>.png")
