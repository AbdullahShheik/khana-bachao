# Architectural Analysis: `fitness.py` & `evolution.py` vs. Reissmann et al. (2025)

---

## 1. Fitness Function — `fitness.py` vs. Equation 7 + Equation 8

### 1.1 Paper Specification (Equations 7 & 8)

The paper defines the combined loss as:

```
L̂(Y, X, f̂) = (1/n) Σᵢ (yᵢ − f̂(xᵢ))² + λ · d_φ          ... (Eq. 7)
```

where `d_φ` is defined by the **piecewise** Equation 8:

```
d_φ(Y, X, f̂) = {
    ‖φ_Y − φ_{f̂(X)}‖₂,   if homogeneity violated,
    ∞,                      otherwise (i.e., evaluation is INVALID)
}
```

Key semantics from the paper text (line 664–671):
- **Line 1** ("homogeneity violated"): The forward dimension evaluation *succeeds* but the result ≠ target. The L2-norm of the dimension-vector difference is returned.
- **Line 2** ("otherwise" → ∞): The evaluation is **invalid** — the algebraic operation itself is undefined dimensionally (e.g., adding `[kg]` + `[m]`). This should assign **infinite** penalty.

### 1.2 Your Implementation

```python
# fitness.py lines 29-34
try:
    evaluated_dim = tree.evaluate_dimension(context_dims)
    dim_distance = evaluated_dim.distance(target_dim)
except Exception:
    dim_distance = 1e6
```

### 1.3 Deviations Identified

> [!CAUTION]
> **DEV-F1: The "otherwise → ∞" branch is mapped to `1e6`, not `float('inf')`**
>
> Equation 8 explicitly prescribes `∞` for invalid evaluations (dimensional algebra failure). Your code uses `1e6`, which is a finite number. When `λ` is small (e.g., 0.1), the total penalty is only `0.1 × 1e6 = 1e5`, which is comparable to a very bad MSE, not truly infinite. An individual with a structurally invalid tree (e.g., `mass + length`) could survive selection over one with merely high MSE. **Fix**: use `float('inf')` or return `float('inf')` directly for the entire fitness.

