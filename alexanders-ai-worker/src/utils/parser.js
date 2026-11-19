export function parseMarkdownKb(markdown) {
  if (!markdown || typeof markdown !== "string") {
    throw new Error("Markdown content must be a non-empty string.");
  }

  const normalized = markdown.replace(/\r\n/g, "\n");
  const firstHeading = normalized.match(/^##\s+/m);
  if (!firstHeading) {
    throw new Error("No '## ' sections found in Markdown document.");
  }

  // Split on level-2 headings (## ...) starting from the first heading so any preamble is ignored
  const rawBlocks = normalized
    .slice(firstHeading.index)
    .split(/^##\s+/m)
    .map((b) => b.trim())
    .filter(Boolean);

  const sectionsMap = {};
  const indexLines = [];
  let autoCounter = 1;

  for (const block of rawBlocks) {
    const firstNewline = block.indexOf("\n");
    const headerLine = (firstNewline === -1 ? block : block.slice(0, firstNewline)).trim();
    const body = (firstNewline === -1 ? "" : block.slice(firstNewline + 1)).trim();

    if (!headerLine) continue;

    // Match optional explicit ID like "[SEC_01] Title"
    const explicitMatch = headerLine.match(/^\[([A-Z0-9_-]+)\]\s*(.+)$/i);
    let id;
    let title;

    if (explicitMatch) {
      id = explicitMatch[1].toUpperCase();
      title = explicitMatch[2].trim();
    } else {
      id = `SEC_${String(autoCounter).padStart(2, "0")}`;
      title = headerLine;
    }
    autoCounter++;

    sectionsMap[id] = `[${id}] ${title}:\n${body}`;
    indexLines.push(`${id}: ${title}`);
  }

  if (indexLines.length === 0) {
    throw new Error("No '## ' sections found in Markdown document.");
  }

  return {
    indexText: indexLines.join("\n"),
    sectionsMap,
    sectionCount: indexLines.length,
  };
}
