## Problem and change

What triggered this, how behavior changes, and the scope. Name the spec step (S0…S7) if this PR is one.

## Doc sync

Which owner docs changed (design, spec, status, assets, development, acceptance)? If none needed to, say why. Behavior changes to a product skill, system-prompt section or tool description count as behavior, not docs.

## Verification

Commit, platform, commands, results and anything skipped. Keep local and CI separate. A green CI run is not a gate (except G1).

## Gate

Which gate covers this change, and was it run on the Windows machine? Link the run record in `docs/acceptance/G<n>.md` (commit, DSH version, installed `.tgz` hashes, what was seen). If it wasn't run, say why and what remains. NC output is a candidate for human review, never a manufacturing result.

## Open-source boundary

- [ ] No STEP/MCAM/PST/NC files, NX scripts, SDK files, logs, screenshots or session exports
- [ ] No machine names, addresses, keys or Drive/rclone config; assets referred to by logical id
