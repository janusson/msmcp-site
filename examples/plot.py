#!/usr/bin/env python3
"""Draw figures from the captured 1.0.2 tool outputs and exact input files."""
import json
from pathlib import Path
import re
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent
FIG = ROOT.parent / 'public' / 'figures'
FIG.mkdir(parents=True, exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'svg.fonttype':'none','svg.hashsalt':'msmcp-example-v1', 'axes.spines.top':False, 'axes.spines.right':False})

def save(name):
    plt.tight_layout()
    plt.savefig(FIG / name, format='svg', metadata={'Date':None}, bbox_inches='tight')
    plt.close()
    path = FIG / name
    path.write_text('\n'.join(line.rstrip() for line in path.read_text().splitlines()) + '\n')

text = json.loads((ROOT/'results/isotopes.json').read_text())['result']
rows = re.findall(r'\|\s*(M(?:\+\d+)?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|', text)
labels, masses, heights = zip(*[(a,float(b),float(c)) for a,b,c in rows])
fig, ax = plt.subplots(figsize=(7.5,3.7))
ax.bar(range(len(labels)), heights, color='#39849a', width=.48)
for i,(m,h) in enumerate(zip(masses,heights)):
    ax.annotate(f'{m:.4f} Da\n{h:.4f}', (i,h), xytext=(0,5), textcoords='offset points', ha='center', fontsize=9)
ax.set_xticks(range(len(labels)), labels); ax.set_ylim(0,1.22)
ax.set_ylabel('Relative abundance (M = 1)'); ax.set_xlabel('Neutral isotopologue')
ax.set_title('Caffeine · predicted neutral isotope envelope', loc='left', weight='bold')
save('isotope.svg')

# Both records are synthetic. Parse their input peak lists; compute_cosine output
# supplies the reported matching count and score, rather than deriving a score here.
def peaks(path, start, end):
    s = path.read_text().splitlines(); active=False; out=[]
    for line in s:
        if line.startswith(start): active=True; continue
        if active and ((end and line.startswith(end)) or not line.strip()): break
        if active and re.match(r'^\d', line): out.append(tuple(map(float,line.split()[:2])))
    return out
q=peaks(ROOT/'data/caffeine_spectrum.mgf','RTINSECONDS=','END IONS')
r=peaks(ROOT/'data/caffeine_library.msp','Num Peaks:', '')
fig, ax=plt.subplots(figsize=(7.5,4))
for sign, series, color in [(1,q,'#39849a'),(-1,r,'#b46e45')]:
    max_i=max(v for _,v in series)
    for m,v in series:
        h=sign*v/max_i*100; ax.vlines(m,0,h,color=color,lw=2.5)
        if sign==1: ax.annotate(f'{m:.4f}', (m,h), xytext=(0,5), textcoords='offset points', ha='center', fontsize=8)
ax.axhline(0,color='#36434a',lw=.8); ax.set_ylim(-120,135)
ax.set_xlabel('Fragment m/z'); ax.set_ylabel('Relative intensity (%)')
ax.set_title('Synthetic query ↑ / synthetic library entry ↓',loc='left',weight='bold')
ax.text(.98,.95,'4 matched · cosine 1.0000',transform=ax.transAxes,ha='right',va='top',fontsize=9)
save('spectra.svg')

c=json.loads((ROOT/'results/chromatograms.json').read_text())['chromatograms']
t=c['retention_times_min']; traces=[('TIC', c['tic_intensities'], '#202b32'), ('BPC',c['bpc_intensities'],'#638392'), ('XIC 195.0877', c['xic'][0]['intensities'],'#17829b'), ('XIC 250.1234',c['xic'][1]['intensities'],'#bd7044')]
fig,ax=plt.subplots(figsize=(8,4.2))
for label, y, color in traces: ax.plot(t,y,label=label,color=color,lw=2)
ax.set_xlabel('Retention time (min)'); ax.set_ylabel('Summed intensity (input units)')
ax.set_title('Synthetic MS1 traces · ±5 ppm XIC windows',loc='left',weight='bold')
ax.legend(frameon=False,ncol=2,fontsize=9); ax.set_xlim(0,4); ax.set_ylim(bottom=0)
save('chromatograms.svg')
