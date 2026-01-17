# Python Development Standards

> Reference for Python projects (patrimoine_optimizer, FastAPI backends, data science)

---

## Type System

### Strict Type Hints — Mandatory

```python
# ✅ CORRECT — Fully typed
def calculate_monthly_payment(
    principal: Decimal,
    annual_rate: Decimal,
    months: int,
) -> Decimal:
    """Calculate monthly mortgage payment."""
    ...

# ❌ FORBIDDEN — Missing types
def calculate_monthly_payment(principal, annual_rate, months):
    ...
```

### mypy Configuration

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_ignores = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = true
no_implicit_optional = true
warn_redundant_casts = true
```

---

## Validation with Pydantic v2

### All External Inputs Must Use Pydantic

```python
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

class LoanParameters(BaseModel):
    """Paramètres du prêt immobilier."""
    
    principal_cents: int = Field(..., gt=0, description="Principal in centimes")
    annual_rate_bps: int = Field(..., ge=0, le=10000, description="Rate in basis points")
    duration_months: int = Field(..., ge=12, le=360)
    
    @field_validator("duration_months")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v % 12 != 0:
            raise ValueError("Duration must be a multiple of 12 months")
        return v
    
    @property
    def principal(self) -> Decimal:
        """Convert centimes to euros."""
        return Decimal(self.principal_cents) / 100
    
    @property
    def annual_rate(self) -> Decimal:
        """Convert basis points to decimal rate."""
        return Decimal(self.annual_rate_bps) / 10000
```

---

## Financial Calculations

### ⚠️ CRITICAL: Never Use Float for Money

```python
# ❌ CATASTROPHIC — Float precision errors
total = 0.1 + 0.2  # = 0.30000000000000004

# ✅ CORRECT — Integer centimes
total_cents: int = 10 + 20  # = 30 (€0.30)

# ✅ CORRECT — Decimal with explicit precision
from decimal import Decimal, ROUND_HALF_UP

amount = Decimal("0.1") + Decimal("0.2")  # = Decimal("0.3")
rounded = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
```

### Fiscal Formula Documentation

```python
def calculate_pea_tax(
    gain_cents: int,
    holding_years: int,
) -> int:
    """
    Calculate PEA taxation on capital gains.
    
    Reference: Article 150-0 A du Code Général des Impôts
    - PEA < 5 years: Clôture = PFU 30% (12.8% IR + 17.2% PS)
    - PEA ≥ 5 years: 0% IR + 17.2% PS only
    
    Args:
        gain_cents: Capital gain in centimes
        holding_years: Years since PEA opening
    
    Returns:
        Tax amount in centimes
    """
    if holding_years < 5:
        # PFU = 30% (Art. 200 A CGI)
        return int(gain_cents * 30 / 100)
    else:
        # Prélèvements sociaux only (Art. 136-7 CSS)
        return int(gain_cents * 172 / 1000)
```

---

## Monte Carlo Simulations

### NumPy Vectorization — Mandatory

```python
import numpy as np
from numpy.typing import NDArray

def simulate_returns(
    n_simulations: int,
    n_months: int,
    annual_return: float,
    annual_volatility: float,
    rng: np.random.Generator,
) -> NDArray[np.float64]:
    """
    Vectorized Monte Carlo simulation of investment returns.
    
    Uses log-normal distribution for realistic asset modeling.
    Target: 10,000 simulations in < 30 seconds.
    """
    monthly_return = annual_return / 12
    monthly_vol = annual_volatility / np.sqrt(12)
    
    # ✅ CORRECT — Fully vectorized, no Python loops
    random_shocks = rng.normal(
        loc=monthly_return,
        scale=monthly_vol,
        size=(n_simulations, n_months),
    )
    
    # Cumulative product for wealth evolution
    return np.cumprod(1 + random_shocks, axis=1)


# ❌ FORBIDDEN — Python loops over simulations
def simulate_returns_slow(n_simulations, n_months, ...):
    results = []
    for i in range(n_simulations):  # NEVER DO THIS
        for j in range(n_months):
            ...
