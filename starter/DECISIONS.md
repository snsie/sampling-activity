# My decisions and evidence notes

Written by me, not by my AI agent. Write my challenge hypothesis (section 5) **before** consulting
my agent about it, and do not edit it afterwards; add a dated revision below instead.

## 1. Population and target

- Scenario and file:
- One row means:
- Number of rows (N):
- Row order, and what it means in this file:
- Target column and units:
- My finite population is (and what it is not):
- True mean I calculated (and how):

## 2. Design choices

For each stage: the option I chose, why, and what it is meant to help a user learn.

- Stage 2, visualization (include one visual feature meant to reveal a sampling problem):
- Stage 3, sampling interactions and stratification column:
- Stage 4, presentation of the method comparison and sample-size experiments:
- Stage 5, challenge controls:

## 3. Results table

One row per result I read from my app. Add rows as needed. Rerun and update a row whenever I
like: my app does not need to keep a history of runs. Seed is "exact" for exact enumeration;
type is Monte Carlo or exact. In Settings I record the settings that matter for the result, such
as the stratification column and allocation, or my challenge-control values. Keep results from
different conditions in separate rows.

| Experiment | Population or condition | Method | Settings | Seed (or exact) | n | Repetitions or starts | Type | Bias | SD | RMSE |
|---|---|---|---|---|---|---|---|---|---|---|
| Methods at n = 100 | baseline | Simple random | | | 100 | | | | | |
| Methods at n = 100 | baseline | Systematic | | | 100 | | | | | |
| Methods at n = 100 | baseline | Stratified | | | 100 | | | | | |
| Sample size | baseline | Simple random | | | 1 | | | | | |
| Sample size | baseline | Simple random | | | 10 | | | | | |
| Challenge | | | | | | | | | | |

The simple random n = 100 row is also the n = 100 sample-size result when the population and
settings match. If I reran it with different settings, I add a separate row.

## 4. Findings (in my own words, using my own numbers)

- (a) The three sampling methods compared at n = 100 (bias versus variability, and for which population):
- (b) How sample size affects the spread of estimates and the estimation error, and what a larger sample cannot fix:

## 5. Challenge (hypothesis written independently, before consulting my agent)

Hypothesis, written before I consult my agent:

- Date written:
- Method I chose to challenge:
- The change to the population or its ordering:
- Why the selection rule would interact with that change:
- Evidence I expect across repeated samples:
- Evidence that would contradict my hypothesis:

After I test it:

- Test settings (conditions, methods, alternative method or correction, n, seeds); results are in the table above:
- Did the evidence support my hypothesis? Bias versus variability, other explanations, what the alternative or correction showed, and any dated revision (keep the original above):

## 6. AI use

- Tools used:
- What I asked my agent to do, and what I checked myself:
