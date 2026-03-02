export function rowToJson(row, jsonFields) {
  if (!row) return null;
  const copy = { ...row };
  for (const field of jsonFields) {
    if (copy[field] && typeof copy[field] === "string") {
      copy[field] = JSON.parse(copy[field]);
    }
  }
  return copy;
}
