# Notes for the talk: what does 0.8 promise?

These are the long version, for understanding rather than presenting. The deck
has fifteen minutes; this has none of that constraint. Each section matches a
slide or two, states the claim, derives it, says what the synthetic run
measured, and marks where an analogy is a formal statement and where it is
only a picture. Numbers are from `results/synthetic-lsa/summary.md` (7,613
synthetic tweets, LSA encoder, test split of 2,284) unless stated otherwise.
The last section is a list of predictions to check against the real data,
written down before the real run on purpose.

---

## 1. The promise

A forecaster is calibrated when, among all the items it assigns probability
$p$, the event happens a fraction $p$ of the time:
$\Pr(Y = 1 \mid \hat p = p) = p$ for every $p$. That is a statement about a
population of forecasts, never about one. A single 0.8 that turns out false is
not a calibration failure; a thousand 0.8s of which six hundred come true is.

Calibration alone is cheap. The forecaster that announces the base rate for
every item is perfectly calibrated and knows nothing. That is why the talk
opens on two axes rather than one, and it is the cleanest argument against
reporting ECE without a proper score next to it.

**Proper scoring rules.** A scoring rule $S(p, y)$ is proper if the expected
score under the true probability $q$ is optimised by reporting $p = q$. For
Brier, $\mathbb{E}_q[(p - Y)^2] = (p - q)^2 + q(1 - q)$, minimised uniquely at
$p = q$: strictly proper. Log loss is the other common one. Proper scores reward
honesty and knowledge together, which is why they are the right training
objective and the right headline metric, and why ECE is a diagnostic rather
than a target.

**Murphy's decomposition (1973).** Group forecasts into bins $k$ with
$n_k$ items, mean forecast $\bar p_k$, observed rate $\bar o_k$, overall rate
$\bar o$. Then

$$
\text{Brier} = \underbrace{\sum_k \tfrac{n_k}{n} (\bar p_k - \bar o_k)^2}_{\text{reliability}}
- \underbrace{\sum_k \tfrac{n_k}{n} (\bar o_k - \bar o)^2}_{\text{resolution}}
+ \underbrace{\bar o (1 - \bar o)}_{\text{uncertainty}}
$$

exactly when every forecast in a bin equals its bin mean, and up to a
within-bin variance term otherwise (`metrics.murphy` reports that residual
rather than hiding it, so the arithmetic always closes). Reliability is
dishonesty; resolution is knowledge; uncertainty is the base rate's fixed cost.
For a calibrated forecaster resolution equals $\mathrm{Var}(\hat p)$, which the
test suite checks.

What the run found: keyword rates (empirical Bayes) have reliability 0.0003 and
resolution 0.0076, honest and almost useless (AUC 0.61). Naive Bayes has
reliability 0.038 and resolution 0.087: it knows a lot and lies about it. The
oracle sits at resolution 0.118. The probe gets 0.107 with reliability 0.0006.

---

## 2. The traditional ladder

**Keyword empirical Bayes.** Each keyword's disaster rate, shrunk toward the
pooled rate by a Beta prior fitted by maximising the beta-binomial marginal
likelihood. The fitted prior had strength $a + b \approx 14.5$, so a keyword
seen 14 times is pulled halfway to the global rate. This is what an actuary
would do first, and it is calibrated by construction on anything resembling
its training distribution.

**Logistic regression is calibrated in the large for free.** The log-likelihood
is $\ell = \sum_i y_i \log p_i + (1 - y_i)\log(1 - p_i)$ with
$p_i = \sigma(w^\top x_i + b)$. Its gradient in $b$ is $\sum_i (y_i - p_i)$, so
at the maximum, $\sum_i p_i = \sum_i y_i$: the mean prediction equals the base
rate on the training rows. More generally the gradient in $w_j$ is
$\sum_i x_{ij}(y_i - p_i)$, so for every indicator feature in the model (a
keyword one-hot, a word present or not) the model is calibrated in the large
*within that group* on the training data. That is a weak, in-sample version of
multicalibration, and it is why logistic regression is "honest by accident".
scikit-learn doesn't penalise the intercept for the lbfgs solver, so the
identity survives L2 regularisation; the run measured mean p 0.43682 against mean y 0.43683 on the training rows.

