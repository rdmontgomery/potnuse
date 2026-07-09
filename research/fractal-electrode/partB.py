"""
Part B -- inverse design of a neural electrode by topology optimization.

Setup: a single feed contact at the bottom centre (phi = 1) and a distant
return at the top (phi = 0), with electrolyte in between. We DEMAND a target
potential pattern on a tissue plane -- several separated stimulation spots --
and let an optimizer decide where to put metal, subject to a tight metal
budget (= high optical transparency).

Model (differentiable):  div( sigma(gamma) grad phi ) = 0,
   sigma(gamma) = sigma_min * (sigma_max/sigma_min) ** gamma_filt,
gamma in [0,1] is the design density. Metal emerges as the high-sigma region.

Objective:  J = 1/2 || phi_on_tissue - target ||^2.
Conduction is self-adjoint, so the gradient is exact and cheap:
   dJ/dsigma_i = -sum_{faces f at i} 0.5 (phi_a-phi_b)(lam_a-lam_b),
with K lam = P^T (P phi - target).

The question the post raised: when the physics is forced to route field to a
distributed target through a transparency budget, what does it build -- and
what is its fractal dimension?
"""
import sys, json, time
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla
from scipy.ndimage import gaussian_filter
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from lib import box_count_dim

SMOKE = "--smoke" in sys.argv

Ny = 120 if not SMOKE else 50
Nx = 168 if not SMOKE else 70
TISSUE = 22 if not SMOKE else 10           # tissue-plane row (near ground/top)
SIG_MIN, SIG_MAX = 1.0, 1.0e3
LNR = np.log(SIG_MAX / SIG_MIN)
VFRAC = 0.11                                # metal budget (fraction of design region)
FILT = 1.6                                  # density filter radius (cells)
ITERS = 160 if not SMOKE else 25
STEP = 0.18

