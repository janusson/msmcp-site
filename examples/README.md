# MSMCP 1.0.2: three reproducible demonstrations

These are software demonstrations, not analytical validation. All spectra and the mzML acquisition in this directory are **synthetic**, including the caffeine library: no instrument measured these data. The synthetic mzML is a minimal reader fixture, not a full mzML conformance example. Its intensities are constructed Gaussian signals, not modelled measurement uncertainty.

## Reproduce

Python 3.13 or later is required. From the website repository root:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install 'msmcp==1.0.2' 'matplotlib==3.10.7'
python examples/reproduce.py
python examples/plot.py
```

The first script sets `MSMCP_ALLOWED_ROOT` to `examples/data` **before importing the installed server**, generates the synthetic mzML, invokes its registered MCP tools in process, polls the real asynchronous search, captures the 15 advertised tool schemas and structured tool outputs in `examples/results`. The second plots those results and peak lists to `public/figures`. The scripts use the same registered tool functions and schemas as the MCP server; they do not exercise a separate stdio client transport. Job IDs, pointer IDs, timestamps, absolute paths and dependency versions can vary; captured paths are normalized to `<DATA>`. For real client connection instructions see the website's Get started section. Do not substitute an unsupported library extension: the release can fall back to a labelled synthetic library for unsupported paths.

## Inputs and provenance

The two caffeine files are byte-for-byte copies from [MSMCP 1.0.2](https://github.com/janusson/MSMCP/tree/1.0.2/examples), licensed under the project's [MIT license](https://github.com/janusson/MSMCP/blob/1.0.2/LICENSE). The library explicitly duplicates the query's caffeine peaks. An MSP file read from disk is a real _file_, but its contents here are fabricated. The synthetic mzML is produced by `reproduce.py`: 41 positive centroid MS1 scans at 0.1-minute intervals, four interleaved MS2 scans, and deterministic constructed signals. This file is licensed with this site under MIT. These are minimal fixtures; no claim about full mzML conformance or vendor compatibility is made.

| Input                   | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `caffeine_spectrum.mgf` | `b185682ea472c486f56119f8ddf130f7b40a9ddd80fa632895143dca7fc6a3f6` |
| `caffeine_library.msp`  | `b2cbfb00dec55518c82cdbdc813f3fe0b8d6d1dee86e6551b08b3763a2d9a436` |
| `synthetic_lcms.mzML`   | `6822e9b6b725d9efaf6afae5cff44518e387e745735057c4ed283dd941462526` |

The generator uses Python floating-point exponentials; check the digest on your platform. If the last bytes vary across platforms, compare the observations and numerical tolerances below rather than claiming byte identity.

## Calls, observations and limitations

The complete parameter choices are in `reproduce.py`, and the actual responses are in `results/`. `annotate_isotopes(identifier="C8H10N4O2", isotopologues=4)` returns neutral M 194.0804 Da and relative abundances 1.0000, 0.1032, 0.0089, 0.0006. `predict_adduct_offset(adduct_string="[M+H]+")` returns +1.007276 Da and charge +1. The comparison uses **the displayed rounded masses**, giving 195.087676 m/z. For the illustrative 195.087700 and 195.090000 inputs, `validate_precursor` with `instrument_class="orbitrap"` reports +0.12 ppm (pass) and +11.91 ppm (reject), respectively, against the preset ±5 ppm. The ±5 ppm is a scenario assumption; an actual method needs its own calibration and acceptance criteria. The isotope plot is a neutral theoretical distribution and does not compare an observed envelope. A pass does not identify a molecule.

`load_spectrum` reads index 0 of the MGF. `search_library` uses the returned spectrum reference, the MSP path, `classical`, `generic`, and `chunk_size=100`; `check_search_status` retrieves the result. The generic preset uses a ±5 ppm precursor gate and ±0.02 Da fragment window. The release reports one eligible candidate (caffeine, 1.0000), and excludes four entries for precursor mismatch. Query polarity, charge and adduct are not provided; the library caffeine entry states positive polarity but not charge or adduct. Compatibility is compared only where both sides provide it. `compute_cosine` on the same four lists returns 4/4 matches and 0 unmatched, cosine 1.0000. Similarity is not structural identity; the result has no calibrated significance or validated error-rate claim. The duplicated query/library pair is a mechanics check, not an independent search validation.

`list_spectra` lists all 45 zero-based indices. `extract_chromatograms` uses MS1, targets 195.0877 and 250.1234 m/z, ±5 ppm, and `max_spectra=10000`. Expect 45 scanned, 41 selected, 0 missing RTs, 0 empty arrays, full coverage and retention time 0–4.0 min. TIC sums the reported scan points; BPC is the maximum; each XIC sums inclusive window points. No smoothing, baseline correction or normalization is applied. `generate_qc_summary` covers 45 spectra and reports all have fewer than five peaks, because the fixture was built that way. Its signal-to-noise calculation is a proxy. The QC total includes MS2, whereas the plotted traces select MS1. No blanks, replicates or standards are present. Compare plotted trace values to captured outputs within floating-point roundoff (absolute 1e-8 in input intensity units), and use the displayed 4-decimal precision for isotope rows and scores.

The [scientific validation record](https://github.com/janusson/MSMCP/blob/1.0.2/SCIENTIFIC_VALIDATION.md) describes independent evidence and its limitations. Reproducing these examples demonstrates software behavior, not fitness for an analytical method, identity, FDR control, or instrument performance.
