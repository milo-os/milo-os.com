# Datum Cloud deployment for milo-os.com

Kustomize program that deploys the milo-os.com website as a Datum Cloud compute
`Workload` (`compute.datumapis.com/v1alpha`) on the general-purpose runtime. The
Workload imports the GitHub App credentials from a Secret **by reference only**.
It mirrors the live workload `milo-os-com` in `datum-cloud`; CI
(`.github/workflows/deploy-datum.yml`) deploys with `datumctl compute deploy`
flags and does not use this program.

```
deploy/datum/
  base/
    kustomization.yaml
    workload.yaml
    kustomizeconfig/
      images.yaml
  overlays/
    staging/
      kustomization.yaml
  secret.example.yaml
  README.md
```

## Prerequisite: the Secret must already exist

This program does **not** create or contain any secret. It expects a Secret
named `milo-os-com-secrets` to **already exist** in the target project's
`default` namespace, with keys `APP_ID`, `APP_INSTALLATION_ID`, and
`APP_PRIVATE_KEY`. The Workload imports every key of the Secret as environment
variables with `envFrom`.

Create the Secret from your secret manager (Vault, 1Password, SOPS, External
Secrets Operator, ...) before deploying. `secret.example.yaml` is a template you
can fill in — it is documentation only and is intentionally **not** part of any
kustomization:

```sh
# fill in real values first — never commit them
datumctl apply -f deploy/datum/secret.example.yaml
```

The platform's referenced-data resolver propagates the Secret to the POP cell
running the Instance; the WorkloadDeployment surfaces a `ReferencedDataReady`
condition once propagation completes.

## Deploy

Build the overlay and deploy the Workload with `datumctl`:

```sh
kustomize build deploy/datum/overlays/staging | datumctl compute deploy -f - -y
```

`compute deploy` watches the rollout and prints live progress until the new
Instance is ready. Alternatively, apply the overlay declaratively:

```sh
datumctl apply -k deploy/datum/overlays/staging
```

Verify the Instance:

```sh
datumctl compute instances --workload=milo-os-com
```

## Per-environment knobs (overlay)

Each overlay pins:

- **Image tag** — via the `images:` transformer. The Workload's image lives at
  the non-standard CRD path `spec/template/spec/runtime/sandbox/containers[]/image`,
  so `base/kustomizeconfig/images.yaml` registers a FieldSpec teaching the
  built-in transformer to find it on `kind: Workload`.

## Secrets are not part of this program

By design, no secret values are stored or generated here. There is no
`secretGenerator` and the Secret is never listed in `resources`. The Workload
only references an externally-managed Secret by name.