**Naive Bayes is overconfident by construction.** It multiplies per-word
likelihood ratios as if words were independent given the class. Correlated
words ("forest", "fire", "wildfire") are evidence counted three times, so the
log-odds are too large in magnitude. The fitted temperature for naive Bayes was
$T = 9.3$: its log-odds were roughly nine times too loud. Niculescu-Mizil and
Caruana (2005) catalogued the pattern across model families: naive Bayes
pushes to the corners, boosted trees and SVMs squash toward the middle,
logistic regression and bagged trees sit near the diagonal.

**Gradient boosting** (LightGBM on TF-IDF) was the weakest of the
text-feature models here (AUC 0.863), which is the usual result on sparse
bag-of-words: boosting wins on tables, linear models win on bag-of-words. With
log loss as the objective modern GBMs are reasonably calibrated (ECE 0.024).

**Every monotone map preserves ranking.** Platt, temperature, beta, isotonic
and histogram binning are all non-decreasing functions of the raw score, so
AUC is unchanged (isotonic and binning can only *lose* AUC, through ties). A
monotone map can fix reliability and cannot raise resolution beyond what the
ordering already contains. You can buy honesty locally; you cannot buy
knowledge locally. Naive Bayes: ECE 0.186 raw, 0.027 after Platt, 0.019 after
beta calibration, AUC 0.850 throughout.

The maps, in increasing appetite for labels:

* **Temperature**: $\sigma(z / T)$, one parameter. Fixes sharpness, not shift.
* **Platt** (1999): $\sigma(a z + b)$. Slope is $1/T$; intercept is a base-rate shift.
* **Beta** (Kull, Silva Filho and Flach 2017): logistic on $[\ln p, -\ln(1-p)]$,
  bending the two tails separately. The right family for naive Bayes and trees,
  whose miscalibration is asymmetric.
* **Isotonic**: the best non-decreasing step function (pool adjacent violators).
  Reaches zero calibration error in sample, always, which is why it must be
  scored out of sample.
* **Histogram binning** (Zadrozny and Elkan 2001): equal-mass bins mapped to their rates.
* **Venn-Abers** (Vovk and Petej 2014): isotonic twice, see section 8.

---

## 3. Temperature is literal

Softmax is the Boltzmann distribution, $p_i \propto e^{-E_i / k_B T}$, with the
logit $z_i$ playing $-E_i$ and $k_B = 1$. Dividing logits by $T$ is heating or
cooling. Cooling is a monotone transformation, so it moves every probability
and no ranking; this is why AUC and accuracy at 0.5 are blind to it. Rick's
earlier post (`/experiments/confidence-has-a-temperature`) has the full version,
including the toy RLHF calculation where a reward equal to the model's own
log-probability gives $\text{new}(y) \propto \text{old}(y)^{1 + 1/\beta}$, i.e.
cooling to $T = \beta / (1 + \beta)$.

Guo, Pleiss, Sun and Weinberger (2017) found that one fitted $T$ repairs most
of the miscalibration of modern deep nets. That is an empirical fact with a
structural reading: if one scalar suffices, the miscalibration is mostly a
global scale error on the logits, not a distortion of their shape. When it does
not suffice (temperature stalled at ECE 0.028 on the bent probe in section 6,
because the bend included a shift), you need an intercept (Platt) or a shape
(beta, isotonic).

---

## 4. A frozen encoder and one head

The paradigm Rick wants to defend: a pretrained transformer used as a feature
extractor (attention, tokenizer and all), frozen, with a small trained head on
top. BERT-style encoders, DINO and JEPA-style vision models, embedding models
like EmbeddingGemma, and, per secondary reporting, System One models like Jev
(a readout head in place of the vocabulary head) all have this shape. TabPFN
does not: it is pretrained to do inference *in context* (section 5).

**The head is logistic regression.** With frozen features $x$, a linear head
$p = \sigma(w^\top x + b)$ is exactly logistic regression on $x$, so section 2
applies verbatim: calibrated in the large on its training rows, a proper
objective, and a monotone recalibration story. Write $w = \lVert w \rVert\, u$
with $\lVert u \rVert = 1$. Then
$w^\top x + b = \lVert w \rVert (u^\top x + b / \lVert w \rVert)$, which is
$\lVert w \rVert$ times the signed distance from $x$ to the hyperplane. The
norm of the weight vector is an inverse temperature, $T_\text{eff} = 1 / \lVert w \rVert$
(for unit-normalised embeddings, which is why `embed()` normalises). Steep wall,
cold model.

