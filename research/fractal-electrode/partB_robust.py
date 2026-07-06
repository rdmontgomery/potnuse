"""Robustness of the emergent dimension: re-run the inverse design across
different numbers of target spots and metal budgets, record box-counting D
of the optimised electrode. Tests whether 'the physics picks ~neuronal D'
holds or was a one-off."""
import json, time
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla
from scipy.ndimage import gaussian_filter
from lib import box_count_dim

Ny, Nx, TISSUE = 120, 168, 22
SIG_MIN, SIG_MAX = 1.0, 1.0e3
LNR = np.log(SIG_MAX / SIG_MIN)
FILT, ITERS, STEP = 1.6, 130, 0.18

ground = np.zeros((Ny, Nx), bool); ground[0, :] = True
fixed_base = ground.copy()


def run(nspots, vfrac, seed):
    rng = np.random.default_rng(seed)
    feed = np.zeros((Ny, Nx), bool)
    feed[Ny - 3:Ny, Nx // 2 - 4:Nx // 2 + 4] = True
    fixed = fixed_base | feed
    fixed_val = np.where(feed, 1.0, 0.0)
    design = np.zeros((Ny, Nx), bool); design[TISSUE + 1:Ny - 3, :] = True; design &= ~feed
    free = ~fixed
    free_ids = np.where(free.ravel())[0]
    N = Ny * Nx
    remap = -np.ones(N, np.int64); remap[free_ids] = np.arange(free_ids.size); nf = free_ids.size

    xs = np.arange(Nx)
    centers = np.linspace(0.18, 0.82, nspots) * Nx
    target = np.zeros(Nx)
    for c in centers:
        target += np.exp(-((xs - c) ** 2) / (2 * 4.5 ** 2))
    target *= 0.4

    def sigma_of(gp):
        s = np.full((Ny, Nx), SIG_MIN); s[design] = SIG_MIN * (SIG_MAX / SIG_MIN) ** gp[design]; return s

    def project(gf, b, e=0.5):
        d = np.tanh(b * e) + np.tanh(b * (1 - e)); return (np.tanh(b * e) + np.tanh(b * (gf - e))) / d

    def dproject(gf, b, e=0.5):
        d = np.tanh(b * e) + np.tanh(b * (1 - e)); return b * (1 - np.tanh(b * (gf - e)) ** 2) / d

    def assemble(sig):
        idx = np.arange(N).reshape(Ny, Nx); diag = np.zeros(N)
        rows, cols, data = [], [], []; b = np.zeros(nf); sflat = sig.ravel(); fv = fixed_val.ravel()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            y0, y1 = max(0, -dy), Ny - max(0, dy); x0, x1 = max(0, -dx), Nx - max(0, dx)
            a = idx[y0:y1, x0:x1].ravel(); nb = idx[y0 + dy:y1 + dy, x0 + dx:x1 + dx].ravel()
            g = 0.5 * (sflat[a] + sflat[nb]); af = remap[a]; sel = af >= 0
            a_s, nb_s, g_s, af_s = a[sel], nb[sel], g[sel], af[sel]
            np.add.at(diag, a_s, g_s); nbf = remap[nb_s]; mf = nbf >= 0
            rows.extend(af_s[mf]); cols.extend(nbf[mf]); data.extend(-g_s[mf])
            mx = ~mf; np.add.at(b, af_s[mx], g_s[mx] * fv[nb_s[mx]])
        rows.extend(range(nf)); cols.extend(range(nf)); data.extend(diag[free_ids])
        return sp.csr_matrix((data, (rows, cols)), shape=(nf, nf)), b

    def solve(K, b):
        phi = fixed_val.copy().ravel(); phi[free_ids] = spla.spsolve(K, b); return phi.reshape(Ny, Nx)

    def sens(phi, lam):
        ds = np.zeros((Ny, Nx))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            y0, y1 = max(0, -dy), Ny - max(0, dy); x0, x1 = max(0, -dx), Nx - max(0, dx)
            ds[y0:y1, x0:x1] += -0.5 * (phi[y0:y1, x0:x1] - phi[y0 + dy:y1 + dy, x0 + dx:x1 + dx]) * \
                                       (lam[y0:y1, x0:x1] - lam[y0 + dy:y1 + dy, x0 + dx:x1 + dx])
        return ds

    def vproj(g, vf):
        lo, hi = -1, 1
        for _ in range(50):
            c = 0.5 * (lo + hi)
            if np.clip(g + c, 0, 1)[design].mean() > vf: hi = c
            else: lo = c
        return np.clip(g + 0.5 * (lo + hi), 0, 1)

    gamma = np.zeros((Ny, Nx)); gamma[design] = vfrac
    for it in range(ITERS):
        beta = min(8.0, 1.0 + it / 18.0)
        gf = gaussian_filter(gamma, FILT); gp = project(gf, beta) * design
        sig = sigma_of(gp); K, b = assemble(sig); phi = solve(K, b)
        resid = phi[TISSUE, :] - target
        adj = np.zeros((Ny, Nx)); adj[TISSUE, :] = resid
        lam = np.zeros(N); lam[free_ids] = spla.spsolve(K, adj.ravel()[free_ids]); lam = lam.reshape(Ny, Nx)
        grad = sens(phi, lam) * (sig * LNR) * dproject(gf, beta)
        grad = gaussian_filter(grad, FILT) * design
        gamma = vproj(gamma - (STEP / (np.abs(grad[design]).max() + 1e-12)) * grad, vfrac)
    gp = project(gaussian_filter(gamma, FILT), 8.0) * design
    metal = (gp > 0.5) & design
    return box_count_dim(metal), int(metal.sum()), gp[design].mean()


cases = [(3, 0.11), (4, 0.11), (5, 0.11), (4, 0.07), (4, 0.16)]
print("nspots vfrac ->  D     cells  cov")
res = []
t0 = time.time()
for ns, vf in cases:
    D, cells, cov = run(ns, vf, seed=1)
    res.append({"nspots": ns, "vfrac": vf, "D": D, "cells": cells, "cov": cov})
    print(f"  {ns}     {vf:.2f}    {D:.2f}   {cells:5d}  {cov:.3f}", flush=True)
print(f"total {time.time()-t0:.0f}s")
Ds = [r["D"] for r in res]
print(f"\nemergent D: mean={np.mean(Ds):.2f}  range=[{min(Ds):.2f}, {max(Ds):.2f}]")
json.dump(res, open("results_B_robust.json", "w"), indent=2)
