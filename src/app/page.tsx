import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TENANT_CONFIGS } from "@/tenants";
import { resolveTenantByHost } from "@/lib/tenant/routing";

export default async function Home() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const tenant = resolveTenantByHost(host);

  if (tenant) {
    redirect(`/${tenant.id}`);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}>
      <section style={{ width: "100%", maxWidth: 720, border: "1px solid #d5dde8", borderRadius: 14, padding: 24 }}>
        <h1 style={{ marginTop: 0 }}>StudioVerse</h1>
        <p style={{ marginBottom: 12 }}>
          Domain entrypoint is enabled. If a mapped tenant domain is used, this route redirects automatically to that tenant context.
        </p>
        <p style={{ marginTop: 0, marginBottom: 8 }}>Available tenant contexts:</p>
        <ul style={{ marginTop: 0 }}>
          {TENANT_CONFIGS.map((item) => (
            <li key={item.id}>
              <Link href={`/${item.id}`}>{item.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}