**Matryoshka.** EmbeddingGemma is trained so its first 512, 256 or 128
dimensions are themselves good embeddings (Matryoshka representation
learning); you truncate and re-normalise. The run truncated LSA, whose SVD
components are ordered by variance and so behave like a crude Matryoshka:
Brier after Platt fell monotonically from 0.183 at 16 dims to 0.139 at 256.
Every dropped dimension cost resolution, which no map buys back.

**Task prefixes.** EmbeddingGemma is steered by a prompt prepended to the
text: `task: classification | query: ` for classification, `task: clustering
| query: ` and `task: search result | query: ` among others. Rick's hypothesis
is that the right prefix gives "better contrast and clustering". The lab turns
that into two numbers per prefix: the Fisher ratio of the probe's logit
($(\mu_1 - \mu_0)^2 / (\sigma_0^2 + \sigma_1^2)$, separation along the one
direction the head uses) and the cosine silhouette of the classes in the full
space (separation everywhere). The prefix can only change resolution; whether
it also changes the head's calibration is an empirical question the run
answers. LSA has no prefixes, so this is empty until the gemma run.

---

## 5. Cover's theorem and the hard wall

The tempting recipe: put a few hundred labelled tweets into a 768-dimensional
space and find the hyperplane that separates them.

**Cover (1965).** For $n$ points in general position in $\mathbb{R}^d$, the
number of labellings realisable by a hyperplane through the origin is
$C(n, d) = 2 \sum_{k=0}^{d-1} \binom{n-1}{k}$. Every one of the $2^n$
labellings is separable when $n \le d$, and the fraction $C(n,d)/2^n$ crosses
$1/2$ at exactly $n = 2d$, sharpening into a step as $d \to \infty$. So below
about two points per dimension a separating hyperplane exists for *random*
labels. Finding one tells you nothing about whether there is signal.

**Gardner (1988)** computed the same capacity with the replica method from the
statistical mechanics of spin glasses: the volume of weight space consistent
with $\alpha n$ random patterns vanishes at $\alpha_c = 2$, a genuine phase
transition in the thermodynamic limit. This is the formal version of the
physics framing, not an analogy: perceptron capacity is a partition-function
calculation.

**What separability does to a probability.** If the training labels are
linearly separable, the logistic likelihood has no finite maximum: scaling $w$
up always increases it (Albert and Anderson 1984). An unpenalised fit runs
$\lVert w \rVert \to \infty$, so $T_\text{eff} \to 0$ and every prediction is
pushed to 0 or 1. The hard wall. An L2 penalty bounds $\lVert w \rVert$: it
softens the wall, and in this picture the regulariser is the thermostat. The
Bayesian version is MacKay's moderated output: integrating the sigmoid over the
posterior on $w$ shrinks the logit by roughly $1/\sqrt{1 + \pi s^2 / 8}$, where
$s^2$ is the posterior variance along $x$. Uncertainty about the wall is
temperature.

What the run found (unpenalised fit at $C = 10^6$ against a cross-validated
L2 head, test ECE, three subsamples each):

| d | n | n/d | separable | ECE, no penalty | ECE, L2 |
|---|---|---|---|---|---|
| 256 | 25–200 | 0.1–0.8 | always | 0.23–0.26 | 0.07–0.14 |
| 256 | 400 | 1.6 | 2 of 3 | 0.27 | 0.05 |
| 256 | 800 | 3.1 | never | 0.24 | 0.035 |
| 256 | 3,807 | 14.9 | never | 0.046 | 0.018 |

The same transition shows at $d = 32$ and $d = 128$: separable at
$n/d = 1.56$, not at $3.1$. Real data with signal is a little more separable
than random labels, so the transition sits slightly above 2. The weight norm
peaks near the transition (1,770 at $d = 128$, $n = 400$): the fit is almost
separable and runs a long way before the few overlapping points stop it.

The phrasing for the room: finding the hyperplane is free; the probability is
the penalty's doing. The hyperplane is the decision; the temperature is
everything else.

**Pushback on the original plan.** "Find the separating hyperplane, then
calibrate it" works, but the calibration step is then doing all the work, and it
needs labels the hyperplane didn't see. With a few hundred labels in 768
dimensions, fit the head with a penalty chosen by cross-validated log loss and
calibrate on a separate slice; or use the labels for the head and accept
temperature scaling as the only map you can afford.

---

## 6. Training calibration into a transformer

