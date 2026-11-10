#!/usr/bin/env python3
"""Run all examples with the installed MSMCP 1.0.2 MCP tool registrations.

The mzML is an explicitly synthetic teaching fixture, not an acquisition.
"""
import asyncio
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import time
from importlib.metadata import version

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
OUT = ROOT / 'results'
os.environ['MSMCP_ALLOWED_ROOT'] = str(DATA)
assert version('msmcp') == '1.0.2', 'Install msmcp==1.0.2 in a clean environment'
from msmcp.server import mcp  # noqa: E402 - policy must be set before import


def array(kind, values):
    payload = base64.b64encode(struct.pack('<' + 'd' * len(values), *values)).decode()
    accession, name = ('MS:1000514', 'm/z array') if kind == 'mz' else ('MS:1000515', 'intensity array')
    return (f'<binaryDataArray encodedLength="{len(payload)}"><cvParam cvRef="MS" accession="{accession}" name="{name}"/>'
            f'<cvParam cvRef="MS" accession="MS:1000523" name="64-bit float"/><cvParam cvRef="MS" accession="MS:1000576" name="no compression"/><binary>{payload}</binary></binaryDataArray>')


def synthetic_mzml():
    spectra = []
    # 41 MS1 scans, with 4 interleaved MS2 scans. Intensities are deterministic,
    # constructed Gaussian peaks, and do not represent instrument measurements.
    for n in range(41):
        t = n * 0.1
        a = 1000 * math.exp(-0.5 * ((t - 1.5) / 0.32) ** 2)
        b = 650 * math.exp(-0.5 * ((t - 2.7) / 0.45) ** 2)
        specs = [(1, [100.0, 195.0877, 250.1234], [50.0, a, b], None, t)]
        if n in (10, 15, 25, 30):
            specs.append((2, [110.0713, 138.0662], [20.0, 100.0], 195.0877, t + 0.02))
        for level, mz, intensities, precursor, rt in specs:
            i = len(spectra)
            p = '' if precursor is None else f'<precursorList count="1"><precursor><selectedIonList count="1"><selectedIon><cvParam cvRef="MS" accession="MS:1000744" name="selected ion m/z" value="{precursor}"/></selectedIon></selectedIonList></precursor></precursorList>'
            spectra.append(f'<spectrum index="{i}" id="scan={i}" defaultArrayLength="{len(mz)}"><cvParam cvRef="MS" accession="MS:1000511" name="ms level" value="{level}"/><cvParam cvRef="MS" accession="MS:1000130" name="positive scan"/><cvParam cvRef="MS" accession="MS:100 centroid" name="centroid spectrum"/><scanList count="1"><scan><cvParam cvRef="MS" accession="MS:1000016" name="scan start time" value="{rt:.2f}" unitAccession="UO:0000031" unitName="minute"/></scan></scanList>{p}<binaryDataArrayList count="2">{array("mz", mz)}{array("intensity", intensities)}</binaryDataArrayList></spectrum>')
    xml = f'<?xml version="1.0" encoding="utf-8"?><mzML xmlns="http://psi.hupo.org/ms/mzml" version="1.1.0"><run id="synthetic"><spectrumList count="{len(spectra)}">{"".join(spectra)}</spectrumList></run></mzML>'
    (DATA / 'synthetic_lcms.mzML').write_text(xml.replace('MS:100 centroid', 'MS:1000127'), encoding='utf-8')


async def call(name, **kwargs):
    result = await mcp.call_tool(name, kwargs)
    if result.is_error:
        raise RuntimeError(f'{name}: {result}')
    value = result.structured_content
    if value is None:
        value = [x.model_dump() for x in result.content]
    return value


def string(value):
    return value.get('result', '') if isinstance(value, dict) else str(value)


async def main():
    synthetic_mzml()
    query, library, run = [str(DATA / name) for name in ('caffeine_spectrum.mgf', 'caffeine_library.msp', 'synthetic_lcms.mzML')]
    tools = await mcp.list_tools()
    expected = {"load_mzml_summary", "list_spectra", "load_spectrum", "summarise_reference", "release_reference", "extract_chromatograms", "predict_adduct_offset", "annotate_isotopes", "validate_precursor", "compute_cosine", "search_library", "check_search_status", "cancel_search", "generate_qc_summary", "ping"}
    assert {tool.name for tool in tools} == expected
    outputs = {"tool_schemas": [tool.model_dump(mode="json") for tool in tools]}
    outputs['adduct'] = await call('predict_adduct_offset', adduct_string='[M+H]+')
    outputs['isotopes'] = await call('annotate_isotopes', identifier='C8H10N4O2', isotopologues=4)
    # Inputs intentionally use the rounded output of annotate_isotopes and adduct tool.
    outputs['mass_pass'] = await call('validate_precursor', theoretical_mass=195.087676, experimental_mass=195.0877, instrument_class='orbitrap')
    outputs['mass_reject'] = await call('validate_precursor', theoretical_mass=195.087676, experimental_mass=195.0900, instrument_class='orbitrap')
    outputs['query'] = await call('load_spectrum', file_path=query, spectrum_index=0)
    outputs['search_dispatch'] = await call('search_library', database_file=library, spectrum_reference=outputs['query']['reference'], scoring_method='classical', instrument_class='generic', chunk_size=100)
    match = re.search(r'\b[0-9a-f]{32}\b', string(outputs['search_dispatch']))
    if not match:
        raise RuntimeError('Could not find search job ID')
    for _ in range(100):
        status = await call('check_search_status', job_id=match.group(), full_report=True)
        if 'failed' in string(status).lower():
            raise RuntimeError(string(status))
        if 'Search Results' in string(status):
            outputs['search_result'] = status
            break
        await asyncio.sleep(.1)
    else:
        raise RuntimeError('Search timed out')
    outputs['cosine'] = await call('compute_cosine', query_peaks=[[110.0713,40],[120.0808,100],[136.0757,60],[138.0662,420]], reference_peaks=[[110.0713,40],[120.0808,100],[136.0757,60],[138.0662,420]], instrument_class='generic')
    outputs['spectra'] = await call('list_spectra', file_path=run, max_spectra=100)
    outputs['chromatograms'] = await call('extract_chromatograms', file_path=run, targets_mz=[195.0877,250.1234], tolerance=5.0, tolerance_unit='ppm', ms_level=1, max_spectra=10000)
    outputs['qc'] = await call('generate_qc_summary', file_path=run, instrument_class='generic')
    assert 'VALIDATION PASSED' in string(outputs['mass_pass'])
    assert 'VALIDATION REJECTED' in string(outputs['mass_reject'])
    assert '| 1 | Caffeine | 1.0000 |' in string(outputs['search_result'])
    assert 'SIGNIFICANCE UNCALIBRATED' in string(outputs['search_result'])
    assert '4 / 4 query peaks' in string(outputs['cosine'])
    c = outputs['chromatograms']
    assert c['acquisition']['spectrum_counts_by_ms_level'] == {'1': 41, '2': 4}
    assert c['completeness']['full_acquisition_processed'] is True
    assert len(c['chromatograms']['retention_times_min']) == 41
    OUT.mkdir(exist_ok=True)
    for key, val in outputs.items():
        (OUT / f'{key}.json').write_text(json.dumps(val, indent=2, ensure_ascii=False).replace(str(DATA), '<DATA>') + '\n', encoding='utf-8')
    for p in sorted(DATA.iterdir()):
        print(hashlib.sha256(p.read_bytes()).hexdigest(), p.name)
    print('Done:', ', '.join(outputs))


if __name__ == '__main__':
    asyncio.run(main())
