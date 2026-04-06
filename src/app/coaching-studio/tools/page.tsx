import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioToolsPage() {
  const toolsLabel = config.landingContent?.displayLabels?.tools ?? "Tools";

  return (
    <main style={{ padding: "40px" }}>
      <h1>{toolsLabel}</h1>
      <p>This is a placeholder page for the {toolsLabel}.</p>
    </main>
  );
}
