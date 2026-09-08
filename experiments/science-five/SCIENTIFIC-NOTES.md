# Five small laboratories

These BEACN Labs studies turn mathematical rules into instruments you can question. Each combines a visual model, controls and measurements. When embedded in an NFT, the program bytes and initial instructions remain fixed; the browser computes the changing experience. Drawing, shaking or moving a slider does not update the NFT's ledger metadata. A downloaded image records one view, not every state that produced it.

## [Entropy Oracle](source/entropy-oracle/source.html): randomness has rules

The Oracle chooses among 24 original responses. Independent mode permits any response, including the previous one. Fresh mode excludes the previous response, leaving 23 equally likely choices after the first draw. Deck mode samples without replacement; a new deck can start with the previous deck's final response. The question changes the caption, not the probabilities.

Each choice starts with browser randomness from the [W3C `getRandomValues` API](https://www.w3.org/TR/webcrypto/#Crypto-method-getRandomValues). Rejection sampling removes the incomplete remainder of the 32-bit range before selecting an index, avoiding modulo bias. This is an entertainment instrument, not a financial forecast or chain oracle.

**Experiment:** reset to Deck and draw 240 times. Ten complete decks give each response ten appearances. Compare that flat histogram with the shrinking uncertainty inside one deck: its last card is predictable. The displayed empirical entropy, `H = −Σ p log₂ p`, describes observed frequencies; the next-draw entropy describes eligible choices. These are different questions within [Claude Shannon's information theory](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf). A flat histogram does not establish independence or cryptographic security.

The remaining deck, last response and histogram live in the browser session. Reloading resets them; repeating an experiment need not repeat its random sequence.

## [Turing Garden](source/turing-garden/source.html): patterns from local chemistry

The implemented model is Gray–Scott reaction–diffusion. Two concentration fields, A and B, interact through `A + 2B → 3B`. Feed replenishes A, removal drains B, and diffusion spreads A faster than B. Repeated local changes can produce fronts, spots and branching forms. The model belongs to the family discussed by [Abelson and collaborators at MIT](https://groups.csail.mit.edu/mac/projects/amorphous/GrayScott/); the numerical stencil follows [Karl Sims's reaction–diffusion tutorial](https://www.karlsims.com/rd.html).

This study uses a 192 × 192 grid with wrapping edges: leaving one side brings a pattern to the opposite side. Forward Euler advances by one dimensionless step. The nine-point Laplacian weights are −1 at the center, 0.2 at axial neighbors and 0.05 at diagonal neighbors. Diffusion coefficients are 1 and 0.5.

**Experiment:** pause after initialization, paint one dot near a growing front, and advance in 20-step increments. Change only the feed rate and repeat from the same starting state. Observe whether the dot spreads, divides or disappears. Preset names describe possible appearances, not guaranteed destinations.

The garden is not a literal organism. Float32 grids approximate concentrations; clipping to [0,1] is counted. Initialization includes 900 warm-up steps. Its state export preserves both numeric grids and parameters, including brushwork; restoration pauses at the saved step. A PNG preserves appearance only.

## [Chaos Mirrors](source/chaos-mirrors/source.html): same laws, different futures

Two ideal double pendulums follow identical equations. Each has two 1 kg point masses on massless, rigid 1 m rods under gravity of 9.81 m/s². Only the second system's lower starting angle is perturbed. There is no friction, collision or random forcing. The equations follow [Erik Neumann's double-pendulum derivation](https://www.myphysicslab.com/pendulum/double-pendulum-en.html); classical [Runge–Kutta integration](https://www.myphysicslab.com/explain/runge-kutta-en.html) advances them at 1/480 simulated second per step.

**Experiment:** choose The butterfly, set the offset to 0.01°, and build the 24-second composition. Then repeat with Exact twins. Identical numerical starting states follow identical paths. Compare Near harmony to see that small-angle behavior can remain approximately regular; strong separation is not inevitable for every initial condition.

The graph measures distance between the lower tips, not distance in full phase space or a Lyapunov exponent. Energy drift reports numerical error, not physical dissipation. Small accumulated errors can alter long trajectories even when energy drift remains small.

Angles, velocities and finite trail history live in browser memory. Reset restores the chosen initial conditions. Use simulated time when comparing runs; display speed and slow devices can change the relationship to wall-clock time.

## [Hash Cathedral](source/hash-cathedral/source.html): one bit, many differences

SHA-256 converts message bytes into a 256-bit digest under [NIST FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final). The rose window is derived from that digest; its two outer rings compare the original input with a single-bit mutation. The grid counts the exact XOR differences. Roughly half the output bits is a statistical expectation across trials, not a requirement for an individual pair.

**Experiment:** enter a short message and step through its input bits. Record the changed-bit count each time. Bit zero is the first UTF-8 byte's most significant bit; changing it need not produce valid text. Then select a Merkle leaf, verify, tamper with a sibling and verify again against the unchanged root.

The ordered eight-leaf tree uses `H(00 || text)` for leaves and `H(01 || left || right)` for branches, with raw digest bytes. These one-byte prefixes distinguish the two roles, following [RFC 9162 §2.1](https://www.rfc-editor.org/rfc/rfc9162.html#section-2.1). Three siblings establish inclusion at a position under a chosen root; they do not authenticate the root or establish ownership.

Messages, candidate proofs and selection state are local. SHA-256 is the teaching algorithm; Cardano's ledger instead uses [Blake2b hash types](https://cardano-ledger.cardano.intersectmbo.org/cardano-ledger-core/Cardano-Ledger-Hashes.html).

## [Fourier Forge](source/fourier-forge/source.html): circles inside a drawing

A closed drawing becomes 128 samples spaced equally along its arc length, represented as complex numbers `z = x + iy`. A discrete Fourier transform decomposes them into rotating vectors. Coefficient magnitude controls circle radius; its argument controls phase. Positive and negative frequencies rotate in opposite directions. The center is the zero-frequency term.

The study uses a forward factor of `1/N` and negative exponential, then reconstructs by summing positive exponentials. Compare the sign and normalization conventions in the [FFTW authors' DFT specification](https://www.fftw.org/fftw3_doc/The-1d-Discrete-Fourier-Transform-_0028DFT_0029.html). This implementation computes the DFT directly; it does not require an FFT library.

**Experiment:** select Heart, reduce the frequency band, and find the smallest band below 1% normalized RMS error. Changing phase moves the drawing point but does not improve reconstruction error. Full bandwidth recovers the sampled points within floating-point precision, not details between them; the Nyquist frequency appears once, at −64.

Optional audio sonifies only x(t), using up to eight selected harmonics at a 110 Hz base frequency through [Web Audio's PeriodicWave](https://www.w3.org/TR/webaudio/#the-periodicwave-interface). Drawing speed does not change pitch. Drawn coordinates, coefficients and phase remain browser state.

## Reproduce the question, not just the picture

Keep the exact program version, inputs and settings. For a garden, retain its state file; for pendulums, record initial angles and simulated duration; for hashes, preserve exact bytes, bit index and root; for Fourier experiments, use the same preset and band, or retain geometry supplied to the math API. For the Oracle, compare distributions across trials rather than expecting identical sequences.

The source exposes small `window.lab` helpers for mathematical checks. Consult each study's version-specific receipts for tested behavior. Floating-point evolution, canvas rendering, audio and downloads can differ between browsers or viewers; an immutable program does not make every viewing environment identical.