**Why pretrained models start out roughly calibrated.** Next-token pretraining
minimises log loss, a strictly proper score, so at the optimum the predicted
distribution matches the conditional frequency the model can represent. Kadavath
et al. (2022) found large pretrained models well calibrated on multiple-choice
questions. The GPT-4 technical report showed calibration degrading after
preference tuning, and Tian et al. (2023) found the same for the token
probabilities of RLHF models.

**Why tuning breaks it.** A preference reward is not a proper scoring rule:
nothing in "the rater preferred answer A" rewards stating the right
probability. The KL-regularised RL optimum is a Boltzmann reweighting of the
pretrained distribution by the reward (the closed form DPO starts from), and if
the reward favours confident-sounding answers the result is cooled (section 3).

**What training it in requires.** Put a proper score back in the objective for
whatever the model reports as its probability. For a classifier head that is
just log loss, plus a held-out check. Variants in the literature: label
smoothing (trades overconfidence for underconfidence), focal loss (Mukhoti et
al. 2020), mixup, and post-hoc temperature. For a model that states its
confidence in text, RL with a Brier-style term on the stated confidence (the
"RLCR" line of work, Damani et al. 2025; check the citation before quoting it).
TypeSafe calls its method RLCD and describes the reward as whether the
probability was honest; the objective is not published, so "a proper scoring
rule in RL clothing" is an interpretation. The only independent evaluation
found their multiple-choice probabilities well calibrated and their binary yes/no
probabilities biased toward yes, which is the argument for recalibrating on your
own traffic even when the vendor trained for calibration. The lab's Jev mock
copies that bias (+0.5 logit) so the pipeline has something to repair; it is not
a claim about Jev.

**TabPFN is a different paradigm.** A prior-fitted network (Müller et al. 2022;
Hollmann et al. 2023, 2025) is a transformer trained on millions of synthetic
datasets drawn from a prior over data-generating processes, with the objective
of predicting held-out points given the rest of the dataset in context. The
minimiser of that expected log loss is the posterior predictive under the prior.
So TabPFN is calibrated by construction *to the extent the prior matches your
data*, and its inference is in-context learning: no head, no gradient step at
prediction time. That puts it closer to an LLM doing few-shot classification
than to a BERT with a classifier on top. In the lab it appears as a nonlinear
head on the first 128 embedding dimensions (`--tabpfn`), which is a hybrid:
frozen encoder, in-context head.

---

## 7. Measuring it: the ruler

**Binned ECE is biased upward by noise.** Take a perfectly calibrated
forecaster and $B$ equal-mass bins of $m = n/B$ items each. A bin's observed
rate minus its mean forecast is a mean of $m$ centred Bernoulli residuals, with
standard deviation about $\sigma / \sqrt m$ where
$\sigma^2 = \overline{p(1-p)}$. For a roughly normal variable
$\mathbb{E}|X| = \sqrt{2/\pi}\, \mathrm{sd}(X)$, so

$$
\mathbb{E}[\text{ECE}_B] \approx \sqrt{2/\pi}\; \sigma \sqrt{B / n}.
$$

A calibrated model's ECE is pure noise, and it grows as the square root of the
number of bins. A real miscalibration of size $\delta$ appears as a plateau at
$\delta$ for coarse bins, until $\sqrt{2/\pi}\,\sigma\sqrt{B/n}$ overtakes it at
$B^* \approx \pi n \delta^2 / (2 \sigma^2)$. That crossover is the finest
calibration map the labels can support.

**The coastline.** Richardson measured coastlines with shorter rulers and found
the length growing as a power of the ruler; Mandelbrot read the exponent as a
fractal dimension, $L(\varepsilon) \sim \varepsilon^{1 - D}$. Sort the forecasts
and form the running sum $W_k = \frac1n \sum_{i \le k} (y_i - p_i)$. Under
calibration it is a martingale with increments of variance $p_i(1-p_i)/n^2$, a
time-changed Brownian motion, and the graph of Brownian motion has
dimension 1.5. Binned ECE is (up to the absolute value) a sum of the walk's
increments over $B$ blocks, a length at ruler $\varepsilon = 1/B$, so
$\text{ECE} \sim B^{1/2} = \varepsilon^{1 - 1.5}$. **This one is formal**: it is
the same scaling, from the same object. The run measured slopes of 0.54 (null),
0.47 (oracle on all 7,613 rows), 0.46 (probe after Platt) and 0.01 for naive
Bayes, whose real error dominates at every ruler in range.