```

---

## Docstrings — Google Style

```python
def optimize_allocation(
    monthly_budget_cents: int,
    loan: LoanParameters,
    envelopes: list[InvestmentEnvelope],
    horizon_months: int,
    risk_tolerance: float,
) -> AllocationResult:
    """
    Optimize monthly allocation between loan repayment and investments.
    
    Uses dynamic programming with Monte Carlo sampling to maximize
    expected terminal wealth under risk constraints.
    
    Args:
        monthly_budget_cents: Fixed monthly budget in centimes.
        loan: Loan parameters including rate and remaining duration.
        envelopes: Available investment vehicles (PEA, AV, CTO, etc.).
        horizon_months: Investment horizon in months.
        risk_tolerance: Risk aversion coefficient (0=risk-averse, 1=risk-neutral).
    
    Returns:
        AllocationResult containing optimal monthly allocations and
        projected wealth distribution.
    
    Raises:
        ValidationError: If inputs violate constraints.
        OptimizationError: If no feasible solution exists.
    
    Example:
        >>> result = optimize_allocation(
        ...     monthly_budget_cents=200000,  # €2,000
        ...     loan=LoanParameters(...),
        ...     envelopes=[pea, av],
        ...     horizon_months=240,
        ...     risk_tolerance=0.5,
        ... )
        >>> print(result.optimal_allocation)
    """
    ...
```

---

## Testing with pytest

### Test Organization

```
tests/
├── unit/
│   ├── test_loan_calculations.py
│   ├── test_tax_engine.py
│   └── test_monte_carlo.py
├── integration/
│   ├── test_optimization_pipeline.py
│   └── test_api_endpoints.py
└── conftest.py  # Shared fixtures
```

### Test Patterns

```python
import pytest
from decimal import Decimal
from hypothesis import given, strategies as st

class TestLoanCalculations:
    """Test suite for loan calculation functions."""
    
    def test_monthly_payment_standard_case(self) -> None:
        """Standard 20-year loan at 3.5%."""
        payment = calculate_monthly_payment(
            principal_cents=20000000,  # €200,000
            annual_rate_bps=350,       # 3.50%
            months=240,
        )
        assert payment == 115940  # €1,159.40
    
    def test_monthly_payment_zero_rate(self) -> None:
        """Edge case: interest-free loan."""
        payment = calculate_monthly_payment(
            principal_cents=12000000,
            annual_rate_bps=0,
            months=120,
        )
        assert payment == 100000  # €1,000 (principal / months)
    
    def test_monthly_payment_negative_principal_raises(self) -> None:
        """Negative principal must raise ValidationError."""
        with pytest.raises(ValidationError, match="principal.*positive"):
            calculate_monthly_payment(
                principal_cents=-100,
                annual_rate_bps=350,
                months=240,
            )
    
    @given(
        principal=st.integers(min_value=1, max_value=100_000_000_00),
        rate_bps=st.integers(min_value=0, max_value=2000),
        months=st.integers(min_value=12, max_value=360),
    )
    def test_monthly_payment_always_positive(
        self,
        principal: int,
        rate_bps: int,
        months: int,
    ) -> None:
        """Property: payment is always positive for valid inputs."""
        payment = calculate_monthly_payment(principal, rate_bps, months)
        assert payment > 0
```

---

## Dependencies

### Required in pyproject.toml

```toml
[project]
dependencies = [
    "numpy>=1.24.0",
    "pandas>=2.0.0",
    "scipy>=1.11.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-cov>=4.1.0",
    "pytest-xdist>=3.3.0",
    "mypy>=1.5.0",
    "black>=23.0.0",
    "ruff>=0.1.0",
    "hypothesis>=6.0.0",
]
```

---

## Linting & Formatting

### Ruff Configuration

```toml
[tool.ruff]
target-version = "py311"
line-length = 100
select = [
    "E",   # pycodestyle errors
    "W",   # pycodestyle warnings
    "F",   # pyflakes
    "I",   # isort
    "B",   # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
    "SIM", # flake8-simplify
]
ignore = []

[tool.ruff.per-file-ignores]
"tests/*" = ["S101"]  # Allow assert in tests
```

---

*Apply these standards to all Python code without exception.*