> [!WARNING]
> **DEV-F2: The distance metric does not match Equation 1**
>
> Equation 1 defines:
> ```
> d_φ(φ_a, φ_b) = (1/7) Σ ((φ_a − φ_b)²)
> ```
> This is the **mean** of squared element-wise differences (divided by 7), i.e., MSE over the 7 SI dimensions.
>
> Your `Dimension.distance()` ([dimension.py:36](file:///d:/backprop_imple/dimension.py#L36)) uses `np.linalg.norm(...)` which computes:
> ```
> √(Σ (φ_a − φ_b)²)
> ```
> This is the Euclidean norm (L2-norm), **not** the paper's formula. The paper's formula is `(1/7) * Σ(diff²)` — no square root, plus a 1/7 normalizer. The two are monotonically related but **numerically different**, which will shift the balance between MSE and penalty.

> [!WARNING]
> **DEV-F3: `lambda_penalty` default is `1000`, paper uses `{0, 0.1, 1, 10}`**
>
> Your default `lambda_penalty=1000` is two orders of magnitude above the paper's maximum tested value of `λ=10`. Per the paper (line 666–671), `λ=10` already "dominates even in more extensive error regimes". A value of 1000 will almost certainly suppress all exploration in favor of dimensional correctness, effectively becoming a "discard" strategy (which the paper shows degrades performance by 89% solution rate, line 868–869).

> [!NOTE]
> **DEV-F4: Dimension evaluation happens on the TRAIN context but uses the TREE structure**
>
> This is architecturally correct — dimensional analysis is a structural property of the expression, not data-dependent. However, your `evaluate_dimension` can raise exceptions on `forward_add`/`forward_sub` when child dimensions don't match. The paper treats this as the "otherwise → ∞" case in Eq. 8. Your exception handler catches this correctly in *intent* but uses a finite `1e6` instead of `∞` (see DEV-F1).

> [!NOTE]
> **DEV-F5: Missing the `()²` (square) operator**
>
> The paper's Table 2 (line 727–731) lists the non-terminal set as: `{+, −, ∗, ∕, log, exp, sin(), cos(), ()², √()}`. Your implementation includes `**` in the phenotype but **does NOT include it in the non-terminal set** in `evolution.py` (line 38). The `()²` operator is a unary square (arity 1), not a generic power. Your `arity_map` has `'**': 2` (binary power) which is a different operator not listed in the paper.

---

## 2. Evolution Loop — `evolution.py` vs. Sections 3.1 & 4.2

### 2.1 Tournament Selection

| Aspect | Paper | Your Code | Match? |
|--------|-------|-----------|--------|
| Tournament size | 3 (Table 2, line 700–703) | `size=3` default | ✅ |
| Selection method | Min fitness wins | `min(selected_idx, key=...)` | ✅ |
| Sampling | With/without replacement unspecified | `random.sample` (without replacement) | ✅ |

### 2.2 Elitism

| Aspect | Paper | Your Code | Match? |
|--------|-------|-----------|--------|
| Elitism count | Standard GEP: best individual preserved | 1 elite (`best_all_time`) | ✅ |
| Placement | Injected into new population | `new_population.append(best_all_time.clone())` | ✅ |

### 2.3 Genetic Operator Application Order

> [!CAUTION]
> **DEV-E1: Crossover applied sequentially to the SAME pair — second crossover destroys the first**
>
> ```python
> parent1.one_point_crossover(parent2, prob=0.5)   # may swap segments
> parent1.two_point_crossover(parent2, prob=0.4)    # may swap AGAIN on already-modified parents
> ```
>
> In standard GEP (Ferreira, 2006, [28]), crossover operators are **mutually exclusive per individual per generation**. An individual undergoes *one* type of recombination, not a sequential chain. Your code chains them: if both fire (probability 0.5 × 0.4 = 0.2), the two-point crossover operates on already-crossovered material, which is not equivalent to the paper's intent. **Fix**: select one crossover type per pair (e.g., with probability 0.5 do one-point, else with probability 0.4 do two-point, else none).

> [!WARNING]
> **DEV-E2: Mating proportion is not implemented**
>
> Table 2 specifies `Mating proportion = 0.5` (line 704–707): "Fraction of the population for recreation." This means only 50% of the population should be selected for mating/recombination; the remaining 50% should survive unmodified (beyond the single elite). Your code selects parents for the **entire** population (minus 1 elite), so effectively 100% of offspring are generated through tournament selection + operators. This fundamentally changes the selection pressure.

> [!WARNING]
> **DEV-E3: Both parents are added to the new population — double-counting**
>
> ```python
> new_population.append(parent1)
> if len(new_population) < self.population_size:
>     new_population.append(parent2)
> ```
>
> After crossover, both `parent1` and `parent2` are modified in-place and added. But mutations are also applied to both. This means every tournament selection produces **two** offspring, which is fine in principle but combined with DEV-E2, it means the entire population is replaced each generation with no survivors. Standard GEP typically keeps a fraction unmodified.

> [!WARNING]
> **DEV-E4: Semantic backpropagation is applied to the ENTIRE population every generation**
>
> ```python
> for chro in population:
>     fix_semantics(chro, self.target_dim, library, ...)
> ```
>
> The paper (Algorithm 1, line 523–548) describes the correction being applied to candidates that violate dimensional homogeneity, with **several attempts**. Your code applies it indiscriminately to every individual, including the elite and individuals that may already be dimensionally correct. This is wasteful and potentially destructive — it could modify an already-correct elite before fitness evaluation. Furthermore, the "several attempts" retry logic from Algorithm 1 is not visible here.

> [!NOTE]
> **DEV-E5: SBP is applied BEFORE fitness evaluation — this is CORRECT**
>
> Per the paper (line 547): "the correction process is implemented before evaluation takes place." Your ordering matches.

---

## 3. Missing Hyperparameters & Structural Components (Table 2 Audit)

| Parameter | Table 2 Value | Your Implementation | Status |
|-----------|---------------|---------------------|--------|
| Population size | 500 (GEP_Test) / 1000 (SRBench) | `500` default | ✅ |
| Generations | 1000 (GEP_Test) / 1500 (SRBench) | `1000` default | ✅ |
| Head length | **8** | `init_population(head_length=5)` default overridden to `8` in `run()` | ✅ (in `run()`) |
| **Number of genes** | **3** | **1 (single gene per chromosome)** | ❌ **MISSING** |
| Tournament size | 3 | 3 | ✅ |
| Mating proportion | 0.5 | Not implemented | ❌ **MISSING** |
| Mutation probability | 0.2 | 0.2 | ✅ |
| Inversion probability | 0.1 | 0.1 | ✅ |
| One-point crossover prob | 0.5 | 0.5 | ✅ |
| Two-point crossover prob | 0.4 | 0.4 | ✅ |
| Non-terminal set | `{+,−,∗,∕,log,exp,sin,cos,()²,√}` | Missing `()²`, has `**` instead | ⚠️ **MISMATCH** |
| Terminal set | `x₁,...,xₙ` | Variables + `'1.0'` | ⚠️ Extra constant |
| **Coefficient optimizer** | **Conjugate gradient** | **Not implemented** | ❌ **MISSING** |
| **λ values tested** | `{0, 0.1, 1, 10}` | Default `1000` | ❌ **WRONG** |
| **Tail length formula** | `tail = head + 1` (single gene) | `tail = head + 1` | ⚠️ See note below |

> [!CAUTION]
> **DEV-H1: Multi-gene architecture is completely absent**
>
> Table 2 specifies `Number of genes = 3`. In GEP, multiple genes produce sub-expressions that are combined (typically via addition or multiplication) to form the final expression. Your `Chromosome` class represents a **single gene**. This is a fundamental structural omission — multi-gene GEP can represent significantly more complex expressions.

> [!CAUTION]
> **DEV-H2: Coefficient/constant optimization is missing**
>
> Table 2 specifies a **Conjugate Gradient** coefficient optimizer. The paper mentions this is the "Method for constant optimization." Without it, your system cannot tune floating-point constants in discovered expressions, which is critical for matching equations like `F = G * m₁ * m₂ / r²` where `G` is a physical constant.

> [!WARNING]
> **DEV-H3: Tail length formula for multi-gene GEP**
>
> The paper states sequence length = `2n + 1` with `n = head_length` (line 249). Your implementation uses `tail = head + 1`, giving total length `2h + 1` — this matches for a **single gene**. However, with 3 genes, the full genome should be `3 × (2h + 1)` = `3 × 17 = 51` symbols for `h=8`.

> [!WARNING]
> **DEV-H4: Train/test split uses 10,000 data points**
>
> The paper (line 581) specifies "a total of 10,000 data points" with 0.75/0.25 split. Your code correctly implements the split ratio but depends on `data_loader` providing the correct number of points — verify this.

> [!NOTE]
> **DEV-H5: The `'1.0'` constant in the terminal set**
>
> The paper's terminal set is `{x₁,...,xₙ}` — only input features. Your code adds `'1.0'` as a constant terminal. This is a pragmatic addition (many GEP implementations include ERC — ephemeral random constants), but it deviates from the paper. The paper relies on the **Conjugate Gradient optimizer** (DEV-H2) to fit constants, not on predefined terminal constants.

---

## 4. Summary of Critical Issues (Priority Order)

| Priority | ID | Issue | Impact |
|----------|----|-------|--------|
| 🔴 Critical | DEV-H1 | Multi-gene (3 genes) not implemented | Fundamentally limits expressiveness |
| 🔴 Critical | DEV-H2 | Conjugate gradient constant optimizer missing | Cannot fit physical constants (G, ε₀, etc.) |
| 🔴 Critical | DEV-E1 | Crossover operators chained, not exclusive | Destroys recombination semantics |
| 🟠 High | DEV-F1 | Invalid dimension penalty = 1e6, not ∞ | Invalid trees can survive selection |
| 🟠 High | DEV-F2 | Distance metric: L2-norm vs. paper's (1/7)Σ(diff²) | Numerical mismatch in penalty balance |
| 🟠 High | DEV-F3 | λ default = 1000 vs. paper's max = 10 | Suppresses exploration catastrophically |
| 🟠 High | DEV-E2 | Mating proportion (0.5) not implemented | 100% replacement vs. 50% |
| 🟡 Medium | DEV-E4 | SBP applied to entire pop, no retry logic | Wasteful, may damage correct individuals |
| 🟡 Medium | DEV-F5 | Missing `()²` unary operator | Reduced operator expressiveness |
| 🟢 Low | DEV-H5 | Extra `'1.0'` terminal | Minor deviation from paper |