# ---- domains --------------------------------------------------------------
ground = np.zeros((Ny, Nx), bool); ground[0, :] = True          # phi = 0
feed = np.zeros((Ny, Nx), bool)                                  # phi = 1
fw = 4 if not SMOKE else 2
feed[Ny - 3:Ny, Nx // 2 - fw:Nx // 2 + fw] = True
fixed = ground | feed
fixed_val = np.where(ground, 0.0, 0.0) + np.where(feed, 1.0, 0.0)

# design region: between tissue plane and feed; electrolyte above tissue is fixed material
design = np.zeros((Ny, Nx), bool)
design[TISSUE + 1:Ny - 3, :] = True
design &= ~feed
nd = design.sum()

# tissue target: separated Gaussian spots
xs = np.arange(Nx)
centers = [Nx * f for f in (0.22, 0.42, 0.6, 0.8)] if not SMOKE else [Nx * 0.35, Nx * 0.65]
target_line = np.zeros(Nx)
for c in centers:
    target_line += np.exp(-((xs - c) ** 2) / (2 * (4.5 if not SMOKE else 3) ** 2))
target_line *= 0.45  # peak potential to ask for on the tissue plane

# ---- index map for free nodes --------------------------------------------
free = ~fixed
free_ids = np.where(free.ravel())[0]
N = Ny * Nx
remap = -np.ones(N, np.int64); remap[free_ids] = np.arange(free_ids.size)
nf = free_ids.size


def project(gf, beta, eta=0.5):
    den = np.tanh(beta * eta) + np.tanh(beta * (1 - eta))
    return (np.tanh(beta * eta) + np.tanh(beta * (gf - eta))) / den


def dproject(gf, beta, eta=0.5):
    den = np.tanh(beta * eta) + np.tanh(beta * (1 - eta))
    return beta * (1 - np.tanh(beta * (gf - eta)) ** 2) / den


def sigma_of(gp):
    s = np.full((Ny, Nx), SIG_MIN)
    s[design] = SIG_MIN * (SIG_MAX / SIG_MIN) ** gp[design]
    return s


def assemble(sig):
    """5-point conduction matrix on free nodes; arithmetic-mean face sigma."""
    rows, cols, data = [], [], []
    b = np.zeros(nf)
    sflat = sig.ravel()
    fv = fixed_val.ravel()
    fx = fixed.ravel()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        pass
    # vectorised assembly
    idx = np.arange(N).reshape(Ny, Nx)
    diag = np.zeros(N)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        y0, y1 = max(0, -dy), Ny - max(0, dy)
        x0, x1 = max(0, -dx), Nx - max(0, dx)
        a = idx[y0:y1, x0:x1].ravel()
        nb = idx[y0 + dy:y1 + dy, x0 + dx:x1 + dx].ravel()
        gface = 0.5 * (sflat[a] + sflat[nb])
        # only equations for free 'a'
        af = remap[a]
        sel = af >= 0
        a_s, nb_s, g_s, af_s = a[sel], nb[sel], gface[sel], af[sel]
        np.add.at(diag, a_s, g_s)
        nb_free = remap[nb_s]
        m_free = nb_free >= 0
        rows.extend(af_s[m_free]); cols.extend(nb_free[m_free]); data.extend(-g_s[m_free])
        m_fix = ~m_free
        np.add.at(b, af_s[m_fix], g_s[m_fix] * fv[nb_s[m_fix]])
    rows.extend(np.arange(nf)); cols.extend(np.arange(nf)); data.extend(diag[free_ids])
    K = sp.csr_matrix((data, (rows, cols)), shape=(nf, nf))
    return K, b


def solve_full(K, b):
    sol = spla.spsolve(K, b)
    phi = fixed_val.copy().ravel()
    phi[free_ids] = sol
    return phi.reshape(Ny, Nx)


def sensitivity(sig, phi, lam):
    """dJ/dsigma per cell = -sum_faces 0.5 (phi_a-phi_b)(lam_a-lam_b)."""
    ds = np.zeros((Ny, Nx))
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        y0, y1 = max(0, -dy), Ny - max(0, dy)
        x0, x1 = max(0, -dx), Nx - max(0, dx)
        dphi = phi[y0:y1, x0:x1] - phi[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        dlam = lam[y0:y1, x0:x1] - lam[y0 + dy:y1 + dy, x0 + dx:x1 + dx]
        ds[y0:y1, x0:x1] += -0.5 * dphi * dlam
    return ds


def volume_project(g, vfrac):
    """shift+clip so mean over design region == vfrac."""
    lo, hi = -1.0, 1.0
    for _ in range(60):
        c = 0.5 * (lo + hi)
        gv = np.clip(g + c, 0, 1)
        if gv[design].mean() > vfrac:
            hi = c
        else:
            lo = c
    return np.clip(g + 0.5 * (lo + hi), 0, 1)


# ---- optimization loop ----------------------------------------------------
gamma = np.zeros((Ny, Nx)); gamma[design] = VFRAC
P_rows = TISSUE
hist = []
t0 = time.time()
for it in range(ITERS):
    beta = min(8.0, 1.0 + it / 18.0)             # Heaviside continuation
    gf = gaussian_filter(gamma, FILT)
    gp = project(gf, beta) * design              # filtered + projected density
    sig = sigma_of(gp)
    K, b = assemble(sig)
    phi = solve_full(K, b)
    resid = phi[P_rows, :] - target_line
    J = 0.5 * float((resid ** 2).sum())
    # adjoint rhs: P^T resid  (only tissue-row free nodes)
    adj_full = np.zeros((Ny, Nx)); adj_full[P_rows, :] = resid
    rhs = adj_full.ravel()[free_ids]
    lam_sol = spla.spsolve(K, rhs)       # K symmetric
    lam = np.zeros(N); lam[free_ids] = lam_sol; lam = lam.reshape(Ny, Nx)
    dJ_dsig = sensitivity(sig, phi, lam)
    grad = dJ_dsig * (sig * LNR)         # dJ/dgp
    grad = grad * dproject(gf, beta)     # chain through projection
    grad = gaussian_filter(grad, FILT) * design   # chain through filter (self-adjoint)
    gnorm = np.abs(grad[design]).max() + 1e-12
    gamma = gamma - (STEP / gnorm) * grad
    gamma = volume_project(gamma, VFRAC)
    hist.append(J)
    if it % (20 if not SMOKE else 5) == 0 or it == ITERS - 1:
        print(f"  it {it:3d}  beta={beta:.1f}  J={J:.5e}  "
              f"cov={gp[design].mean():.3f}  t={time.time()-t0:.1f}s", flush=True)

beta = 8.0
gf = gaussian_filter(gamma, FILT)
gp = project(gf, beta) * design
sig = sigma_of(gp)
phi = solve_full(*assemble(sig))
final_line = phi[P_rows, :].copy()

# emergent electrode = thresholded metal
metal = (gp > 0.5) & design
Dhat = box_count_dim(metal) if metal.sum() > 5 else float("nan")
cov = gp[design].mean()
print(f"\nfinal: J={hist[-1]:.4e}  coverage={cov:.3f}  "
      f"metal_cells={int(metal.sum())}  D(threshold)={Dhat:.2f}", flush=True)

# ====================== FIGURES ===========================================
BG = "#1a1207"
fig, ax = plt.subplots(2, 2, figsize=(12, 8.5))
fig.patch.set_facecolor(BG)
for a in ax.ravel():
    a.set_facecolor("#241a0c")
    a.tick_params(colors="#9e8e72")
    for s in a.spines.values():
        s.set_color("#3d2e1a")

# (1) emergent design (density)
im = ax[0, 0].imshow(gp, cmap="inferno", origin="upper")
ax[0, 0].axhline(TISSUE, color="#8fd6ff", lw=1, ls=":")
ax[0, 0].set_title("emergent electrode (optimised metal density)", color="#f0e6d2")
ax[0, 0].text(2, TISSUE - 2, "tissue plane", color="#8fd6ff", fontsize=8)

# (2) potential field
im2 = ax[0, 1].imshow(phi, cmap="magma", origin="upper")
ax[0, 1].contour(phi, levels=10, colors="#3d2e1a", linewidths=0.4)
ax[0, 1].axhline(TISSUE, color="#8fd6ff", lw=1, ls=":")
ax[0, 1].set_title("resulting potential field", color="#f0e6d2")

# (3) target vs achieved on tissue plane
ax[1, 0].plot(target_line, color="#e8a838", lw=2, label="target")
ax[1, 0].plot(final_line, color="#8fd6ff", lw=1.6, ls="--", label="achieved")
ax[1, 0].set_title("potential on the tissue plane", color="#f0e6d2")
ax[1, 0].set_xlabel("x (cells)", color="#f0e6d2")
ax[1, 0].legend(facecolor="#241a0c", edgecolor="#3d2e1a", labelcolor="#9e8e72")

# (4) convergence
ax[1, 1].semilogy(hist, color="#ffd984", lw=1.8)
ax[1, 1].set_title("objective (log)", color="#f0e6d2")
ax[1, 1].set_xlabel("iteration", color="#f0e6d2")

fig.suptitle(f"inverse-designed electrode  -  coverage {cov*100:.0f}%   "
             f"box-counting D = {Dhat:.2f}", color="#e8a838", fontsize=14)
fig.tight_layout()
fig.savefig("figs/B1_inverse_design.png", dpi=130, facecolor=BG, bbox_inches="tight")
print("wrote figs/B1_inverse_design.png", flush=True)

json.dump({"J": hist, "coverage": cov, "D": Dhat,
           "metal_cells": int(metal.sum()), "vfrac": VFRAC,
           "centers": [float(c) for c in centers]},
          open("results_B.json", "w"), indent=2)
print("wrote results_B.json", flush=True)
