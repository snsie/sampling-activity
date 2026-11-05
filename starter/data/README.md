# Data dictionary

Choose ONE scenario. The whole CSV for that scenario is your finite population: every number you call the true mean is the mean of the target column over all its rows.

## Clinic waiting times: `clinic_visits.csv` (SIMULATED)

- **One row:** one appointment. **Rows:** 10,000.
- **Target:** `wait_time` (minutes).
- **Population:** All 10,000 appointments in this file (100 weeks x 5 days x 20 slots). It is not every clinic or every week.
- **Row order:** Chronological: visit_id runs week by week, Monday to Friday, slot 1 to 20 within each day.
- **Provenance:** Newly simulated for this activity by data-prep/prepare_data.py (seed 20261105). It follows the layout of the course notebook's clinic_visits.csv, which was not available, so its values are NOT the notebook's values.
- **Source:** Simulated (no external source)
- **Licence / reuse:** Created for this activity; reuse with the rest of this repository.
- **SHA-256:** `594c0f62bb522b383670661a531410a89ac376311c9a11a8b840110970621980`

| Column | Meaning | Units / values |
|---|---|---|
| `visit_id` | Appointment number, 1-10,000, in chronological order | id |
| `week` | Week of the record, 1-100 | week number |
| `weekday` | Day of the week | Mon-Fri |
| `slot` | Appointment slot within the day, 1 (first) to 20 (last) | slot number |
| `visit_type` | Type of appointment | Follow-up, New, Same-day |
| `wait_time` | Minutes the patient waited after the appointment time | minutes (whole) |

Group sizes:

- `visit_type`: Follow-up 5,475, New 2,469, Same-day 2,056
- `weekday`: Mon 2,000, Tue 2,000, Wed 2,000, Thu 2,000, Fri 2,000
- `slot`: 20 values, 500-500 rows each

Simulation model (so you can reason about it, not so you can skip the investigation): waits are whole minutes and never negative; expected waits rise through the day and are longer for Same-day visits; each day also has its own random busy/quiet effect. Generator: `data-prep/prepare_data.py` in the guide's source repository, seed 20261105.

## Healthcare costs: `healthcare_costs.csv` (PUBLIC TEACHING DATASET, simulated by its original author)

- **One row:** one person (a beneficiary record). **Rows:** 1,338.
- **Target:** `charges` (US dollars).
- **Population:** The 1,338 people in this file. It is a teaching dataset, not a representative sample of current claims.
- **Row order:** The order of the source file. row_id is added; the order has no documented meaning and is not a time sequence.
- **Provenance:** The insurance.csv teaching dataset distributed with Brett Lantz's book Machine Learning with R (Packt), as mirrored in the stedy/Machine-Learning-with-R-datasets GitHub repository. The book describes it as hypothetical (simulated) data created using US Census Bureau demographic statistics; the repository itself documents nothing further, and how charges were generated is not published. Unchanged except for the added row_id and age_band columns.
- **Source:** stedy/Machine-Learning-with-R-datasets, insurance.csv <https://raw.githubusercontent.com/stedy/Machine-Learning-with-R-datasets/master/insurance.csv>
- **Licence / reuse:** No licence is stated in the source repository. Widely redistributed for teaching; confirm this use fits your course policy.
- **SHA-256:** `d51bc2b911e7d636d232ee6e9fb94b0c0e9bbad2d898894d9938afb7fa2bbbbd`

| Column | Meaning | Units / values |
|---|---|---|
| `row_id` | Row number in the source file, 1-1,338 (added) | id |
| `age` | Age of the primary beneficiary | years |
| `age_band` | Age group derived from age (added) | 18-29, 30-39, 40-49, 50-64 |
| `sex` | Recorded sex | female, male |
| `bmi` | Body mass index | kg/m² |
| `children` | Number of dependants covered | count |
| `smoker` | Smoker | yes, no |
| `region` | US region of residence | northeast, northwest, southeast, southwest |
| `charges` | Individual medical costs billed | US dollars |

Group sizes:

- `age_band`: 18-29 417, 30-39 257, 40-49 279, 50-64 385
- `region`: northeast 324, northwest 325, southeast 364, southwest 325
- `smoker`: no 1,064, yes 274
- `sex`: female 662, male 676

## Wearable heart rate: `heart_rate_week.csv` (REAL (public extract))

- **One row:** one recorded minute. **Rows:** 9,864.
- **Target:** `heart_rate_bpm` (beats per minute).
- **Population:** The recorded minutes of one wearer's week (25 April - 1 May 2016). It is not every minute of that week, and not other people.
- **Row order:** Chronological by timestamp. Minutes with no reading are absent, so consecutive rows are not always one minute apart.
- **Provenance:** A real extract from the Crowd-sourced Fitbit datasets (Furberg, Brinton, Keating & Ortiz, Zenodo 2016): participant 5577150313, 2016-04-25 00:00 to 2016-05-01 23:59 (device local time), export 4.12.16-5.12.16. heart_rate_bpm is the mean of that minute's readings (the device records every few seconds). activity_state is derived from the same participant's Fitbit sleep log (asleep or restless = sleep) and minute intensity (fairly or very active = exercise); everything else is rest. These are device estimates, not observed or clinically verified labels.
- **Source:** Crowd-sourced Fitbit datasets 03.12.2016-05.12.2016, Zenodo record 53894 <https://zenodo.org/records/53894>
- **Licence / reuse:** CC BY 4.0. Cite: Furberg R, Brinton J, Keating M, Ortiz A. Crowd-sourced Fitbit datasets 03.12.2016-05.12.2016. Zenodo; 2016. doi:10.5281/zenodo.53894
- **SHA-256:** `40be3d58fea1c1aa12b58be75d26460baa8c8a988caac34ff22f3262e98cf5e8`

| Column | Meaning | Units / values |
|---|---|---|
| `row_id` | Row number, 1 to N, in time order | id |
| `timestamp` | Start of the minute, device local time | YYYY-MM-DD HH:MM |
| `heart_rate_bpm` | Mean of the heart-rate readings in that minute | beats per minute (1 decimal) |
| `n_readings` | How many device readings were averaged for that minute | count |
| `activity_state` | Device-derived state: sleep, rest or exercise (see provenance) | sleep, rest, exercise |

Group sizes:

- `activity_state`: exercise 1,049, rest 5,886, sleep 2,929

Recorded minutes: 9,864 of 10,080 in the week (216 minutes have no reading; the longest gap is 135 minutes). Do not assume rows are evenly spaced in time.

No values are missing in any target column.
