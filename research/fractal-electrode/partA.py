"""
Part A -- forward comparison, fixed pixel footprint.

Each electrode is confined to the SAME W x W pixel and sits the SAME gap
above the tissue plane (matched proximity). What varies is the geometry,
and therefore the metal COVERAGE (= 1 - optical transparency).

The device question: can a sparse fractal deliver field comparable to a
solid pad while covering a fraction of the pixel? And is there a fractal
dimension D where "field delivered per unit coverage" is maximised?
"""
import sys, json, time
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from lib import (solve_conductor, harmonic_measure, tissue_field,
                 make_square, make_htree, grow_dbm, box_count_dim)

SMOKE = "--smoke" in sys.argv

Ny = Nx = 220 if not SMOKE else 100
W = 84 if not SMOKE else 36          # pixel footprint (cells)
TOP_ROW = 130 if not SMOKE else 58   # closest metal row to ground/tissue side
GAP = 9 if not SMOKE else 4
TISSUE = TOP_ROW - GAP
GRID = 141 if not SMOKE else 61
TR = W // 2 - 2                       # DBM target radius
NCAP = 1000 if not SMOKE else 200


def stamp(mask_local, top_row):
    ys, xs = np.where(mask_local)
    sub = mask_local[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = sub.shape
    out = np.zeros((Ny, Nx), dtype=bool)
    x0 = Nx // 2 - w // 2
    out[top_row:top_row + h, x0:x0 + w] = sub
    return out, (h, w)


def metrics(mask, bbox):
    phi = solve_conductor(mask, ground_row=0)
    sigma = harmonic_measure(phi, mask)
    Q = float(sigma.sum())
    _, Emag, _ = tissue_field(phi, TISSUE)
    area = int(mask.sum())
    foot = W * W
    coverage = area / foot
    meanE = float(Emag.mean())
    peakE = float(Emag.max())
    return dict(phi=phi, sigma=sigma, Q=Q, area=area, coverage=coverage,
                meanE=meanE, peakE=peakE,
                field_per_coverage=meanE / coverage,
                field_per_charge=meanE / Q,
                uniformity=meanE / peakE,
                D=float(box_count_dim(mask)))


t0 = time.time()
print("references ...", flush=True)
square_local = np.ones((W, W), dtype=bool)
square, _ = stamp(square_local, TOP_ROW)
m_sq = metrics(square, None)
m_sq["D"] = 2.0  # solid

ht_local = make_htree(Ny, Nx, order=4, span=W - 6, cy=Ny // 2, cx=Nx // 2, thickness=2)
htree, _ = stamp(ht_local, TOP_ROW)
m_ht = metrics(htree, None)

print(f"  square  cov={m_sq['coverage']:.2f} D~2.0  meanE={m_sq['meanE']:.4f} "
      f"Q={m_sq['Q']:.0f}  field/cov={m_sq['field_per_coverage']:.4f}", flush=True)
print(f"  h-tree  cov={m_ht['coverage']:.2f} D={m_ht['D']:.2f} meanE={m_ht['meanE']:.4f} "
      f"Q={m_ht['Q']:.0f}  field/cov={m_ht['field_per_coverage']:.4f}", flush=True)

# DLA reference for harmonic-measure figure
dla_local = grow_dbm(grid=GRID, n_cells=NCAP, eta=1.0, seed=1, target_radius=TR)
dla, _ = stamp(dla_local, TOP_ROW)
m_dla = metrics(dla, None)
print(f"  DLA     cov={m_dla['coverage']:.2f} D={m_dla['D']:.2f} meanE={m_dla['meanE']:.4f} "
      f"Q={m_dla['Q']:.0f}  field/cov={m_dla['field_per_coverage']:.4f}", flush=True)

# ---- sweep eta -> D across the fractal regime -----------------------------
etas = [1.0, 1.5, 2.0, 3.0, 4.0] if not SMOKE else [1.0, 3.0]
seeds = [1, 2] if not SMOKE else [1]
print("\nsweep ...", flush=True)
sweep = []
for eta in etas:
    for sd in seeds:
        cl = grow_dbm(grid=GRID, n_cells=NCAP, eta=eta, seed=sd, target_radius=TR)
        mk, _ = stamp(cl, TOP_ROW)
        m = metrics(mk, None)
        sweep.append((eta, sd, m))
        print(f"  eta={eta:4.1f} s{sd} D={m['D']:.2f} cov={m['coverage']:.2f} "
              f"meanE={m['meanE']:.4f} field/cov={m['field_per_coverage']:.4f}", flush=True)
print(f"  total {time.time()-t0:.1f}s", flush=True)

# ====================== FIGURE 1: harmonic measure ========================
BG = "#1a1207"
refs = {"solid square": (square, m_sq), "h-tree": (htree, m_ht), "DLA (eta=1)": (dla, m_dla)}
fig, axes = plt.subplots(1, 3, figsize=(11, 4.3))
fig.patch.set_facecolor(BG)
for ax, (name, (mask, m)) in zip(axes, refs.items()):
    ys, xs = np.where(mask)
    y0, y1 = ys.min() - 3, ys.max() + 4
    x0, x1 = xs.min() - 3, xs.max() + 4
    crop = m["sigma"][y0:y1, x0:x1]
    disp = np.ma.masked_where(crop <= 0, crop)
    ax.imshow(np.where(mask[y0:y1, x0:x1], 1, 0), cmap="bone", alpha=0.15)
    ax.imshow(disp, cmap="inferno")
    ax.set_title(f"{name}\nD={m['D']:.2f}  coverage={m['coverage']*100:.0f}%  Q={m['Q']:.0f}",
                 color="#f0e6d2", fontsize=10.5)
    ax.set_xticks([]); ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_color("#3d2e1a")
fig.suptitle("harmonic measure: where the surface charge (= the field) actually lives",
             color="#e8a838", fontsize=13, y=1.03)
fig.tight_layout()
fig.savefig("figs/A1_harmonic_measure.png", dpi=130, facecolor=BG, bbox_inches="tight")
print("wrote figs/A1_harmonic_measure.png", flush=True)

# ====================== FIGURE 2: trade-off + optimal D ===================
Ds = np.array([m["D"] for *_, m in sweep])
cov = np.array([m["coverage"] for *_, m in sweep]) * 100
me = np.array([m["meanE"] for *_, m in sweep])
fpc = np.array([m["field_per_coverage"] for *_, m in sweep])

fig, ax = plt.subplots(1, 2, figsize=(11.5, 4.6))
fig.patch.set_facecolor(BG)
for a in ax:
    a.set_facecolor("#241a0c")
    a.tick_params(colors="#9e8e72")
    for sp in a.spines.values():
        sp.set_color("#3d2e1a")

# left: field delivered vs coverage (the trade-off plane)
sc = ax[0].scatter(cov, me, c=Ds, cmap="autumn", s=55, edgecolor="#1a1207", zorder=3)
ax[0].scatter([m_sq["coverage"] * 100], [m_sq["meanE"]], marker="s", s=90,
              c="#9e8e72", edgecolor="#f0e6d2", label="solid square", zorder=4)
ax[0].scatter([m_ht["coverage"] * 100], [m_ht["meanE"]], marker="^", s=90,
              c="#e8a838", edgecolor="#f0e6d2", label="h-tree", zorder=4)
ax[0].set_xlabel("metal coverage  (%)  ->  less transparent", color="#f0e6d2")
ax[0].set_ylabel("field delivered to tissue plane", color="#f0e6d2")
ax[0].set_title("the trade-off plane", color="#f0e6d2")
ax[0].legend(facecolor="#241a0c", edgecolor="#3d2e1a", labelcolor="#9e8e72", fontsize=8)
cb = fig.colorbar(sc, ax=ax[0]); cb.set_label("D", color="#9e8e72")
cb.ax.yaxis.set_tick_params(color="#9e8e72")
plt.setp(plt.getp(cb.ax, "yticklabels"), color="#9e8e72")

# right: field per coverage vs D
ax[1].axvspan(1.3, 1.45, color="#e8a838", alpha=0.12)
ax[1].axvline(1.4, color="#e8a838", ls=":", lw=1, label="neuron D~1.4")
ax[1].axvline(1.71, color="#b87a1e", ls="--", lw=1, label="DLA 1.71")
ax[1].scatter(Ds, fpc, c="#ffd984", s=55, edgecolor="#1a1207", zorder=3)
ax[1].axhline(m_sq["field_per_coverage"], color="#9e8e72", ls="-", lw=1, label="solid square")
ax[1].set_xlabel("fractal dimension D", color="#f0e6d2")
ax[1].set_ylabel("field delivered per unit coverage", color="#f0e6d2")
ax[1].set_title("transparency efficiency vs D", color="#f0e6d2")
ax[1].legend(facecolor="#241a0c", edgecolor="#3d2e1a", labelcolor="#9e8e72", fontsize=8)

fig.suptitle("a sparse fractal buys field at a fraction of the coverage",
             color="#e8a838", fontsize=13)
fig.tight_layout()
fig.savefig("figs/A2_tradeoff.png", dpi=130, facecolor=BG, bbox_inches="tight")
print("wrote figs/A2_tradeoff.png", flush=True)

out = {"refs": {k: {kk: vv for kk, vv in m.items() if kk not in ("phi", "sigma")}
                for k, (_, m) in refs.items()},
       "sweep": [{"eta": e, "seed": s,
                  **{kk: vv for kk, vv in m.items() if kk not in ("phi", "sigma")}}
                 for (e, s, m) in sweep]}
with open("results_A.json", "w") as f:
    json.dump(out, f, indent=2)
print("wrote results_A.json", flush=True)
