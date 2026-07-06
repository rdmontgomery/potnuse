"""
Core library for the fractal-electrode experiment.

Physical model: quasi-static conduction in a homogeneous electrolyte,
    div( grad(phi) ) = 0      (Laplace)
with the metal electrode held at phi = 1 (an equipotential conductor),
a distant return electrode (top boundary) at phi = 0, and insulating
(Neumann) side/bottom walls representing a unit cell in an array.

The field that matters for neural stimulation lives on a "tissue plane"
a fixed gap above the electrode substrate. We read |E| and the activating
function there. The surface-charge density on the electrode is the
harmonic measure -- where the field actually concentrates.

Everything is plain numpy/scipy. The forward solve is a sparse 5-point
Laplacian; for the inverse design (partB) the same machinery is reused
with a material-interpolation (SIMP) conductivity so it is differentiable.
"""

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla


# --------------------------------------------------------------------------
# Forward solver: equipotential metal in uniform electrolyte
# --------------------------------------------------------------------------
def solve_conductor(metal, ground_row=0):
    """Solve Laplace with `metal` (bool array, Ny x Nx) held at phi=1.

    Boundary conditions:
      - top row (index ground_row, default 0) : Dirichlet phi = 0 (return)
      - metal cells                            : Dirichlet phi = 1
      - all other outer walls                  : Neumann (zero flux)

    Returns phi (Ny x Nx float).
    """
    Ny, Nx = metal.shape
    N = Ny * Nx
    idx = lambda y, x: y * Nx + x

    fixed = np.zeros((Ny, Nx), dtype=bool)
    fixed_val = np.zeros((Ny, Nx))
    fixed[metal] = True
    fixed_val[metal] = 1.0
    fixed[ground_row, :] = True
    fixed_val[ground_row, :] = 0.0

    free = ~fixed
    free_ids = np.where(free.ravel())[0]
    remap = -np.ones(N, dtype=np.int64)
    remap[free_ids] = np.arange(free_ids.size)

    rows, cols, data = [], [], []
    b = np.zeros(free_ids.size)

    for k, gid in enumerate(free_ids):
        y, x = divmod(gid, Nx)
        diag = 0.0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= Ny or nx < 0 or nx >= Nx:
                continue  # Neumann wall: no flux, skip (contributes 0)
            diag += 1.0
            nb = idx(ny, nx)
            if fixed.ravel()[nb]:
                b[k] += fixed_val.ravel()[nb]
            else:
                rows.append(k)
                cols.append(remap[nb])
                data.append(-1.0)
        rows.append(k)
        cols.append(k)
        data.append(diag)

    A = sp.csr_matrix((data, (rows, cols)), shape=(free_ids.size, free_ids.size))
    sol = spla.spsolve(A, b)

    phi = fixed_val.copy().ravel()
    phi[free_ids] = sol
    return phi.reshape(Ny, Nx)


def harmonic_measure(phi, metal):
    """Surface-charge density per metal-boundary cell ~ sum of (phi_metal - phi_nb)
    over electrolyte neighbours. This is the discrete normal field = harmonic measure.
    Returns array (Ny x Nx); zero off the boundary."""
    Ny, Nx = metal.shape
    sigma = np.zeros((Ny, Nx))
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny0, ny1 = max(0, -dy), Ny - max(0, dy)
        nx0, nx1 = max(0, -dx), Nx - max(0, dx)
        m = metal[ny0:ny1, nx0:nx1]
        nb_phi = phi[ny0 + dy:ny1 + dy, nx0 + dx:nx1 + dx]
        nb_metal = metal[ny0 + dy:ny1 + dy, nx0 + dx:nx1 + dx]
        contrib = np.where(m & ~nb_metal, 1.0 - nb_phi, 0.0)
        sigma[ny0:ny1, nx0:nx1] += contrib
    return sigma


def tissue_field(phi, tissue_row):
    """Return (Ey, Emag, activating_function) along the tissue plane row."""
    Ey = -(phi[tissue_row + 1, :] - phi[tissue_row - 1, :]) / 2.0
    Ex = -(np.gradient(phi[tissue_row, :]))
    Emag = np.hypot(Ex, Ey)
    af = np.gradient(np.gradient(phi[tissue_row, :]))  # d2phi/dx2
    return Ey, Emag, af


# --------------------------------------------------------------------------
# Geometry generators (all rasterised onto an Ny x Nx grid)
# --------------------------------------------------------------------------
def make_square(Ny, Nx, area_cells, base_row):
    """A solid square electrode of ~area_cells, sitting with its base at base_row."""
    side = int(round(np.sqrt(area_cells)))
    m = np.zeros((Ny, Nx), dtype=bool)
    cx = Nx // 2
    x0 = cx - side // 2
    y1 = base_row
    y0 = base_row - side
    m[max(0, y0):y1, max(0, x0):x0 + side] = True
    return m