Corollary for anyone quoting a number: even the oracle, the true probabilities
themselves, scores ECE 0.015 on the 2,284-row test split with ten bins. A
reported ECE without its bin count and sample size is reporting the ruler.

**Measure the excursion, not the length.** Under the null, $W$ rescaled by its
standard deviation $\sqrt{\sum p_i(1-p_i)}/n$ is approximately standard Brownian
motion on $[0, 1]$, so the Kolmogorov–Smirnov statistic $\max_k |W_k|$ has the
distribution of $\sup_{t \le 1} |B_t|$:
$\Pr(\sup|B| < x) = \frac{4}{\pi}\sum_{k \ge 0} \frac{(-1)^k}{2k+1} e^{-(2k+1)^2 \pi^2 / 8x^2}$.
No bins, an exact null, a p-value (Tygert 2021; Arrieta-Ibarra et al. 2022 on
cumulative differences; Gupta et al. 2021 use the same statistic for training).
The run: probe p = 0.75 raw, 0.34 after Platt on the walk figure's draw; naive
Bayes p ≈ 7e-14. Smooth ECE (Błasiok and Nakkiran 2023) is the kernel
alternative: smooth the residuals with a reflected Gaussian of width $s$ and
choose $s$ at the fixed point $\text{smECE}(s) = s$, which makes the bandwidth
choose itself.

**The billiard connection, stated carefully.** In Rick's grad work
(GaAs/AlGaAs two-dimensional electron gas billiards; Taylor, Micolich and
colleagues) the magnetoconductance trace fluctuates, and the fractal dimension
of that trace was a diagnostic of the dynamics underneath. As I understand the
physics (Rick knows it first-hand; correct me): Ketzmerick predicted that
mixed phase space, which soft walls produce, gives fractal conductance
fluctuations, while fully chaotic hard-walled billiards give smooth statistics,
and the experiments measured the dimension of the trace to tell them apart.
The formal part of the analogy is the *method*: estimate the scaling of a noisy
1-d trace across rulers and read the exponent as a statement about the process.
The model is not a billiard. What carries over is that you know the dimension
of the noise (1.5), so departures from it at large scales are signal.

---

## 8. How many labels, and the conformal family

**Labels per bin.** A bin's observed rate has standard error
$\sqrt{p(1-p)/m}$; to see a gap $\delta$ at $z$ standard errors you need
$m = z^2 p(1-p)/\delta^2$: 385 labels at $p = 0.5$ for $\delta = 0.05$,
2,401 for $\delta = 0.02$. The $1/\delta^2$ is the conversation with whoever
pays the labelers. The run bent the probe (cooled to $T = 0.5$, shifted +0.4
logits, ECE 0.102) and repaired it with growing label sets: temperature is best
up to about 200 labels (0.040 at 100, against Platt's 0.049 and isotonic's
0.078) and then stalls near 0.03 because one scalar cannot undo a shift; Platt
overtakes it around 400; isotonic needs about 800 before it stops fitting
noise. That matches the jev-mock README's table on a different problem.

**Conformal prediction** (Vovk, Gammerman, Shafer) promises something else.
Split conformal: fit on one slice, compute nonconformity scores
$s_i = 1 - \hat p(y_i \mid x_i)$ on a calibration slice of size $n$, take
$q$ = the $\lceil (n+1)(1-\alpha) \rceil$-th smallest, and output
$\{y : 1 - \hat p(y \mid x) \le q\}$. If the calibration and test points are
exchangeable, $\Pr(Y \in \text{set}) \ge 1 - \alpha$ in finite samples, for
*any* model. That guarantee is marginal and about sets. A useless model meets
it by returning {0, 1} often; it never becomes calibrated.

The run makes the distinction concrete: naive Bayes (ECE 0.186) gets 90.9%
coverage. Keyword rates (ECE 0.010, the most calibrated model in the ladder)
also get 90.4% overall, but only 81% on real disasters and 98% on the rest:
the marginal guarantee is met by over-covering the easy class. **Mondrian**
conformal, one threshold per class, restores 92% and 89%. Marginal guarantees
hide the class you care about; so do marginal calibration metrics, which is the
same lesson as section 10's segmentation.

