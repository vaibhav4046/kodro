# EarthProof methodology

## Purpose

EarthProof extends Kodro's existing **Design -> Prove -> Build** evidence loop with transparent environmental engineering quantities. It is designed for the NextStep 2026 Earth Forward theme without changing Kodro into a lifecycle-assessment product or making environmental claims the software cannot prove.

The central rule is simple: **measured/derived values, counterfactual scenario values, and real-world outcomes are different things and must stay different in the output.**

## Inputs

### Design evidence

- robot mass (kg)
- battery capacity (Wh)
- replaceable-component mass (kg)
- human-readable design name

### Proof-run evidence

- controlled run duration (seconds)
- average electrical power assumption or measurement (W)
- successful seeded proof runs
- total seeded proof runs

### Explicit scenario assumption

`scenario_physical_iterations_avoided` represents a user-selected counterfactual such as "compare virtual verification with two extra physical prototype iterations". It is **not** evidence that two builds were actually prevented.

## Derived quantities

Run energy is calculated exactly as:

```
run_energy_Wh = average_power_W * runtime_seconds / 3600
```

Scenario material not required is calculated as:

```
material_not_required_kg = replaceable_component_mass_kg * scenario_physical_iterations_avoided
```

This second number is labelled a scenario estimate everywhere. It is not reported as waste saved.

Proof success rate is:

```
proof_success_rate = successful_runs / total_runs
```

## Carbon policy

EarthProof has no built-in grid-emissions constant. Carbon remains `null` unless the caller explicitly supplies both:

1. an electricity factor in kg CO2e/kWh; and
2. a source label for that factor.

When supplied, the calculation covers only the modelled electricity for the controlled run:

```
run_carbon_kg_CO2e = (run_energy_Wh / 1000) * supplied_factor
```

It is **not lifecycle carbon**, embodied carbon, avoided carbon, or a product carbon footprint.

## No magic sustainability score

EarthProof deliberately does not collapse environmental quantities into a single "green score". Two designs can instead be compared on transparent quantities such as run energy and robot mass. A judge or engineer can see why one value is lower without trusting opaque weighting.

## Reproducibility

The report is canonicalised as sorted JSON and SHA-256 hashed. Identical inputs produce identical evidence and the same evidence hash. This supports Kodro's wider deterministic-proof philosophy.

## Validation and failure handling

The engine rejects:

- empty design names
- non-positive robot mass
- negative battery or component mass
- non-positive run duration
- negative power
- zero proof-run count
- successful-run counts outside `[0, total]`
- negative counterfactual iterations
- NaN and infinite numeric evidence
- a carbon factor without a source
- a carbon source without a factor

## Claims boundary

EarthProof can support these statements:

- Kodro can calculate controlled-run energy from explicit inputs.
- Kodro can compare candidate robot designs on transparent engineering quantities.
- Kodro can model a user-selected physical-prototype scenario.
- Kodro can emit deterministic, machine-readable environmental evidence.

EarthProof **cannot**, without external empirical evidence, support these statements:

- Kodro reduced real-world e-waste by X kg.
- Kodro prevented X physical prototypes.
- Kodro reduced lifecycle carbon by X kg CO2e.
- Kodro is an environmental certification or lifecycle assessment.
- Using simulation is always environmentally better than physical testing.

## NextStep contribution

This subsystem is isolated from Kodro's existing visual UI. It adds an auditable Earth Forward evidence capability while preserving the existing product and its research boundaries. The pre-existing Kodro product should be disclosed as prior work; EarthProof and its associated tests/documentation should be disclosed as the NextStep-specific contribution.