def make_htree(Ny, Nx, order, span, cy, cx, thickness=1):
    """Rasterise an H-tree of given order centred at (cy, cx)."""
    m = np.zeros((Ny, Nx), dtype=bool)

    def seg(y1, x1, y2, x2):
        n = int(max(abs(y2 - y1), abs(x2 - x1))) + 1
        ys = np.linspace(y1, y2, n).round().astype(int)
        xs = np.linspace(x1, x2, n).round().astype(int)
        for yy, xx in zip(ys, xs):
            for ty in range(-thickness // 2, thickness // 2 + 1):
                for tx in range(-thickness // 2, thickness // 2 + 1):
                    yi, xi = yy + ty, xx + tx
                    if 0 <= yi < Ny and 0 <= xi < Nx:
                        m[yi, xi] = True

    def rec(x, y, length, depth, horiz):
        if depth > order:
            return
        if horiz:
            x1, x2 = x - length / 2, x + length / 2
            seg(y, x1, y, x2)
            nl = length / np.sqrt(2)
            rec(x1, y, nl, depth + 1, False)
            rec(x2, y, nl, depth + 1, False)
        else:
            y1, y2 = y - length / 2, y + length / 2
            seg(y1, x, y2, x)
            nl = length / np.sqrt(2)
            rec(x, y1, nl, depth + 1, True)
            rec(x, y2, nl, depth + 1, True)

    # note: rec uses (x, y, ...) but seg takes (y, x) -- wrap
    def rec2(cx, cy, length, depth, horiz):
        if depth > order:
            return
        if horiz:
            x1, x2 = cx - length / 2, cx + length / 2
            seg(cy, x1, cy, x2)
            nl = length / np.sqrt(2)
            rec2(x1, cy, nl, depth + 1, False)
            rec2(x2, cy, nl, depth + 1, False)
        else:
            y1, y2 = cy - length / 2, cy + length / 2
            seg(y1, cx, y2, cx)
            nl = length / np.sqrt(2)
            rec2(cx, y1, nl, depth + 1, True)
            rec2(cx, y2, nl, depth + 1, True)

    rec2(cx, cy, span, 1, True)
    return m


def grow_dbm(grid=121, n_cells=420, eta=1.0, seed=0, target_radius=None, verbose=False):
    """Dielectric-breakdown model on a lattice. Growth probability on each
    empty perimeter site ~ phi^eta, where phi solves Laplace with the cluster
    at phi=1 and a circular far boundary at phi=0.

    eta = 0  -> Eden-like, compact, D -> 2
    eta = 1  -> classic DLA, D ~ 1.7
    eta large-> sparse, dendritic, D -> 1

    Returns the cluster as a bool array (grid x grid).
    """
    rng = np.random.default_rng(seed)
    c = grid // 2
    occ = np.zeros((grid, grid), dtype=bool)
    occ[c, c] = True
    R = float(grid // 2 - 2)

    def laplace_outside(occ, Rb):
        """Solve Laplace: occ cells phi=1, cells outside radius Rb phi=0,
        elsewhere free. Crude but cheap full solve each step is too slow;
        instead we relax only when needed. Use a sparse solve on the disk."""
        yy, xx = np.mgrid[0:grid, 0:grid]
        r = np.hypot(yy - c, xx - c)
        outside = r > Rb
        fixed = occ | outside
        free = ~fixed
        ids = np.where(free.ravel())[0]
        if ids.size == 0:
            return np.where(occ, 1.0, 0.0)
        remap = -np.ones(grid * grid, dtype=np.int64)
        remap[ids] = np.arange(ids.size)
        rows, cols, data = [], [], []
        b = np.zeros(ids.size)
        occf = occ.ravel()
        for k, gid in enumerate(ids):
            y, x = divmod(gid, grid)
            diag = 0.0
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if ny < 0 or ny >= grid or nx < 0 or nx >= grid:
                    continue
                diag += 1.0
                nb = ny * grid + nx
                if fixed.ravel()[nb]:
                    if occf[nb]:
                        b[k] += 1.0
                    # outside -> 0
                else:
                    rows.append(k); cols.append(remap[nb]); data.append(-1.0)
            rows.append(k); cols.append(k); data.append(diag)
        A = sp.csr_matrix((data, (rows, cols)), shape=(ids.size, ids.size))
        sol = spla.spsolve(A, b)
        phi = np.where(occ, 1.0, 0.0).ravel()
        phi[ids] = sol
        return phi.reshape(grid, grid)

    maxr = 1.0
    def keep_going():
        if target_radius is not None:
            return maxr < target_radius and occ.sum() < n_cells
        return occ.sum() < n_cells
    while keep_going():
        Rb = min(maxr + 6, R)
        phi = laplace_outside(occ, Rb)
        # perimeter empty sites adjacent to cluster
        peri = np.zeros((grid, grid), dtype=bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.zeros_like(occ)
            ys, xs = np.where(occ)
            ny, nx = ys + dy, xs + dx
            ok = (ny >= 0) & (ny < grid) & (nx >= 0) & (nx < grid)
            sh[ny[ok], nx[ok]] = True
            peri |= sh & ~occ
        py, px = np.where(peri)
        if py.size == 0:
            break
        # local field at perimeter ~ phi of that empty cell (it's between 0 and 1)
        f = np.clip(phi[py, px], 1e-9, None)
        w = f ** eta
        w = w / w.sum()
        pick = rng.choice(py.size, p=w)
        occ[py[pick], px[pick]] = True
        maxr = max(maxr, np.hypot(py[pick] - c, px[pick] - c))
    return occ


# --------------------------------------------------------------------------
# Box-counting fractal dimension
# --------------------------------------------------------------------------
def box_count_dim(mask):
    """Estimate fractal dimension by box counting on a bool mask."""
    pts = np.argwhere(mask)
    if pts.shape[0] < 5:
        return float("nan")
    pts = pts - pts.min(0)
    size = pts.max() + 1
    sizes = []
    counts = []
    s = 1
    while s < size:
        boxes = set()
        for p in pts:
            boxes.add((p[0] // s, p[1] // s))
        sizes.append(s)
        counts.append(len(boxes))
        s *= 2
    sizes = np.array(sizes, float)
    counts = np.array(counts, float)
    if len(sizes) < 2:
        return float("nan")
    coef = np.polyfit(np.log(1 / sizes), np.log(counts), 1)
    return coef[0]
