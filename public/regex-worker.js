self.onmessage = ({ data: { pattern, flags, text } }) => {
  try {
    const regex = new RegExp(pattern, flags);
    const matches = [];
    const found = regex.global ? text.matchAll(regex) : [regex.exec(text)].filter(Boolean);
    for (const item of found) {
      if (matches.length === 2000) {
        self.postMessage({ matches, capped: true });
        return;
      }
      matches.push({ match: item[0], index: item.index, groups: item.slice(1) });
    }
    self.postMessage({ matches, capped: false });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Could not test the pattern." });
  }
};
