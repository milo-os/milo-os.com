# Release

This service is deployable within a Kubernetes environment and depends on the
Gateway API to expose the application to the world. The base configuration also
includes an Envoy Gateway traffic policy, so the cluster needs Envoy Gateway
installed.

We also use Datum Cloud's edge as our proxy to get traffic from the internet
edge back to our service.

## Deployment Configurations

The `config` directory contains the application deployment configuration for the
service. The `config/base` directory contains the application deployment
configuration that can be used to deploy the application to a cluster and expose
it from the cluster using the Gateway API. The `config/gateway` directory
contains the Datum Cloud gateway configuration to proxy traffic from Datum
Cloud's edge to our cluster.

## Deployment Steps

> [!NOTE]
> It's highly recommended to use a system like Flux to automatically apply
> deployment configurations to an environment.

### Application Deployment

The application can be deployed to a Kubernetes cluster by running the following
command with the cluster set as the current context.

```shell
kubectl apply -k config/base
```

### Datum Cloud Configuration

The Datum Cloud configuration can be updated by using `datumctl` to generate a
kubeconfig to use to apply manifests to Datum Cloud.

```shell
datumctl auth update-kubeconfig --project <project-name> --kubeconfig datumcfg
```

Then you can use kubectl to apply the changes to Datum Cloud.

```shell
kubectl apply -k config/gateway --kubeconfig datumcfg -n milo-os-com
```
