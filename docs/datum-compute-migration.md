# Move milo-os.com to Datum Compute

**Status:** plan. Nothing in this document has been applied. Everything under
[Where things are today](#where-things-are-today) was read from the live
`datum-cloud` project on 2026-10-20. Steps marked **untested** have not been
tried.

Goal: `milo-os.com` and `www.milo-os.com` are served by a workload on Datum
Compute instead of the Kubernetes production cluster. DNS stays in the zone
`milo-os-com-28ke6x` and the domain stays verified in Datum.

## Where things are today

```text
visitor -> www.milo-os.com
  -> CNAME chat-spot-v3mst.datumproxy.net            (Datum edge, anycast)
  -> Gateway milo-os-com-proxy, namespace milo-os-com (project datum-cloud)
  -> HTTPRoute milo-os-com-http-route
       URLRewrite Host: milo-os-com.prod.env.datum.net
  -> EndpointSlice milo-os-com (FQDN, port 443)
  -> milo-os-com.prod.env.datum.net -> 34.48.170.137   (Kubernetes production)

visitor -> milo-os.com  (A/AAAA to the same anycast addresses)
  -> Gateway listener for milo-os.com
  -> HTTPRoute milo-os-com-redirect -> 301 https://www.milo-os.com
```

| Item         | Value                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain       | `milo-os.com`, verified in Datum                                                                                                                                 |
| DNS zone     | `milo-os-com-28ke6x` (Datum DNS, nameservers `ns1`-`ns4.datumdomains.net`)                                                                                       |
| Apex records | `A 67.14.164.1`, `A 67.14.165.1`, `AAAA 2607:ed40:20::1`, `AAAA 2607:ed40:10::1`, TTL 60                                                                         |
| `www` record | `CNAME chat-spot-v3mst.datumproxy.net.`, TTL 60                                                                                                                  |
| Gateway      | `milo-os-com-proxy`, namespace `milo-os-com`, 6 listeners (apex and `www` on 80 and 443, plus the platform hostname)                                             |
| Origin       | `milo-os-com.prod.env.datum.net`, a record in **Google Cloud DNS** (delegated from `prod.env`), the Kubernetes production gateway shared with other sites        |
| Compute      | Workload `milo-os-com` (namespace `default`), general-purpose, image `ghcr.io/milo-os/milo-os-com:<tag>-compute`, URL `https://niche-thank-mktw3.datumproxy.net` |

Things to know:

- The apex uses fixed `A`/`AAAA` records to Datum's anycast edge. The edge picks
  the gateway by **hostname**, not by address, so the apex needs no DNS change
  when the origin moves. The same addresses serve `datum.net` and `cms.datum.net`.
- `milo-os-com.prod.env.datum.net` does not live in this zone. It is shared by
  every site on the production cluster. **Do not edit that record.**
- The live Gateway, HTTPRoutes and EndpointSlice carry no Flux labels and no
  apply annotation, so they were applied by hand. The manifests of record are in
  the infra repo: `provisioning/prism-migration/milo-os-com/gateway.yaml` and
  `httproutes.yaml`. The EndpointSlice is not tracked there.
- `config/gateway/` in this repo is **out of date** (it names the Gateway
  `milo-os-com-gateway`, the live one is `milo-os-com-proxy`). Do not edit it to
  change the live origin.
- DNS for this zone is under Git:
  `apps/milo-os-com/datum-cloud/dnsrecordsets.yaml` in the infra repo.
- The workload first ran on the unikernel runtime. It broke when the tag
  `v1.2.6` was overwritten by the Kubernetes image (see the Pitfalls), and on
  2026-10-22 it was destroyed and redeployed on **general-purpose**. The URL
  changed from `blend-heat-zcppf.datumproxy.net` to the one above.

## Pick a path

|               | Path A: change the origin                | Path B: move the hostnames                          |
| ------------- | ---------------------------------------- | --------------------------------------------------- |
| What changes  | Where the existing Gateway sends traffic | Which load balancer owns `milo-os.com` and `www`    |
| DNS change    | none                                     | `www` CNAME (infra PR)                              |
| Certificates  | unchanged                                | reissued, needs DNS first                           |
| Downtime      | none expected                            | HTTPS on `www` is down until the certificate issues |
| Rollback      | one patch, immediate                     | re-apply the captured objects, repoint the CNAME    |
| Gateway stays | yes, an extra hop remains                | no                                                  |
| Tested        | **untested**                             | same sequence ran on 2026-08-29 (prism move)        |

Do A first. Do B later, in a quiet hour, only if you want to retire the old
Gateway. The 2026-08-29 move to the current Gateway took under three minutes of
HTTPS downtime on `www`; see `provisioning/prism-migration/milo-os-com/README.md`
in the infra repo.

## Before either path

None of these steps touches production.

1. **Secrets.** The workload imports `milo-os-com-secrets` with `envFrom`
   (`APP_ID`, `APP_INSTALLATION_ID`, `APP_PRIVATE_KEY`, `SITE_URL`, `PORT`,
   `ASTRO_TELEMETRY_DISABLED`). The app reads the GitHub App values from
   `process.env` only, and uses them for the roadmap and changelog; both show
   real GitHub data on Compute. `CACHE_CLEAR_SECRET` (used by `/api/cache-clear`)
   is not in the Compute Secret.
2. **Image.** CI builds the image from the release tag (see _After the move_).
   Never deploy a tag that `publish.yml` also writes: `v1.2.6` was overwritten by
   the Kubernetes image and the instance could no longer start.
3. **Content parity.** The Compute build differs from production (different
   asset hashes, a `Card` island where production has `RoadmapCard`). Compare:

   ```bash
   C=niche-thank-mktw3.datumproxy.net
   IP=$(dig +short AAAA $C @1.1.1.1 | head -1)
   for p in / /roadmap/ /changelog/ /sitemap-index.xml /robots.txt; do
     a=$(curl -s -m 25 https://www.milo-os.com$p | md5 -q)
     b=$(curl -s -m 25 --resolve "$C:443:$IP" https://$C$p | md5 -q)
     echo "$p  prod=$a  compute=$b"
   done
   ```

   Hashes will differ for pages with generated asset names; open the pages and
   check the content, especially the roadmap and changelog.

4. **Capture the live objects** for rollback. Keep the file outside the repo:

   ```bash
   datumctl get gateway,httproute,endpointslice -n milo-os-com \
     --project datum-cloud -o yaml > ~/milo-os-com-capture-$(date +%Y%m%d).yaml
   ```

   This returned 1 Gateway, 2 HTTPRoutes and 1 EndpointSlice on 2026-10-20.

5. **Quota.** An HTTPProxy has its own quota that `datumctl compute quota` does
   not show:

   ```bash
   datumctl get allowancebuckets -A --project datum-cloud | grep -E "NAME|httpproxies"
   ```

   It was 20 of 25 used on 2026-10-20.

## Path A: change the origin

The Gateway, its certificates and DNS stay as they are. Only the origin changes,
from the Kubernetes gateway to the Compute workload's load balancer.

1. **Create a second EndpointSlice.** Leave `milo-os-com` untouched so rollback
   is a one-line patch. Run the first command with `--dry-run=server`, then
   without:

   ```bash
   cat <<'EOF' | datumctl apply -f - --project datum-cloud --dry-run=server
   apiVersion: discovery.k8s.io/v1
   kind: EndpointSlice
   metadata:
     name: milo-os-com-compute
     namespace: milo-os-com
   addressType: FQDN
   ports:
     - name: https
       protocol: TCP
       appProtocol: https
       port: 443
   endpoints:
     - addresses:
         - "niche-thank-mktw3.datumproxy.net"
       conditions:
         ready: true
   EOF
   ```

2. **Optional, untested: try the origin without touching `www`.** The Gateway
   also has listeners for its own platform hostname
   (`default-https`, `chat-spot-v3mst.datumproxy.net`). Attach a test HTTPRoute to
   that listener with the new EndpointSlice and the rewrite below, then request
   `https://chat-spot-v3mst.datumproxy.net/`. This checks that the Gateway can
   reach a `datumproxy.net` origin over TLS with the rewritten Host. Remove the
   test route afterwards.
3. **Switch the live route in one patch.** One patch changes both the backend and
   the Host rewrite, so there is no moment where they disagree. The `test`
   operations make it fail instead of editing the wrong value:

   ```bash
   datumctl patch httproute milo-os-com-http-route -n milo-os-com \
     --project datum-cloud --type json -p '[
     {"op":"test","path":"/spec/rules/0/backendRefs/0/name","value":"milo-os-com"},
     {"op":"test","path":"/spec/rules/0/filters/0/urlRewrite/hostname","value":"milo-os-com.prod.env.datum.net"},
     {"op":"replace","path":"/spec/rules/0/backendRefs/0/name","value":"milo-os-com-compute"},
     {"op":"replace","path":"/spec/rules/0/filters/0/urlRewrite/hostname","value":"niche-thank-mktw3.datumproxy.net"}]'
   ```

4. **Verify** for several minutes:
   - `curl -sI https://www.milo-os.com/` returns 200, and
     `curl -sI https://milo-os.com/` returns `301` to `https://www.milo-os.com/`.
   - `datumctl compute logs milo-os-com --project datum-cloud` shows the requests
     (the app logs each `GET`).
   - The roadmap and changelog still show data.
5. **Roll back** (immediate) by patching the same route back:

   ```bash
   datumctl patch httproute milo-os-com-http-route -n milo-os-com \
     --project datum-cloud --type json -p '[
     {"op":"replace","path":"/spec/rules/0/backendRefs/0/name","value":"milo-os-com"},
     {"op":"replace","path":"/spec/rules/0/filters/0/urlRewrite/hostname","value":"milo-os-com.prod.env.datum.net"}]'
   ```

6. **Make Git match the live state.** In the infra repo, update
   `provisioning/prism-migration/milo-os-com/httproutes.yaml` (backend name and
   rewrite hostname) and add the new EndpointSlice next to it.

While on path A, Kubernetes keeps running as the fallback. Do not remove it.

## Path B: move the hostnames to Compute

Two load balancers cannot hold the same hostname, and a certificate is issued
only after DNS already points at the load balancer that serves the name. That
forces the order, and it means a short outage of HTTPS on `www`.

1. **Capture** the live objects (see above).
2. **Prepare the Compute side without hostnames yet.** The workload's load
   balancer is the `HTTPProxy` `milo-os-com` in `default`. Check that it serves on
   `niche-thank-mktw3.datumproxy.net`.
3. **Plan the apex redirect.** Today the Gateway redirects the apex to `www`.
   An `HTTPProxy` can return a `RequestRedirect` with no backend (Datum docs,
   "HTTP to HTTPS Redirect with HTTPProxy"). Create a second `HTTPProxy` for
   `milo-os.com` with a rule like this one. **Untested:** the docs example
   redirects to the same host over HTTPS; setting `hostname: www.milo-os.com` on
   `requestRedirect` follows the Gateway API but is not in the docs example.

   ```yaml
   apiVersion: networking.datumapis.com/v1alpha
   kind: HTTPProxy
   metadata:
     name: milo-os-com-apex-redirect
   spec:
     hostnames:
       - milo-os.com
     rules:
       - name: redirect-to-www
         matches:
           - path:
               type: PathPrefix
               value: /
         filters:
           - type: RequestRedirect
             requestRedirect:
               hostname: www.milo-os.com
               scheme: https
               statusCode: 301
   ```

4. **Free the hostnames:** delete `Gateway/milo-os-com-proxy` in `milo-os-com`.
   HTTPS on `www` is down from here.
5. **Attach the hostnames:** add `www.milo-os.com` to the `spec.hostnames` of the
   `milo-os-com` HTTPProxy, and apply the apex redirect proxy.
6. **Point DNS at it.** Open a PR in the infra repo that changes the `www` CNAME in
   `apps/milo-os-com/datum-cloud/dnsrecordsets.yaml` to the new load balancer's
   generated hostname. The apex records stay. Read what the platform expects from
   `datumctl get httpproxy milo-os-com -n default --project datum-cloud -o json | jq '.status.hostnameStatuses'`:
   each hostname lists the DNS record it needs, with `state: Missing` until it
   exists.
7. **Wait for the certificates**, then verify HTTPS on both names.
8. **Roll back** by re-applying the capture file. That creates a new Gateway
   with a new UID and a new `datumproxy.net` hostname, so `www` must be pointed at
   it again. It restores service, not the old address.

## Pitfalls

- **Adding a hostname that another Gateway holds breaks the proxy.** On
  2026-10-21 `www.milo-os.com` was added to the HTTPProxy of the workload while
  the Gateway `milo-os-com-proxy` still held it. The hostname showed `InUse`, the
  proxy went to `Programmed=False` (`ListenersNotValid`) and the generated URL
  answered 503, also after the hostname was removed again. Free the hostname
  first (path B), do not stage it.
- **A tag that two workflows write is not safe to deploy.** `publish.yml` pushes
  the Kubernetes image to `v1.2.6` on every release, over the image the workload
  was running. After a restart the instance failed with `ImageUnavailable`
  (`could not be pulled anonymously`), and a failed instance blocks the rollout
  because the placement is `OrderedReady`. The deploy waited until the job timed
  out. Compute images use their own `-compute` tags.

- **Do not click "Protect with ALB" on a production record in the console.** It
  creates an `HTTPProxy` for that hostname with the CNAME target as its origin. It
  stays inactive while another Gateway holds the hostname, but it counts against
  the quota and could claim the name later. Undo it with
  `datumctl delete httpproxy <name> -n default --project datum-cloud`. This
  happened on 2026-10-20.
- **Custom hostnames are unique across Datum.** A hostname held elsewhere shows
  `HostnameInUse`, and who holds it is not visible.
- **Use `--project datum-cloud` on every command.** Without it `datumctl` uses the
  active context, which can be another project. In zsh, do not keep
  `-n ... --project ...` in one unquoted variable: it is not split into words.
- **Do not edit `milo-os-com.prod.env.datum.net`.** It is shared.
- **Keep the Kubernetes publish jobs** in `.github/workflows/publish.yml` until
  Kubernetes is retired. It is the rollback target.
- `datumctl compute destroy` removes a workload's load balancer together with its
  custom hostnames.

## After the move

- CI: publishing a GitHub release starts `deploy-datum.yml` (releases are created
  by hand, as in `datum.net`). It builds the regular `Dockerfile` (`production`
  stage), pushes `ghcr.io/milo-os/milo-os-com:vX.Y.Z-compute` and runs
  `datumctl compute deploy milo-os-com --runtime-class general-purpose` in
  `datum-cloud`, with `HOST=::` and the Secret `milo-os-com-secrets` imported by
  `--env-from-secret` (the Secret must already exist). It then checks the
  workload and requests the generated URL. The deploy can also be run by hand
  from Actions, which tags the image `sha-<short sha>-compute`. The job logs in as
  a Datum service account whose credentials JSON is the `DATUM_SA_CREDENTIALS`
  secret of the `datum-compute` GitHub environment. Because the tag has the
  `-compute` suffix it never collides with the Kubernetes image that
  `publish.yml` pushes on the same release.
- Retire Kubernetes: remove the app from the infra repo, and the hostname entry
  `milo-os-com.prod.env.datum.net` in
  `infrastructure/envoy-gateway-system/gateways/external/production/kustomization.yaml`.
  Only then.
- The stray `A`/`AAAA` records named after the old prism hostname in the zone are
  a separate cleanup (see the infra README).

## Not verified

- That the Gateway accepts a `datumproxy.net` hostname as an origin with a Host
  rewrite (path A).
- Whether `requestRedirect.hostname` works on an `HTTPProxy` (path B).
