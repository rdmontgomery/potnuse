// Derive for Module 11. Prose-heavy module on the mapping between
// statistical-physics concepts and tonal music. No interactive — the
// physics analogy is itself the work this block does, and the
// surrounding Behold + Operate components carry the empirical
// demonstrations.

export default function Module11Derive() {
  return (
    <div className="m11-derive">
      <table className="m11-mapping-table">
        <thead>
          <tr>
            <th>physics</th>
            <th>tonal music</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>order parameter</td>
            <td>the inferred-key vector (which tonic the system is locked onto)</td>
          </tr>
          <tr>
            <td>thermal fluctuation</td>
            <td>chromatic notes that don't fit the current key context</td>
          </tr>
          <tr>
            <td>temperature</td>
            <td>density of out-of-key notes per unit time</td>
          </tr>
          <tr>
            <td>phase transition</td>
            <td>modulation — the order parameter rotates to a new tonic</td>
          </tr>
          <tr>
            <td>critical point</td>
            <td>ambiguous tonality — multiple keys correlate equally well</td>
          </tr>
          <tr>
            <td>symmetry breaking</td>
            <td>cadential resolution — the system commits to a tonic</td>
          </tr>
        </tbody>
      </table>
      <p className="m11-derive-caption">
        Tonality isn't a fact; it's a <em>phase</em>. The same set of
        pitches can support several different orderings, and which one
        the music settles into is the order parameter. Modulation —
        the move from one key to another — is the same kind of event
        as a magnetic domain flipping or water boiling: a system
        relaxing to a new ground state under driving forces.
      </p>
    </div>
  );
}