**Venn-Abers is the bridge.** For a test score $s$, append $(s, 0)$ to the
calibration set and fit isotonic regression, read off $p_0$; append $(s, 1)$,
read off $p_1$. Under exchangeability one of $p_0 \le p_1$ is perfectly
calibrated (a Venn predictor's validity), and the interval width is the price of
not knowing which. It shrinks roughly like $1/n$: 0.165 wide at 50 calibration
labels, 0.038 at 400, 0.017 at 1,522. The point prediction
$p_1 / (1 - p_0 + p_1)$ minimises log loss over the pair. This is the honest
form of what Rick first called "conformal mapping": conformal machinery,
probabilistic output, and a validity guarantee instead of a fitted curve.
(Conformal *mapping* is the angle-preserving maps of complex analysis; avoid
the phrase in the room.)

---

## 9. Drift

Three kinds, worth naming separately. **Covariate shift**: $p(x)$ changes,
$p(y \mid x)$ doesn't; a model that learned $p(y \mid x)$ well stays
calibrated, but only where it saw data. **Label shift**: $p(y)$ changes,
$p(x \mid y)$ doesn't; the correct posterior moves by a constant in log-odds,
$\log\frac{\pi'_1 \pi_0}{\pi_1 \pi'_0}$ (Saerens, Latinne and Decaestecker 2002),
which is exactly an intercept change: Platt's $b$. **Concept shift**:
$p(y \mid x)$ itself changes; only new labels can show it.

The storm in the lab is the first two at once: water keywords never seen in
training (covariate shift in vocabulary) and water tweets drawn with weight
$1 + 3y$ (label shift; the share that are real reports jumps when the storm
hits). The model trained dry scored ECE 0.036 on held-out dry tweets and 0.066
on water tweets. The simulation's oracle is corrected for the label shift, as
it must be: the same tweet is likelier to be real when it arrives mid-storm,
$t' = 4t / (4t + 1 - t)$.

**Ergodicity and exchangeability.** The slide line, "exchangeability is the
statistician's ergodic hypothesis", is loose; here is the precise version.
Estimating calibration from past labels and applying it to future items assumes
time averages over your label stream equal the expectation under the
distribution you'll face: an ergodic, stationary assumption. Conformal needs
more: exchangeability, invariance of the joint law under permutations. By de
Finetti an exchangeable sequence is a mixture of i.i.d. sequences, and by the
ergodic decomposition a stationary process is a mixture of ergodic ones;
exchangeable processes are the stationary ones whose ergodic components are
i.i.d. A storm breaks stationarity outright, and with it both. Adaptive
conformal inference (Gibbs and Candès 2021) gives up the exchangeability
guarantee for a long-run one: after each step,
$\alpha_{t+1} = \alpha_t + \gamma(\alpha - \text{err}_t)$, so misses shrink the
working $\alpha$ and grow the sets. In the storm the frozen threshold covered
86.7% against a 90% target; ACI covered 89.9%.

**The label-free alarm.** The population stability index on raw scores
(0.150 on water tweets) flags that something changed without any labels. It is
an alarm, not a test: calibration can rot under an unchanged score histogram
(concept shift), and the histogram can move while calibration holds (pure
covariate shift inside the model's competence).

---

## 10. The labeling loop

The setup: score each batch of 150, act on items whose recalibrated
probability is at least 0.5, label 30 per batch, labels arrive two batches
later, refit Platt on the labels you have. Four policies spend the same budget
differently: label what you flagged (dispatchers confirming alerts), label
nearest the threshold (uncertainty sampling), label uniformly at random, or a
stratified design with 80% flagged and 20% from the unflagged, each weighted by
its inverse inclusion probability.

**A correction to what I said in chat.** I said choosing which items to label
by the model's own score biases the calibration map. Stated that way it is
wrong. The map estimates $\Pr(Y = 1 \mid S = s)$; selecting on $S$ is selection
on the conditioning variable, which is ignorable (missing at random given $s$).
Within the region you label, the flagged queue learns the map without bias. The
damage is elsewhere: (1) outside that region the map is unidentified, and a
parametric map like Platt extrapolates whatever it learned in the flagged
region into the unflagged one; (2) every *aggregate* you estimate from those
labels (the miss rate, recall, ECE, the count of disasters) is biased, because
those are expectations over the whole population, not conditionals on $s$.
The run confirms both halves. All four policies, refitting on everything they
had, produced nearly the same map (late-storm calibration-in-the-large between
−0.073 and −0.085). The policies differed only in what they could *see*: real
misses ran at about 17 a batch; the flagged-only queue estimated 0.0, because a
miss is by definition something you didn't flag; uncertainty sampling estimated
7.1, because it only sees the misses that were nearly caught; random and
stratified estimated 16.9 and 16.3. The weighted estimator is Horvitz–Thompson:
each audited item stands for $1/\pi_i$ items, so
$\widehat{\text{misses}} = \sum_{\text{audited, unflagged}} y_i / \pi_i$ is
unbiased.

**Forget, and segment.** The policy barely moved the map; memory and structure
did. Late in the storm, mean squared error against the (label-shift-corrected)
truth:

| loop | error vs truth | calibration in the large | count error / batch |
|---|---|---|---|
| frozen launch map | 0.056 | −0.134 | 20.1 |
| refit on all labels | 0.041 | −0.084 | 12.6 |
| refit on the last 6 batches | 0.031 | −0.011 | 4.4 |
| last 6 batches, one map per keyword family | 0.015 | −0.014 | 4.3 |

Refitting on everything is outvoted by months of calm. Forgetting follows the
storm but stretches one curve over two populations, dry and wet, that need
different intercepts. Segmenting gives each its own map once it has 40 labels
in the window. Forgetting has a price that shows early in the run: with only
one or two batches of labels in the window, the windowed maps are noisier than
the cumulative one (error 0.027 against 0.012 at batch 3). Window length is a
bias–variance knob, and in production it should be chosen the way the refit is
gated: on held-back recent labels.

The segmentation result is the same lesson as Mondrian conformal and as the
jev-mock README's "score each question separately": calibration is per
question, per population, per period.

---

## 11. What the synthetic data can and can't say

The generator is in `lab/synth.py`. Each tweet gets a keyword (about 120, in
eight families, each with a literal "lean"), a register (report, witness,
ambiguous, news about something else, figurative, media) and decoration (links,
hashtags, shouting, a location or not). The true log-odds is
$\text{base}_\text{register} + \text{gain}_\text{register} \times \text{lean}_\text{keyword}$
plus small effects for links, location and shouting; the label is a coin flip
with that probability. The product term makes the truth nonlinear in
bag-of-words features, so a nonlinear head has something to find; it found a
little (MLP true ECE 0.022 against the linear probe's 0.025, inside the noise).
Oracle AUC is 0.89 and oracle Brier 0.128, close to what strong models reach
on the real file.

What it can't say: anything about semantics. LSA knows only co-occurrence in
this corpus; EmbeddingGemma knows English. Every result that depends on the
encoder's knowledge (how much the prefix helps, how far the probe beats
TF-IDF, how badly the storm hurts a model that has never seen the word
"hurricane") will change on the real run, and should. Every result that is
structural (the noise floor, the √B law, Cover's transition, the
flagged-only blind spot, the label-shift intercept) should not.

---

## 12. Predictions for the real run

Written before seeing it. Check each one and keep score; the misses are the
interesting part.

1. **The ruler** holds: null slope within 0.4–0.6; naive Bayes plateau at
   ECE above 0.1. (Structural; high confidence.)
2. **Naive Bayes** fitted temperature well above 2; Platt or beta brings its
   ECE under 0.04. (High.)
3. **The probe beats TF-IDF logistic regression** on AUC by at least 0.02 with
   EmbeddingGemma, because the encoder knows that "flood" and "deluge" are
   related and the bag of words doesn't. (Medium.)
4. **The classification prefix** gives a higher Fisher ratio than no prefix.
   The custom task prefix is a coin flip against it. (Medium-low; this is the
   one Rick cares about and the one I'm least sure of.)
5. **Cover's transition** at 768 dimensions lands between $n/d = 1$ and 3, so
   somewhere between about 800 and 2,300 labels, and the unpenalised head's ECE
   is above 0.15 below it. (High for the location, medium for the size.)
6. **The storm hurts the gemma probe less than the LSA probe**: smaller gap
   between dry and water ECE, because pretrained semantics transfer to unseen
   keywords. This is the cleanest test of "transfer learning" in the deck.
   (Medium.)
7. **The flagged-only queue estimates zero misses.** (Certain: it is
   structural. If it doesn't, there's a bug.)
8. **Mondrian closes the keyword model's class gap**; split conformal's
   coverage on real disasters is under 85% for keyword rates. (Medium-high.)
9. **The real labels are noisier than the synthetic ones**: the real file has
   duplicate tweets with conflicting labels, so expect every model's Brier to
   sit above its synthetic counterpart. (High.)
