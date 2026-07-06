"""Replot Part A from results_A.json with an honest efficiency-vs-D panel."""
import json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

d = json.load(open("results_A.json"))
refs, sweep = d["refs"], d["sweep"]
BG = "#1a1207"

sq, ht = refs["solid square"], refs["h-tree"]
Ds = np.array([s["D"] for s in sweep])
cov = np.array([s["coverage"] for s in sweep]) * 100
me = np.array([s["meanE"] for s in sweep])
fpc = np.array([s["field_per_coverage"] for s in sweep])

fig, ax = plt.subplots(1, 2, figsize=(11.6, 4.7))
fig.patch.set_facecolor(BG)
for a in ax:
    a.set_facecolor("#241a0c"); a.tick_params(colors="#9e8e72")
    for s in a.spines.values():
        s.set_color("#3d2e1a")

# LEFT: trade-off plane
ax[0].scatter(cov, me, c=Ds, cmap="autumn", s=60, edgecolor="#1a1207", zorder=3, label="DBM clusters")
ax[0].scatter([sq["coverage"] * 100], [sq["meanE"]], marker="s", s=130, c="#9e8e72",
              edgecolor="#f0e6d2", zorder=4, label="solid square")
ax[0].scatter([ht["coverage"] * 100], [ht["meanE"]], marker="^", s=130, c="#e8a838",
              edgecolor="#f0e6d2", zorder=4, label="h-tree")
ax[0].annotate("same field,\n1/4 the metal", (ht["coverage"] * 100, ht["meanE"]),
               (ht["coverage"] * 100 + 12, ht["meanE"] + 0.00002),
               color="#e8a838", fontsize=9,
               arrowprops=dict(arrowstyle="->", color="#e8a838"))
ax[0].set_xlabel("metal coverage  (%)   ->   less transparent", color="#f0e6d2")
ax[0].set_ylabel("field delivered to tissue plane", color="#f0e6d2")
ax[0].set_title("the trade-off plane: fractals break it", color="#f0e6d2", fontsize=12)
ax[0].legend(facecolor="#241a0c", edgecolor="#3d2e1a", labelcolor="#9e8e72", fontsize=8, loc="center right")

# RIGHT: efficiency vs D (honest)
ax[1].axvspan(1.3, 1.45, color="#e8a838", alpha=0.10)
ax[1].axvline(1.4, color="#e8a838", ls=":", lw=1)
ax[1].axhline(sq["field_per_coverage"], color="#9e8e72", lw=1.4)
ax[1].text(1.95, sq["field_per_coverage"] * 1.15, "solid square baseline", color="#9e8e72", fontsize=8)
ax[1].scatter(Ds, fpc, c="#ffd984", s=60, edgecolor="#1a1207", zorder=3, label="DBM (eta sweep)")
ax[1].scatter([ht["D"]], [ht["field_per_coverage"]], marker="^", s=130, c="#e8a838",
              edgecolor="#f0e6d2", zorder=4, label="h-tree")
ax[1].scatter([2.0], [sq["field_per_coverage"]], marker="s", s=130, c="#9e8e72",
              edgecolor="#f0e6d2", zorder=4, label="solid (D=2)")
ax[1].set_xlabel("fractal dimension D", color="#f0e6d2")
ax[1].set_ylabel("field delivered per unit coverage", color="#f0e6d2")
ax[1].set_title("efficiency jumps when you go fractal -- then D barely matters",
                color="#f0e6d2", fontsize=11.5)
ax[1].legend(facecolor="#241a0c", edgecolor="#3d2e1a", labelcolor="#9e8e72", fontsize=8)
ax[1].set_xlim(1.25, 2.1)

fig.suptitle("a sparse fractal buys field at a fraction of the coverage  "
             "(the lever is sparsity, not a magic dimension)",
             color="#e8a838", fontsize=12.5)
fig.tight_layout()
fig.savefig("figs/A2_tradeoff.png", dpi=130, facecolor=BG, bbox_inches="tight")
print("rewrote figs/A2_tradeoff.png")
