# Kodro Prove report

Overall deterministic verdict: **PASS**

Kinematic simulation evidence only. This does not validate or certify physical performance or safety.

Engine: `kodro-python-rover` version `2.0.0`
Engine source SHA-256: `1f6ea92dbd57bfd393dbf6be9c448507d299ee7df47ef53ab303597963a204ae`
Seed root: `4046`

| Contract | Runs passed | Mean distance | Mean collisions | Mean battery | Verdict |
|---|---:|---:|---:|---:|---|
| Straight transit | 5/5 | 3.000 m | 0.000 | 89.97% | PASS |
| Controlled corner | 5/5 | 4.000 m | 0.000 | 89.58% | PASS |
| Obstacle clearance | 5/5 | 4.000 m | 0.000 | 88.24% | PASS |
| Battery reserve | 5/5 | 4.000 m | 0.000 | 59.81% | PASS |

## Interpretation boundary

A pass means the controller met the declared criteria for the recorded seeds and perturbations in this kinematic engine. It is not evidence of real-world equivalence, electrical safety, mechanical safety or fitness for deployment.
